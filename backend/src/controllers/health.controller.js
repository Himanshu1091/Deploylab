import { isDbConnected } from '../config/db.js';

/**
 * Unauthenticated. This is what an uptime monitor, a load balancer, or the
 * post-deploy smoke test in CI polls — so it reports the database too. A process
 * that is listening but cannot reach its database is not actually healthy.
 */
export function getHealth(_req, res) {
  const dbUp = isDbConnected();

  res.status(dbUp ? 200 : 503).json({
    status: dbUp ? 'ok' : 'degraded',
    db: dbUp ? 'connected' : 'disconnected',
    uptime: Number(process.uptime().toFixed(2)),
    timestamp: new Date().toISOString(),
  });
}
