"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initCronJobs = exports.checkExpiredSubscriptions = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const prisma_js_1 = __importDefault(require("./prisma.js"));
const client_1 = require("@prisma/client");
const checkExpiredSubscriptions = async () => {
    console.log('[CRON] Checking for expired subscriptions...');
    try {
        const now = new Date();
        // Find all active subscriptions that have expired
        const expiredSubs = await prisma_js_1.default.subscription.findMany({
            where: {
                status: client_1.SubscriptionStatus.ACTIVE,
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
        await prisma_js_1.default.$transaction(async (tx) => {
            for (const sub of expiredSubs) {
                // 1. Mark subscription as EXPIRED
                await tx.subscription.update({
                    where: { id: sub.id },
                    data: { status: client_1.SubscriptionStatus.EXPIRED },
                });
                // 2. Mark member status as INACTIVE
                await tx.member.update({
                    where: { id: sub.memberId },
                    data: { status: client_1.MemberStatus.INACTIVE },
                });
            }
        });
        console.log('[CRON] Expired subscriptions updated successfully.');
        return expiredSubs.length;
    }
    catch (error) {
        console.error('[CRON] Error during subscription expiration check:', error);
        throw error;
    }
};
exports.checkExpiredSubscriptions = checkExpiredSubscriptions;
const initCronJobs = () => {
    // Run daily at midnight
    node_cron_1.default.schedule('0 0 * * *', async () => {
        await (0, exports.checkExpiredSubscriptions)();
    });
    console.log('[CRON] Subscription check scheduler initialized (Daily at 00:00).');
};
exports.initCronJobs = initCronJobs;
