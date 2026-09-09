import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';

/** Keeps a signed-in user off the login and register screens. */
export function GuestRoute() {
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
