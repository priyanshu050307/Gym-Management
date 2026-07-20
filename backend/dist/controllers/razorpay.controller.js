import prisma from '../config/prisma.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { PaymentStatus, PaymentMethod } from '@prisma/client';
import { createNotification } from './notification.controller.js';
import { activateSubscriptionAfterPayment } from '../utils/subscription.js';
import logger from '../config/logger.js';
import { emitPaymentReceived } from '../config/socket.js';
import { sendPaymentReceiptEmail } from '../config/email.js';
// Initialize Razorpay client
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
export const createRazorpayOrder = async (req, res) => {
    try {
        const { id } = req.params; // Payment record ID
        const payment = await prisma.payment.findUnique({
            where: { id },
            include: {
                subscription: {
                    include: {
                        member: {
                            include: {
                                user: true
                            }
                        }
                    }
                }
            },
        });
        if (!payment) {
            return res.status(404).json({ error: 'Payment record not found' });
        }
        if (payment.status === PaymentStatus.PAID) {
            return res.status(400).json({ error: 'Payment has already been paid' });
        }
        // Role verification
        if (req.user?.role === 'MEMBER') {
            if (payment.subscription.member.userId !== req.user.id) {
                return res.status(403).json({ error: 'Access Denied: You cannot purchase orders for other members.' });
            }
        }
        else if (req.user?.role !== 'ADMIN') {
            if (payment.subscription.member.user.branchId !== req.user?.branchId) {
                return res.status(403).json({ error: 'Access Denied: Member belongs to a different branch.' });
            }
        }
        const razorpay = getRazorpayInstance();
        const amountInPaise = Math.round(payment.amount * 100);
        const options = {
            amount: amountInPaise,
            currency: 'INR',
            receipt: payment.id,
            notes: {
                subscriptionId: payment.subscriptionId,
                memberId: payment.subscription.memberId,
                memberEmail: payment.subscription.member.user.email
            }
        };
        const order = await razorpay.orders.create(options);
        // Save order ID to the payment record
        await prisma.payment.update({
            where: { id: payment.id },
            data: { razorpayOrderId: order.id }
        });
        return res.status(200).json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.RAZORPAY_KEY_ID,
            paymentId: payment.id,
            member: {
                name: `${payment.subscription.member.user.firstName} ${payment.subscription.member.user.lastName}`,
                email: payment.subscription.member.user.email,
                phone: payment.subscription.member.emergencyContact || ''
            }
        });
    }
    catch (error) {
        console.error('Razorpay Order Creation Error:', error);
        const errorMsg = error.error?.description || error.message || 'Failed to create Razorpay order';
        return res.status(500).json({ error: errorMsg });
    }
};
export const verifyRazorpayPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
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
        // Find the corresponding payment record
        const payment = await prisma.payment.findFirst({
            where: { razorpayOrderId: razorpay_order_id },
            include: {
                subscription: {
                    include: {
                        member: true,
                        plan: true
                    }
                }
            }
        });
        if (!payment) {
            return res.status(404).json({ error: 'Associated payment record not found for this order' });
        }
        if (payment.status === PaymentStatus.PAID) {
            return res.status(200).json({ message: 'Payment already completed', payment });
        }
        // Update statuses inside a database transaction
        const result = await prisma.$transaction(async (tx) => {
            const updatedPayment = await tx.payment.update({
                where: { id: payment.id },
                data: {
                    status: PaymentStatus.PAID,
                    method: PaymentMethod.RAZORPAY,
                    razorpayPaymentId: razorpay_payment_id,
                    razorpaySignature: razorpay_signature,
                    paymentDate: new Date(),
                },
            });
            await activateSubscriptionAfterPayment(tx, payment);
            return updatedPayment;
        });
        // Notify the member
        await createNotification(payment.subscription.member.userId, 'Payment Succeeded', `Payment of ₹${payment.amount} verified securely via Razorpay. Your membership is now active!`, 'BILLING');
        // Get the owning admin for this branch
        const memberUser = await prisma.user.findUnique({
            where: { id: payment.subscription.member.userId },
            include: { branch: true },
        });
        const ownerBranch = await prisma.branch.findUnique({
            where: { id: memberUser?.branchId || '' },
            select: { ownerId: true, name: true },
        });
        if (ownerBranch?.ownerId) {
            emitPaymentReceived(ownerBranch.ownerId, {
                memberName: `${memberUser?.firstName} ${memberUser?.lastName}`,
                amount: payment.amount,
                planName: payment.subscription?.plan?.name || 'Membership',
            });
        }
        // Send email receipt (non-blocking)
        sendPaymentReceiptEmail(memberUser?.email || '', `${memberUser?.firstName} ${memberUser?.lastName}`, payment.subscription?.plan?.name || 'Membership', payment.amount, razorpay_payment_id).catch((e) => logger.error('Failed to send receipt email', { error: e.message }));
        return res.status(200).json({
            message: 'Payment verified and subscription activated successfully',
            payment: result
        });
    }
    catch (error) {
        logger.error('Razorpay verification error', { error: error.message });
        return res.status(500).json({ error: error.message || 'Internal payment verification error' });
    }
};
