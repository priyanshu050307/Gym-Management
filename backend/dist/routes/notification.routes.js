import { Router } from 'express';
import { getNotifications, markAsRead, markAllAsRead, } from '../controllers/notification.controller.js';
import { authenticateToken } from '../middleware/auth.js';
const router = Router();
router.use(authenticateToken);
router.get('/', getNotifications);
router.put('/:id/read', markAsRead);
router.put('/read-all', markAllAsRead);
export default router;
