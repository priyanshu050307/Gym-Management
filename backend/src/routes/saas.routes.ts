import { Router } from 'express';
import {
  getSaaSSubscriptionStatus,
  subscribeToPlan,
  updateBillingProfile,
  resetSaaSState,
} from '../controllers/saas.controller.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Retrieve SaaS status (requires authentication)
router.get('/status', authenticateToken as any, getSaaSSubscriptionStatus);

// Secure mutating actions
router.use(authenticateToken as any);
router.post('/subscribe', subscribeToPlan);
router.put('/billing', updateBillingProfile);
router.post('/reset', resetSaaSState);

export default router;
