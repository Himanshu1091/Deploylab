import { Link, NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth.js';
import { RoleBadge } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';

/** Navigation is built from the role, so no link appears that would 403. */
const NAV_BY_ROLE = {
  admin: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/admin/users', label: 'Users' },
    { to: '/profile', label: 'Profile' },
  ],
  manager: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/team', label: 'My Team' },
    { to: '/profile', label: 'Profile' },
  ],
  employee: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/profile', label: 'Profile' },
  ],
};

export function AppShell() {
  const { user, logout } = useAuth();
  const links = NAV_BY_ROLE[user.role] ?? [];

  return (
    <div className="shell">
      <header className="shell__header">
        <div className="shell__header-inner">
          <Link to="/dashboard" className="wordmark">
            Deploylab
          </Link>

          <nav className="nav">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => `nav__link ${isActive ? 'nav__link--active' : ''}`.trim()}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="shell__user">
            <span className="shell__user-name">{user.name}</span>
            <RoleBadge role={user.role} />
            <Button variant="ghost" onClick={logout}>
              Log out
            </Button>
          </div>
        </div>
      </header>

      <main className="shell__main">
        <Outlet />
      </main>
    </div>
  );
}
