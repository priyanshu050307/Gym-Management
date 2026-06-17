import { Router } from 'express';
import {
  createClass,
  getClasses,
  getClassById,
  updateClass,
  deleteClass,
} from '../controllers/class.controller.js';
import { authenticateToken, requireRoles } from '../middleware/auth.js';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authenticateToken as any);

router.get('/', getClasses);
router.get('/:id', getClassById);

router.post('/', requireRoles([UserRole.ADMIN, UserRole.STAFF]) as any, createClass);
router.put('/:id', requireRoles([UserRole.ADMIN, UserRole.STAFF]) as any, updateClass);
router.delete('/:id', requireRoles([UserRole.ADMIN]) as any, deleteClass);

export default router;
