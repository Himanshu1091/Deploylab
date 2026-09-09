import rateLimit from 'express-rate-limit';
import { ApiError } from '../utils/ApiError.js';

const MINUTE = 60 * 1000;

/**
 * Routes the rejection through the normal error handler, so a 429 comes back in
 * the same envelope as every other error and the client needs no special case.
 */
function reject(_req, _res, next) {
  next(new ApiError(429, 'Too many attempts. Try again in a few minutes.', 'RATE_LIMITED'));
}

const base = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: reject,
};

/**
 * Login is the brute-force target, so it gets the tightest budget.
 *
 * Counting is per IP, which only works because `app.set('trust proxy', 1)` lets
 * Express read the real address out of X-Forwarded-For. Without that, every
 * request behind nginx looks like 127.0.0.1 and one attacker locks out everyone.
 */
export const loginLimiter = rateLimit({
  ...base,
  windowMs: 15 * MINUTE,
  limit: 10,

  // Only failed attempts count. What is being stopped is password guessing, and
  // a successful login is evidence the password is already known. Counting
  // successes would lock out someone signing in across several devices while
  // doing nothing extra against an attacker.
  skipSuccessfulRequests: true,
});

/** Slower still: automated signup abuse is the thing being stopped here. */
export const registerLimiter = rateLimit({ ...base, windowMs: 60 * MINUTE, limit: 5 });

/**
 * A backstop for everything else. Health is exempt so an uptime monitor polling
 * every few seconds cannot exhaust the budget and start reporting the service
 * as down when it is fine.
 */
export const apiLimiter = rateLimit({
  ...base,
  windowMs: 15 * MINUTE,
  limit: 200,
  skip: (req) => req.path === '/health',
});
