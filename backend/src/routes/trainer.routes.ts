import { Router } from 'express';
import {
  createTrainer,
  getTrainers,
  getTrainerById,
  updateTrainer,
  deleteTrainer,
} from '../controllers/trainer.controller.js';
import { authenticateToken, requireRoles } from '../middleware/auth.js';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authenticateToken as any);

router.get('/', getTrainers);
router.get('/:id', getTrainerById);

router.post('/', requireRoles([UserRole.ADMIN, UserRole.STAFF]) as any, createTrainer);
router.put('/:id', requireRoles([UserRole.ADMIN, UserRole.STAFF]) as any, updateTrainer);
router.delete('/:id', requireRoles([UserRole.ADMIN]) as any, deleteTrainer);

export default router;
