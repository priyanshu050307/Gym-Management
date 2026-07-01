import { Router } from 'express';
import { getSupplementSales, recordSupplementSale } from '../controllers/sale.controller.js';
import { authenticateToken, requireRoles } from '../middleware/auth.js';
import { UserRole } from '@prisma/client';

const router = Router();
router.use(authenticateToken as any);

router.get('/', getSupplementSales as any);
router.post('/', requireRoles([UserRole.ADMIN, UserRole.STAFF]) as any, recordSupplementSale as any);

export default router;
