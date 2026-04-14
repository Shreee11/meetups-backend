const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { User } = require('../models');
const upload = require('../middleware/upload');
const cloudinary = require('../utils/cloudinary');

const router = express.Router();

// GET /api/v1/users/me - Get current user profile
router.get('/me', async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user: user.toPublicProfile() });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/users/me - Update current user profile
router.patch('/me',
  [
    body('firstName').optional().trim().isLength({ min: 2, max: 50 }),
    body('lastName').optional().trim().isLength({ max: 50 }),
    body('bio').optional().trim().isLength({ max: 500 }),
    body('jobTitle').optional().trim().isLength({ max: 100 }),
    body('company').optional().trim().isLength({ max: 100 }),
    body('school').optional().trim().isLength({ max: 100 }),
    body('interests').optional().isArray({ max: 20 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const allowedFields = [
        'firstName', 'lastName', 'bio', 'jobTitle', 'company', 
        'school', 'interests', 'showMe',
        'relationshipGoal', 'height', 'pronouns',
      ];
      
      const updates = {};
      allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      });

      // Handle nested lifestyle object
      if (req.body.lifestyle && typeof req.body.lifestyle === 'object') {
        const allowedLifestyle = ['drinking', 'smoking', 'exercise', 'diet', 'children', 'education', 'zodiac'];
        allowedLifestyle.forEach(key => {
          if (req.body.lifestyle[key] !== undefined) {
            updates[`lifestyle.${key}`] = req.body.lifestyle[key];
          }
        });
      }

      // Handle prompts array
      if (Array.isArray(req.body.prompts)) {
        updates.prompts = req.body.prompts.slice(0, 3).map(p => ({
          question: String(p.question || '').substring(0, 200),
          answer: String(p.answer || '').substring(0, 300),
        }));
      }
      
      const user = await User.findByIdAndUpdate(
        req.userId,
        updates,
        { new: true, runValidators: true }
      );
      
      res.json({ user });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/v1/users/me/complete-profile - Complete profile after registration
router.patch('/me/complete-profile',
  [
    body('firstName').trim().isLength({ min: 2, max: 50 }).withMessage('First name must be 2-50 characters'),
    body('birthday').isISO8601().withMessage('Invalid birthday'),
    body('gender').isIn(['male', 'female', 'other']).withMessage('Invalid gender'),
    body('bio').optional().trim().isLength({ max: 500 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { firstName, lastName, birthday, gender, bio } = req.body;

      // Validate age (must be 18+)
      const birthDate = new Date(birthday);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      if (age < 18) {
        return res.status(400).json({ error: 'You must be at least 18 years old' });
      }

      const user = await User.findByIdAndUpdate(
        req.userId,
        { firstName, lastName, birthday: birthDate, gender, bio: bio || '' },
        { new: true, runValidators: true }
      );

      res.json({ user: user.toPublicProfile() });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/v1/users/me/location - Update location
router.patch('/me/location',
  [
    body('latitude').isFloat({ min: -90, max: 90 }),
    body('longitude').isFloat({ min: -180, max: 180 }),
    body('city').optional().trim(),
    body('country').optional().trim(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { latitude, longitude, city, country } = req.body;
      
      const user = await User.findByIdAndUpdate(
        req.userId,
        {
          location: {
            type: 'Point',
            coordinates: [longitude, latitude],
            city,
            country,
          },
        },
        { new: true }
      );
      
      res.json({ location: user.location });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/v1/users/me/preferences - Update preferences
router.patch('/me/preferences',
  [
    body('ageMin').optional().isInt({ min: 18, max: 100 }),
    body('ageMax').optional().isInt({ min: 18, max: 100 }),
    body('distanceMax').optional().isInt({ min: 1, max: 500 }),
    body('gender').optional().isIn(['men', 'women', 'everyone']),
    body('global').optional().isBoolean(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { ageMin, ageMax, distanceMax, gender, global } = req.body;
      
      const updates = {};
      if (ageMin !== undefined) updates['preferences.ageMin'] = ageMin;
      if (ageMax !== undefined) updates['preferences.ageMax'] = ageMax;
      if (distanceMax !== undefined) updates['preferences.distanceMax'] = distanceMax;
      if (gender !== undefined) updates['preferences.gender'] = gender;
      if (global !== undefined) updates['preferences.global'] = global;
      
      const user = await User.findByIdAndUpdate(
        req.userId,
        { $set: updates },
        { new: true, runValidators: true }
      );

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ preferences: user.preferences });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/users/me/photos - Upload photo
router.post('/me/photos',
  upload.single('photo'),
  async (req, res, next) => {
    try {
      const user = await User.findById(req.userId);
      
      if (user.photos.length >= 9) {
        return res.status(400).json({ error: 'Maximum 9 photos allowed' });
      }
      
      // Upload to Cloudinary
      const result = await cloudinary.uploadImage(req.file.buffer, {
        folder: `tender/users/${req.userId}`,
        transformation: [
          { width: 1080, height: 1350, crop: 'fill' },
          { quality: 'auto' },
        ],
      });
      
      const photo = {
        url: result.secure_url,
        publicId: result.public_id,
        order: user.photos.length,
        isMain: user.photos.length === 0,
      };
      
      user.photos.push(photo);
      await user.save();
      
      res.status(201).json({ photo: user.photos[user.photos.length - 1] });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/v1/users/me/photos/:photoId - Delete photo
router.delete('/me/photos/:photoId',
  async (req, res, next) => {
    try {
      const user = await User.findById(req.userId);
      
      const photoIndex = user.photos.findIndex(
        p => p._id.toString() === req.params.photoId
      );
      
      if (photoIndex === -1) {
        return res.status(404).json({ error: 'Photo not found' });
      }
      
      if (user.photos.length <= 2) {
        return res.status(400).json({ error: 'You must have at least 2 photos' });
      }
      
      const photo = user.photos[photoIndex];
      
      // Delete from Cloudinary
      await cloudinary.deleteImage(photo.publicId);
      
      // Remove from user
      user.photos.splice(photoIndex, 1);
      
      // Reorder remaining photos
      user.photos.forEach((p, i) => {
        p.order = i;
        p.isMain = i === 0;
      });
      
      await user.save();
      
      res.json({ message: 'Photo deleted' });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/v1/users/me/photos/reorder - Reorder photos
router.patch('/me/photos/reorder',
  [
    body('photoIds').isArray({ min: 2 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { photoIds } = req.body;
      const user = await User.findById(req.userId);
      
      // Validate all photo IDs exist
      const userPhotoIds = user.photos.map(p => p._id.toString());
      const allExist = photoIds.every(id => userPhotoIds.includes(id));
      
      if (!allExist || photoIds.length !== user.photos.length) {
        return res.status(400).json({ error: 'Invalid photo IDs' });
      }
      
      // Reorder photos
      const reorderedPhotos = photoIds.map((id, index) => {
        const photo = user.photos.find(p => p._id.toString() === id);
        photo.order = index;
        photo.isMain = index === 0;
        return photo;
      });
      
      user.photos = reorderedPhotos;
      await user.save();
      
      res.json({ photos: user.photos });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/v1/users/me/notification-settings — Update notification preferences
router.patch('/me/notification-settings',
  [
    body('newMatches').optional().isBoolean(),
    body('messages').optional().isBoolean(),
    body('messageLikes').optional().isBoolean(),
    body('superLikes').optional().isBoolean(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const updates = {};
      ['newMatches', 'messages', 'messageLikes', 'superLikes'].forEach(key => {
        if (req.body[key] !== undefined) {
          updates[`notificationSettings.${key}`] = req.body[key];
        }
      });

      const user = await User.findByIdAndUpdate(req.userId, updates, { new: true });
      res.json({ notificationSettings: user.notificationSettings });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/users/:userId - Get user profile (public)
router.get('/:userId',
  [
    param('userId').isMongoId(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = await User.findById(req.params.userId);
      
      if (!user || !user.active) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Check if blocked
      if (user.blockedUsers.includes(req.userId)) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json({ user: user.toPublicProfile() });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/users/:userId/block - Block user
router.post('/:userId/block',
  [
    param('userId').isMongoId(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      if (req.params.userId === req.userId.toString()) {
        return res.status(400).json({ error: 'Cannot block yourself' });
      }
      
      await User.findByIdAndUpdate(req.userId, {
        $addToSet: { blockedUsers: req.params.userId },
      });
      
      res.json({ message: 'User blocked' });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/v1/users/:userId/block - Unblock user
router.delete('/:userId/block',
  [
    param('userId').isMongoId(),
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
      
      res.json({ message: 'User unblocked' });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/users/:userId/report - Report user
router.post('/:userId/report',
  [
    param('userId').isMongoId(),
    body('reason').isIn([
      'inappropriate_photos', 
      'inappropriate_messages', 
      'fake_profile', 
      'spam', 
      'other'
    ]),
    body('details').optional().trim().isLength({ max: 500 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // In production, save report to database and notify admin
      console.log('Report:', {
        reporter: req.userId,
        reported: req.params.userId,
        reason: req.body.reason,
        details: req.body.details,
      });
      
      res.json({ message: 'Report submitted. Thank you for keeping Tender safe!' });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/users/me/stats - Profile stats summary
router.get('/me/stats', async (req, res, next) => {
  try {
    const userId = req.userId;
    const { Swipe, Match } = require('../models');

    const [
      totalLikesReceived,
      totalSuperLikesReceived,
      totalMatches,
      totalConversations,
    ] = await Promise.all([
      Swipe.countDocuments({ swiped: userId, action: { $in: ['like', 'superlike'] } }),
      Swipe.countDocuments({ swiped: userId, action: 'superlike' }),
      Match.countDocuments({ users: userId, unmatched: false }),
      Match.countDocuments({ users: userId, unmatched: false, lastMessageAt: { $exists: true } }),
    ]);

    const user = await User.findById(userId).select(
      'profileCompletionPercent eloScore subscription boost dailySwipes dailySuperLikes'
    );

    res.json({
      stats: {
        likesReceived: totalLikesReceived,
        superLikesReceived: totalSuperLikesReceived,
        totalMatches,
        totalConversations,
        profileCompletionPercent: user?.profileCompletionPercent ?? 0,
        eloScore: user?.eloScore ?? 1400,
        dailySwipesUsed: user?.dailySwipes?.count ?? 0,
        dailySuperLikesUsed: user?.dailySuperLikes?.count ?? 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/users/me - Delete account (GDPR)
router.delete('/me', async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Anonymise instead of hard delete for data integrity
    await User.findByIdAndUpdate(req.userId, {
      active: false,
      deletedAt: new Date(),
      email: `deleted_${Date.now()}_${req.userId}@deleted.invalid`,
      phone: `deleted_${Date.now()}_${req.userId}`,
      firstName: 'Deleted',
      lastName: 'User',
      bio: '',
      photos: [],
      interests: [],
      prompts: [],
      fcmToken: null,
      refreshToken: null,
      showMe: false,
    });
    
    res.json({ message: 'Account deleted. Your data will be fully removed within 30 days.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
