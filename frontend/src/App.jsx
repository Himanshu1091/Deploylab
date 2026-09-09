import { Navigate, Route, Routes } from 'react-router-dom';

import { useAuth } from './hooks/useAuth.js';
import { FullPageSpinner } from './components/ui/Spinner.jsx';
import { AppShell } from './components/layout/AppShell.jsx';
import { GuestRoute } from './components/routing/GuestRoute.jsx';
import { ProtectedRoute } from './components/routing/ProtectedRoute.jsx';
import { RoleRoute } from './components/routing/RoleRoute.jsx';

import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Profile from './pages/Profile.jsx';
import AdminUsers from './pages/AdminUsers.jsx';
import Team from './pages/Team.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  const { loading } = useAuth();

  // Nothing renders until the session is known. Routing before this point would
  // show the login screen for a moment to someone who is in fact logged in.
  if (loading) {
    return <FullPageSpinner label="Restoring session" />;
  }

  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />

          <Route element={<RoleRoute roles={['admin']} />}>
            <Route path="/admin/users" element={<AdminUsers />} />
          </Route>

          <Route element={<RoleRoute roles={['manager']} />}>
            <Route path="/team" element={<Team />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
