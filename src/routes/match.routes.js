const express = require('express');
const { param, validationResult } = require('express-validator');
const { Match, Message } = require('../models');

const router = express.Router();

// GET /api/v1/matches - Get all matches
router.get('/', async (req, res, next) => {
  try {
    const matches = await Match.find({
      users: req.userId,
      unmatched: false,
    })
      .populate('users', 'firstName lastName photos isOnline lastActive')
      .populate('lastMessage')
      .sort({ lastMessageAt: -1, matchedAt: -1 });
    
    const formattedMatches = matches.map(match => {
      const otherUser = match.users.find(
        u => u._id.toString() !== req.userId.toString()
      );
      
      return {
        id: match._id,
        user: otherUser ? {
          id: otherUser._id,
          firstName: otherUser.firstName,
          lastName: otherUser.lastName,
          photos: otherUser.photos ?? [],
          isOnline: otherUser.isOnline,
          lastActive: otherUser.lastActive,
        } : null,
        matchedAt: match.matchedAt,
        isSuperLike: match.isSuperLike,
        lastMessage: match.lastMessage ? {
          id: match.lastMessage._id,
          content: match.lastMessage.content,
          senderId: match.lastMessage.sender,
          createdAt: match.lastMessage.createdAt,
          read: match.lastMessage.read,
        } : null,
        lastMessageAt: match.lastMessageAt,
        hasUnread: match.lastMessage 
          ? !match.lastMessage.read && 
            match.lastMessage.sender.toString() !== req.userId.toString()
          : false,
      };
    });
    
    // Separate new matches (no messages) from conversations
    const newMatches = formattedMatches.filter(m => !m.lastMessage);
    const conversations = formattedMatches.filter(m => m.lastMessage);
    
    res.json({ 
      newMatches,
      conversations,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/matches/:matchId - Get match details
router.get('/:matchId',
  [
    param('matchId').isMongoId(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const match = await Match.findOne({
        _id: req.params.matchId,
        users: req.userId,
        unmatched: false,
      }).populate('users', '-refreshToken -blockedUsers');
      
      if (!match) {
        return res.status(404).json({ error: 'Match not found' });
      }
      
      const otherUser = match.users.find(
        u => u._id.toString() !== req.userId.toString()
      );
      
      res.json({
        match: {
          id: match._id,
          user: otherUser?.toPublicProfile(),
          matchedAt: match.matchedAt,
          isSuperLike: match.isSuperLike,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/v1/matches/:matchId - Unmatch
router.delete('/:matchId',
  [
    param('matchId').isMongoId(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const match = await Match.findOne({
        _id: req.params.matchId,
        users: req.userId,
        unmatched: false,
      });
      
      if (!match) {
        return res.status(404).json({ error: 'Match not found' });
      }
      
      match.unmatched = true;
      match.unmatchedAt = new Date();
      match.unmatchedBy = req.userId;
      await match.save();
      
      // Notify other user via socket
      const otherUserId = match.users.find(
        u => u.toString() !== req.userId.toString()
      );
      
      const io = req.app.get('io');
      io.to(`user:${otherUserId}`).emit('unmatched', {
        matchId: match._id,
      });
      
      res.json({ message: 'Unmatched successfully' });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
