import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth.js';
import { RoleBadge } from '../ui/Badge.jsx';
import { ThemeToggle } from '../ui/ThemeToggle.jsx';
import { initials } from '../../utils/initials.js';
import { PageHeaderProvider, useHeaderSlots } from '../../context/PageHeaderContext.jsx';

const ICONS = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  team: <><path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy="7" r="4" /><path d="M22 11h-6" /></>,
  profile: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>,
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  close: <path d="M18 6L6 18M6 6l12 12" />,
};

function Icon({ name }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

/** Navigation is built from the role, so no link appears that would 403. */
const NAV_BY_ROLE = {
  admin: [
    { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { to: '/admin/users', label: 'Users', icon: 'users' },
    { to: '/profile', label: 'Profile', icon: 'profile' },
  ],
  manager: [
    { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { to: '/team', label: 'My Team', icon: 'team' },
    { to: '/profile', label: 'Profile', icon: 'profile' },
  ],
  employee: [
    { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    { to: '/profile', label: 'Profile', icon: 'profile' },
  ],
};


/**
 * The provider has to wrap both the topbar and the outlet, and a component
 * cannot consume a context it renders itself — hence the split.
 */
export function AppShell() {
  return (
    <PageHeaderProvider>
      <Shell />
    </PageHeaderProvider>
  );
}

function Shell() {
  const { user, logout } = useAuth();
  const { header, setActionsSlot } = useHeaderSlots();
  const links = NAV_BY_ROLE[user.role] ?? [];

  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer on navigation. Without this you tap a link and
  // the drawer stays over the page you just asked for.
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  return (
    <div className={`shell ${navOpen ? 'shell--nav-open' : ''}`.trim()}>
      <aside className="sidebar">
        <div className="sidebar__head">
          <Link to="/dashboard" className="wordmark">
            <span className="wordmark__mark" aria-hidden="true" />
            Deploylab
          </Link>

          <button
            type="button"
            className="icon-btn sidebar__close"
            onClick={() => setNavOpen(false)}
            aria-label="Close navigation"
          >
            <Icon name="close" />
          </button>
        </div>

        <nav className="nav" aria-label="Main">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `nav__link ${isActive ? 'nav__link--active' : ''}`.trim()}
            >
              <Icon name={link.icon} />
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__foot">
          <div className="user-chip">
            <span className="avatar" aria-hidden="true">
              {initials(user.name)}
            </span>

            <div className="user-chip__text">
              <span className="user-chip__name">{user.name}</span>
              <RoleBadge role={user.role} />
            </div>
          </div>

          <button type="button" className="nav__link nav__link--action" onClick={logout}>
            <Icon name="logout" />
            Log out
          </button>
        </div>
      </aside>

      {/* Only rendered while open, so it cannot swallow clicks on desktop. */}
      {navOpen && (
        <div
          className="sidebar__scrim"
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="shell__body">
        {/* The topbar is the page header. Keeping a second one in the page
            body duplicated the same words a few pixels lower and left this
            bar looking empty. */}
        <header className="topbar">
          <button
            type="button"
            className="icon-btn topbar__menu"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
          >
            <Icon name="menu" />
          </button>

          <div className="topbar__text">
            <h1 className="topbar__title">{header.title}</h1>
            {header.description && (
              <p className="topbar__description">{header.description}</p>
            )}
          </div>

          <div className="topbar__actions" ref={setActionsSlot} />

          <ThemeToggle />
        </header>

        <main className="shell__main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
