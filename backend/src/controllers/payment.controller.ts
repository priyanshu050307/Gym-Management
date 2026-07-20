import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../config/prisma.js';
import { cacheDelPrefix } from '../config/cache.js';
import { isSuperAdmin } from '../utils/superadmin.js';
import { PaymentStatus, PaymentMethod, SubscriptionStatus, MemberStatus } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { createNotification } from './notification.controller.js';
import { activateSubscriptionAfterPayment } from '../utils/subscription.js';

export const getPayments = async (req: AuthRequest, res: Response) => {
  try {
    const { status, branchId } = req.query;

    const filter: any = {};
    if (status && Object.values(PaymentStatus).includes(status as any)) {
      filter.status = status as PaymentStatus;
    }

    // Branch Filtering logic
    const activeBranchIdHeader = req.headers['x-branch-id'] as string | undefined;
    const userRole = req.user?.role;
    const userBranchId = req.user?.branchId;
    const resolvedBranchId = (userRole !== 'ADMIN' ? userBranchId : (branchId as string || activeBranchIdHeader)) || undefined;

    if (resolvedBranchId) {
      filter.subscription = {
        member: {
          user: {
            branchId: resolvedBranchId,
          },
        },
      };
    } else {
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
  } catch (error: any) {
    console.error('Fetch payments error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const recordManualPayment = async (req: Request, res: Response) => {
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

    const reqUser = (req as any).user;
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
      } else {
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
          method: method as PaymentMethod,
          discount: discountAmount,
          amount: netAmount,
          paymentDate: new Date(),
        },
      });

      // 2. Activate subscription and set dates appropriately
      await activateSubscriptionAfterPayment(tx, payment);

      return updatedPayment;
    });

    await createNotification(
      payment.subscription.member.userId,
      'Payment Received',
      `Payment of ₹${netAmount} recorded successfully using ${method} for membership plan.`,
      'BILLING'
    );

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
  } catch (error: any) {
    console.error('Record manual payment error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const processMockCardPayment = async (req: Request, res: Response) => {
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

    const reqUser = (req as any).user;
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
      } else if (reqUser.role === 'ADMIN') {
        if (paymentMember.user.branchId) {
          const branch = await prisma.branch.findUnique({
            where: { id: paymentMember.user.branchId },
            select: { ownerId: true },
          });
          if (branch && branch.ownerId !== reqUser.id) {
            return res.status(403).json({ error: 'Access Denied: You do not own the branch this member belongs to.' });
          }
        }
      } else {
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

    await createNotification(
      payment.subscription.member.userId,
      'Payment Authorized',
      `Mock Card payment of ₹${payment.amount} authorized and logged successfully.`,
      'BILLING'
    );

    return res.status(200).json({
      message: 'Mock Card payment authorized and logged successfully',
      payment: result,
    });
  } catch (error: any) {
    console.error('Mock card payment error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const downloadInvoice = async (req: Request, res: Response) => {
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

    // Fetch branch info dynamically
    let branch = null;
    if (user.branchId) {
      branch = await prisma.branch.findUnique({
        where: { id: user.branchId },
      });
    }
    const branchName = branch ? branch.name : 'Gymnasium Club';
    const branchAddress = branch ? branch.address : '100 Fitness Boulevard';
    const branchPhone = branch ? branch.phone : 'N/A';
    const branchGst = branch ? branch.gstNo : 'N/A';

    const reqUser = (req as any).user;
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

    // Header Title: Branch Name
    doc.fillColor(primaryColor)
       .font('Helvetica-Bold')
       .fontSize(18)
       .text(branchName.toUpperCase(), 50, 45)
       .fontSize(9)
       .font('Helvetica')
       .fillColor(secondaryColor)
       .text('SECURE MEMBER PAYMENT RECEIPT', 50, 70);

    // Highlight Gymnasium Brand
    doc.rect(380, 42, 170, 20).fill('#f5f3ff');
    doc.fillColor(primaryColor)
       .font('Helvetica-Bold')
       .fontSize(8)
       .text('POWERED BY GYMNASIUM SOFTWARE', 380, 48, { align: 'center', width: 170 });

    // Invoice Metadata
    doc.font('Helvetica')
       .fontSize(14)
       .fillColor('#0f172a')
       .text('RECEIPT', 400, 72, { align: 'right' })
       .fontSize(8)
       .fillColor(secondaryColor)
       .text(`ID: ${payment.id.toUpperCase()}`, 400, 90, { align: 'right' })
       .text(`Date: ${payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString() : 'N/A'}`, 400, 102, { align: 'right' })
       .text(`Status: ${payment.status}`, 400, 114, { align: 'right' });

    // Separation line
    doc.moveTo(50, 130).lineTo(550, 130).strokeColor('#e2e8f0').stroke();

    // From info (Branch info)
    doc.fontSize(10)
       .fillColor('#0f172a')
       .font('Helvetica-Bold')
       .text('BILLED BY:', 50, 145)
       .font('Helvetica')
       .fontSize(9)
       .fillColor(secondaryColor)
       .text(branchName, 50, 160)
       .text(branchAddress || 'N/A', 50, 173)
       .text(`Phone: ${branchPhone || 'N/A'}`, 50, 186)
       .text(`GSTIN: ${branchGst || 'N/A'}`, 50, 199);

    // To info
    doc.fontSize(10)
       .fillColor('#0f172a')
       .font('Helvetica-Bold')
       .text('BILLED TO:', 300, 145)
       .font('Helvetica')
       .fontSize(9)
       .fillColor(secondaryColor)
       .text(`${user.firstName} ${user.lastName}`, 300, 160)
       .text(`Email: ${user.email}`, 300, 173)
       .text(`Member ID: ${member.id}`, 300, 186)
       .text(`Emergency: ${member.emergencyContact || 'None'}`, 300, 199);

    // Table Header Block
    const tableTop = 240;
    doc.rect(50, tableTop, 500, 25).fill(lightColor);

    doc.fillColor('#0f172a')
       .font('Helvetica-Bold')
       .fontSize(9)
       .text('ITEM DESCRIPTION', 60, tableTop + 8)
       .text('DURATION', 280, tableTop + 8)
       .text('METHOD', 380, tableTop + 8)
       .text('TOTAL PRICE', 480, tableTop + 8, { align: 'right' });

    // Table Content Line
    const itemRowTop = tableTop + 25;
    doc.moveTo(50, itemRowTop).lineTo(550, itemRowTop).strokeColor('#e2e8f0').stroke();

    doc.fillColor(secondaryColor)
       .font('Helvetica')
       .text(`Membership Plan: ${sub.plan.name}`, 60, itemRowTop + 15)
       .text(`${sub.plan.durationMonths} ${sub.plan.durationMonths === 1 ? 'Month' : 'Months'}`, 280, itemRowTop + 15)
       .text(`${payment.method || 'PENDING'}`, 380, itemRowTop + 15)
       .fillColor('#0f172a')
       .text(`Rs. ${payment.amount.toFixed(2)}`, 480, itemRowTop + 15, { align: 'right' });

    // Total section box
    const totalTop = itemRowTop + 50;
    doc.moveTo(50, totalTop).lineTo(550, totalTop).strokeColor('#e2e8f0').stroke();

    doc.fontSize(10)
       .fillColor('#0f172a')
       .text('Subtotal:', 380, totalTop + 15)
       .text(`Rs. ${payment.amount.toFixed(2)}`, 480, totalTop + 15, { align: 'right' })
       .text('Tax (0%):', 380, totalTop + 30)
       .text('Rs. 0.00', 480, totalTop + 30, { align: 'right' })
       .fontSize(12)
       .font('Helvetica-Bold')
       .fillColor(primaryColor)
       .text('Grand Total:', 380, totalTop + 55)
       .text(`Rs. ${payment.amount.toFixed(2)}`, 480, totalTop + 55, { align: 'right' });

    // Footer signature
    doc.fillColor(secondaryColor)
       .font('Helvetica-Oblique')
       .fontSize(8)
       .text('Thank you for being part of the Gymnasium community! Generated securely via Gymnasium Cloud Suite.', 50, 480, { align: 'center', width: 500 });

    // End Document
    doc.end();
  } catch (error: any) {
    console.error('Download invoice PDF error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const refundPayment = async (req: Request, res: Response) => {
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

    const reqUser = (req as any).user;
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

    await createNotification(
      payment.subscription.member.userId,
      'Refund Processed',
      `A refund of ₹${refundAmount} has been processed for your payment.`,
      'BILLING'
    );

    return res.status(200).json({ message: 'Refund processed successfully', payment: updatedPayment });
  } catch (error: any) {
    console.error('Refund payment error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getDailyCollectionReport = async (req: AuthRequest, res: Response) => {
  try {
    const { date, branchId } = req.query;
    const targetDate = date ? new Date(date as string) : new Date();

    const startOfTarget = new Date(targetDate);
    startOfTarget.setHours(0, 0, 0, 0);

    const endOfTarget = new Date(targetDate);
    endOfTarget.setHours(23, 59, 59, 999);

    // Branch Filtering logic
    const activeBranchIdHeader = req.headers['x-branch-id'] as string | undefined;
    const userRole = req.user?.role;
    const userBranchId = req.user?.branchId;
    const resolvedBranchId = (userRole !== 'ADMIN' ? userBranchId : (branchId as string || activeBranchIdHeader)) || undefined;

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
    const methodBreakdown: { [key: string]: number } = {
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
  } catch (error: any) {
    console.error('Daily collection report error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
