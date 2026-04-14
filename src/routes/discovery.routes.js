const express = require('express');
const { query, param, body, validationResult } = require('express-validator');
const { User, Swipe, Match } = require('../models');
const { swipeLimiter } = require('../middleware/rateLimiter');
const { getCache, setCache, delCache } = require('../config/redis');
const geolib = require('geolib');
const { sendAndSaveNotification } = require('../utils/firebase');
const cache = require('../middleware/cache');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
//  ELO MATCHING ENGINE
// ─────────────────────────────────────────────────────────────────────────────
const ELO_K_LIKE      = 32;   // K-factor for a like
const ELO_K_SUPERLIKE = 48;   // K-factor for a superlike
const ELO_K_NOPE      = 8;    // K-factor for a nope (mild penalty)
const ELO_DEFAULT     = 1400;

/**
 * Classic Elo expected score.
 * @param {number} ratingA
 * @param {number} ratingB
 * @returns {number} Expected probability [0,1] that A beats B
 */
function eloExpected(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Calculate new Elo rating after an interaction.
 * @param {number} rating  – Current rating
 * @param {number} expected – Expected score from eloExpected()
 * @param {number} actual   – 1=like/superlike, 0=nope
 * @param {number} k        – K-factor
 * @returns {number} New rating (clamped to [100, 5000])
 */
function eloNewRating(rating, expected, actual, k) {
  const newRating = Math.round(rating + k * (actual - expected));
  return Math.max(100, Math.min(5000, newRating));
}

/**
 * Update both users' Elo scores after a swipe and persist.
 * @param {Object} swiperDoc  – Mongoose User doc of the person swiping
 * @param {Object} targetDoc  – Mongoose User doc of the target
 * @param {'like'|'nope'|'superlike'} action
 */
async function updateEloScores(swiperDoc, targetDoc, action) {
  const swiperRating = swiperDoc.eloScore || ELO_DEFAULT;
  const targetRating = targetDoc.eloScore || ELO_DEFAULT;

  const expectedSwiper = eloExpected(swiperRating, targetRating);
  const expectedTarget = eloExpected(targetRating, swiperRating);

  let actualSwiper, actualTarget, kFactor;

  if (action === 'like') {
    actualSwiper = 1;    // swiper expressed interest
    actualTarget = 0;    // target hasn't responded yet
    kFactor = ELO_K_LIKE;
  } else if (action === 'superlike') {
    actualSwiper = 1;
    actualTarget = 0;
    kFactor = ELO_K_SUPERLIKE;
  } else {
    // nope — mild downward push for both
    actualSwiper = 0;
    actualTarget = 1;    // being swiped left still "wins" against the swiper
    kFactor = ELO_K_NOPE;
  }

  const newSwiperRating = eloNewRating(swiperRating, expectedSwiper, actualSwiper, kFactor);
  const newTargetRating = eloNewRating(targetRating, expectedTarget, actualTarget, kFactor);

  await Promise.all([
    User.findByIdAndUpdate(swiperDoc._id, { eloScore: newSwiperRating }),
    User.findByIdAndUpdate(targetDoc._id, { eloScore: newTargetRating }),
  ]);
}

/**
 * Jaccard similarity between two interest arrays.
 * @param {string[]} a
 * @param {string[]} b
 * @returns {number} [0,1]
 */
function interestSimilarity(a, b) {
  if (!a?.length || !b?.length) return 0;
  const setA = new Set(a.map(s => s.toLowerCase().trim()));
  const setB = new Set(b.map(s => s.toLowerCase().trim()));
  const intersection = [...setA].filter(x => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Activity score based on how recently a user was active (0–1).
 * Linear decay over 7 days.
 */
function activityScore(lastActive) {
  if (!lastActive) return 0;
  const msPerDay = 86_400_000;
  const daysSince = (Date.now() - new Date(lastActive).getTime()) / msPerDay;
  return Math.max(0, 1 - daysSince / 7);
}

/**
 * Compute a composite matching score for ranking discovery candidates.
 * Higher = better match for the current user.
 *
 * Weights:
 *   40% — Elo score proximity (closer scores = more likely mutual match)
 *   25% — Interest overlap (Jaccard similarity)
 *   15% — Profile completeness
 *   10% — Recent activity
 *   10% — Boost bonus
 */
function computeMatchScore(currentUser, candidate) {
  // 1. Elo proximity — normalised [0,1]. Perfect proximity = same score.
  const eloDiff = Math.abs((currentUser.eloScore || ELO_DEFAULT) - (candidate.eloScore || ELO_DEFAULT));
  const eloProximity = Math.max(0, 1 - eloDiff / 1000);

  // 2. Interest overlap
  const interestScore = interestSimilarity(currentUser.interests || [], candidate.interests || []);

  // 3. Profile completeness  [0,1]
  const completeness = (candidate.profileCompletionPercent || 0) / 100;

  // 4. Activity recency
  const activity = activityScore(candidate.lastActive);

  // 5. Boost
  const boostBonus = candidate.boost?.active ? 1 : 0;

  // Weighted sum
  return (
    0.40 * eloProximity +
    0.25 * interestScore +
    0.15 * completeness +
    0.10 * activity +
    0.10 * boostBonus
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/discovery - Get potential matches (smart Elo feed)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/',
  cache(30), // Cache discovery feed for 30 seconds per user
  [
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const limit = req.query.limit || 20;
      const user = req.user;
      
      // Default location (Pune, India) if user doesn't have one
      const defaultLocation = { 
        type: 'Point', 
        coordinates: [73.8567, 18.5204],
        city: 'Pune',
        country: 'India'
      };
      
      // Use user's location or default
      const userLocation = (user.location && user.location.coordinates && 
        !(user.location.coordinates[0] === 0 && user.location.coordinates[1] === 0))
        ? user.location
        : defaultLocation;

      // Get users already swiped on — cache for 5 minutes
      const swipeCacheKey = `swipes:${user._id}`;
      let swipedUserIds = await getCache(swipeCacheKey);
      if (!swipedUserIds) {
        swipedUserIds = await Swipe.distinct('swiped', { swiper: user._id });
        await setCache(swipeCacheKey, swipedUserIds, 300);
      }
      
      // Build query
      const query = {
        _id: { $ne: user._id, $nin: [...swipedUserIds, ...user.blockedUsers] },
        active: true,
        showMe: true,
        photos: { $exists: true, $ne: [] },
        'photos.0': { $exists: true },
      };
      
      // Gender filter
      if (user.preferences.gender !== 'everyone') {
        const genderMap = { 'men': 'male', 'women': 'female' };
        query.gender = genderMap[user.preferences.gender];
      }
      
      // Age filter
      const now = new Date();
      const minBirthDate = new Date(now.getFullYear() - user.preferences.ageMax, now.getMonth(), now.getDate());
      const maxBirthDate = new Date(now.getFullYear() - user.preferences.ageMin, now.getMonth(), now.getDate());
      query.birthday = { $gte: minBirthDate, $lte: maxBirthDate };
      
      let users;
      
      if (!user.preferences.global) {
        // Location-based discovery
        const distanceInMeters = user.preferences.distanceMax * 1000;
        
        users = await User.aggregate([
          {
            $geoNear: {
              near: {
                type: 'Point',
                coordinates: userLocation.coordinates,
              },
              distanceField: 'distance',
              maxDistance: distanceInMeters,
              query: query,
              spherical: true,
            },
          },
          // Fetch larger pool so we can re-rank by Elo match score
          { $limit: Math.min(limit * 5, 200) },
          {
            $project: {
              refreshToken: 0,
              blockedUsers: 0,
              fcmToken: 0,
              dailySwipes: 0,
              dailySuperLikes: 0,
            },
          },
        ]);
        
        // Convert distance to km and compute smart match score
        users = users.map(u => ({
          ...u,
          distanceKm: Math.round(u.distance / 1000),
          _matchScore: computeMatchScore(user, u),
        }));

        // Sort: boosted (and not expired) first, then by composite match score descending
        const isBoostActive = u => u.boost?.active && u.boost?.expiresAt && new Date(u.boost.expiresAt) > new Date();
        users.sort((a, b) => {
          const aBoost = isBoostActive(a) ? 1 : 0;
          const bBoost = isBoostActive(b) ? 1 : 0;
          if (bBoost !== aBoost) return bBoost - aBoost;
          return b._matchScore - a._matchScore;
        });

        users = users.slice(0, limit);
      } else {
        // Global discovery (no distance filter)
        // Fetch a larger pool for re-ranking
        const pool = await User.find(query)
          .select('-refreshToken -blockedUsers -fcmToken -dailySwipes -dailySuperLikes')
          .limit(Math.min(limit * 5, 200))
          .lean();
        
        // Calculate distance for display and compute match score
        users = pool.map(u => {
          let distanceKm = null;
          if (u.location && u.location.coordinates) {
            const distance = geolib.getDistance(
              { latitude: userLocation.coordinates[1], longitude: userLocation.coordinates[0] },
              { latitude: u.location.coordinates[1], longitude: u.location.coordinates[0] }
            );
            distanceKm = Math.round(distance / 1000);
          }
          return {
            ...u,
            distanceKm,
            _matchScore: computeMatchScore(user, u),
          };
        });

        // Sort: boosted (and not expired) first, then by composite match score descending
        users.sort((a, b) => {
          const aBoost = (a.boost?.active && a.boost?.expiresAt && new Date(a.boost.expiresAt) > new Date()) ? 1 : 0;
          const bBoost = (b.boost?.active && b.boost?.expiresAt && new Date(b.boost.expiresAt) > new Date()) ? 1 : 0;
          if (bBoost !== aBoost) return bBoost - aBoost;
          return b._matchScore - a._matchScore;
        });

        users = users.slice(0, limit);
      }
      
      // Add virtual 'age' field and strip internal scoring field
      users = users.map(u => {
        const birthday = new Date(u.birthday);
        const today = new Date();
        let age = today.getFullYear() - birthday.getFullYear();
        const monthDiff = today.getMonth() - birthday.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthday.getDate())) {
          age--;
        }
        const { _matchScore, ...rest } = u;
        return { ...rest, age, id: u._id };
      });
      
      res.json({ 
        users,
        remaining: await User.countDocuments(query) - users.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/discovery/swipe - Swipe on a user
router.post('/swipe',
  swipeLimiter,
  [
    body('userId').isMongoId().withMessage('Invalid user ID'),
    body('action').isIn(['like', 'nope', 'superlike']).withMessage('Invalid action'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId, action } = req.body;
      const user = req.user;
      
      // Can't swipe on yourself
      if (userId === user._id.toString()) {
        return res.status(400).json({ error: 'Cannot swipe on yourself' });
      }
      
      // Check swipe limits
      if (!user.canSwipe() && action !== 'nope') {
        return res.status(403).json({ 
          error: 'Daily swipe limit reached',
          upgrade: true,
        });
      }
      
      // Check super like limits
      if (action === 'superlike' && !user.canSuperLike()) {
        return res.status(403).json({ 
          error: 'Daily super like limit reached',
          upgrade: true,
        });
      }
      
      // Check if already swiped
      const existingSwipe = await Swipe.findOne({
        swiper: user._id,
        swiped: userId,
      });
      
      if (existingSwipe) {
        return res.status(400).json({ error: 'Already swiped on this user' });
      }
      
      // Check if target user exists
      const targetUser = await User.findById(userId);
      if (!targetUser || !targetUser.active) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Create swipe
      const swipe = await Swipe.create({
        swiper: user._id,
        swiped: userId,
        action,
      });

      // Invalidate swipe cache + discovery feed cache so next request is fresh
      await delCache(`swipes:${user._id}`, `route:${user._id}:/api/v1/discovery`);

      // ── Update Elo scores (fire-and-forget, don't block the response) ──
      updateEloScores(user, targetUser, action).catch(err =>
        console.error('Elo update failed:', err.message)
      );
      
      // Update swipe counts
      if (action === 'like' || action === 'superlike') {
        user.dailySwipes.count += 1;
      }
      if (action === 'superlike') {
        user.dailySuperLikes.count += 1;

        // Notify target user of super like (if they haven't swiped yet)
        if (targetUser.fcmToken && targetUser.notificationSettings?.superLikes !== false) {
          await sendAndSaveNotification({
            userId,
            fcmToken: targetUser.fcmToken,
            type: 'super_like',
            title: '⭐ Super Like!',
            body: `${user.firstName} Super Liked you!`,
            imageUrl: user.photos?.[0]?.url,
            data: { screen: 'discovery' },
          });
        }
      }
      await user.save();
      
      let match = null;
      
      // Check for match (if liked or superliked)
      if (action === 'like' || action === 'superlike') {
        const reverseSwipe = await Swipe.findOne({
          swiper: userId,
          swiped: user._id,
          action: { $in: ['like', 'superlike'] },
        });
        
        if (reverseSwipe) {
          // It's a match!
          match = await Match.create({
            users: [user._id, userId],
            isSuperLike: action === 'superlike' || reverseSwipe.action === 'superlike',
          });
          
          // Update both swipes as matched
          swipe.matched = true;
          await swipe.save();
          reverseSwipe.matched = true;
          await reverseSwipe.save();
          
          // Populate match with user info
          await match.populate('users', 'firstName photos');
          
          // Emit socket event for real-time notification
          const io = req.app.get('io');
          const matchedUserPublic = targetUser.toPublicProfile();
          const currentUserPublic = user.toPublicProfile();
          
          io.to(`user:${userId}`).emit('new_match', {
            match: {
              id: match._id,
              user: currentUserPublic,
              matchedAt: match.matchedAt,
              isSuperLike: match.isSuperLike,
            },
          });

          // FCM push notification to matched user
          if (targetUser.fcmToken && targetUser.notificationSettings?.newMatches !== false) {
            await sendAndSaveNotification({
              userId,
              fcmToken: targetUser.fcmToken,
              type: 'new_match',
              title: "It's a Match! 🎉",
              body: `You and ${user.firstName} liked each other`,
              imageUrl: user.photos?.[0]?.url,
              data: { matchId: match._id.toString(), screen: 'matches' },
            });
          }
          // FCM to current user too
          if (user.fcmToken && user.notificationSettings?.newMatches !== false) {
            await sendAndSaveNotification({
              userId: user._id,
              fcmToken: user.fcmToken,
              type: 'new_match',
              title: "It's a Match! 🎉",
              body: `You and ${targetUser.firstName} liked each other`,
              imageUrl: targetUser.photos?.[0]?.url,
              data: { matchId: match._id.toString(), screen: 'matches' },
            });
          }
          
          match = {
            id: match._id,
            user: matchedUserPublic,
            matchedAt: match.matchedAt,
            isSuperLike: match.isSuperLike,
          };
        }
      }
      
      // Compute remaining counts for the response
      const maxSwipes = user.isPremium() ? -1 : parseInt(process.env.MAX_SWIPES_PER_DAY || 100);
      const remainingLikes = maxSwipes === -1 ? -1 : Math.max(0, maxSwipes - user.dailySwipes.count);
      const maxSuperLikes = user.isPremium()
        ? parseInt(process.env.PREMIUM_SUPER_LIKES || 5)
        : parseInt(process.env.SUPER_LIKES_PER_DAY || 1);
      const remainingSuperLikes = Math.max(0, maxSuperLikes - user.dailySuperLikes.count);

      res.json({ 
        swipe: {
          id: swipe._id,
          action: swipe.action,
          matched: swipe.matched,
        },
        match,
        remainingLikes,
        remainingSuperLikes,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/discovery/undo - Undo last swipe (premium)
router.post('/undo',
  async (req, res, next) => {
    try {
      if (!req.user.isPremium()) {
        return res.status(403).json({ 
          error: 'Premium subscription required',
          upgrade: true,
        });
      }
      
      // Find last swipe
      const lastSwipe = await Swipe.findOne({
        swiper: req.userId,
      }).sort({ createdAt: -1 });
      
      if (!lastSwipe) {
        return res.status(404).json({ error: 'No swipe to undo' });
      }
      
      // Check if it was a match
      if (lastSwipe.matched) {
        await Match.deleteOne({
          users: { $all: [req.userId, lastSwipe.swiped] },
        });
      }
      
      // Delete the swipe
      await lastSwipe.deleteOne();
      
      // Get the user info
      const undoneUser = await User.findById(lastSwipe.swiped);
      
      res.json({ 
        message: 'Swipe undone',
        user: undoneUser?.toPublicProfile(),
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/v1/discovery/likes-me - Get users who liked me (premium)
router.get('/likes-me',
  async (req, res, next) => {
    try {
      if (!req.user.isPremium()) {
        // Return count only for free users
        const count = await Swipe.countDocuments({
          swiped: req.userId,
          action: { $in: ['like', 'superlike'] },
          matched: false,
        });
        
        return res.json({ 
          count,
          users: [],
          upgrade: true,
        });
      }
      
      const swipes = await Swipe.find({
        swiped: req.userId,
        action: { $in: ['like', 'superlike'] },
        matched: false,
      })
        .populate('swiper', '-refreshToken -blockedUsers')
        .sort({ createdAt: -1 })
        .limit(50);
      
      const users = swipes
        .filter(s => s.swiper && s.swiper.active)
        .map(s => ({
          ...s.swiper.toPublicProfile(),
          swipeAction: s.action,
          swipedAt: s.createdAt,
        }));
      
      res.json({ users, count: users.length });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/discovery/boost - Activate boost (premium)
router.post('/boost',
  async (req, res, next) => {
    try {
      const user = req.user;
      
      if (user.boost.active && user.boost.expiresAt > new Date()) {
        return res.status(400).json({ error: 'Boost already active' });
      }
      
      // In production, check boost allowance based on subscription
      
      user.boost = {
        active: true,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      };
      await user.save();
      
      res.json({ 
        message: 'Boost activated!',
        expiresAt: user.boost.expiresAt,
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
