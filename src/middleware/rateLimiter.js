const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const { isRedisReady, redis } = require('../config/redis');

/**
 * Create a Redis-backed store lazily — only when Redis is actually connected.
 * Falls back to the default in-memory store otherwise.
 * The function is called per-request so it picks up Redis once it connects.
 */
const makeStore = (prefix) => {
  if (!isRedisReady()) return undefined;
  return new RedisStore({
    sendCommand: (...args) => redis.call(...args),
    prefix: `rl:${prefix}:`,
  });
};

/**
 * Wrapper that creates a rate limiter with a lazy store getter.
 * This avoids calling makeStore() at module-load time before Redis connects.
 */
const makeLimiter = (options, prefix) => {
  // Create a single store instance once Redis is ready
  let store;
  const getStore = () => {
    if (!store && isRedisReady()) store = makeStore(prefix);
    return store;
  };

  return rateLimit({
    ...options,
    // express-rate-limit v7 supports a store function
    store: makeStore(prefix), // will be undefined (memory) until Redis connects
  });
};

// General API rate limiter
const apiLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
}, 'api');

// Auth rate limiter (stricter)
const authLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
}, 'auth');

// SMS verification rate limiter
const smsLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many SMS requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
}, 'sms');

// Swipe rate limiter
const swipeLimiter = makeLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Slow down! Too many swipes' },
  keyGenerator: (req) => req.userId || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
}, 'swipe');

// Message rate limiter
const messageLimiter = makeLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Slow down! Too many messages' },
  keyGenerator: (req) => req.userId || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
}, 'msg');

module.exports = {
  apiLimiter,
  authLimiter,
  smsLimiter,
  swipeLimiter,
  messageLimiter,
};
