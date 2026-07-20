import prisma from '../config/prisma.js';
import { cacheDelPrefix } from '../config/cache.js';
import { isSuperAdmin } from '../utils/superadmin.js';
import { PaymentStatus, PaymentMethod } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { createNotification } from './notification.controller.js';
import { activateSubscriptionAfterPayment } from '../utils/subscription.js';
export const getPayments = async (req, res) => {
    try {
        const { status, branchId } = req.query;
        const filter = {};
        if (status && Object.values(PaymentStatus).includes(status)) {
            filter.status = status;
        }
        // Branch Filtering logic
        const activeBranchIdHeader = req.headers['x-branch-id'];
        const userRole = req.user?.role;
        const userBranchId = req.user?.branchId;
        const resolvedBranchId = (userRole !== 'ADMIN' ? userBranchId : (branchId || activeBranchIdHeader)) || undefined;
        if (resolvedBranchId) {
            filter.subscription = {
                member: {
                    user: {
                        branchId: resolvedBranchId,
                    },
                },
            };
        }
        else {
            // Find all branches owned by this admin
            const ownedBranches = await prisma.branch.findMany({
                where: isSuperAdmin(req.user) ? {
                    OR: [{ ownerId: req.user?.id || '' }, { ownerId: null }]
                } : { ownerId: req.user?.id || '' },
                select: { id: true }
            });
            filter.subscription = {
                member: {
                    user: {
                        branchId: { in: ownedBranches.map(b => b.id) }
                    }
                }
            };
        }
        const payments = await prisma.payment.findMany({
            where: filter,
            include: {
                subscription: {
                    include: {
                        plan: true,
                        member: {
                            include: {
                                user: {
                                    select: {
                                        firstName: true,
                                        lastName: true,
                                        email: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: { paymentDate: 'desc' },
        });
        return res.status(200).json({ payments });
    }
    catch (error) {
        console.error('Fetch payments error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
export const recordManualPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { method, discount } = req.body;
        if (!method || !Object.values(PaymentMethod).includes(method)) {
            return res.status(400).json({ error: 'Valid payment method (CASH, CARD, UPI) is required' });
        }
        const payment = await prisma.payment.findUnique({
            where: { id },
            include: {
                subscription: {
                    include: {
                        member: true
                    }
                }
            },
        });
        if (!payment) {
            return res.status(404).json({ error: 'Payment record not found' });
        }
        const reqUser = req.user;
        const paymentMember = await prisma.member.findUnique({
            where: { id: payment.subscription.memberId },
            include: { user: true },
        });
        if (!paymentMember) {
            return res.status(404).json({ error: 'Associated member not found' });
        }
        if (reqUser && !isSuperAdmin(reqUser)) {
            if (reqUser.role === 'ADMIN') {
                if (paymentMember.user.branchId) {
                    const branch = await prisma.branch.findUnique({
                        where: { id: paymentMember.user.branchId },
                        select: { ownerId: true },
                    });
                    if (branch && branch.ownerId !== reqUser.id) {
                        return res.status(403).json({ error: 'Access Denied: You do not own the branch this member belongs to.' });
                    }
                }
            }
            else {
                if (paymentMember.user.branchId !== reqUser.branchId) {
                    return res.status(403).json({ error: 'Access Denied: You can only record payments for members in your own branch.' });
                }
            }
        }
        if (payment.status === PaymentStatus.PAID) {
            return res.status(400).json({ error: 'Payment has already been paid' });
        }
        const discountAmount = discount ? parseFloat(discount) : 0;
        const netAmount = Math.max(0, payment.amount - discountAmount);
        const result = await prisma.$transaction(async (tx) => {
            // 1. Mark payment as PAID with discount details
            const updatedPayment = await tx.payment.update({
                where: { id },
                data: {
                    status: PaymentStatus.PAID,
                    method: method,
                    discount: discountAmount,
                    amount: netAmount,
                    paymentDate: new Date(),
                },
            });
            // 2. Activate subscription and set dates appropriately
            await activateSubscriptionAfterPayment(tx, payment);
            return updatedPayment;
        });
        await createNotification(payment.subscription.member.userId, 'Payment Received', `Payment of ₹${netAmount} recorded successfully using ${method} for membership plan.`, 'BILLING');
        // Invalidate caches
        if (reqUser) {
            let ownerId = reqUser.id;
            if (reqUser.role === 'STAFF' && reqUser.branchId) {
                const branch = await prisma.branch.findUnique({
                    where: { id: reqUser.branchId },
                    select: { ownerId: true }
                });
                ownerId = branch?.ownerId || '';
            }
            if (ownerId) {
                cacheDelPrefix(`members:${ownerId}`);
                cacheDelPrefix(`dashboard:${ownerId}`);
            }
        }
        return res.status(200).json({ message: 'Payment recorded successfully', payment: result });
    }
    catch (error) {
        console.error('Record manual payment error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
export const processMockCardPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { cardNumber, expiry, cvc, cardholderName } = req.body;
        if (!cardNumber || !expiry || !cvc || !cardholderName) {
            return res.status(400).json({ error: 'Card parameters are incomplete' });
        }
        const payment = await prisma.payment.findUnique({
            where: { id },
            include: {
                subscription: {
                    include: {
                        member: true
                    }
                }
            },
        });
        if (!payment) {
            return res.status(404).json({ error: 'Payment record not found' });
        }
        const reqUser = req.user;
        const paymentMember = await prisma.member.findUnique({
            where: { id: payment.subscription.memberId },
            include: { user: true },
        });
        if (!paymentMember) {
            return res.status(404).json({ error: 'Associated member not found' });
        }
        if (reqUser && !isSuperAdmin(reqUser)) {
            if (reqUser.role === 'MEMBER') {
                if (reqUser.id !== paymentMember.userId) {
                    return res.status(403).json({ error: 'Access Denied: You can only pay for your own subscriptions.' });
                }
            }
            else if (reqUser.role === 'ADMIN') {
                if (paymentMember.user.branchId) {
                    const branch = await prisma.branch.findUnique({
                        where: { id: paymentMember.user.branchId },
                        select: { ownerId: true },
                    });
                    if (branch && branch.ownerId !== reqUser.id) {
                        return res.status(403).json({ error: 'Access Denied: You do not own the branch this member belongs to.' });
                    }
                }
            }
            else {
                if (paymentMember.user.branchId !== reqUser.branchId) {
                    return res.status(403).json({ error: 'Access Denied: You can only pay for members in your own branch.' });
                }
            }
        }
        if (payment.status === PaymentStatus.PAID) {
            return res.status(400).json({ error: 'Payment has already been paid' });
        }
        // Process payment in a transaction
        const result = await prisma.$transaction(async (tx) => {
            // Mark payment as PAID
            const updatedPayment = await tx.payment.update({
                where: { id },
                data: {
                    status: PaymentStatus.PAID,
                    method: PaymentMethod.CARD,
                    paymentDate: new Date(),
                },
            });
            // Activate subscription and set dates appropriately
            await activateSubscriptionAfterPayment(tx, payment);
            return updatedPayment;
        });
        await createNotification(payment.subscription.member.userId, 'Payment Authorized', `Mock Card payment of ₹${payment.amount} authorized and logged successfully.`, 'BILLING');
        return res.status(200).json({
            message: 'Mock Card payment authorized and logged successfully',
            payment: result,
        });
    }
    catch (error) {
        console.error('Mock card payment error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
export const downloadInvoice = async (req, res) => {
    try {
        const { id } = req.params;
        const payment = await prisma.payment.findUnique({
            where: { id },
            include: {
                subscription: {
                    include: {
                        plan: true,
                        member: {
                            include: {
                                user: true,
                            },
                        },
                    },
                },
            },
        });
        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }
        const sub = payment.subscription;
        const member = sub.member;
        const user = member.user;
        const reqUser = req.user;
        if (reqUser && reqUser.role === 'MEMBER' && user.id !== reqUser.id) {
            return res.status(403).json({ error: 'Access Denied: You can only download your own invoices.' });
        }
        if (reqUser && reqUser.role !== 'ADMIN' && reqUser.role !== 'MEMBER') {
            if (user.branchId !== reqUser.branchId) {
                return res.status(403).json({ error: 'Access Denied: You can only download invoices for members in your own branch.' });
            }
        }
        // Create a PDF Document
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        // Stream the PDF straight to Response
        res.setHeader('Content-disposition', `attachment; filename=invoice_${payment.id}.pdf`);
        res.setHeader('Content-type', 'application/pdf');
        doc.pipe(res);
        // Color Palette
        const primaryColor = '#8b5cf6'; // Violet
        const secondaryColor = '#475569'; // Slate-600
        const lightColor = '#f8fafc'; // Slate-50
        // Header Title
        doc.fillColor(primaryColor)
            .fontSize(26)
            .text('GYMNASIUM CLUB', 50, 45)
            .fontSize(10)
            .fillColor(secondaryColor)
            .text('PREMIUM FITNESS & HEALTH CLUB', 50, 75);
        // Invoice Metadata
        doc.fontSize(16)
            .fillColor('#0f172a')
            .text('INVOICE', 400, 45, { align: 'right' })
            .fontSize(9)
            .fillColor(secondaryColor)
            .text(`Invoice ID: ${payment.id.toUpperCase()}`, 400, 65, { align: 'right' })
            .text(`Date: ${payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString() : 'N/A'}`, 400, 78, { align: 'right' })
            .text(`Status: ${payment.status}`, 400, 91, { align: 'right' });
        // Separation line
        doc.moveTo(50, 115).lineTo(550, 115).strokeColor('#e2e8f0').stroke();
        // From info
        doc.fontSize(10)
            .fillColor('#0f172a')
            .text('BILLED BY:', 50, 135)
            .fontSize(9)
            .fillColor(secondaryColor)
            .text('Gymnasium Inc.', 50, 150)
            .text('100 Fitness Boulevard', 50, 163)
            .text('New York, NY 10001', 50, 176)
            .text('support@gymnasium.com', 50, 189);
        // To info
        doc.fontSize(10)
            .fillColor('#0f172a')
            .text('BILLED TO:', 300, 135)
            .fontSize(9)
            .fillColor(secondaryColor)
            .text(`${user.firstName} ${user.lastName}`, 300, 150)
            .text(`Email: ${user.email}`, 300, 163)
            .text(`Member ID: ${member.id}`, 300, 176)
            .text(`Emergency contact: ${member.emergencyContact || 'None'}`, 300, 189);
        // Table Header Block
        const tableTop = 230;
        doc.rect(50, tableTop, 500, 25).fill(lightColor);
        doc.fillColor('#0f172a')
            .fontSize(9)
            .text('ITEM DESCRIPTION', 60, tableTop + 8)
            .text('DURATION', 280, tableTop + 8)
            .text('METHOD', 380, tableTop + 8)
            .text('TOTAL PRICE', 480, tableTop + 8, { align: 'right' });
        // Table Content Line
        const itemRowTop = tableTop + 25;
        doc.moveTo(50, itemRowTop).lineTo(550, itemRowTop).strokeColor('#e2e8f0').stroke();
        doc.fillColor(secondaryColor)
            .text(`Membership Plan: ${sub.plan.name}`, 60, itemRowTop + 15)
            .text(`${sub.plan.durationMonths} ${sub.plan.durationMonths === 1 ? 'Month' : 'Months'}`, 280, itemRowTop + 15)
            .text(`${payment.method || 'PENDING'}`, 380, itemRowTop + 15)
            .fillColor('#0f172a')
            .text(`Rs. ${payment.amount.toFixed(2)}`, 480, itemRowTop + 15, { align: 'right' });
        // Total section box
        const totalTop = itemRowTop + 50;
        doc.moveTo(50, totalTop).lineTo(550, totalTop).strokeColor('#e2e8f0').stroke();
        doc.fontSize(11)
            .fillColor('#0f172a')
            .text('Subtotal:', 380, totalTop + 15)
            .text(`Rs. ${payment.amount.toFixed(2)}`, 480, totalTop + 15, { align: 'right' })
            .text('Tax (0%):', 380, totalTop + 30)
            .text('Rs. 0.00', 480, totalTop + 30, { align: 'right' })
            .fontSize(14)
            .fillColor(primaryColor)
            .text('Grand Total:', 380, totalTop + 55)
            .text(`Rs. ${payment.amount.toFixed(2)}`, 480, totalTop + 55, { align: 'right' });
        // Footer signature
        doc.fillColor(secondaryColor)
            .fontSize(8)
            .text('Thank you for being part of the Gymnasium community! Please keep this copy for your records.', 50, 480, { align: 'center' });
        // End Document
        doc.end();
    }
    catch (error) {
        console.error('Download invoice PDF error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
export const refundPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { amount } = req.body;
        const payment = await prisma.payment.findUnique({
            where: { id },
            include: {
                subscription: {
                    include: {
                        member: true
                    }
                }
            },
        });
        if (!payment) {
            return res.status(404).json({ error: 'Payment record not found' });
        }
        const reqUser = req.user;
        if (reqUser && reqUser.role !== 'ADMIN') {
            const paymentMember = await prisma.member.findUnique({
                where: { id: payment.subscription.memberId },
                include: { user: true },
            });
            if (paymentMember?.user.branchId !== reqUser.branchId) {
                return res.status(403).json({ error: 'Access Denied: You can only refund payments for members in your own branch.' });
            }
        }
        if (payment.status !== PaymentStatus.PAID) {
            return res.status(400).json({ error: 'Cannot refund an unpaid or pending payment' });
        }
        if (payment.isRefunded) {
            return res.status(400).json({ error: 'Payment is already fully or partially refunded' });
        }
        const refundAmount = amount ? parseFloat(amount) : payment.amount;
        if (refundAmount > payment.amount) {
            return res.status(400).json({ error: `Refund amount (Rs. ${refundAmount}) cannot exceed paid amount (Rs. ${payment.amount})` });
        }
        const updatedPayment = await prisma.payment.update({
            where: { id },
            data: {
                isRefunded: true,
                refundedAmount: refundAmount,
            },
        });
        await createNotification(payment.subscription.member.userId, 'Refund Processed', `A refund of ₹${refundAmount} has been processed for your payment.`, 'BILLING');
        return res.status(200).json({ message: 'Refund processed successfully', payment: updatedPayment });
    }
    catch (error) {
        console.error('Refund payment error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
export const getDailyCollectionReport = async (req, res) => {
    try {
        const { date, branchId } = req.query;
        const targetDate = date ? new Date(date) : new Date();
        const startOfTarget = new Date(targetDate);
        startOfTarget.setHours(0, 0, 0, 0);
        const endOfTarget = new Date(targetDate);
        endOfTarget.setHours(23, 59, 59, 999);
        // Branch Filtering logic
        const activeBranchIdHeader = req.headers['x-branch-id'];
        const userRole = req.user?.role;
        const userBranchId = req.user?.branchId;
        const resolvedBranchId = (userRole !== 'ADMIN' ? userBranchId : (branchId || activeBranchIdHeader)) || undefined;
        const payments = await prisma.payment.findMany({
            where: {
                status: PaymentStatus.PAID,
                paymentDate: {
                    gte: startOfTarget,
                    lte: endOfTarget,
                },
                subscription: resolvedBranchId ? {
                    member: {
                        user: {
                            branchId: resolvedBranchId,
                        },
                    },
                } : undefined,
            },
            include: {
                subscription: {
                    include: {
                        plan: true,
                        member: {
                            include: {
                                user: {
                                    select: {
                                        firstName: true,
                                        lastName: true,
                                        email: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: { paymentDate: 'desc' },
        });
        // Calculations
        let totalCollected = 0;
        let totalDiscount = 0;
        let totalRefunded = 0;
        const methodBreakdown = {
            CASH: 0,
            CARD: 0,
            UPI: 0,
            STRIPE: 0,
        };
        payments.forEach((payment) => {
            totalCollected += payment.amount;
            totalDiscount += payment.discount;
            totalRefunded += payment.refundedAmount;
            if (payment.method) {
                methodBreakdown[payment.method] = (methodBreakdown[payment.method] || 0) + payment.amount;
            }
        });
        return res.status(200).json({
            date: startOfTarget.toISOString().split('T')[0],
            totalCollected,
            totalDiscount,
            totalRefunded,
            methodBreakdown,
            payments,
        });
    }
    catch (error) {
        console.error('Daily collection report error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
