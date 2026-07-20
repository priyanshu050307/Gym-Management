import { Router } from 'express';
import { registerMember, getMembers, getMemberById, updateMemberStatus, addSubscriptionToMember, logMemberCheckIn, getDashboardStats, freezeMember, unfreezeMember, updateMemberProfile, upgradeDowngradeSubscription, deleteMember, uploadMemberPhoto, } from '../controllers/member.controller.js';
import { getMemberWorkoutPlan, assignWorkoutPlan, deleteWorkoutPlan } from '../controllers/workout.controller.js';
import { getMemberDietPlan, assignDietPlan, deleteDietPlan } from '../controllers/diet.controller.js';
import { getProgressLogs, createProgressLog, getMemberAttendance } from '../controllers/progress.controller.js';
import { submitTrainerFeedback } from '../controllers/feedback.controller.js';
import { authenticateToken, requireRoles } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createMemberSchema } from '../schemas/member.schema.js';
import { profileUpload } from '../config/cloudinary.js';
import { uploadRateLimiter } from '../middleware/rateLimiter.js';
import { UserRole } from '@prisma/client';
const router = Router();
router.use(authenticateToken);
// Admins and Staff can perform most member actions
router.post('/register', requireRoles([UserRole.ADMIN, UserRole.STAFF]), validate(createMemberSchema), registerMember);
router.get('/dashboard/stats', requireRoles([UserRole.ADMIN, UserRole.STAFF]), getDashboardStats);
router.get('/', requireRoles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER]), getMembers);
router.get('/:id', getMemberById);
router.put('/:id/status', requireRoles([UserRole.ADMIN, UserRole.STAFF]), updateMemberStatus);
router.post('/:id/subscription', requireRoles([UserRole.ADMIN, UserRole.STAFF, UserRole.MEMBER]), addSubscriptionToMember);
router.post('/:id/checkin', requireRoles([UserRole.ADMIN, UserRole.STAFF]), logMemberCheckIn);
router.post('/:id/freeze', requireRoles([UserRole.ADMIN, UserRole.STAFF]), freezeMember);
router.post('/:id/unfreeze', requireRoles([UserRole.ADMIN, UserRole.STAFF]), unfreezeMember);
router.put('/:id/profile', updateMemberProfile);
router.post('/:id/upgrade-downgrade', requireRoles([UserRole.ADMIN, UserRole.STAFF]), upgradeDowngradeSubscription);
router.delete('/:id', requireRoles([UserRole.ADMIN, UserRole.STAFF]), deleteMember);
// Photo upload (Cloudinary)
router.post('/:id/photo', requireRoles([UserRole.ADMIN, UserRole.STAFF]), uploadRateLimiter, profileUpload.single('photo'), uploadMemberPhoto);
// Workout Plan routes
router.get('/:id/workout', getMemberWorkoutPlan);
router.post('/:id/workout', requireRoles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER]), assignWorkoutPlan);
router.delete('/:id/workout', requireRoles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER]), deleteWorkoutPlan);
// Diet Plan routes
router.get('/:id/diet', getMemberDietPlan);
router.post('/:id/diet', requireRoles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER]), assignDietPlan);
router.delete('/:id/diet', requireRoles([UserRole.ADMIN, UserRole.STAFF, UserRole.TRAINER]), deleteDietPlan);
// Progress & Attendance logs
router.get('/:id/progress', getProgressLogs);
router.post('/:id/progress', createProgressLog);
router.get('/:id/attendance', getMemberAttendance);
router.post('/:id/feedback', submitTrainerFeedback);
export default router;
