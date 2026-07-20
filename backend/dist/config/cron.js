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
                    // Only mark member status as INACTIVE if they have no other active subscription
                    const otherActiveSubCount = await tx.subscription.count({
                        where: {
                            memberId: sub.memberId,
                            status: SubscriptionStatus.ACTIVE,
                            id: { not: sub.id },
                            endDate: { gt: now },
                        },
                    });
                    if (otherActiveSubCount === 0) {
                        await tx.member.update({
                            where: { id: sub.memberId },
                            data: { status: MemberStatus.INACTIVE },
                        });
                    }
                    // Send notification
                    await createNotification(sub.member.userId, 'Subscription Expired', `Your subscription to plan "${sub.plan.name}" has expired. Please renew to resume access.`, 'ALERT');
                }
            });
        }
        // 2. Find subscriptions expiring within 5 days to send alerts
        const fiveDaysLater = new Date();
        fiveDaysLater.setDate(fiveDaysLater.getDate() + 5);
        const expiringSoonSubs = await prisma.subscription.findMany({
            where: {
                status: SubscriptionStatus.ACTIVE,
                endDate: {
                    gt: now,
                    lte: fiveDaysLater,
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
            await createNotification(sub.member.userId, 'Subscription Renewal Reminder', `Your subscription to plan "${sub.plan.name}" expires in less than 5 days (on ${new Date(sub.endDate).toLocaleDateString()}). Please renew soon.`, 'ALERT');
        }
        console.log('[CRON] Subscription check completed successfully.');
        return expiredSubs.length;
    }
    catch (error) {
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
