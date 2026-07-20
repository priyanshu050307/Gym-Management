import { Router } from 'express';
import { createTrainer, getTrainers, getTrainerById, updateTrainer, deleteTrainer, getMyPTMembers, getMySchedule, } from '../controllers/trainer.controller.js';
import { getTrainerFeedback } from '../controllers/feedback.controller.js';
import { authenticateToken, requireRoles } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createTrainerSchema, updateTrainerSchema } from '../schemas/trainer.schema.js';
import { UserRole } from '@prisma/client';
const router = Router();
router.use(authenticateToken);
// Trainer self-service endpoints (must come before /:id to avoid route collision)
router.get('/me/members', requireRoles([UserRole.TRAINER]), getMyPTMembers);
router.get('/me/schedule', requireRoles([UserRole.TRAINER]), getMySchedule);
router.get('/', getTrainers);
router.get('/:id', getTrainerById);
router.get('/:id/feedback', getTrainerFeedback);
router.post('/', requireRoles([UserRole.ADMIN, UserRole.STAFF]), validate(createTrainerSchema), createTrainer);
router.put('/:id', requireRoles([UserRole.ADMIN, UserRole.STAFF]), validate(updateTrainerSchema), updateTrainer);
router.delete('/:id', requireRoles([UserRole.ADMIN, UserRole.STAFF]), deleteTrainer);
export default router;
