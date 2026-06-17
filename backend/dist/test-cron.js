"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_js_1 = __importDefault(require("./config/prisma.js"));
const cron_js_1 = require("./config/cron.js");
const client_1 = require("@prisma/client");
async function testCron() {
    console.log('--- STARTING CRON JOB INTEGRATION TEST ---');
    const testEmail = `cron.tester.${Date.now()}@gym.com`;
    try {
        // 1. Create a dummy User
        const user = await prisma_js_1.default.user.create({
            data: {
                email: testEmail,
                passwordHash: 'dummyhash',
                firstName: 'Cron',
                lastName: 'Tester',
                role: client_1.UserRole.MEMBER,
            },
        });
        // 2. Create a dummy Member
        const member = await prisma_js_1.default.member.create({
            data: {
                userId: user.id,
                status: client_1.MemberStatus.ACTIVE,
            },
        });
        // 3. Create a Plan
        const plan = await prisma_js_1.default.membershipPlan.create({
            data: {
                name: 'Temporary Cron Plan',
                price: 9.99,
                durationMonths: 1,
            },
        });
        // 4. Create an EXPIRED subscription (endDate set to yesterday)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const subscription = await prisma_js_1.default.subscription.create({
            data: {
                memberId: member.id,
                planId: plan.id,
                startDate: new Date(yesterday.getTime() - 30 * 24 * 60 * 60 * 1000),
                endDate: yesterday,
                status: client_1.SubscriptionStatus.ACTIVE,
            },
        });
        console.log(`Created expired subscription ${subscription.id} for member ${member.id}`);
        // 5. Run the expiration logic
        const expiredCount = await (0, cron_js_1.checkExpiredSubscriptions)();
        console.log(`Cron execution updated ${expiredCount} subscriptions.`);
        // 6. Verify changes in DB
        const updatedSub = await prisma_js_1.default.subscription.findUnique({
            where: { id: subscription.id },
        });
        const updatedMember = await prisma_js_1.default.member.findUnique({
            where: { id: member.id },
        });
        const isSubCorrect = updatedSub?.status === client_1.SubscriptionStatus.EXPIRED;
        const isMemberCorrect = updatedMember?.status === client_1.MemberStatus.INACTIVE;
        if (isSubCorrect && isMemberCorrect) {
            console.log('✅ TEST PASSED: Subscription successfully marked EXPIRED, Member marked INACTIVE.');
        }
        else {
            console.error('❌ TEST FAILED:', {
                subStatus: updatedSub?.status,
                expectedSub: client_1.SubscriptionStatus.EXPIRED,
                memberStatus: updatedMember?.status,
                expectedMember: client_1.MemberStatus.INACTIVE,
            });
        }
        // 7. Cleanup
        await prisma_js_1.default.subscription.delete({ where: { id: subscription.id } });
        await prisma_js_1.default.member.delete({ where: { id: member.id } });
        await prisma_js_1.default.user.delete({ where: { id: user.id } });
        await prisma_js_1.default.membershipPlan.delete({ where: { id: plan.id } });
        console.log('Cleanup completed successfully.');
    }
    catch (error) {
        console.error('Error in cron test:', error);
    }
    finally {
        await prisma_js_1.default.$disconnect();
    }
}
testCron();
