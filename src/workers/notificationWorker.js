/**
 * workers/notificationWorker.js
 *
 * Processes push notification jobs from the 'notifications' Bull queue.
 * Run this as a separate process so it doesn't share CPU with the API server:
 *
 *   node src/workers/notificationWorker.js
 *
 * Or add it to ecosystem.config.js as a second PM2 app.
 */

require('dotenv').config();
const { notificationQueue } = require('../queues');
const { sendAndSaveNotification } = require('../utils/firebase');
const logger = require('../config/logger');

const CONCURRENCY = parseInt(process.env.NOTIFICATION_CONCURRENCY) || 10;

notificationQueue.process(CONCURRENCY, async (job) => {
  const { userId, fcmToken, type, title, body, imageUrl, data } = job.data;

  try {
    await sendAndSaveNotification({ userId, fcmToken, type, title, body, imageUrl, data });
    logger.info(`Notification sent: type=${type} userId=${userId}`);
  } catch (err) {
    logger.error(`Notification failed: type=${type} userId=${userId} error=${err.message}`);
    throw err; // Rethrow so Bull retries with backoff
  }
});

notificationQueue.on('failed', (job, err) => {
  logger.error(`Notification job ${job.id} permanently failed after ${job.opts.attempts} attempts: ${err.message}`);
});

logger.info(`🔔 Notification worker started (concurrency=${CONCURRENCY})`);

// Graceful shutdown
process.on('SIGTERM', async () => {
  await notificationQueue.close();
  process.exit(0);
});
