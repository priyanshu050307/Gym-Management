import prisma from './config/prisma.js';
import { checkExpiredSubscriptions } from './config/cron.js';
import { UserRole, MemberStatus, SubscriptionStatus, PaymentStatus, PaymentMethod } from '@prisma/client';

async function testCron() {
  console.log('--- STARTING CRON JOB INTEGRATION TEST ---');

  const testEmail = `cron.tester.${Date.now()}@gym.com`;

  try {
    // 1. Create a dummy User
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash: 'dummyhash',
        firstName: 'Cron',
        lastName: 'Tester',
        role: UserRole.MEMBER,
      },
    });

    // 2. Create a dummy Member
    const member = await prisma.member.create({
      data: {
        userId: user.id,
        status: MemberStatus.ACTIVE,
      },
    });

    // 3. Create a Plan
    const plan = await prisma.membershipPlan.create({
      data: {
        name: 'Temporary Cron Plan',
        price: 9.99,
        durationMonths: 1,
      },
    });

    // 4. Create an EXPIRED subscription (endDate set to yesterday)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const subscription = await prisma.subscription.create({
      data: {
        memberId: member.id,
        planId: plan.id,
        startDate: new Date(yesterday.getTime() - 30 * 24 * 60 * 60 * 1000),
        endDate: yesterday,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    console.log(`Created expired subscription ${subscription.id} for member ${member.id}`);

    // 5. Run the expiration logic
    const expiredCount = await checkExpiredSubscriptions();
    console.log(`Cron execution updated ${expiredCount} subscriptions.`);

    // 6. Verify changes in DB
    const updatedSub = await prisma.subscription.findUnique({
      where: { id: subscription.id },
    });

    const updatedMember = await prisma.member.findUnique({
      where: { id: member.id },
    });

    const isSubCorrect = updatedSub?.status === SubscriptionStatus.EXPIRED;
    const isMemberCorrect = updatedMember?.status === MemberStatus.INACTIVE;

    if (isSubCorrect && isMemberCorrect) {
      console.log('✅ TEST PASSED: Subscription successfully marked EXPIRED, Member marked INACTIVE.');
    } else {
      console.error('❌ TEST FAILED:', {
        subStatus: updatedSub?.status,
        expectedSub: SubscriptionStatus.EXPIRED,
        memberStatus: updatedMember?.status,
        expectedMember: MemberStatus.INACTIVE,
      });
    }

    // 7. Cleanup
    await prisma.subscription.delete({ where: { id: subscription.id } });
    await prisma.member.delete({ where: { id: member.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.membershipPlan.delete({ where: { id: plan.id } });
    console.log('Cleanup completed successfully.');

  } catch (error) {
    console.error('Error in cron test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCron();
