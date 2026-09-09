import { Router } from 'express';

import * as userController from '../controllers/user.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import {
  updateMeSchema,
  listUsersSchema,
  changeRoleSchema,
  changeStatusSchema,
  assignManagerSchema,
} from '../validators/user.schema.js';

const router = Router();

// Every route below needs a session.
router.use(requireAuth);

// Literal paths must be declared before any `/:id` route. Express matches in
// declaration order, so a later `/:id` would happily capture "stats" and "team"
// as identifiers and fail on an invalid ObjectId instead of routing correctly.
router.patch('/me', validate(updateMeSchema), userController.updateMe);
router.get('/stats', requireRole('admin'), userController.stats);
router.get('/team', requireRole('manager'), userController.team);

router.get('/', requireRole('admin'), validate(listUsersSchema), userController.list);

router.patch(
  '/:id/role',
  requireRole('admin'),
  validate(changeRoleSchema),
  userController.changeRole
);
router.patch(
  '/:id/status',
  requireRole('admin'),
  validate(changeStatusSchema),
  userController.changeStatus
);
router.patch(
  '/:id/manager',
  requireRole('admin'),
  validate(assignManagerSchema),
  userController.assignManager
);

export default router;
