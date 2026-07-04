import rateLimit from 'express-rate-limit';
import logger from '../config/logger.js';

const rateLimitHandler = (req: any, res: any) => {
  logger.warn('Rate limit exceeded', {
    ip: req.ip,
    path: req.path,
    method: req.method,
  });
  res.status(429).json({
    error: 'Too many requests. Please slow down and try again later.',
    retryAfter: '60 seconds',
  });
};

// ── Auth endpoints (login, register) — very strict ──
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // 10 attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  message: 'Too many authentication attempts. Please try again in 15 minutes.',
  skipSuccessfulRequests: true, // Only count failed attempts
});

// ── General API — standard limit ──
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,            // 120 requests/min per IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

// ── File uploads — conservative ──
export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,             // 10 uploads per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

// ── Password reset / sensitive endpoints ──
export const sensitiveRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,                    // 5 per hour
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});
