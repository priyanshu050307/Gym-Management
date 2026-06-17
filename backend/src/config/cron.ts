import cron from 'node-cron';
import prisma from './prisma.js';
import { SubscriptionStatus, MemberStatus } from '@prisma/client';

export const checkExpiredSubscriptions = async () => {
  console.log('[CRON] Checking for expired subscriptions...');
  try {
    const now = new Date();

    // Find all active subscriptions that have expired
    const expiredSubs = await prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        endDate: {
          lt: now,
        },
      },
    });

    if (expiredSubs.length === 0) {
      console.log('[CRON] No expired subscriptions found.');
      return 0;
    }

    console.log(`[CRON] Found ${expiredSubs.length} subscriptions to expire.`);

    // Deactivate them in a transaction
    await prisma.$transaction(async (tx) => {
      for (const sub of expiredSubs) {
        // 1. Mark subscription as EXPIRED
        await tx.subscription.update({
          where: { id: sub.id },
          data: { status: SubscriptionStatus.EXPIRED },
        });

        // 2. Mark member status as INACTIVE
        await tx.member.update({
          where: { id: sub.memberId },
          data: { status: MemberStatus.INACTIVE },
        });
      }
    });

    console.log('[CRON] Expired subscriptions updated successfully.');
    return expiredSubs.length;
  } catch (error) {
    console.error('[CRON] Error during subscription expiration check:', error);
    throw error;
  }
};

export const initCronJobs = () => {
  // Run daily at midnight
  cron.schedule('0 0 * * *', async () => {
    await checkExpiredSubscriptions();
  });
  console.log('[CRON] Subscription check scheduler initialized (Daily at 00:00).');
};
