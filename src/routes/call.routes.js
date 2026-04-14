/**
 * Video Call Routes (Agora RTC)
 * POST /api/v1/calls/token  — generate Agora RTC token
 * POST /api/v1/calls/initiate — initiate a call (signals the other user via socket)
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { Match } = require('../models');
const { generateAgoraToken } = require('../utils/agora');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

/**
 * POST /api/v1/calls/token
 * Body: { matchId }
 * Returns: { appId, channel, token, uid }
 */
router.post('/token',
  [
    body('matchId').isMongoId().withMessage('Invalid match ID'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { matchId } = req.body;

      // Verify match exists and user is part of it
      const match = await Match.findOne({
        _id: matchId,
        users: req.userId,
        unmatched: false,
      });

      if (!match) {
        return res.status(404).json({ error: 'Match not found' });
      }

      // Use matchId as channel name for unique 1-on-1 call
      const channel = matchId;
      // Generate a numeric UID from userId (Agora requires a uint32)
      const uid = parseInt(req.userId.toString().slice(-8), 16) % 2147483647;
      const token = generateAgoraToken(channel, uid, 'publisher', 3600);

      res.json({
        appId: process.env.AGORA_APP_ID || 'dev-agora-app-id',
        channel,
        token,
        uid,
        expiresIn: 3600,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/calls/initiate
 * Body: { matchId }
 * Signals the other user via socket.io to show incoming call UI
 */
router.post('/initiate',
  [
    body('matchId').isMongoId().withMessage('Invalid match ID'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { matchId } = req.body;

      const match = await Match.findOne({
        _id: matchId,
        users: req.userId,
        unmatched: false,
      }).populate('users', 'firstName photos');

      if (!match) {
        return res.status(404).json({ error: 'Match not found' });
      }

      const caller = match.users.find(u => u._id.toString() === req.userId.toString());
      const otherUser = match.users.find(u => u._id.toString() !== req.userId.toString());
      const callId = uuidv4();

      // Signal the other user via socket.io
      const io = req.app.get('io');
      io.to(`user:${otherUser._id}`).emit('incoming_call', {
        callId,
        matchId,
        caller: {
          id: caller._id,
          firstName: caller.firstName,
          photo: caller.photos?.[0]?.url || null,
        },
      });

      res.json({
        callId,
        channel: matchId,
        message: 'Call initiated',
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
