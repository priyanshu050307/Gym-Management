import { Router } from 'express';
import { getEquipments, createEquipment, updateEquipment, deleteEquipment } from '../controllers/equipment.controller.js';
import { authenticateToken, requireRoles } from '../middleware/auth.js';
import { UserRole } from '@prisma/client';

const router = Router();
router.use(authenticateToken as any);

router.get('/', getEquipments as any);
router.post('/', requireRoles([UserRole.ADMIN, UserRole.STAFF]) as any, createEquipment as any);
router.put('/:id', requireRoles([UserRole.ADMIN, UserRole.STAFF]) as any, updateEquipment as any);
router.delete('/:id', requireRoles([UserRole.ADMIN, UserRole.STAFF]) as any, deleteEquipment as any);

export default router;
