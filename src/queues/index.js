/**
 * queues/index.js — Bull queue definitions
 *
 * Why queues?
 * At 1M users, operations like sending push notifications, emails, and
 * processing matches MUST be off the hot request path.
 * A swipe should return in < 50ms. FCM calls, email sends, etc. should
 * happen asynchronously in the background.
 *
 * Queues require Redis. If Redis is unavailable (local dev without Redis),
 * job enqueuing is silently skipped — the operation still completes
 * synchronously as a fallback.
 */

const Bull = require('bull');

const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  // Fast failure in local dev
  maxRetriesPerRequest: 1,
  connectTimeout: 3000,
  lazyConnect: true,
  retryStrategy: (times) => (times > 1 ? null : 500),
};

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 200,
};

// ─── Queue definitions ───────────────────────────────────────────────────────

let notificationQueue, emailQueue, matchQueue, profileQueue;

const REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false';

if (REDIS_ENABLED) {
  notificationQueue = new Bull('notifications', { redis: redisConnection, defaultJobOptions });
  emailQueue        = new Bull('emails',        { redis: redisConnection, defaultJobOptions });
  matchQueue        = new Bull('matches',        { redis: redisConnection, defaultJobOptions });
  profileQueue      = new Bull('profiles',       { redis: redisConnection, defaultJobOptions });

  // Suppress unhandled Redis errors from Bull's internal client
  for (const q of [notificationQueue, emailQueue, matchQueue, profileQueue]) {
    q.on('error', (err) => {
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`⚠️  Queue "${q.name}" error (Redis unavailable?): ${err.message}`);
      }
    });
  }
} else {
  // No-op queue stub so callers don't need null checks
  const noop = { add: async () => null, close: async () => {} };
  notificationQueue = emailQueue = matchQueue = profileQueue = noop;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const closeQueues = async () => {
  await Promise.all([
    notificationQueue.close(),
    emailQueue.close(),
    matchQueue.close(),
    profileQueue.close(),
  ]);
};

module.exports = { notificationQueue, emailQueue, matchQueue, profileQueue, closeQueues };
