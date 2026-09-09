import { Router } from 'express';

import { getHealth } from '../controllers/health.controller.js';
import authRoutes from './auth.routes.js';

const router = Router();

router.get('/health', getHealth);
router.use('/auth', authRoutes);

// Mounted in a later phase:
// router.use('/users', userRoutes);  Phase 5

export default router;
