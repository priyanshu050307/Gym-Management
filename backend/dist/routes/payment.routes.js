import { Router } from 'express';
import { getPayments, recordManualPayment, processMockCardPayment, downloadInvoice, refundPayment, getDailyCollectionReport } from '../controllers/payment.controller.js';
import { createRazorpayOrder, verifyRazorpayPayment } from '../controllers/razorpay.controller.js';
import { authenticateToken, requireRoles } from '../middleware/auth.js';
import { UserRole } from '@prisma/client';
const router = Router();
// Secure all endpoints
router.use(authenticateToken);
router.get('/report/daily', requireRoles([UserRole.ADMIN, UserRole.STAFF]), getDailyCollectionReport);
router.get('/', requireRoles([UserRole.ADMIN, UserRole.STAFF]), getPayments);
router.post('/:id/manual', requireRoles([UserRole.ADMIN, UserRole.STAFF]), recordManualPayment);
router.post('/:id/mock-pay', processMockCardPayment);
router.post('/:id/razorpay-order', createRazorpayOrder);
router.post('/razorpay-verify', verifyRazorpayPayment);
router.get('/:id/invoice', downloadInvoice);
router.post('/:id/refund', requireRoles([UserRole.ADMIN, UserRole.STAFF]), refundPayment);
export default router;
