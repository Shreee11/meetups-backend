/**
 * Report & Block Routes
 * POST   /api/v1/reports              — report a user
 * POST   /api/v1/reports/:userId/block   — block a user
 * DELETE /api/v1/reports/:userId/block   — unblock a user
 * GET    /api/v1/reports/blocked         — list blocked users
 */

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { User, Report } = require('../models');
const { sendAndSaveNotification } = require('../utils/firebase');

const router = express.Router();

// POST /api/v1/reports — Submit a report
router.post('/',
  [
    body('reportedUserId').isMongoId().withMessage('Invalid user ID'),
    body('reason').isIn([
      'spam', 'inappropriate_content', 'harassment',
      'fake_profile', 'underage', 'hate_speech', 'violence', 'other',
    ]).withMessage('Invalid reason'),
    body('description').optional().trim().isLength({ max: 500 }),
    body('matchId').optional().isMongoId(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { reportedUserId, reason, description, matchId } = req.body;
      const reporterId = req.userId;

      if (reportedUserId === reporterId.toString()) {
        return res.status(400).json({ error: 'Cannot report yourself' });
      }

      // Check if reported user exists
      const reportedUser = await User.findById(reportedUserId);
      if (!reportedUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Upsert report (one active report per reporter/reported pair)
      const report = await Report.findOneAndUpdate(
        { reporter: reporterId, reported: reportedUserId },
        {
          $set: {
            reason,
            description: description || '',
            matchId: matchId || undefined,
            status: 'pending',
          },
        },
        { upsert: true, new: true }
      );

      // Auto-block the reported user after reporting
      await User.findByIdAndUpdate(reporterId, {
        $addToSet: { blockedUsers: reportedUserId },
      });

      // Increment report count on the reported user
      await User.findByIdAndUpdate(reportedUserId, {
        $inc: { reportCount: 1 },
      });

      res.status(201).json({
        message: 'Report submitted successfully. The user has been blocked.',
        reportId: report._id,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/reports/:userId/block — Block a user
router.post('/:userId/block',
  [
    param('userId').isMongoId().withMessage('Invalid user ID'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId } = req.params;

      if (userId === req.userId.toString()) {
        return res.status(400).json({ error: 'Cannot block yourself' });
      }

      const targetUser = await User.findById(userId);
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      await User.findByIdAndUpdate(req.userId, {
        $addToSet: { blockedUsers: userId },
      });

      res.json({ message: 'User blocked successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/v1/reports/:userId/block — Unblock a user
router.delete('/:userId/block',
  [
    param('userId').isMongoId().withMessage('Invalid user ID'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      await User.findByIdAndUpdate(req.userId, {
        $pull: { blockedUsers: req.params.userId },
      });

      res.json({ message: 'User unblocked successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/reports/blocked — Get list of blocked users
router.get('/blocked', async (req, res, next) => {
  try {
    const user = await User.findById(req.userId)
      .populate('blockedUsers', 'firstName photos verified')
      .lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      blockedUsers: (user.blockedUsers || []).map(u => ({
        id: u._id,
        firstName: u.firstName,
        photo: u.photos?.[0]?.url || null,
        verified: u.verified,
      })),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
