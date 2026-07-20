import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
// Signed user details matching mock db resolves
const mockUserForToken = {
    id: 'user-owner-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'owner@gym.com',
    role: 'ADMIN',
    branchId: null,
};
// Create a JWT token for the mock user
const token = jwt.sign(mockUserForToken, 'super-secret-jwt-key-replace-this-in-production');
// Mock Prisma
vi.mock('../config/prisma.js', () => {
    const mockUser = {
        id: 'user-owner-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'owner@gym.com',
        role: 'ADMIN',
        branchId: null,
    };
    const mockSubscription = {
        id: 'sub-123',
        ownerId: 'user-owner-123',
        status: 'TRIAL_ACTIVE',
        planName: 'Starter',
        trialEndDate: new Date(),
        billingCycle: 'MONTHLY',
        subscriptionEnd: null,
    };
    return {
        default: {
            user: {
                findUnique: vi.fn().mockResolvedValue(mockUser),
                findFirst: vi.fn().mockResolvedValue(mockUser),
            },
            branch: {
                findUnique: vi.fn().mockResolvedValue(null),
            },
            saaSSubscription: {
                findUnique: vi.fn().mockResolvedValue(mockSubscription),
                findFirst: vi.fn().mockResolvedValue(mockSubscription),
                create: vi.fn().mockImplementation(async ({ data }) => {
                    return {
                        ...mockSubscription,
                        status: data.status,
                        planName: data.planName,
                        billingCycle: data.billingCycle,
                        subscriptionEnd: data.subscriptionEnd,
                    };
                }),
                update: vi.fn().mockImplementation(async ({ data }) => {
                    return {
                        ...mockSubscription,
                        status: data.status,
                        planName: data.planName,
                        billingCycle: data.billingCycle,
                        subscriptionEnd: data.subscriptionEnd,
                    };
                }),
            },
        }
    };
});
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
// Mock Razorpay as a Class constructor
vi.mock('razorpay', () => {
    class MockRazorpay {
        orders = {
            create: vi.fn().mockImplementation(async (options) => {
                return {
                    id: 'order_mock_123',
                    amount: options.amount,
                    currency: options.currency,
                };
            })
        };
    }
    return {
        default: MockRazorpay
    };
});
describe('SaaS Subscription API', () => {
    beforeEach(() => {
        process.env.RAZORPAY_KEY_ID = 'test_key_id';
        process.env.RAZORPAY_KEY_SECRET = 'test_key_secret';
    });
    describe('POST /api/saas/create-order', () => {
        const plansToTest = [
            { cycle: 'MONTHLY', expectedPrice: 50000 },
            { cycle: 'HALF_YEARLY', expectedPrice: 280000 },
            { cycle: 'YEARLY', expectedPrice: 550000 },
        ];
        plansToTest.forEach(({ cycle, expectedPrice }) => {
            it(`should create order with correct amount for billing cycle: ${cycle}`, async () => {
                const res = await request(app)
                    .post('/api/saas/create-order')
                    .set('Authorization', `Bearer ${token}`)
                    .send({ planName: 'Premium', billingCycle: cycle });
                expect(res.status).toBe(200);
                expect(res.body).toHaveProperty('orderId', 'order_mock_123');
                expect(res.body).toHaveProperty('amount', expectedPrice);
                expect(res.body).toHaveProperty('currency', 'INR');
            });
        });
    });
    describe('POST /api/saas/verify-payment', () => {
        const verificationToTest = [
            { cycle: 'MONTHLY' },
            { cycle: 'HALF_YEARLY' },
            { cycle: 'YEARLY' },
        ];
        verificationToTest.forEach(({ cycle }) => {
            it(`should calculate correct subscription end date for billing cycle: ${cycle}`, async () => {
                const orderId = 'order_mock_123';
                const paymentId = 'pay_mock_123';
                const secret = process.env.RAZORPAY_KEY_SECRET || 'test_key_secret';
                const signature = crypto
                    .createHmac('sha256', secret)
                    .update(orderId + '|' + paymentId)
                    .digest('hex');
                const res = await request(app)
                    .post('/api/saas/verify-payment')
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                    razorpay_order_id: orderId,
                    razorpay_payment_id: paymentId,
                    razorpay_signature: signature,
                    planName: 'Premium',
                    billingCycle: cycle,
                });
                expect(res.status).toBe(200);
                expect(res.body.message).toBe('Subscribed successfully');
                expect(res.body.subscription.billingCycle).toBe(cycle);
                expect(res.body.subscription.subscriptionEnd).toBeDefined();
                const end = new Date(res.body.subscription.subscriptionEnd);
                const now = new Date();
                if (cycle === 'MONTHLY') {
                    const deltaMonths = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
                    expect(deltaMonths).toBe(1);
                }
                else if (cycle === 'HALF_YEARLY') {
                    const deltaMonths = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
                    expect(deltaMonths).toBe(6);
                }
                else if (cycle === 'YEARLY') {
                    const deltaYears = end.getFullYear() - now.getFullYear();
                    expect(deltaYears).toBe(1);
                }
            });
        });
    });
});
