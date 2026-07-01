import cron from 'node-cron';
import prisma from './prisma.js';
import { SubscriptionStatus, MemberStatus } from '@prisma/client';
import { createNotification } from '../controllers/notification.controller.js';

export const checkExpiredSubscriptions = async () => {
  console.log('[CRON] Checking for expired subscriptions...');
  try {
    const now = new Date();

    // 1. Find and process expired subscriptions
    const expiredSubs = await prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        endDate: {
          lt: now,
        },
      },
      include: {
        plan: true,
        member: {
          include: {
            user: true
          }
        }
      }
    });

    if (expiredSubs.length > 0) {
      console.log(`[CRON] Found ${expiredSubs.length} subscriptions to expire.`);
      await prisma.$transaction(async (tx) => {
        for (const sub of expiredSubs) {
          // Mark subscription as EXPIRED
          await tx.subscription.update({
            where: { id: sub.id },
            data: { status: SubscriptionStatus.EXPIRED },
          });

          // Mark member status as INACTIVE
          await tx.member.update({
            where: { id: sub.memberId },
            data: { status: MemberStatus.INACTIVE },
          });

          // Send notification
          await createNotification(
            sub.member.userId,
            'Subscription Expired',
            `Your subscription to plan "${sub.plan.name}" has expired. Please renew to resume access.`,
            'ALERT'
          );
        }
      });
    }

    // 2. Find subscriptions expiring within 3 days to send alerts
    const threeDaysLater = new Date();
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);

    const expiringSoonSubs = await prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        endDate: {
          gt: now,
          lte: threeDaysLater,
        },
      },
      include: {
        plan: true,
        member: {
          include: {
            user: true
          }
        }
      }
    });

    for (const sub of expiringSoonSubs) {
      // Send reminder notification
      await createNotification(
        sub.member.userId,
        'Subscription Renewal Reminder',
        `Your subscription to plan "${sub.plan.name}" expires in less than 3 days (on ${new Date(sub.endDate).toLocaleDateString()}). Please renew soon.`,
        'ALERT'
      );
    }

    console.log('[CRON] Subscription check completed successfully.');
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
