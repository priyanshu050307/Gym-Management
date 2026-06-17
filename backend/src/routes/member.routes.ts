import { Router } from 'express';
import {
  registerMember,
  getMembers,
  getMemberById,
  updateMemberStatus,
  addSubscriptionToMember,
  logMemberCheckIn,
  getDashboardStats,
} from '../controllers/member.controller.js';
import { authenticateToken, requireRoles } from '../middleware/auth.js';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authenticateToken as any);

// Admins and Staff can perform most member actions
router.post('/register', requireRoles([UserRole.ADMIN, UserRole.STAFF]) as any, registerMember);
router.get('/dashboard/stats', requireRoles([UserRole.ADMIN, UserRole.STAFF]) as any, getDashboardStats);
router.get('/', requireRoles([UserRole.ADMIN, UserRole.STAFF]) as any, getMembers);
router.get('/:id', getMemberById as any); // Members can fetch their own details, check in controllers could refine permission checks if needed
router.put('/:id/status', requireRoles([UserRole.ADMIN, UserRole.STAFF]) as any, updateMemberStatus);
router.post('/:id/subscription', requireRoles([UserRole.ADMIN, UserRole.STAFF]) as any, addSubscriptionToMember);
router.post('/:id/checkin', requireRoles([UserRole.ADMIN, UserRole.STAFF]) as any, logMemberCheckIn);

export default router;
