import { Router } from 'express';
import {
  getSaaSSubscriptionStatus,
  subscribeToPlan,
  updateBillingProfile,
  resetSaaSState,
  createSaaSOrder,
  verifySaaSPayment,
} from '../controllers/saas.controller.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Retrieve SaaS status (requires authentication)
router.get('/status', authenticateToken as any, getSaaSSubscriptionStatus);

// Secure mutating actions
router.use(authenticateToken as any);
router.post('/subscribe', subscribeToPlan);
router.post('/create-order', createSaaSOrder);
router.post('/verify-payment', verifySaaSPayment);
router.put('/billing', updateBillingProfile);
router.post('/reset', resetSaaSState);

export default router;
