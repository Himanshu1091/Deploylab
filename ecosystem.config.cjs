/**
 * pm2 process definition.
 *
 * .cjs because pm2 loads this file with require(), and the backend workspace is
 * ESM — a plain .js here would be read as a module and fail.
 *
 * Only NODE_ENV is set. Every other variable comes from backend/.env, which
 * dotenv loads at startup and which is never committed. Putting secrets here
 * would put them in the repository, which is the thing to avoid.
 */
module.exports = {
  apps: [
    {
      name: 'deploylab',

      // Relative to this file, so the config works whatever the checkout path is.
      cwd: './backend',
      script: 'src/server.js',

      // Fork mode with a single instance. Cluster mode would need a shared store
      // for the rate limiter, whose counters currently live in process memory.
      exec_mode: 'fork',
      instances: 1,

      env: {
        NODE_ENV: 'production',
      },

      // 1 GB of RAM total on the instance. A leak should restart the process
      // rather than push the box into swap and take everything down with it.
      max_memory_restart: '400M',

      // Stop pm2 restart-looping on a crash that repeats immediately, e.g. a bad
      // MONGODB_URI. Backing off makes the logs readable instead of a firehose.
      exp_backoff_restart_delay: 1000,
      max_restarts: 10,

      // SIGTERM triggers the graceful shutdown path in server.js, which drains
      // in-flight requests. Give it room to finish before pm2 forces the issue.
      kill_timeout: 12000,

      merge_logs: true,
      time: true,
    },
  ],
};
