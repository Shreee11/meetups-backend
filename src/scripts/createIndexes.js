/**
 * createIndexes.js — Run once at deployment to ensure all MongoDB indexes exist.
 *
 * Usage:  node src/scripts/createIndexes.js
 *
 * At 1M users, missing indexes = full collection scans = timeouts.
 * Every field used in $match / $lookup / sort / $geoNear must be indexed.
 */

require('dotenv').config();
const mongoose = require('mongoose');

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;

  // ─── users ───────────────────────────────────────────────────────────────
  const users = db.collection('users');

  // 2dsphere for geo-discovery (MOST IMPORTANT)
  await users.createIndex({ 'location': '2dsphere' });

  // Auth lookups
  await users.createIndex({ email: 1 }, { unique: true, sparse: true });
  await users.createIndex({ phone: 1 }, { unique: true, sparse: true });

  // Discovery filters — compound to cover all WHERE clauses in the aggregate
  await users.createIndex({
    active: 1,
    showMe: 1,
    gender: 1,
    birthday: 1,
    'subscription.type': 1,
  });

  // Online presence / last-active lookups
  await users.createIndex({ isOnline: 1, lastActive: -1 });

  // Boost expiry (TTL-style query)
  await users.createIndex({ 'boost.active': 1, 'boost.expiresAt': 1 });

  // Token lookups
  await users.createIndex({ refreshToken: 1 }, { sparse: true });
  await users.createIndex({ fcmToken: 1 }, { sparse: true });

  // Soft-delete filter
  await users.createIndex({ deletedAt: 1 }, { sparse: true });

  console.log('✅ users indexes created');

  // ─── swipes ──────────────────────────────────────────────────────────────
  const swipes = db.collection('swipes');

  // "Has this user already swiped on that person?" — the most frequent query
  await swipes.createIndex({ swiper: 1, swiped: 1 }, { unique: true });

  // Find all swipes by a user (discovery exclusion list)
  await swipes.createIndex({ swiper: 1, createdAt: -1 });

  // Mutual-like detection (match creation trigger)
  await swipes.createIndex({ swiped: 1, direction: 1 });

  // TTL — auto-delete old swipes after 90 days to keep the collection lean
  await swipes.createIndex({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

  console.log('✅ swipes indexes created');

  // ─── matches ─────────────────────────────────────────────────────────────
  const matches = db.collection('matches');

  // Load matches for a user (matches screen)
  await matches.createIndex({ users: 1, createdAt: -1 });

  // Single match lookup (chat screen)
  await matches.createIndex({ users: 1 }, { unique: false }); // compound pair check done in app
  await matches.createIndex({ lastMessageAt: -1 });

  console.log('✅ matches indexes created');

  // ─── messages ────────────────────────────────────────────────────────────
  const messages = db.collection('messages');

  // Load chat history (paginated, newest first)
  await messages.createIndex({ match: 1, createdAt: -1 });

  // Mark as read (bulk update by match + read=false)
  await messages.createIndex({ match: 1, read: 1 });

  // TTL — auto-delete messages older than 1 year
  await messages.createIndex({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 3600 });

  console.log('✅ messages indexes created');

  // ─── notifications ───────────────────────────────────────────────────────
  const notifications = db.collection('notifications');

  await notifications.createIndex({ user: 1, read: 1, createdAt: -1 });

  // TTL — auto-delete read notifications after 30 days
  await notifications.createIndex({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

  console.log('✅ notifications indexes created');

  // ─── reports ─────────────────────────────────────────────────────────────
  const reports = db.collection('reports');
  await reports.createIndex({ reporter: 1, reported: 1 });
  await reports.createIndex({ status: 1, createdAt: -1 });
  console.log('✅ reports indexes created');

  await mongoose.disconnect();
  console.log('\n🎉 All indexes created successfully');
};

run().catch((err) => {
  console.error('❌ Index creation failed:', err);
  process.exit(1);
});
