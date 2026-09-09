import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import * as authApi from '../api/auth.api.js';
import { setUnauthorizedHandler } from '../api/client.js';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  // Starts true so the app can block rendering until the session is known.
  // Without this gate, a logged-in user refreshing the page would see the login
  // screen flash before being restored — which reads as a bug, not a delay.
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  // One interceptor handles session expiry for the whole app, so no individual
  // API call has to think about it. Registered via a ref-stable callback so the
  // effect does not re-run on every navigation.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setSessionExpired(true);
      navigateRef.current('/login', { replace: true });
    });

    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    authApi
      .me()
      .then((restored) => {
        if (!cancelled) setUser(restored);
      })
      .catch(() => {
        // A 401 here just means nobody is logged in.
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    // Cleared when the attempt starts, not when it succeeds. The notice explains
    // why the user landed on this page; once they act on it, it is stale. Leaving
    // it until success stacks it above the error from a failed attempt, which
    // reads as two unrelated problems.
    setSessionExpired(false);

    const loggedIn = await authApi.login(credentials);
    setUser(loggedIn);
    return loggedIn;
  }, []);

  const register = useCallback(async (payload) => {
    setSessionExpired(false);

    const created = await authApi.register(payload);
    setUser(created);
    return created;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      // Cleared even if the request fails. Otherwise a network blip would strand
      // the user in a half-logged-out state with no way forward.
      setUser(null);
      setSessionExpired(false);
      navigateRef.current('/login', { replace: true });
    }
  }, []);

  /** Re-reads the current user, e.g. after a profile update. */
  const refresh = useCallback(async () => {
    const fresh = await authApi.me();
    setUser(fresh);
    return fresh;
  }, []);

  const value = useMemo(
    () => ({ user, loading, sessionExpired, login, register, logout, refresh, setUser }),
    [user, loading, sessionExpired, login, register, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
