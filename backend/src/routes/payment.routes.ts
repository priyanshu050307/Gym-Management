import { Router } from 'express';
import {
  getPayments,
  recordManualPayment,
  processMockCardPayment,
  downloadInvoice
} from '../controllers/payment.controller.js';
import { authenticateToken, requireRoles } from '../middleware/auth.js';
import { UserRole } from '@prisma/client';

const router = Router();

// Secure all endpoints
router.use(authenticateToken as any);

router.get('/', requireRoles([UserRole.ADMIN, UserRole.STAFF]) as any, getPayments);
router.post('/:id/manual', requireRoles([UserRole.ADMIN, UserRole.STAFF]) as any, recordManualPayment);
router.post('/:id/mock-pay', processMockCardPayment as any);
router.get('/:id/invoice', downloadInvoice as any);

export default router;
