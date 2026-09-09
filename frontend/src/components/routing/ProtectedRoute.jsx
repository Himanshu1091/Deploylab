import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';

/**
 * Blocks a route for guests.
 *
 * This is a usability guard, not a security boundary. Anyone can edit the
 * JavaScript running in their own browser, so the server re-checks every
 * request independently. What this buys is a sensible redirect instead of a
 * screen full of failed requests.
 */
export function ProtectedRoute() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    // Remember where they were headed, so login can return them there rather
    // than dumping everyone on the dashboard.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
