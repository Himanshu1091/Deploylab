import jwt from 'jsonwebtoken';

import User from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';
import { COOKIE_NAME } from '../config/cookie.js';

/**
 * Verifies the session cookie and attaches the current user to the request.
 *
 * The user is re-read from the database on every request rather than trusted
 * from the token payload. That costs one indexed lookup and buys two things:
 * deactivating an account cuts off its live session immediately, and a role
 * change applies on the next request instead of up to 24 hours later when the
 * token would have expired.
 *
 * Express 5 forwards rejected promises to the error handler, so a jwt.verify
 * failure lands there and is translated into a 401.
 */
export async function requireAuth(req, _res, next) {
  const token = req.cookies?.[COOKIE_NAME];

  if (!token) {
    return next(ApiError.unauthorized('Not authenticated.'));
  }

  // Throws JsonWebTokenError / TokenExpiredError, both mapped to 401 by the
  // error handler.
  const payload = jwt.verify(token, env.JWT_SECRET);

  const user = await User.findById(payload.sub);

  if (!user) {
    return next(ApiError.unauthorized('Not authenticated.'));
  }

  if (!user.isActive) {
    return next(
      ApiError.unauthorized('This account has been deactivated.', 'ACCOUNT_DISABLED')
    );
  }

  req.user = user;
  return next();
}
