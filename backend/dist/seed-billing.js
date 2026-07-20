import prisma from './config/prisma.js';
import bcrypt from 'bcryptjs';
import { UserRole, MemberStatus, SubscriptionStatus, PaymentStatus } from '@prisma/client';
async function seed() {
    console.log('--- SEEDING BILLING AND USER DATABASE ---');
    try {
        // 1. Clean previous test records
        await prisma.payment.deleteMany({
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
        await prisma.subscription.deleteMany({
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
        await prisma.member.deleteMany({
            where: {
                user: {
                    email: {
                        endsWith: '@gymtest.com',
                    },
                },
            },
        });
        await prisma.user.deleteMany({
            where: {
                email: {
                    endsWith: '@gymtest.com',
                },
            },
        });
        await prisma.membershipPlan.deleteMany({
            where: {
                name: 'Elite Platinum Plan',
            },
        });
        console.log('Cleared old test data.');
        // 2. Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash('Password123', salt);
        // 3. Create Admin/Staff User
        const adminUser = await prisma.user.create({
            data: {
                email: 'admin@gymtest.com',
                passwordHash,
                firstName: 'System',
                lastName: 'Administrator',
                role: UserRole.ADMIN,
            },
        });
        console.log(`Created admin user: ${adminUser.email}`);
        // 4. Create Member User
        const memberUser = await prisma.user.create({
            data: {
                email: 'john.doe@gymtest.com',
                passwordHash,
                firstName: 'John',
                lastName: 'Doe',
                role: UserRole.MEMBER,
            },
        });
        const member = await prisma.member.create({
            data: {
                userId: memberUser.id,
                status: MemberStatus.ACTIVE,
                emergencyContact: '+1-555-0199',
            },
        });
        console.log(`Created member: ${memberUser.firstName} ${memberUser.lastName}`);
        // 5. Create Plan
        const plan = await prisma.membershipPlan.create({
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
        const subscription = await prisma.subscription.create({
            data: {
                memberId: member.id,
                planId: plan.id,
                startDate: start,
                endDate: end,
                status: SubscriptionStatus.ACTIVE,
            },
        });
        console.log(`Created subscription for member.`);
        // 7. Create Pending Payment
        const payment = await prisma.payment.create({
            data: {
                subscriptionId: subscription.id,
                amount: plan.price,
                status: PaymentStatus.PENDING,
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
        await prisma.$disconnect();
    }
}
seed();
