import * as authService from '../services/auth.service.js';
import { serializeUser } from '../utils/serializeUser.js';
import { COOKIE_NAME, cookieOptions } from '../config/cookie.js';

/** Signs a token for the user and attaches it as the session cookie. */
function startSession(res, user) {
  const token = authService.signToken(user);
  res.cookie(COOKIE_NAME, token, cookieOptions(authService.tokenLifetimeMs(token)));
}

export async function register(req, res) {
  const user = await authService.register(req.body);

  // Registration logs the user straight in. Asking someone to type the password
  // they just chose, one screen later, is friction with no security value.
  startSession(res, user);

  res.status(201).json({ success: true, data: { user: serializeUser(user) } });
}

export async function login(req, res) {
  const user = await authService.login(req.body);
  startSession(res, user);

  res.json({ success: true, data: { user: serializeUser(user) } });
}

export function logout(_req, res) {
  // Same attributes as when the cookie was set, minus maxAge. A browser will
  // only clear a cookie when name, path, and flags all match.
  res.clearCookie(COOKIE_NAME, cookieOptions());

  // Idempotent: succeeds whether or not a session existed, so a client can
  // always reach a logged-out state.
  res.json({ success: true, data: { message: 'Logged out.' } });
}

export async function me(req, res) {
  // requireAuth already loaded the user; populate the manager for display.
  await req.user.populate('managerId', 'name');

  res.json({ success: true, data: { user: serializeUser(req.user) } });
}
