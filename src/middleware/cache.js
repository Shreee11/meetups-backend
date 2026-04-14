const { getCache, setCache } = require('../config/redis');

/**
 * Route-level response cache middleware.
 *
 * Usage:
 *   router.get('/heavy', cache(60), handler)    // cache 60 seconds
 *
 * The cache key includes the authenticated user's ID and the full query string
 * so different users always get their own data.
 */
const cache = (ttlSeconds = 300) => async (req, res, next) => {
  // Skip caching for non-GET requests
  if (req.method !== 'GET') return next();

  const userId = req.userId || 'anon';
  const key = `route:${userId}:${req.originalUrl.split('?')[0]}`;

  const cached = await getCache(key);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  // Intercept res.json to store the response in cache
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode === 200) {
      setCache(key, body, ttlSeconds).catch(() => {});
    }
    res.setHeader('X-Cache', 'MISS');
    return originalJson(body);
  };

  next();
};

module.exports = cache;
