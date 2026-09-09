import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth.js';
import { getStats, getTeam } from '../api/users.api.js';
import { RoleBadge } from '../components/ui/Badge.jsx';
import { Spinner } from '../components/ui/Spinner.jsx';
import { formatDate } from '../utils/formatDate.js';

const ROLE_SUMMARY = {
  admin: 'You can view every user and change roles, managers, and account status.',
  manager: 'You can view your direct reports.',
  employee: 'You can view and edit your own profile.',
};

function StatCard({ label, value, to }) {
  const content = (
    <>
      <span className="stat__value">{value}</span>
      <span className="stat__label">{label}</span>
    </>
  );

  return to ? (
    <Link to={to} className="stat stat--link">
      {content}
    </Link>
  ) : (
    <div className="stat">{content}</div>
  );
}

/** Admin sees system-wide counts; manager sees their own team size. */
function RoleStats({ role }) {
  const [stats, setStats] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const request = role === 'admin' ? getStats() : role === 'manager' ? getTeam() : null;
    if (!request) return undefined;

    request
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch(() => {
        // The dashboard is still useful without counts, so a failure here
        // degrades quietly rather than replacing the whole page with an error.
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [role]);

  if (role === 'employee') return null;
  if (failed) return <p className="muted">Statistics are unavailable right now.</p>;
  if (!stats) return <Spinner label="Loading statistics" />;

  if (role === 'manager') {
    return (
      <div className="stats">
        <StatCard label="Direct reports" value={stats.count} to="/team" />
      </div>
    );
  }

  return (
    <div className="stats">
      <StatCard label="Total users" value={stats.total} to="/admin/users" />
      <StatCard label="Active" value={stats.active} />
      <StatCard label="Admins" value={stats.byRole.admin} />
      <StatCard label="Managers" value={stats.byRole.manager} />
      <StatCard label="Employees" value={stats.byRole.employee} />
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const location = useLocation();

  // Set by RoleRoute when it turns someone away from a page they cannot access.
  const notice = location.state?.notice;

  return (
    <div className="page">
      {notice && <p className="banner banner--warning">{notice}</p>}

      <h1 className="page__title">Welcome, {user.name.split(' ')[0]}</h1>
      <p className="page__lead">{ROLE_SUMMARY[user.role]}</p>

      <RoleStats role={user.role} />

      <section className="card">
        <h2 className="card__title">Your account</h2>

        <dl className="detail-list">
          <dt>Name</dt>
          <dd>{user.name}</dd>

          <dt>Email</dt>
          <dd>{user.email}</dd>

          <dt>Role</dt>
          <dd>
            <RoleBadge role={user.role} />
          </dd>

          {user.manager && (
            <>
              <dt>Manager</dt>
              <dd>{user.manager.name}</dd>
            </>
          )}

          <dt>Member since</dt>
          <dd>{formatDate(user.createdAt)}</dd>
        </dl>
      </section>
    </div>
  );
}
