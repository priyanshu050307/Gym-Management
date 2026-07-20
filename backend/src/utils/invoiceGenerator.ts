import PDFDocument from 'pdfkit';
import { Response } from 'express';

interface InvoiceData {
  invoiceNumber: string;
  date: string;
  adminName: string;
  adminEmail: string;
  branchName: string;
  branchAddress: string;
  branchPhone: string;
  branchGst: string;
  planName: string;
  billingCycle: string;
  amount: number;
  discount: number;
  total: number;
  paymentId: string;
}

export const generateInvoicePDF = (res: Response, data: InvoiceData) => {
  // Create PDF document
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  // Stream directly to response
  doc.pipe(res);

  // Design Color Tokens
  const primaryColor = '#8b5cf6'; // GymOS brand violet
  const darkColor = '#0f172a';    // Deep slate
  const lightColor = '#f8fafc';   // Soft off-white
  const mutedColor = '#64748b';   // Cool slate-gray

  // 1. Header Dark Banner (Modern & Sleek)
  doc.rect(0, 0, 595, 120).fill(darkColor);

  // Logo text & Branding
  doc.fillColor('#ffffff')
     .font('Helvetica-Bold')
     .fontSize(24)
     .text('GYMNASIUM', 50, 40);

  doc.fillColor(primaryColor)
     .font('Helvetica')
     .fontSize(9)
     .text('PREMIUM GYM MANAGEMENT SOFTWARE', 50, 68);

  // Invoice Title block
  doc.fillColor('#ffffff')
     .font('Helvetica-Bold')
     .fontSize(18)
     .text('INVOICE / RECEIPT', 350, 40, { align: 'right', width: 195 });

  doc.fillColor('#94a3b8')
     .font('Helvetica')
     .fontSize(9)
     .text(`Invoice #: ${data.invoiceNumber}`, 350, 64, { align: 'right', width: 195 });

  doc.text(`Date: ${data.date}`, 350, 78, { align: 'right', width: 195 });

  // 2. Info Columns
  let y = 150;
  doc.fillColor(darkColor).font('Helvetica-Bold').fontSize(11).text('BILL TO (ADMIN):', 50, y);
  doc.text('BRANCH INFO:', 300, y);

  y += 18;
  doc.fillColor(mutedColor).font('Helvetica').fontSize(9);
  
  // Left Column (Admin Information)
  doc.text(data.adminName, 50, y);
  doc.text(data.adminEmail, 50, y + 14);
  doc.text('Payment Gateway: Razorpay Secure', 50, y + 28);
  doc.text(`Payment ID: ${data.paymentId || 'N/A'}`, 50, y + 42);

  // Right Column (Branch Details)
  doc.text(data.branchName, 300, y);
  doc.text(data.branchAddress || 'Address Not Provided', 300, y + 14);
  doc.text(`Phone: ${data.branchPhone || 'N/A'}`, 300, y + 28);
  doc.text(`GSTIN / Tax No: ${data.branchGst || 'N/A'}`, 300, y + 42);

  // 3. Table Header
  y = 250;
  doc.rect(50, y, 495, 25).fill(primaryColor);
  
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
  doc.text('ITEM DESCRIPTION', 60, y + 8);
  doc.text('CYCLE', 260, y + 8);
  doc.text('BASE PRICE', 360, y + 8, { width: 80, align: 'right' });
  doc.text('FINAL AMOUNT', 450, y + 8, { width: 85, align: 'right' });

  // Table Row
  y += 25;
  doc.rect(50, y, 495, 36).fill(lightColor);
  doc.fillColor(darkColor).font('Helvetica').fontSize(9);
  doc.text(`Gymnasium Premium Cloud Subscription - ${data.planName} Plan`, 60, y + 14);
  doc.text(data.billingCycle, 260, y + 14);
  doc.text(`INR ${data.amount.toFixed(2)}`, 360, y + 14, { width: 80, align: 'right' });
  doc.text(`INR ${data.total.toFixed(2)}`, 450, y + 14, { width: 85, align: 'right' });

  // 4. Summary Block
  y += 60;
  doc.moveTo(50, y).lineTo(545, y).strokeColor('#e2e8f0').lineWidth(1).stroke();

  y += 12;
  doc.fillColor(mutedColor).font('Helvetica').fontSize(9);
  doc.text('Subtotal:', 340, y, { width: 100, align: 'right' });
  doc.fillColor(darkColor).text(`INR ${data.amount.toFixed(2)}`, 450, y, { width: 85, align: 'right' });

  y += 18;
  doc.fillColor(mutedColor).text('Discount Applied:', 340, y, { width: 100, align: 'right' });
  doc.fillColor('#ef4444').text(`- INR ${data.discount.toFixed(2)}`, 450, y, { width: 85, align: 'right' });

  y += 18;
  doc.rect(320, y - 4, 225, 26).fill('#f5f3ff');
  doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(10);
  doc.text('Total Amount Paid:', 330, y + 4, { width: 110, align: 'right' });
  doc.text(`INR ${data.total.toFixed(2)}`, 450, y + 4, { width: 85, align: 'right' });

  // Footer Disclaimer
  doc.fillColor(mutedColor)
     .font('Helvetica-Oblique')
     .fontSize(8)
     .text('Thank you for partnering with Gymnasium Cloud! This is a system-generated secure invoice receipt and requires no physical signatures.', 50, 480, { align: 'center', width: 495 });

  doc.end();
};
