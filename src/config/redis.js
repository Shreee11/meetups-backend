const Redis = require('ioredis');

const REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false';

// Stub used when Redis is disabled or unavailable
const noopRedis = {
  status: 'disabled',
  get: async () => null,
  set: async () => null,
  setex: async () => null,
  del: async () => null,
  incr: async () => null,
  expire: async () => null,
  call: async () => null,
  disconnect: () => {},
};

// Support single REDIS_URL (used by Render, Railway, Heroku, etc.)
const redisBaseConfig = process.env.REDIS_URL
  ? { url: process.env.REDIS_URL }
  : {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB) || 0,
    };

const redisConfig = {
  ...redisBaseConfig,

  // Connection pool & retry
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  connectTimeout: 3000,
  lazyConnect: true,

  retryStrategy(times) {
    if (times > 2) return null; // Give up fast in dev
    return Math.min(times * 200, 1000);
  },
};

let redis = noopRedis;
let redisSub = noopRedis;
let redisPub = noopRedis;

if (REDIS_ENABLED) {
  redis = new Redis(redisConfig);
  redisSub = new Redis(redisConfig);
  redisPub = new Redis(redisConfig);

  // Suppress unhandled error events — they are handled in connectRedis
  redis.on('error', () => {});
  redisSub.on('error', () => {});
  redisPub.on('error', () => {});
}

/**
 * Gracefully connect all Redis clients at startup.
 * If Redis is not running, the app continues without it.
 */
const connectRedis = async () => {
  if (!REDIS_ENABLED) {
    console.warn('⚠️  Redis disabled (REDIS_ENABLED=false), running without cache');
    return;
  }

  try {
    await Promise.all([
      redis.connect(),
      redisSub.connect(),
      redisPub.connect(),
    ]);
    console.log('✅ Redis connected');
  } catch (err) {
    // Redis is optional — degrade gracefully
    console.warn('⚠️  Redis unavailable, running without cache:', err.message);

    // Replace with no-ops so no further errors are thrown downstream
    redis = noopRedis;
    redisSub = noopRedis;
    redisPub = noopRedis;
  }
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Get a JSON-cached value. Returns null if missing or Redis is down. */
const getCache = async (key) => {
  if (redis === noopRedis) return null;
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

/** Set a JSON value with a TTL (seconds). */
const setCache = async (key, value, ttlSeconds = 300) => {
  if (redis === noopRedis) return;
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch {
    // Best-effort
  }
};

/** Delete one or more cache keys. */
const delCache = async (...keys) => {
  if (redis === noopRedis) return;
  try {
    if (keys.length) await redis.del(...keys);
  } catch {
    // Best-effort
  }
};

/** Increment a counter with optional TTL. Returns new value or null. */
const incr = async (key, ttlSeconds) => {
  if (redis === noopRedis) return null;
  try {
    const val = await redis.incr(key);
    if (val === 1 && ttlSeconds) await redis.expire(key, ttlSeconds);
    return val;
  } catch {
    return null;
  }
};

/** True when Redis is connected and usable */
const isRedisReady = () => redis !== noopRedis && redis.status === 'ready';

module.exports = { redis, redisSub, redisPub, connectRedis, getCache, setCache, delCache, incr, isRedisReady };
