import { ApiError } from '../utils/ApiError.js';

/**
 * Gate a route behind one or more roles. Must run after requireAuth.
 *
 *   router.get('/', requireAuth, requireRole('admin'), controller.list)
 *
 * This is the actual security boundary. The client's route guards exist so a
 * manager does not land on a broken admin screen; they stop nobody, because
 * anyone can edit the JavaScript running in their own browser.
 */
export function requireRole(...roles) {
  return function checkRole(req, _res, next) {
    if (!req.user) {
      // Reaching here means requireRole was mounted without requireAuth in
      // front of it. Fail closed rather than reading a role off undefined.
      return next(ApiError.unauthorized('Not authenticated.'));
    }

    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden());
    }

    return next();
  };
}
