import { Router } from 'express';
import { getSupplementSales, recordSupplementSale } from '../controllers/sale.controller.js';
import { authenticateToken, requireRoles } from '../middleware/auth.js';
import { UserRole } from '@prisma/client';
const router = Router();
router.use(authenticateToken);
router.get('/', getSupplementSales);
router.post('/', requireRoles([UserRole.ADMIN, UserRole.STAFF]), recordSupplementSale);
export default router;
