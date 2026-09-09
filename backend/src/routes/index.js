import { Router } from 'express';

import { getHealth } from '../controllers/health.controller.js';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';

const router = Router();

router.get('/health', getHealth);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);

export default router;
