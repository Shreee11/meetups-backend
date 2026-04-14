const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const sanitizeHtml = require('sanitize-html');
const { Match, Message, User } = require('../models');
const { messageLimiter } = require('../middleware/rateLimiter');
const upload = require('../middleware/upload');
const cloudinary = require('../utils/cloudinary');
const { sendAndSaveNotification } = require('../utils/firebase');

const router = express.Router();

// GET /api/v1/messages/:matchId - Get messages for a match
router.get('/:matchId',
  [
    param('matchId').isMongoId(),
    query('before').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { matchId } = req.params;
      const { before, limit = 50 } = req.query;
      
      // Verify match exists and user is part of it
      const match = await Match.findOne({
        _id: matchId,
        users: req.userId,
        unmatched: false,
      });
      
      if (!match) {
        return res.status(404).json({ error: 'Match not found' });
      }
      
      const query = { match: matchId, deleted: false };
      
      if (before) {
        query.createdAt = { $lt: new Date(before) };
      }
      
      const messages = await Message.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      
      // Mark messages as read
      const unreadMessageIds = messages
        .filter(m => !m.read && m.sender.toString() !== req.userId.toString())
        .map(m => m._id);
      
      if (unreadMessageIds.length > 0) {
        await Message.updateMany(
          { _id: { $in: unreadMessageIds } },
          { read: true, readAt: new Date() }
        );
        
        // Notify sender about read receipt
        const io = req.app.get('io');
        const otherUserId = match.users.find(
          u => u.toString() !== req.userId.toString()
        );
        
        io.to(`user:${otherUserId}`).emit('messages_read', {
          matchId,
          messageIds: unreadMessageIds,
          readAt: new Date(),
        });
      }
      
      res.json({
        messages: messages.reverse().map(m => ({
          id: m._id,
          content: m.content,
          type: m.type,
          mediaUrl: m.mediaUrl,
          senderId: m.sender,
          read: m.read || unreadMessageIds.includes(m._id),
          readAt: m.readAt,
          liked: m.liked,
          createdAt: m.createdAt,
        })),
        hasMore: messages.length === limit,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/messages/:matchId - Send a message
router.post('/:matchId',
  messageLimiter,
  [
    param('matchId').isMongoId(),
    body('content').trim().isLength({ min: 1, max: 1000 }),
    body('type').optional().isIn(['text', 'image', 'gif', 'audio']),
    body('mediaUrl').optional().isURL(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { matchId } = req.params;
      const { content, type = 'text', mediaUrl } = req.body;
      
      // Verify match
      const match = await Match.findOne({
        _id: matchId,
        users: req.userId,
        unmatched: false,
      });
      
      if (!match) {
        return res.status(404).json({ error: 'Match not found' });
      }
      
      const receiverId = match.users.find(
        u => u.toString() !== req.userId.toString()
      );
      
      // Sanitize content
      const sanitizedContent = sanitizeHtml(content, {
        allowedTags: [],
        allowedAttributes: {},
      });
      
      // Create message
      const message = await Message.create({
        match: matchId,
        sender: req.userId,
        receiver: receiverId,
        content: sanitizedContent,
        type,
        mediaUrl,
      });
      
      // Update match
      match.lastMessage = message._id;
      match.lastMessageAt = message.createdAt;
      await match.save();
      
      const messageData = {
        id: message._id,
        matchId,
        content: message.content,
        type: message.type,
        mediaUrl: message.mediaUrl,
        senderId: message.sender,
        read: false,
        liked: false,
        createdAt: message.createdAt,
      };
      
      // Send via socket
      const io = req.app.get('io');
      io.to(`user:${receiverId}`).emit('new_message', messageData);

      // Send push notification if receiver has FCM token
      const receiver = await User.findById(receiverId).select('fcmToken notificationSettings firstName');
      if (receiver?.fcmToken && receiver.notificationSettings?.messages !== false) {
        const senderName = req.user?.firstName || 'Someone';
        const notifBody = type === 'image' ? `${senderName} sent a photo` :
          type === 'audio' ? `${senderName} sent a voice message` :
          type === 'gif' ? `${senderName} sent a GIF` :
          `${senderName}: ${sanitizedContent.substring(0, 60)}${sanitizedContent.length > 60 ? '...' : ''}`;

        await sendAndSaveNotification({
          userId: receiverId,
          fcmToken: receiver.fcmToken,
          type: 'new_message',
          title: senderName,
          body: notifBody,
          data: { matchId, screen: 'chat' },
        });
      }
      
      res.status(201).json({ message: messageData });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/messages/:matchId/media — Upload image or audio for chat
router.post('/:matchId/media',
  upload.chatUpload.single('file'),
  [param('matchId').isMongoId()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'File required' });
      }

      const { matchId } = req.params;

      // Verify match
      const match = await Match.findOne({
        _id: matchId,
        users: req.userId,
        unmatched: false,
      });

      if (!match) {
        return res.status(404).json({ error: 'Match not found' });
      }

      const isAudio = req.file.mimetype.startsWith('audio/') || req.file.mimetype === 'video/webm';
      const resourceType = isAudio ? 'video' : 'image'; // Cloudinary uses 'video' for audio
      const folder = `tender/chat/${matchId}`;
      const messageType = isAudio ? 'audio' : 'image';

      let uploadResult;
      try {
        const uploadOptions = {
          folder,
          resource_type: resourceType,
        };
        if (!isAudio) {
          uploadOptions.transformation = [
            { width: 800, height: 800, crop: 'limit' },
            { quality: 'auto' },
          ];
        }
        uploadResult = await cloudinary.uploadImage(req.file.buffer, uploadOptions);
      } catch (uploadErr) {
        console.error('Cloudinary upload error:', uploadErr?.message || uploadErr);
        return res.status(500).json({
          error: 'File upload failed',
          ...(process.env.NODE_ENV !== 'production' && { detail: uploadErr?.message }),
        });
      }

      const receiverId = match.users.find(u => u.toString() !== req.userId.toString());

      const message = await Message.create({
        match: matchId,
        sender: req.userId,
        receiver: receiverId,
        content: isAudio ? '[Voice Message]' : '[Image]',
        type: messageType,
        mediaUrl: uploadResult.secure_url,
      });

      match.lastMessage = message._id;
      match.lastMessageAt = message.createdAt;
      await match.save();

      const messageData = {
        id: message._id,
        matchId,
        content: message.content,
        type: message.type,
        mediaUrl: message.mediaUrl,
        senderId: message.sender,
        read: false,
        liked: false,
        createdAt: message.createdAt,
      };

      const io = req.app.get('io');
      io.to(`user:${receiverId}`).emit('new_message', messageData);

      // Push notification
      const receiver = await User.findById(receiverId).select('fcmToken notificationSettings firstName');
      if (receiver?.fcmToken && receiver.notificationSettings?.messages !== false) {
        const senderName = req.user?.firstName || 'Someone';
        await sendAndSaveNotification({
          userId: receiverId,
          fcmToken: receiver.fcmToken,
          type: 'new_message',
          title: senderName,
          body: isAudio ? `${senderName} sent a voice message` : `${senderName} sent a photo`,
          data: { matchId, screen: 'chat' },
        });
      }

      res.status(201).json({ message: messageData });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/v1/messages/:messageId/like - Like/unlike a message
router.patch('/:messageId/like',
  [
    param('messageId').isMongoId(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const message = await Message.findOne({
        _id: req.params.messageId,
        receiver: req.userId, // Can only like messages sent to you
        deleted: false,
      }).populate('match');
      
      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }
      
      message.liked = !message.liked;
      message.likedAt = message.liked ? new Date() : null;
      await message.save();
      
      // Notify sender
      const io = req.app.get('io');
      io.to(`user:${message.sender}`).emit('message_liked', {
        messageId: message._id,
        matchId: message.match._id,
        liked: message.liked,
        likedAt: message.likedAt,
      });
      
      res.json({ liked: message.liked });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/v1/messages/:messageId - Delete a message (soft delete)
router.delete('/:messageId',
  [
    param('messageId').isMongoId(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const message = await Message.findOne({
        _id: req.params.messageId,
        sender: req.userId, // Can only delete your own messages
      });
      
      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }
      
      message.deleted = true;
      message.deletedAt = new Date();
      await message.save();
      
      res.json({ message: 'Message deleted' });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/messages/:matchId/typing - Send typing indicator
router.post('/:matchId/typing',
  [
    param('matchId').isMongoId(),
    body('isTyping').isBoolean(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { matchId } = req.params;
      const { isTyping } = req.body;
      
      // Verify match
      const match = await Match.findOne({
        _id: matchId,
        users: req.userId,
        unmatched: false,
      });
      
      if (!match) {
        return res.status(404).json({ error: 'Match not found' });
      }
      
      const receiverId = match.users.find(
        u => u.toString() !== req.userId.toString()
      );
      
      // Send via socket
      const io = req.app.get('io');
      io.to(`user:${receiverId}`).emit('typing', {
        matchId,
        userId: req.userId,
        isTyping,
      });
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
