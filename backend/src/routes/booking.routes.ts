import { Router } from 'express';
import {
  createBooking,
  cancelBooking,
  getMemberBookings,
} from '../controllers/booking.controller.js';
import { authenticateToken, requireRoles } from '../middleware/auth.js';
import { UserRole } from '@prisma/client';

const router = Router();

router.use(authenticateToken as any);

router.post('/', requireRoles([UserRole.ADMIN, UserRole.STAFF, UserRole.MEMBER]) as any, createBooking);
router.post('/cancel', requireRoles([UserRole.ADMIN, UserRole.STAFF, UserRole.MEMBER]) as any, cancelBooking);
router.get('/member/:memberId', requireRoles([UserRole.ADMIN, UserRole.STAFF, UserRole.MEMBER]) as any, getMemberBookings);

export default router;
