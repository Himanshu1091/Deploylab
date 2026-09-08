import { Router } from 'express';
import { getHealth } from '../controllers/health.controller.js';

const router = Router();

router.get('/health', getHealth);

// Mounted in later phases:
// router.use('/auth', authRoutes);   Phase 4
// router.use('/users', userRoutes);  Phase 5

export default router;
