import { Router } from 'express';
import { uploadAttendance, receiveHeartbeat, getPendingCommands, handleCommandResponse } from '../controllers/sync.controller.js';
const router = Router();
// Biometric Synchronization Routes
router.post('/attendance', uploadAttendance);
router.post('/heartbeat', receiveHeartbeat);
router.get('/commands', getPendingCommands);
router.post('/commands/:id/response', handleCommandResponse);
export default router;
