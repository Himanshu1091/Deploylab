import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

/** Any /api path that matched no route lands here. */
export function notFound(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`, 'ROUTE_NOT_FOUND'));
}

/**
 * The single place in the codebase that formats an error response.
 *
 * Express 5 forwards rejected promises from async handlers automatically, so
 * route handlers need no try/catch wrapper — a thrown ApiError arrives here.
 */
// eslint-disable-next-line no-unused-vars -- Express identifies error middleware by arity
export function errorHandler(err, req, res, next) {
  let { status, message, code } = err;

  // Mongoose duplicate key — surfaces when two users register the same email
  // in the same instant and both pass the pre-insert existence check.
  if (err.code === 11000) {
    status = 409;
    code = 'EMAIL_EXISTS';
    message = 'An account with this email already exists.';
  }

  // Malformed ObjectId in a route parameter
  if (err.name === 'CastError') {
    status = 400;
    code = 'INVALID_ID';
    message = 'Invalid identifier.';
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    status = 401;
    code = 'UNAUTHORIZED';
    message = 'Session invalid or expired.';
  }

  status = status || 500;
  code = code || 'INTERNAL_ERROR';

  // Unexpected faults are logged in full and reported generically. Leaking an
  // internal message to a client is how database structure and file paths escape.
  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
    if (env.isProd) message = 'Something went wrong. Please try again.';
  }

  const body = { success: false, message: message || 'Something went wrong.', code };
  if (!env.isProd && err.stack) body.stack = err.stack;

  res.status(status).json(body);
}
