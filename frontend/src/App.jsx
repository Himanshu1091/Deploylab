import { useEffect, useState } from 'react';
import axios from 'axios';

/**
 * Phase 1 placeholder.
 *
 * It exists to prove one thing before any feature is built: that the browser can
 * reach Express through Vite's proxy, and that Express can reach Atlas. If this
 * page is green, the whole plumbing chain is sound. Replaced in Phase 6 by the
 * router and auth shell.
 */
export default function App() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios
      .get('/api/health')
      .then((res) => setHealth(res.data))
      .catch((err) => setError(err.response?.data ?? { message: err.message }));
  }, []);

  const dbUp = health?.db === 'connected';

  return (
    <main className="boot">
      <h1>Deploylab</h1>
      <p className="tagline">RBAC dashboard — a deployment learning project.</p>

      <section className="card">
        <h2>Connectivity check</h2>

        {!health && !error && <p className="muted">Checking…</p>}

        {error && (
          <>
            <p className="status status--bad">API unreachable</p>
            <p className="muted">{error.message}</p>
            <p className="muted">Is the server running on port 5000?</p>
          </>
        )}

        {health && (
          <dl>
            <dt>API</dt>
            <dd className="status status--good">reachable</dd>

            <dt>Database</dt>
            <dd className={dbUp ? 'status status--good' : 'status status--bad'}>{health.db}</dd>

            <dt>Uptime</dt>
            <dd>{health.uptime}s</dd>
          </dl>
        )}
      </section>

      <p className="muted next">Next: Phase 3 — data model and seeding.</p>
    </main>
  );
}
