/**
 * cluster.js — Entry point that forks one worker per CPU core.
 *
 * Why: Node.js is single-threaded. At 1M users you need all CPU cores.
 * 4-core server → 4 workers → 4× throughput.
 *
 * Usage:
 *   Development:  node src/server.js          (single process, fast reload)
 *   Production:   node src/cluster.js          (multi-process)
 *   PM2:          pm2 start ecosystem.config.js
 */

const cluster = require('cluster');
const os = require('os');

const WORKERS = parseInt(process.env.WEB_CONCURRENCY) || os.cpus().length;

if (cluster.isPrimary) {
  console.log(`🚀 Master process ${process.pid} starting ${WORKERS} workers`);

  for (let i = 0; i < WORKERS; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.warn(`⚠️  Worker ${worker.process.pid} died (code ${code}, signal ${signal}). Restarting...`);
    cluster.fork(); // Auto-restart crashed workers
  });

  cluster.on('online', (worker) => {
    console.log(`✅ Worker ${worker.process.pid} online`);
  });
} else {
  // Each worker runs the Express/Socket.io server
  require('./server');
}
