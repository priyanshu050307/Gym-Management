import { Router } from 'express';
import { register, login, getProfile, forgotPassword, resetPassword, firebaseLogin, updateProfile } from '../controllers/auth.controller.js';
import { getBranchFeedbacks } from '../controllers/feedback.controller.js';
import { authenticateToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, firebaseLoginSchema } from '../schemas/auth.schema.js';
import { authRateLimiter, sensitiveRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/register', authRateLimiter, validate(registerSchema), register);
router.post('/login',    authRateLimiter, validate(loginSchema),    login);
router.post('/firebase-login', authRateLimiter, validate(firebaseLoginSchema), firebaseLogin);
router.get('/me',        authenticateToken as any, getProfile);
router.put('/profile',   authenticateToken as any, updateProfile);
router.get('/feedbacks', authenticateToken as any, getBranchFeedbacks);
router.post('/forgot-password', sensitiveRateLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password',  sensitiveRateLimiter, validate(resetPasswordSchema),  resetPassword);

export default router;
