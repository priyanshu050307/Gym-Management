import { Router } from 'express';
import { createPlan, getPlans, getPlanById, updatePlan, deletePlan } from '../controllers/plan.controller.js';
import { authenticateToken, requireRoles } from '../middleware/auth.js';
import { UserRole } from '@prisma/client';
const router = Router();
// Allow STAFF or ADMIN to view and manage plans, but only ADMIN can create/edit/delete
router.use(authenticateToken);
router.get('/', getPlans);
router.get('/:id', getPlanById);
// Administrative mutations
router.post('/', requireRoles([UserRole.ADMIN, UserRole.STAFF]), createPlan);
router.put('/:id', requireRoles([UserRole.ADMIN, UserRole.STAFF]), updatePlan);
router.delete('/:id', requireRoles([UserRole.ADMIN, UserRole.STAFF]), deletePlan);
export default router;
