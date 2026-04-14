require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const responseTime = require('response-time');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const http = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');

// Config modules
const connectDB = require('./config/database');
const redisConfig = require('./config/redis');
const logger = require('./config/logger');

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const discoveryRoutes = require('./routes/discovery.routes');
const matchRoutes = require('./routes/match.routes');
const messageRoutes = require('./routes/message.routes');
const subscriptionRoutes = require('./routes/subscription.routes');
const reportRoutes = require('./routes/report.routes');
const notificationRoutes = require('./routes/notification.routes');
const callRoutes = require('./routes/call.routes');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const { authMiddleware } = require('./middleware/auth');
const { apiLimiter } = require('./middleware/rateLimiter');

// Import socket handler
const socketHandler = require('./socket/socketHandler');

const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST'],
  },
  // Tune for high concurrency
  pingTimeout: 30000,
  pingInterval: 10000,
  transports: ['websocket', 'polling'],
  perMessageDeflate: {
    threshold: 1024, // Only compress messages > 1 KB
  },
  maxHttpBufferSize: 1e6, // 1 MB max message size
});

// Make io available to routes
app.set('io', io);

// ─── Security middleware ─────────────────────────────────────────────────────
app.use(helmet());
app.use(mongoSanitize());       // Prevent MongoDB operator injection
app.use(hpp());                 // Prevent HTTP parameter pollution

// ─── Performance middleware ──────────────────────────────────────────────────
app.use(compression());
app.use(responseTime());        // Adds X-Response-Time header

// ─── CORS ────────────────────────────────────────────────────────────────────
const corsOptions = {
  origin: process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',') : '*',
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// ─── Logging ─────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
  }));
}

// ─── Body parsing ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));         // Reduced from 10mb
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ─── Global rate limit ───────────────────────────────────────────────────────
app.use('/api/', apiLimiter);

// ─── Health / readiness checks ───────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/ready', async (req, res) => {
  const mongoose = require('mongoose');
  const dbOk = mongoose.connection.readyState === 1;
  const redisOk = redisConfig.isRedisReady();

  const code = dbOk ? 200 : 503;
  res.status(code).json({
    status: code === 200 ? 'ready' : 'not ready',
    db: dbOk ? 'ok' : 'down',
    cache: redisOk ? 'ok' : 'unavailable (optional)',
    workers: process.env.pm_id ?? 'single',
    uptime: Math.round(process.uptime()),
  });
});

// ─── API Routes ──────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', authMiddleware, userRoutes);
app.use('/api/v1/discovery', authMiddleware, discoveryRoutes);
app.use('/api/v1/matches', authMiddleware, matchRoutes);
app.use('/api/v1/messages', authMiddleware, messageRoutes);
app.use('/api/v1/subscriptions', authMiddleware, subscriptionRoutes);
app.use('/api/v1/reports', authMiddleware, reportRoutes);
app.use('/api/v1/notifications', authMiddleware, notificationRoutes);
app.use('/api/v1/calls', authMiddleware, callRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use(errorHandler);

// Socket.io connection
socketHandler(io);

// ─── Startup ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  // Database
  try {
    await connectDB();
  } catch (err) {
    logger.error('MongoDB connection failed:', err);
    process.exit(1);
  }

  // Redis — attach Socket.io adapter when available
  await redisConfig.connectRedis();
  if (redisConfig.isRedisReady()) {
    io.adapter(createAdapter(redisConfig.redisPub, redisConfig.redisSub));
    logger.info('✅ Socket.io Redis adapter attached');
  } else {
    logger.warn('⚠️  Socket.io running without Redis adapter (single-node mode)');
  }

  server.listen(PORT, () => {
    logger.info(`🚀 Worker ${process.pid} listening on port ${PORT}`);
  });

  // Signal PM2 that we're ready
  if (process.send) process.send('ready');
};

startServer();

// ─── Graceful shutdown ───────────────────────────────────────────────────────
const shutdown = (signal) => {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(async () => {
    const mongoose = require('mongoose');
    await mongoose.disconnect();
    redisConfig.redis.disconnect();
    logger.info('Shutdown complete');
    process.exit(0);
  });

  // Force-kill after 10s if shutdown stalls
  setTimeout(() => process.exit(1), 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  shutdown('unhandledRejection');
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  shutdown('uncaughtException');
});

module.exports = { app, server, io };
