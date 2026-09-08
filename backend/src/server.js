import app from './app.js';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';

const SHUTDOWN_TIMEOUT_MS = 10000;

let server;

async function start() {
  await connectDB();

  // Bind to loopback in production: nginx is the only intended entry point, so
  // port 5000 stays unreachable from the internet regardless of firewall rules.
  const host = env.isProd ? '127.0.0.1' : '0.0.0.0';

  server = app.listen(env.PORT, host, () => {
    console.log(`[server] ${env.NODE_ENV} - listening on http://${host}:${env.PORT}`);
    console.log(`[server] health: http://localhost:${env.PORT}/api/health`);
  });
}

/**
 * Drain in-flight requests before exiting. Without this, every `pm2 reload`
 * drops whatever was mid-flight at that moment.
 */
async function shutdown(signal) {
  console.log(`\n[server] ${signal} received - shutting down`);

  const forceExit = setTimeout(() => {
    console.error('[server] graceful shutdown timed out - forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  try {
    if (server) await new Promise((resolve) => server.close(resolve));
    await disconnectDB();
    console.log('[server] shutdown complete');
    process.exit(0);
  } catch (err) {
    console.error('[server] error during shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandled rejection:', reason);
  shutdown('unhandledRejection');
});

start().catch((err) => {
  console.error('[server] failed to start:', err.message);
  process.exit(1);
});
