import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';

/**
 * Restricts a route to specific roles.
 *
 * Again: cosmetic. An employee who types /admin/users is bounced here for a
 * clean experience, but the API returns 403 regardless of what the client does.
 */
export function RoleRoute({ roles }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace state={{ notice: 'You do not have access to that page.' }} />;
  }

  return <Outlet />;
}
