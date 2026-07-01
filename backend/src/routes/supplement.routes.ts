import { Router } from 'express';
import { getSupplements, createSupplement, updateSupplement, deleteSupplement } from '../controllers/supplement.controller.js';
import { authenticateToken, requireRoles } from '../middleware/auth.js';
import { UserRole } from '@prisma/client';

const router = Router();
router.use(authenticateToken as any);

router.get('/', getSupplements as any);
router.post('/', requireRoles([UserRole.ADMIN, UserRole.STAFF]) as any, createSupplement as any);
router.put('/:id', requireRoles([UserRole.ADMIN, UserRole.STAFF]) as any, updateSupplement as any);
router.delete('/:id', requireRoles([UserRole.ADMIN, UserRole.STAFF]) as any, deleteSupplement as any);

export default router;
