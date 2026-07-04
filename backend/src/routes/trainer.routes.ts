import { Router } from 'express';
import {
  createTrainer,
  getTrainers,
  getTrainerById,
  updateTrainer,
  deleteTrainer,
  getMyPTMembers,
  getMySchedule,
} from '../controllers/trainer.controller.js';
import { getTrainerFeedback } from '../controllers/feedback.controller.js';
import { authenticateToken, requireRoles } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createTrainerSchema, updateTrainerSchema } from '../schemas/trainer.schema.js';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authenticateToken as any);

// Trainer self-service endpoints (must come before /:id to avoid route collision)
router.get('/me/members', requireRoles([UserRole.TRAINER]) as any, getMyPTMembers as any);
router.get('/me/schedule', requireRoles([UserRole.TRAINER]) as any, getMySchedule as any);

router.get('/', getTrainers);
router.get('/:id', getTrainerById);
router.get('/:id/feedback', getTrainerFeedback as any);

router.post('/', requireRoles([UserRole.ADMIN, UserRole.STAFF]) as any, validate(createTrainerSchema), createTrainer);
router.put('/:id', requireRoles([UserRole.ADMIN, UserRole.STAFF]) as any, validate(updateTrainerSchema), updateTrainer);
router.delete('/:id', requireRoles([UserRole.ADMIN, UserRole.STAFF]) as any, deleteTrainer);

export default router;
