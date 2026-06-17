"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_js_1 = __importDefault(require("./config/prisma.js"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const client_1 = require("@prisma/client");
async function seed() {
    console.log('--- SEEDING BILLING AND USER DATABASE ---');
    try {
        // 1. Clean previous test records
        await prisma_js_1.default.payment.deleteMany({
            where: {
                subscription: {
                    member: {
                        user: {
                            email: {
                                endsWith: '@gymtest.com',
                            },
                        },
                    },
                },
            },
        });
        await prisma_js_1.default.subscription.deleteMany({
            where: {
                member: {
                    user: {
                        email: {
                            endsWith: '@gymtest.com',
                        },
                    },
                },
            },
        });
        await prisma_js_1.default.member.deleteMany({
            where: {
                user: {
                    email: {
                        endsWith: '@gymtest.com',
                    },
                },
            },
        });
        await prisma_js_1.default.user.deleteMany({
            where: {
                email: {
                    endsWith: '@gymtest.com',
                },
            },
        });
        await prisma_js_1.default.membershipPlan.deleteMany({
            where: {
                name: 'Elite Platinum Plan',
            },
        });
        console.log('Cleared old test data.');
        // 2. Hash password
        const salt = await bcryptjs_1.default.genSalt(10);
        const passwordHash = await bcryptjs_1.default.hash('Password123', salt);
        // 3. Create Admin/Staff User
        const adminUser = await prisma_js_1.default.user.create({
            data: {
                email: 'admin@gymtest.com',
                passwordHash,
                firstName: 'System',
                lastName: 'Administrator',
                role: client_1.UserRole.ADMIN,
            },
        });
        console.log(`Created admin user: ${adminUser.email}`);
        // 4. Create Member User
        const memberUser = await prisma_js_1.default.user.create({
            data: {
                email: 'john.doe@gymtest.com',
                passwordHash,
                firstName: 'John',
                lastName: 'Doe',
                role: client_1.UserRole.MEMBER,
            },
        });
        const member = await prisma_js_1.default.member.create({
            data: {
                userId: memberUser.id,
                status: client_1.MemberStatus.ACTIVE,
                emergencyContact: '+1-555-0199',
            },
        });
        console.log(`Created member: ${memberUser.firstName} ${memberUser.lastName}`);
        // 5. Create Plan
        const plan = await prisma_js_1.default.membershipPlan.create({
            data: {
                name: 'Elite Platinum Plan',
                price: 150.00,
                durationMonths: 12,
                description: 'All facilities, premium spa access, and custom personal trainers.',
                isActive: true,
            },
        });
        console.log(`Created plan: ${plan.name}`);
        // 6. Create Subscription
        const start = new Date();
        const end = new Date();
        end.setFullYear(end.getFullYear() + 1);
        const subscription = await prisma_js_1.default.subscription.create({
            data: {
                memberId: member.id,
                planId: plan.id,
                startDate: start,
                endDate: end,
                status: client_1.SubscriptionStatus.ACTIVE,
            },
        });
        console.log(`Created subscription for member.`);
        // 7. Create Pending Payment
        const payment = await prisma_js_1.default.payment.create({
            data: {
                subscriptionId: subscription.id,
                amount: plan.price,
                status: client_1.PaymentStatus.PENDING,
                paymentDate: new Date(),
            },
        });
        console.log(`Created pending payment of $${payment.amount} (ID: ${payment.id})`);
        console.log('✅ DATABASE SEED COMPLETED SUCCESSFULLY.');
    }
    catch (error) {
        console.error('Error during database seed:', error);
    }
    finally {
        await prisma_js_1.default.$disconnect();
    }
}
seed();
