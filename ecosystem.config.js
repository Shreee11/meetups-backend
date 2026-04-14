/**
 * PM2 Ecosystem Config — production process management
 *
 * Usage:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 reload ecosystem.config.js --env production   (zero-downtime reload)
 *   pm2 monit
 */

module.exports = {
  apps: [
    {
      name: 'tender-api',
      script: 'src/cluster.js',
      instances: 'max',           // One process per CPU core
      exec_mode: 'fork',          // Cluster handled by our cluster.js
      watch: false,
      max_memory_restart: '512M', // Restart if memory leaks past 512 MB

      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      merge_logs: true,

      // Graceful restart
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,

      // Auto-restart on crash
      autorestart: true,
      max_restarts: 10,
      restart_delay: 1000,
    },
  ],
};
