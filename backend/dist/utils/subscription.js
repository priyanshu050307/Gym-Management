import { SubscriptionStatus, MemberStatus } from '@prisma/client';
export const activateSubscriptionAfterPayment = async (tx, payment) => {
    const subscriptionId = payment.subscriptionId;
    const memberId = payment.subscription.memberId;
    // 1. Fetch the plan duration
    const plan = await tx.membershipPlan.findUnique({
        where: { id: payment.subscription.planId },
    });
    if (!plan) {
        throw new Error('Associated membership plan not found');
    }
    // 2. Check if the member currently has an ACTIVE subscription
    const currentActiveSub = await tx.subscription.findFirst({
        where: {
            memberId,
            status: SubscriptionStatus.ACTIVE,
            endDate: { gt: new Date() },
            id: { not: subscriptionId }, // ignore this subscription itself
        },
    });
    let startDate = new Date();
    if (currentActiveSub) {
        // If they have an active plan, queue this new one to start when the current one expires
        startDate = new Date(currentActiveSub.endDate);
    }
    const endDate = new Date(startDate);
    if (plan.durationMonths === 0) {
        endDate.setDate(endDate.getDate() + 1); // 1 Day Trial!
    }
    else {
        endDate.setMonth(endDate.getMonth() + plan.durationMonths);
    }
    // 3. Update the subscription with active status and recalculated dates
    const updatedSubscription = await tx.subscription.update({
        where: { id: subscriptionId },
        data: {
            status: SubscriptionStatus.ACTIVE,
            startDate,
            endDate,
        },
    });
    // 4. Update the member status to ACTIVE and set expiryDate
    await tx.member.update({
        where: { id: memberId },
        data: {
            status: MemberStatus.ACTIVE,
            expiryDate: endDate,
        },
    });
    return updatedSubscription;
};
