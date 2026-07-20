import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
// Mock Prisma to avoid needing a real DB in tests
vi.mock('../config/prisma.js', () => ({
    default: {
        user: {
            findUnique: vi.fn(),
            create: vi.fn(),
        },
        branch: {
            create: vi.fn(),
            findUnique: vi.fn(),
        },
        saaSSubscription: {
            findUnique: vi.fn(),
            create: vi.fn(),
        },
        $transaction: vi.fn(async (cb) => cb({
            branch: { create: vi.fn().mockResolvedValue({ id: 'branch-1', name: 'Test Branch' }) },
            user: {
                create: vi.fn().mockResolvedValue({
                    id: 'user-1',
                    email: 'test@test.com',
                    firstName: 'Test',
                    lastName: 'User',
                    role: 'ADMIN',
                    branchId: 'branch-1',
                    passwordHash: '$2a$10$hash',
                }),
                findUnique: vi.fn().mockResolvedValue(null),
            },
            saaSSubscription: {
                findUnique: vi.fn().mockResolvedValue(null),
                create: vi.fn().mockResolvedValue({}),
            },
        })),
    },
}));
// Mock email to avoid SMTP in tests
vi.mock('../config/email.js', () => ({
    sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
    sendPaymentReceiptEmail: vi.fn().mockResolvedValue(undefined),
    sendTrialExpiryWarningEmail: vi.fn().mockResolvedValue(undefined),
}));
// Mock socket to avoid uninitialized error in tests
vi.mock('../config/socket.js', () => ({
    emitNewCheckIn: vi.fn(),
    emitPaymentReceived: vi.fn(),
    emitMemberRegistered: vi.fn(),
    emitNotificationToUser: vi.fn(),
    getIO: vi.fn().mockReturnValue({ to: vi.fn().mockReturnValue({ emit: vi.fn() }) }),
}));
describe('Auth API', () => {
    describe('POST /api/auth/register', () => {
        it('should return 400 if email is missing', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({ password: 'password123', firstName: 'John', lastName: 'Doe' });
            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error');
        });
        it('should return 400 if password is too short', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({ email: 'test@test.com', password: '123', firstName: 'John', lastName: 'Doe' });
            expect(res.status).toBe(400);
            expect(res.body.details[0].field).toBe('password');
        });
        it('should return 400 for invalid email format', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({ email: 'not-an-email', password: 'password123', firstName: 'John', lastName: 'Doe' });
            expect(res.status).toBe(400);
        });
    });
    describe('POST /api/auth/login', () => {
        it('should return 400 if credentials are missing', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@test.com' });
            expect(res.status).toBe(400);
        });
    });
});
describe('Health Check', () => {
    it('GET /health should return 200 OK', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('OK');
        expect(res.body).toHaveProperty('uptime');
    });
});
describe('Rate Limiting', () => {
    it('should return 404 for unknown endpoints', async () => {
        const res = await request(app).get('/api/nonexistent-route-xyz');
        expect(res.status).toBe(404);
    });
});
