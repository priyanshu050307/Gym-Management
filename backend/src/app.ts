import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

import authRoutes from './routes/auth.routes.js';
import planRoutes from './routes/plan.routes.js';
import memberRoutes from './routes/member.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import trainerRoutes from './routes/trainer.routes.js';
import classRoutes from './routes/class.routes.js';
import bookingRoutes from './routes/booking.routes.js';
import branchRoutes from './routes/branch.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import equipmentRoutes from './routes/equipment.routes.js';
import supplementRoutes from './routes/supplement.routes.js';
import saleRoutes from './routes/sale.routes.js';
import saasRoutes from './routes/saas.routes.js';
import syncRoutes from './routes/sync.routes.js';
import gymbotRoutes from './routes/gymbot.routes.js';

import { initCronJobs } from './config/cron.js';
import prisma from './config/prisma.js';
import logger from './config/logger.js';
import { apiRateLimiter } from './middleware/rateLimiter.js';
import { cacheGet, cacheSet } from './config/cache.js';

dotenv.config();

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is required in production mode.");
}
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-replace-this-in-production';

// Initialize CRON scheduler
initCronJobs();

const app = express();

// Trust reverse proxy (Nginx on VPS) — required for express-rate-limit to read
// X-Forwarded-For headers correctly and identify real client IPs
app.set('trust proxy', 1);

// ──────────────────────────────────────────────
// Security: Helmet (11 HTTP security headers)
// ──────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow Cloudinary images
  contentSecurityPolicy: false, // CSP handled by frontend (Vite)
}));

// ──────────────────────────────────────────────
// CORS — allowlist-based (not wildcard)
// ──────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://localhost:4173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, mobile apps)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: Origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Branch-Id'],
  credentials: true,
}));

// ──────────────────────────────────────────────
// Body Parsing
// ──────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ──────────────────────────────────────────────
// Global Rate Limiting
// ──────────────────────────────────────────────
app.use('/api/', apiRateLimiter);

// ──────────────────────────────────────────────
// Request Logger (structured)
// ──────────────────────────────────────────────
app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
  logger.info(`${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// ──────────────────────────────────────────────
// SaaS Subscription Lock (per-owner tenant)
// ──────────────────────────────────────────────
const saasLockMiddleware = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  if (!['POST', 'PUT', 'DELETE'].includes(req.method)) return next();

  const url = req.originalUrl;
  const exempted =
    url.startsWith('/api/auth') ||
    url.startsWith('/api/saas') ||
    url.startsWith('/api/payments');
  if (exempted) return next();

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return next();
    const token = authHeader.split(' ')[1];
    if (!token) return next();

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return next();
    }

    if (!decoded) return next();

    // ── Super Admin bypass: admin@gym.com always has unlimited access ──
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@gym.com';
    if (decoded.email === superAdminEmail) {
      return next(); // Never lock the super admin account
    }

    let ownerId = '';
    if (decoded.role === 'ADMIN') {
      ownerId = decoded.id;
    } else if (decoded.branchId) {
      const branch = await prisma.branch.findUnique({
        where: { id: decoded.branchId },
        select: { ownerId: true },
      });
      if (branch && branch.ownerId) {
        ownerId = branch.ownerId;
      }
    }

    if (!ownerId) return next();

    const branchId = decoded.branchId || req.headers['x-branch-id'] || req.query.branchId;
    const cacheKey = branchId ? `saas_sub_branch:${branchId}` : `saas_sub_owner:${ownerId}`;
    let sub = cacheGet<any>(cacheKey);

    if (sub === undefined) {
      if (branchId) {
        sub = await prisma.saaSSubscription.findUnique({
          where: { branchId: branchId as string },
        });
      }
      if (!sub) {
        sub = await prisma.saaSSubscription.findFirst({
          where: { ownerId },
          orderBy: { createdAt: 'asc' },
        });
      }
      cacheSet(cacheKey, sub || null, 120);
    }

    if (sub && (sub.status === 'TRIAL_EXPIRED' || sub.status === 'SUBSCRIBED_EXPIRED')) {
      logger.warn('SaaS lock: Blocked mutating request for expired subscription', {
        ownerId,
        role: decoded.role,
        userId: decoded.id,
        status: sub.status,
        url,
      });
      return res.status(402).json({
        error: 'TRIAL_EXPIRED',
        isSaaSLocked: true,
        message: 'SaaS subscription expired. Please subscribe to continue.',
      });
    }
  } catch (err) {
    logger.error('SaaS lock check failed', { error: (err as Error).message });
  }
  next();
};

app.use(saasLockMiddleware as any);

// ──────────────────────────────────────────────
// Health Check
// ──────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ──────────────────────────────────────────────
// Route Handlers
// ──────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/trainers', trainerRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/equipments', equipmentRoutes);
app.use('/api/supplements', supplementRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/saas', saasRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/gymbot', gymbotRoutes);

// ──────────────────────────────────────────────
// 404 Handler
// ──────────────────────────────────────────────
app.use((req, res) => {
  logger.warn(`404 Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Endpoint not found' });
});

// ──────────────────────────────────────────────
// Global Error Handler
// ──────────────────────────────────────────────
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled Server Error', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
  });

  if (err.message?.startsWith('CORS:')) {
    return res.status(403).json({ error: err.message });
  }

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
});

export default app;
