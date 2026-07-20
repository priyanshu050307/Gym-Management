import prisma from '../config/prisma.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { generateInvoicePDF } from '../utils/invoiceGenerator.js';
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
        // Fetch all subscriptions for this owner (no relation include to avoid client version issues)
        const allSubscriptions = await prisma.saaSSubscription.findMany({
            where: { ownerId },
            orderBy: { createdAt: 'asc' },
        });
        // Separately fetch branch names and join manually
        const branchIds = allSubscriptions.map((s) => s.branchId).filter(Boolean);
        const branches = branchIds.length > 0
            ? await prisma.branch.findMany({
                where: { id: { in: branchIds } },
                select: { id: true, name: true },
            })
            : [];
        const branchMap = Object.fromEntries(branches.map(b => [b.id, b.name]));
        const allSubsWithBranch = allSubscriptions.map((s) => ({
            ...s,
            branch: s.branchId ? { name: branchMap[s.branchId] || 'Unknown Branch' } : null,
        }));
        return res.status(200).json({
            subscription: sub,
            allSubscriptions: allSubsWithBranch,
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
export const validatePromoCode = async (req, res) => {
    try {
        const { code, billingCycle } = req.query;
        if (!code) {
            return res.status(400).json({ error: 'Promo code is required.' });
        }
        const promo = await prisma.promoCode.findUnique({
            where: { code: String(code).toUpperCase() },
        });
        if (!promo || !promo.isActive) {
            return res.status(404).json({ error: 'Invalid or inactive promo code.' });
        }
        if (promo.expiresAt && new Date() > new Date(promo.expiresAt)) {
            return res.status(400).json({ error: 'Promo code has expired.' });
        }
        if (billingCycle && promo.applicableCycles.length > 0 && !promo.applicableCycles.includes(String(billingCycle))) {
            return res.status(400).json({ error: `Promo code is not applicable to the ${billingCycle} billing cycle.` });
        }
        return res.status(200).json({
            valid: true,
            discountPercent: promo.discountPercent,
        });
    }
    catch (error) {
        console.error('Validate promo code error:', error);
        return res.status(500).json({ error: 'Failed to validate promo code.' });
    }
};
export const createSaaSOrder = async (req, res) => {
    try {
        const { planName, billingCycle, branchId, promoCode } = req.body;
        const reqUser = req.user;
        if (!reqUser)
            return res.status(401).json({ error: 'Unauthorized' });
        if (!planName || !['Premium', 'Starter', 'Professional', 'Enterprise'].includes(planName)) {
            return res.status(400).json({ error: 'Invalid plan selected.' });
        }
        let basePrice = billingCycle === 'YEARLY' ? 5500 : billingCycle === 'HALF_YEARLY' ? 2800 : 500;
        let discountPercent = 0;
        if (promoCode) {
            const promo = await prisma.promoCode.findUnique({
                where: { code: String(promoCode).toUpperCase() },
            });
            if (promo && promo.isActive && (!promo.expiresAt || new Date() <= new Date(promo.expiresAt))) {
                if (!promo.applicableCycles.length || promo.applicableCycles.includes(billingCycle)) {
                    discountPercent = promo.discountPercent;
                }
            }
        }
        const discountAmount = (basePrice * discountPercent) / 100;
        const finalPrice = Math.max(0, basePrice - discountAmount);
        const razorpay = getRazorpayInstance();
        const amountInPaise = Math.round(finalPrice * 100);
        const options = {
            amount: amountInPaise,
            currency: 'INR',
            receipt: `saas_${Date.now()}_${reqUser.id.substring(0, 8)}`,
            notes: {
                userId: reqUser.id,
                planName,
                billingCycle,
                branchId: branchId || '',
                promoCode: promoCode || '',
                discountApplied: String(discountAmount),
                amountPaid: String(finalPrice)
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
            },
            discountApplied: discountAmount,
            finalPrice: finalPrice
        });
    }
    catch (error) {
        console.error('Razorpay SaaS Order Creation Error:', error);
        return res.status(500).json({ error: error.message || 'Failed to create SaaS order.' });
    }
};
export const verifySaaSPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planName, billingCycle, cardBrand, cardLast4, gstin, billingAddress, branchId, promoCode, discountApplied, amountPaid } = req.body;
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
        const invoiceNumber = `INV-GYMOS-${now.getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
        const discountVal = discountApplied ? parseFloat(discountApplied) : 0;
        const basePrice = billingCycle === 'YEARLY' ? 5500 : billingCycle === 'HALF_YEARLY' ? 2800 : 500;
        const paidVal = amountPaid ? parseFloat(amountPaid) : (basePrice - discountVal);
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
                    promoCodeUsed: promoCode || null,
                    discountApplied: discountVal,
                    amountPaid: paidVal,
                    razorpayPaymentId: razorpay_payment_id,
                    invoiceNumber
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
                    promoCodeUsed: promoCode || null,
                    discountApplied: discountVal,
                    amountPaid: paidVal,
                    razorpayPaymentId: razorpay_payment_id,
                    invoiceNumber
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
export const downloadSaaSInvoice = async (req, res) => {
    try {
        const { subscriptionId } = req.params;
        const reqUser = req.user;
        if (!reqUser)
            return res.status(401).json({ error: 'Unauthorized' });
        const sub = await prisma.saaSSubscription.findUnique({
            where: { id: subscriptionId },
            include: {
                owner: true,
            }
        });
        if (!sub) {
            return res.status(404).json({ error: 'Subscription invoice not found.' });
        }
        // Security: Only the owner or sub-admins of this workspace can download
        if (sub.ownerId !== reqUser.id && reqUser.role !== 'ADMIN') {
            const ownerId = await getOwnerIdForUser(reqUser);
            if (sub.ownerId !== ownerId) {
                return res.status(403).json({ error: 'Forbidden' });
            }
        }
        // Fetch branch details
        let branchInfo = { name: 'Primary Branch', address: 'GymOS Core Location', phone: 'N/A', gstNo: sub.gstin || 'N/A' };
        if (sub.branchId) {
            const dbBranch = await prisma.branch.findUnique({
                where: { id: sub.branchId }
            });
            if (dbBranch) {
                branchInfo = {
                    name: dbBranch.name,
                    address: dbBranch.address || 'N/A',
                    phone: dbBranch.phone || 'N/A',
                    gstNo: dbBranch.gstNo || sub.gstin || 'N/A'
                };
            }
        }
        const basePrice = sub.billingCycle === 'YEARLY' ? 5500 : sub.billingCycle === 'HALF_YEARLY' ? 2800 : 500;
        // Set headers for secure PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Invoice-${sub.invoiceNumber || sub.id}.pdf`);
        generateInvoicePDF(res, {
            invoiceNumber: sub.invoiceNumber || `INV-TEMP-${sub.id.substring(0, 8)}`,
            date: new Date(sub.updatedAt).toLocaleDateString(),
            adminName: `${sub.owner.firstName} ${sub.owner.lastName}`,
            adminEmail: sub.owner.email,
            branchName: branchInfo.name,
            branchAddress: branchInfo.address,
            branchPhone: branchInfo.phone,
            branchGst: branchInfo.gstNo,
            planName: sub.planName,
            billingCycle: sub.billingCycle,
            amount: basePrice,
            discount: sub.discountApplied,
            total: sub.amountPaid > 0 ? sub.amountPaid : (basePrice - sub.discountApplied),
            paymentId: sub.razorpayPaymentId || 'SYSTEM_TRIAL',
        });
    }
    catch (error) {
        console.error('Invoice generation error:', error);
        if (!res.headersSent) {
            return res.status(500).json({ error: 'Failed to generate PDF invoice.' });
        }
    }
};
