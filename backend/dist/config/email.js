import nodemailer from 'nodemailer';
import logger from './logger.js';
// ──────────────────────────────────────────────
// Transporter — uses SMTP env vars or ethereal dev account
// ──────────────────────────────────────────────
let transporter;
const createTransporter = async () => {
    const host = process.env.EMAIL_HOST;
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;
    if (host && user && pass) {
        // Production / configured SMTP
        transporter = nodemailer.createTransport({
            host,
            port: Number(process.env.EMAIL_PORT || 587),
            secure: process.env.EMAIL_SECURE === 'true',
            auth: { user, pass },
        });
        logger.info('Email: Using configured SMTP transport');
    }
    else {
        // Development fallback — logs emails instead of sending
        logger.warn('Email: SMTP not configured, emails will be logged only. Set EMAIL_HOST, EMAIL_USER, EMAIL_PASS to enable real sending.');
        transporter = nodemailer.createTransport({
            streamTransport: true,
            newline: 'unix',
            buffer: true,
        });
    }
    return transporter;
};
export const getMailer = async () => {
    if (!transporter) {
        await createTransporter();
    }
    return transporter;
};
// ──────────────────────────────────────────────
// Email Templates
// ──────────────────────────────────────────────
const FROM = process.env.EMAIL_FROM || 'GymOS <noreply@gymnasium.com>';
export const sendWelcomeEmail = async (to, firstName, trialDays = 30) => {
    try {
        const mailer = await getMailer();
        const info = await mailer.sendMail({
            from: FROM,
            to,
            subject: `Welcome to GymOS — Your ${trialDays}-Day Trial Has Started 🎉`,
            html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;background:#0f172a;color:#e2e8f0;padding:32px;border-radius:12px">
          <h2 style="color:#8b5cf6">Welcome to Gymnasium ERP, ${firstName}!</h2>
          <p>Your free <strong>${trialDays}-day trial</strong> is now active. You have full access to all features:</p>
          <ul style="line-height:2">
            <li>Multi-branch management</li>
            <li>Member onboarding & billing</li>
            <li>Trainer portals & class scheduling</li>
            <li>Supplement POS & inventory</li>
          </ul>
          <p>After your trial, subscribe at any time from your <strong>SaaS Subscription</strong> page.</p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" 
             style="display:inline-block;margin-top:16px;padding:12px 24px;background:#8b5cf6;color:#000;border-radius:8px;text-decoration:none;font-weight:bold">
            Go to Dashboard →
          </a>
          <p style="margin-top:24px;font-size:12px;color:#64748b">Need help? Reply to this email or contact support@gymnasium.com</p>
        </div>
      `,
        });
        if (process.env.EMAIL_HOST) {
            logger.info('Email: Welcome email sent', { to, messageId: info.messageId });
        }
        else {
            logger.info('Email (dev): Welcome email logged (not sent)', { to, firstName });
        }
    }
    catch (err) {
        logger.error('Email: Failed to send welcome email', { to, error: err.message });
    }
};
export const sendPaymentReceiptEmail = async (to, memberName, planName, amount, paymentId) => {
    try {
        const mailer = await getMailer();
        await mailer.sendMail({
            from: FROM,
            to,
            subject: `Payment Receipt — ₹${amount} for ${planName}`,
            html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;background:#0f172a;color:#e2e8f0;padding:32px;border-radius:12px">
          <h2 style="color:#10b981">Payment Received ✓</h2>
          <p>Dear <strong>${memberName}</strong>,</p>
          <p>Your payment has been successfully processed.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr style="border-bottom:1px solid #1e293b"><td style="padding:8px">Plan</td><td style="padding:8px;text-align:right;font-weight:bold">${planName}</td></tr>
            <tr style="border-bottom:1px solid #1e293b"><td style="padding:8px">Amount Paid</td><td style="padding:8px;text-align:right;color:#10b981;font-weight:bold">₹${amount}</td></tr>
            <tr><td style="padding:8px">Transaction ID</td><td style="padding:8px;text-align:right;font-size:12px;color:#94a3b8">${paymentId}</td></tr>
          </table>
          <p style="margin-top:24px;font-size:12px;color:#64748b">Thank you for your payment. Your membership is now active.</p>
        </div>
      `,
        });
        logger.info('Email: Payment receipt sent', { to, planName, amount });
    }
    catch (err) {
        logger.error('Email: Failed to send payment receipt', { to, error: err.message });
    }
};
export const sendTrialExpiryWarningEmail = async (to, firstName, daysLeft) => {
    try {
        const mailer = await getMailer();
        await mailer.sendMail({
            from: FROM,
            to,
            subject: `⚠️ Your GymOS Trial Expires in ${daysLeft} Day${daysLeft === 1 ? '' : 's'}`,
            html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;background:#0f172a;color:#e2e8f0;padding:32px;border-radius:12px">
          <h2 style="color:#f59e0b">Trial Expiring Soon, ${firstName}</h2>
          <p>Your free trial ends in <strong>${daysLeft} day${daysLeft === 1 ? '' : 's'}</strong>.</p>
          <p>To continue without interruption, choose a subscription plan:</p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/subscription" 
             style="display:inline-block;margin-top:16px;padding:12px 24px;background:#8b5cf6;color:#000;border-radius:8px;text-decoration:none;font-weight:bold">
            View Plans & Subscribe →
          </a>
          <p style="margin-top:16px;font-size:12px;color:#64748b">All your gym data is safely preserved — subscribe anytime to resume access.</p>
        </div>
      `,
        });
        logger.info('Email: Trial expiry warning sent', { to, daysLeft });
    }
    catch (err) {
        logger.error('Email: Failed to send trial expiry email', { to, error: err.message });
    }
};
export const sendOtpEmail = async (to, otp) => {
    try {
        const mailer = await getMailer();
        const info = await mailer.sendMail({
            from: FROM,
            to,
            subject: `Your Gymnasium Verification Code: ${otp}`,
            html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;background:#0f172a;color:#e2e8f0;padding:32px;border-radius:12px">
          <h2 style="color:#8b5cf6;text-align:center">Verification Code</h2>
          <p style="text-align:center;font-size:16px">Please use the following 6-digit code to complete your verification:</p>
          <div style="text-align:center;margin:24px 0">
            <span style="font-size:36px;font-weight:bold;letter-spacing:6px;color:#ffffff;background:#1e293b;padding:12px 24px;border-radius:8px;border:1px solid #334155">
              ${otp}
            </span>
          </div>
          <p style="text-align:center;font-size:12px;color:#64748b;margin-top:24px">This code is valid for 5 minutes. Do not share it with anyone.</p>
        </div>
      `,
        });
        if (process.env.EMAIL_HOST) {
            logger.info('Email: OTP verification email sent', { to, messageId: info.messageId });
        }
        else {
            logger.info('Email (dev): OTP verification email logged (not sent)', { to, otp });
        }
    }
    catch (err) {
        logger.error('Email: Failed to send OTP verification email', { to, error: err.message });
        throw new Error('Failed to send verification email');
    }
};
