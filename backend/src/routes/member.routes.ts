import { Router } from 'express';
import {
  registerMember,
  getMembers,
  getMemberById,
  updateMemberStatus,
  addSubscriptionToMember,
  logMemberCheckIn,
  getDashboardStats,
  freezeMember,
  unfreezeMember,
  updateMemberProfile,
  upgradeDowngradeSubscription,
  deleteMember,
} from '../controllers/member.controller.js';
import { getMemberWorkoutPlan, assignWorkoutPlan, deleteWorkoutPlan } from '../controllers/workout.controller.js';
import { getMemberDietPlan, assignDietPlan, deleteDietPlan } from '../controllers/diet.controller.js';
import { getProgressLogs, createProgressLog, getMemberAttendance } from '../controllers/progress.controller.js';
import { submitTrainerFeedback } from '../controllers/feedback.controller.js';
import { authenticateToken, requireRoles } from '../middleware/auth.js';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authenticateToken as any);

// Admins and Staff can perform most member actions
router.post('/register', requireRoles([UserRole.ADMIN, UserRole.STAFF]) as any, registerMember);
router.get('/dashboard/stats', requireRoles([UserRole.ADMIN, UserRole.STAFF]) as any, getDashboardStats);
router.get('/', requireRoles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER]) as any, getMembers);
router.get('/:id', getMemberById as any); // Members can fetch their own details, check in controllers could refine permission checks if needed
router.put('/:id/status', requireRoles([UserRole.ADMIN, UserRole.STAFF]) as any, updateMemberStatus);
router.post('/:id/subscription', requireRoles([UserRole.ADMIN, UserRole.STAFF, UserRole.MEMBER]) as any, addSubscriptionToMember);
router.post('/:id/checkin', requireRoles([UserRole.ADMIN, UserRole.STAFF]) as any, logMemberCheckIn);
router.post('/:id/freeze', requireRoles([UserRole.ADMIN, UserRole.STAFF]) as any, freezeMember);
router.post('/:id/unfreeze', requireRoles([UserRole.ADMIN, UserRole.STAFF]) as any, unfreezeMember);
router.put('/:id/profile', updateMemberProfile as any);
router.post('/:id/upgrade-downgrade', requireRoles([UserRole.ADMIN, UserRole.STAFF]) as any, upgradeDowngradeSubscription);
router.delete('/:id', requireRoles([UserRole.ADMIN, UserRole.STAFF]) as any, deleteMember);

// Workout Plan routes
router.get('/:id/workout', getMemberWorkoutPlan as any);
router.post('/:id/workout', requireRoles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER]) as any, assignWorkoutPlan);
router.delete('/:id/workout', requireRoles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER]) as any, deleteWorkoutPlan);

// Diet Plan routes
router.get('/:id/diet', getMemberDietPlan as any);
router.post('/:id/diet', requireRoles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER]) as any, assignDietPlan);
router.delete('/:id/diet', requireRoles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER]) as any, deleteDietPlan);

// Progress & Attendance logs
router.get('/:id/progress', getProgressLogs as any);
router.post('/:id/progress', createProgressLog as any);
router.get('/:id/attendance', getMemberAttendance as any);
router.post('/:id/feedback', submitTrainerFeedback as any);

export default router;
