import { useLocation } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth.js';
import { RoleBadge } from '../components/ui/Badge.jsx';

const ROLE_SUMMARY = {
  admin: 'You can view every user and change roles, managers, and account status.',
  manager: 'You can view your direct reports.',
  employee: 'You can view and edit your own profile.',
};

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
        </dl>
      </section>

      <p className="muted">Role-specific statistics arrive in Phase 7.</p>
    </div>
  );
}
