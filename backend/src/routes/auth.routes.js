import { Router } from 'express';

import * as authController from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { loginLimiter, registerLimiter } from '../middleware/rateLimiter.js';
import { registerSchema, loginSchema } from '../validators/auth.schema.js';

const router = Router();

// The limiter runs before validation, so a flood of malformed requests is
// counted and cut off rather than being cheap to send.
router.post('/register', registerLimiter, validate(registerSchema), authController.register);
router.post('/login', loginLimiter, validate(loginSchema), authController.login);
router.post('/logout', authController.logout);
router.get('/me', requireAuth, authController.me);

export default router;
