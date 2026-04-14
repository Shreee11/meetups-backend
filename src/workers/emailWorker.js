/**
 * workers/emailWorker.js — Processes email jobs from the 'emails' Bull queue.
 *
 * Run as a separate process:
 *   node src/workers/emailWorker.js
 */

require('dotenv').config();
const { emailQueue } = require('../queues');
const { sendEmail } = require('../utils/email');
const logger = require('../config/logger');

const CONCURRENCY = parseInt(process.env.EMAIL_CONCURRENCY) || 5;

emailQueue.process(CONCURRENCY, async (job) => {
  const { to, subject, html, text } = job.data;

  try {
    await sendEmail({ to, subject, html, text });
    logger.info(`Email sent: to=${to} subject="${subject}"`);
  } catch (err) {
    logger.error(`Email failed: to=${to} error=${err.message}`);
    throw err;
  }
});

emailQueue.on('failed', (job, err) => {
  logger.error(`Email job ${job.id} permanently failed: ${err.message}`);
});

logger.info(`📧 Email worker started (concurrency=${CONCURRENCY})`);

process.on('SIGTERM', async () => {
  await emailQueue.close();
  process.exit(0);
});
