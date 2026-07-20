import prisma from '../config/prisma.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';
// Helper to find owner user ID for current request user
const getOwnerIdForUser = async (user) => {
    if (user.role === 'ADMIN') {
        return user.id;
    }
    if (user.branchId) {
        const branch = await prisma.branch.findUnique({
            where: { id: user.branchId },
            select: { ownerId: true }
        });
        if (branch && branch.ownerId) {
            return branch.ownerId;
        }
    }
    // Fallback to the seeded admin user
    const defaultAdmin = await prisma.user.findFirst({
        where: { email: process.env.SUPER_ADMIN_EMAIL || 'admin@gym.com' },
        select: { id: true }
    });
    return defaultAdmin?.id || user.id;
};
// Helper to guarantee a SaaS subscription record exists
const getOrCreateSaaSSubscription = async (ownerId, branchId) => {
    if (branchId) {
        let sub = await prisma.saaSSubscription.findUnique({
            where: { branchId },
        });
        if (!sub) {
            const trialEndDate = new Date();
            trialEndDate.setDate(trialEndDate.getDate() + 30); // 30 days trial
            sub = await prisma.saaSSubscription.create({
                data: {
                    ownerId,
                    branchId,
                    status: 'TRIAL_ACTIVE',
                    planName: 'Starter',
                    trialEndDate,
                    billingCycle: 'MONTHLY',
                },
            });
        }
        return sub;
    }
    let sub = await prisma.saaSSubscription.findFirst({
        where: { ownerId },
        orderBy: { createdAt: 'asc' },
    });
    if (!sub) {
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 30); // 30 days trial
        sub = await prisma.saaSSubscription.create({
            data: {
                ownerId,
                branchId: null,
                status: 'TRIAL_ACTIVE',
                planName: 'Starter',
                trialEndDate,
                billingCycle: 'MONTHLY',
            },
        });
    }
    return sub;
};
import { cacheDel } from '../config/cache.js';
export const getSaaSSubscriptionStatus = async (req, res) => {
    try {
        const reqUser = req.user;
        if (!reqUser)
            return res.status(401).json({ error: 'Unauthorized' });
        const ownerId = await getOwnerIdForUser(reqUser);
        const branchId = req.query.branchId || null;
        const sub = await getOrCreateSaaSSubscription(ownerId, branchId);
        // Check if trial has expired in real-time
        if (sub.status === 'TRIAL_ACTIVE' && new Date() > new Date(sub.trialEndDate)) {
            const updated = await prisma.saaSSubscription.update({
                where: { id: sub.id },
                data: { status: 'TRIAL_EXPIRED' },
            });
            cacheDel(`saas_sub_branch:${sub.branchId || 'none'}`, `saas_sub_owner:${ownerId}`);
            return res.status(200).json({ subscription: updated });
        }
        // Check if subscription has expired in real-time
        if (sub.status === 'SUBSCRIBED_ACTIVE' && sub.subscriptionEnd && new Date() > new Date(sub.subscriptionEnd)) {
            const updated = await prisma.saaSSubscription.update({
                where: { id: sub.id },
                data: { status: 'SUBSCRIBED_EXPIRED' },
            });
            cacheDel(`saas_sub_branch:${sub.branchId || 'none'}`, `saas_sub_owner:${ownerId}`);
            return res.status(200).json({ subscription: updated });
        }
        // Also fetch all branch subscriptions of this owner for the billing list overview
        let allSubscriptions = [];
        try {
            allSubscriptions = await prisma.saaSSubscription.findMany({
                where: { ownerId },
                include: {
                    branch: {
                        select: { name: true }
                    }
                },
                orderBy: { createdAt: 'asc' },
            });
        }
        catch {
            // Fallback: DB may not have branchId column yet (run prisma db push on server)
            allSubscriptions = await prisma.saaSSubscription.findMany({
                where: { ownerId },
                orderBy: { createdAt: 'asc' },
            });
        }
        return res.status(200).json({
            subscription: sub,
            allSubscriptions
        });
    }
    catch (error) {
        console.error('Fetch SaaS status error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
export const subscribeToPlan = async (req, res) => {
    try {
        const { planName, billingCycle, cardBrand, cardLast4, gstin, billingAddress, branchId } = req.body;
        const reqUser = req.user;
        if (!reqUser)
            return res.status(401).json({ error: 'Unauthorized' });
        if (!planName || !['Premium', 'Starter', 'Professional', 'Enterprise'].includes(planName)) {
            return res.status(400).json({ error: 'Invalid plan selected.' });
        }
        const ownerId = await getOwnerIdForUser(reqUser);
        const sub = await getOrCreateSaaSSubscription(ownerId, branchId);
        const now = new Date();
        const subscriptionEnd = new Date();
        if (billingCycle === 'YEARLY') {
            subscriptionEnd.setFullYear(now.getFullYear() + 1);
        }
        else if (billingCycle === 'HALF_YEARLY') {
            subscriptionEnd.setMonth(now.getMonth() + 6);
        }
        else {
            subscriptionEnd.setMonth(now.getMonth() + 1);
        }
        const updated = await prisma.saaSSubscription.update({
            where: { id: sub.id },
            data: {
                status: 'SUBSCRIBED_ACTIVE',
                planName,
                billingCycle: billingCycle || 'MONTHLY',
                subscriptionEnd,
                cardBrand: cardBrand || 'Visa',
                cardLast4: cardLast4 || '4242',
                gstin: gstin || null,
                billingAddress: billingAddress || null,
            },
        });
        cacheDel(`saas_sub_branch:${branchId || 'none'}`, `saas_sub_owner:${ownerId}`);
        return res.status(200).json({ message: 'Subscribed successfully', subscription: updated });
    }
    catch (error) {
        console.error('SaaS subscription error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
export const updateBillingProfile = async (req, res) => {
    try {
        const { gstin, billingAddress, cardBrand, cardLast4, branchId } = req.body;
        const reqUser = req.user;
        if (!reqUser)
            return res.status(401).json({ error: 'Unauthorized' });
        const ownerId = await getOwnerIdForUser(reqUser);
        const sub = await getOrCreateSaaSSubscription(ownerId, branchId);
        const updated = await prisma.saaSSubscription.update({
            where: { id: sub.id },
            data: {
                gstin: gstin !== undefined ? gstin : sub.gstin,
                billingAddress: billingAddress !== undefined ? billingAddress : sub.billingAddress,
                cardBrand: cardBrand !== undefined ? cardBrand : sub.cardBrand,
                cardLast4: cardLast4 !== undefined ? cardLast4 : sub.cardLast4,
            },
        });
        return res.status(200).json({ message: 'Billing profile updated successfully', subscription: updated });
    }
    catch (error) {
        console.error('Update SaaS billing error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
// Reset SaaS state for testing and demo purposes
export const resetSaaSState = async (req, res) => {
    try {
        const { status, daysRemaining } = req.body;
        const reqUser = req.user;
        if (!reqUser)
            return res.status(401).json({ error: 'Unauthorized' });
        const ownerId = await getOwnerIdForUser(reqUser);
        const sub = await getOrCreateSaaSSubscription(ownerId);
        const trialEndDate = new Date();
        if (daysRemaining !== undefined) {
            trialEndDate.setDate(trialEndDate.getDate() + Number(daysRemaining));
        }
        else {
            trialEndDate.setDate(trialEndDate.getDate() + 30);
        }
        const updated = await prisma.saaSSubscription.update({
            where: { id: sub.id },
            data: {
                status: status || 'TRIAL_ACTIVE',
                trialEndDate,
                subscriptionEnd: status === 'SUBSCRIBED_ACTIVE' ? trialEndDate : null,
            },
        });
        return res.status(200).json({ message: 'SaaS state reset successfully', subscription: updated });
    }
    catch (error) {
        console.error('Reset SaaS state error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
const getRazorpayInstance = () => {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_id || !key_secret) {
        throw new Error('Razorpay API keys are not configured in environment variables.');
    }
    return new Razorpay({
        key_id,
        key_secret,
    });
};
export const createSaaSOrder = async (req, res) => {
    try {
        const { planName, billingCycle, branchId } = req.body;
        const reqUser = req.user;
        if (!reqUser)
            return res.status(401).json({ error: 'Unauthorized' });
        if (!planName || !['Premium', 'Starter', 'Professional', 'Enterprise'].includes(planName)) {
            return res.status(400).json({ error: 'Invalid plan selected.' });
        }
        let price = billingCycle === 'YEARLY' ? 5500 : billingCycle === 'HALF_YEARLY' ? 2800 : 500;
        const razorpay = getRazorpayInstance();
        const amountInPaise = Math.round(price * 100);
        const options = {
            amount: amountInPaise,
            currency: 'INR',
            receipt: `saas_${Date.now()}_${reqUser.id.substring(0, 8)}`,
            notes: {
                userId: reqUser.id,
                planName,
                billingCycle,
                branchId: branchId || '',
            }
        };
        const order = await razorpay.orders.create(options);
        return res.status(200).json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.RAZORPAY_KEY_ID,
            user: {
                name: `${reqUser.firstName} ${reqUser.lastName}`,
                email: reqUser.email,
            }
        });
    }
    catch (error) {
        console.error('Razorpay SaaS Order Creation Error:', error);
        return res.status(500).json({ error: error.message || 'Failed to create SaaS order.' });
    }
};
export const verifySaaSPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planName, billingCycle, cardBrand, cardLast4, gstin, billingAddress, branchId } = req.body;
        const reqUser = req.user;
        if (!reqUser)
            return res.status(401).json({ error: 'Unauthorized' });
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ error: 'Incomplete transaction verification parameters' });
        }
        const key_secret = process.env.RAZORPAY_KEY_SECRET;
        if (!key_secret) {
            return res.status(500).json({ error: 'Razorpay keys not configured on server' });
        }
        // Verify signature
        const generated_signature = crypto
            .createHmac('sha256', key_secret)
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex');
        if (generated_signature !== razorpay_signature) {
            return res.status(400).json({ error: 'Secure payment signature mismatch. Transaction not verified.' });
        }
        const ownerId = await getOwnerIdForUser(reqUser);
        const now = new Date();
        const subscriptionEnd = new Date();
        if (billingCycle === 'YEARLY') {
            subscriptionEnd.setFullYear(now.getFullYear() + 1);
        }
        else if (billingCycle === 'HALF_YEARLY') {
            subscriptionEnd.setMonth(now.getMonth() + 6);
        }
        else {
            subscriptionEnd.setMonth(now.getMonth() + 1);
        }
        let updated;
        if (branchId) {
            const sub = await prisma.saaSSubscription.findUnique({
                where: { branchId },
            });
            if (!sub) {
                return res.status(404).json({ error: 'Subscription not found for this branch.' });
            }
            updated = await prisma.saaSSubscription.update({
                where: { id: sub.id },
                data: {
                    status: 'SUBSCRIBED_ACTIVE',
                    planName: planName || 'Premium',
                    billingCycle: billingCycle || 'MONTHLY',
                    subscriptionEnd,
                    cardBrand: cardBrand || 'Visa',
                    cardLast4: cardLast4 || '4242',
                    gstin: gstin || null,
                    billingAddress: billingAddress || null,
                },
            });
        }
        else {
            updated = await prisma.saaSSubscription.create({
                data: {
                    ownerId,
                    branchId: null,
                    status: 'SUBSCRIBED_ACTIVE',
                    planName: planName || 'Premium',
                    billingCycle: billingCycle || 'MONTHLY',
                    subscriptionEnd,
                    trialEndDate: now,
                    cardBrand: cardBrand || 'Visa',
                    cardLast4: cardLast4 || '4242',
                    gstin: gstin || null,
                    billingAddress: billingAddress || null,
                },
            });
        }
        cacheDel(`saas_sub_branch:${branchId || 'none'}`, `saas_sub_owner:${ownerId}`);
        return res.status(200).json({ message: 'Subscribed successfully', subscription: updated });
    }
    catch (error) {
        console.error('Razorpay SaaS verification error', { error: error.message });
        return res.status(500).json({ error: error.message || 'Internal payment verification error' });
    }
};
