import { Router } from 'express';
import { getHeatmapData, getRetentionMetrics } from '../controllers/analytics.controller.js';
import { authenticateToken } from '../middleware/auth.js';
const router = Router();
router.use(authenticateToken);
router.get('/heatmap', getHeatmapData);
router.get('/retention', getRetentionMetrics);
export default router;
