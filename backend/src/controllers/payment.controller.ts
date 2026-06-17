import { Request, Response } from 'express';
import prisma from '../config/prisma.js';
import { PaymentStatus, PaymentMethod, SubscriptionStatus, MemberStatus } from '@prisma/client';
import PDFDocument from 'pdfkit';

export const getPayments = async (req: Request, res: Response) => {
  try {
    const { status } = req.query;

    const filter: any = {};
    if (status && Object.values(PaymentStatus).includes(status as any)) {
      filter.status = status as PaymentStatus;
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
    const { method } = req.body;

    if (!method || !Object.values(PaymentMethod).includes(method)) {
      return res.status(400).json({ error: 'Valid payment method (CASH, CARD, UPI) is required' });
    }

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { subscription: true },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment record not found' });
    }

    if (payment.status === PaymentStatus.PAID) {
      return res.status(400).json({ error: 'Payment has already been paid' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Mark payment as PAID
      const updatedPayment = await tx.payment.update({
        where: { id },
        data: {
          status: PaymentStatus.PAID,
          method: method as PaymentMethod,
          paymentDate: new Date(),
        },
      });

      // 2. Activate subscription
      await tx.subscription.update({
        where: { id: payment.subscriptionId },
        data: { status: SubscriptionStatus.ACTIVE },
      });

      // 3. Mark member as ACTIVE
      await tx.member.update({
        where: { id: payment.subscription.memberId },
        data: { status: MemberStatus.ACTIVE },
      });

      return updatedPayment;
    });

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
      include: { subscription: true },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment record not found' });
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

      // Activate subscription
      await tx.subscription.update({
        where: { id: payment.subscriptionId },
        data: { status: SubscriptionStatus.ACTIVE },
      });

      // Mark member as ACTIVE
      await tx.member.update({
        where: { id: payment.subscription.memberId },
        data: { status: MemberStatus.ACTIVE },
      });

      return updatedPayment;
    });

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
       .text(`$${payment.amount.toFixed(2)}`, 480, itemRowTop + 15, { align: 'right' });

    // Total section box
    const totalTop = itemRowTop + 50;
    doc.moveTo(50, totalTop).lineTo(550, totalTop).strokeColor('#e2e8f0').stroke();

    doc.fontSize(11)
       .fillColor('#0f172a')
       .text('Subtotal:', 380, totalTop + 15)
       .text(`$${payment.amount.toFixed(2)}`, 480, totalTop + 15, { align: 'right' })
       .text('Tax (0%):', 380, totalTop + 30)
       .text('$0.00', 480, totalTop + 30, { align: 'right' })
       .fontSize(14)
       .fillColor(primaryColor)
       .text('Grand Total:', 380, totalTop + 55)
       .text(`$${payment.amount.toFixed(2)}`, 480, totalTop + 55, { align: 'right' });

    // Footer signature
    doc.fillColor(secondaryColor)
       .fontSize(8)
       .text('Thank you for being part of the Gymnasium community! Please keep this copy for your records.', 50, 480, { align: 'center' });

    // End Document
    doc.end();
  } catch (error: any) {
    console.error('Download invoice PDF error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
