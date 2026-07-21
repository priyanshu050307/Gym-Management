import { Router } from 'express';
import { generateSampleData } from '../controllers/demo.controller.js';
import { authenticateToken } from '../middleware/auth.js';
const router = Router();
router.use(authenticateToken);
router.post('/seed', generateSampleData);
export default router;
