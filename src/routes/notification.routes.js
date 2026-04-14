/**
 * Notification Routes
 * GET    /api/v1/notifications                    — get user notifications (paginated)
 * GET    /api/v1/notifications/unread-count        — unread count badge
 * PATCH  /api/v1/notifications/:id/read            — mark one as read
 * PATCH  /api/v1/notifications/read-all            — mark all as read
 * DELETE /api/v1/notifications/:id                 — delete one notification
 * POST   /api/v1/notifications/register-token      — register FCM device token
 * DELETE /api/v1/notifications/unregister-token    — remove FCM device token
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { Notification, User } = require('../models');

const router = express.Router();

// GET /api/v1/notifications
router.get('/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const page = req.query.page || 1;
      const limit = req.query.limit || 20;
      const skip = (page - 1) * limit;

      const [notifications, total, unreadCount] = await Promise.all([
        Notification.find({ user: req.userId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Notification.countDocuments({ user: req.userId }),
        Notification.countDocuments({ user: req.userId, read: false }),
      ]);

      res.json({
        notifications: notifications.map(n => ({
          id: n._id,
          type: n.type,
          title: n.title,
          body: n.body,
          imageUrl: n.imageUrl,
          data: (n.data instanceof Map) ? Object.fromEntries(n.data) : (n.data || {}),
          read: n.read,
          readAt: n.readAt,
          createdAt: n.createdAt,
        })),
        unreadCount,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasMore: skip + notifications.length < total,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/notifications/unread-count
router.get('/unread-count', async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({
      user: req.userId,
      read: false,
    });
    res.json({ unreadCount: count });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/notifications/read-all
router.patch('/read-all', async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      { user: req.userId, read: false },
      { read: true, readAt: new Date() }
    );
    res.json({ updated: result.modifiedCount });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/notifications/:id/read
router.patch('/:id/read',
  [param('id').isMongoId()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const notification = await Notification.findOneAndUpdate(
        { _id: req.params.id, user: req.userId },
        { read: true, readAt: new Date() },
        { new: true }
      );

      if (!notification) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      res.json({ notification });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/v1/notifications/:id
router.delete('/:id',
  [param('id').isMongoId()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const result = await Notification.deleteOne({ _id: req.params.id, user: req.userId });

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      res.json({ message: 'Notification deleted' });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/notifications/register-token — Register FCM device token
router.post('/register-token',
  [
    body('fcmToken').notEmpty().withMessage('FCM token required'),
    body('platform').isIn(['ios', 'android']).withMessage('Platform must be ios or android'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { fcmToken } = req.body;

      await User.findByIdAndUpdate(req.userId, { fcmToken });

      res.json({ message: 'Device token registered' });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/v1/notifications/unregister-token — Remove FCM device token
router.delete('/unregister-token', async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.userId, { $unset: { fcmToken: '' } });
    res.json({ message: 'Device token removed' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
