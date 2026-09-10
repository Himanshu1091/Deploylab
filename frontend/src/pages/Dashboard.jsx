import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth.js';
import { getStats, getTeam } from '../api/users.api.js';
import { RoleBadge } from '../components/ui/Badge.jsx';
import { Spinner } from '../components/ui/Spinner.jsx';
import { usePageHeader } from '../context/PageHeaderContext.jsx';
import { initials } from '../utils/initials.js';
import { formatDate } from '../utils/formatDate.js';

const ROLE_SUMMARY = {
  admin: 'You can view every user and change roles, managers, and account status.',
  manager: 'You can view your direct reports.',
  employee: 'You can view and edit your own profile.',
};

function StatCard({ label, value, to, tone = 'default' }) {
  const content = (
    <>
      <span className={`stat__value stat__value--${tone}`}>{value}</span>
      <span className="stat__label">{label}</span>
    </>
  );

  return to ? (
    <Link to={to} className="stat stat--link">
      {content}
      <span className="stat__arrow" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
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

  if (!stats) {
    return (
      <div className="stats stats--loading">
        <Spinner label="Loading statistics" />
      </div>
    );
  }

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
      <StatCard label="Active" value={stats.active} tone="success" />
      <StatCard label="Admins" value={stats.byRole.admin} />
      <StatCard label="Managers" value={stats.byRole.manager} />
      <StatCard label="Employees" value={stats.byRole.employee} />
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const location = useLocation();

  usePageHeader(`Welcome, ${user.name.split(' ')[0]}`, ROLE_SUMMARY[user.role]);

  // Set by RoleRoute when it turns someone away from a page they cannot access.
  const notice = location.state?.notice;

  return (
    <div className="page">
      {notice && <p className="banner banner--warning">{notice}</p>}

      <RoleStats role={user.role} />

      {/* Identity panel beside the detail list, rather than one long list.
          The identity is the thing you glance at; the fields are the thing
          you read, and they deserve different weight. */}
      <section className="card identity">
        <div className="identity__aside">
          <span className="avatar avatar--lg" aria-hidden="true">
            {initials(user.name)}
          </span>
          <p className="identity__name">{user.name}</p>
          <RoleBadge role={user.role} />
        </div>

        <div className="identity__body">
          <h2 className="card__title">Your account</h2>

          <dl className="detail-list">
            <dt>Email</dt>
            <dd>{user.email}</dd>

            {user.manager && (
              <>
                <dt>Manager</dt>
                <dd>{user.manager.name}</dd>
              </>
            )}

            <dt>Member since</dt>
            <dd>{formatDate(user.createdAt)}</dd>
          </dl>
        </div>
      </section>
    </div>
  );
}
