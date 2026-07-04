import { Request, Response } from 'express';
import prisma from '../config/prisma.js';

// Helper to find owner user ID for current request user
const getOwnerIdForUser = async (user: any) => {
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
    where: { email: 'admin@gym.com' },
    select: { id: true }
  });
  return defaultAdmin?.id || user.id;
};

// Helper to guarantee a SaaS subscription record exists
const getOrCreateSaaSSubscription = async (ownerId: string) => {
  let sub = await prisma.saaSSubscription.findUnique({
    where: { ownerId },
  });
  if (!sub) {
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 30); // 30 days trial

    sub = await prisma.saaSSubscription.create({
      data: {
        ownerId,
        status: 'TRIAL_ACTIVE',
        planName: 'Starter',
        trialEndDate,
        billingCycle: 'MONTHLY',
      },
    });
  }
  return sub;
};

export const getSaaSSubscriptionStatus = async (req: Request, res: Response) => {
  try {
    const reqUser = (req as any).user;
    if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

    const ownerId = await getOwnerIdForUser(reqUser);
    const sub = await getOrCreateSaaSSubscription(ownerId);
    
    // Check if trial has expired in real-time
    if (sub.status === 'TRIAL_ACTIVE' && new Date() > new Date(sub.trialEndDate)) {
      const updated = await prisma.saaSSubscription.update({
        where: { id: sub.id },
        data: { status: 'TRIAL_EXPIRED' },
      });
      return res.status(200).json({ subscription: updated });
    }

    // Check if subscription has expired in real-time
    if (sub.status === 'SUBSCRIBED_ACTIVE' && sub.subscriptionEnd && new Date() > new Date(sub.subscriptionEnd)) {
      const updated = await prisma.saaSSubscription.update({
        where: { id: sub.id },
        data: { status: 'SUBSCRIBED_EXPIRED' },
      });
      return res.status(200).json({ subscription: updated });
    }

    return res.status(200).json({ subscription: sub });
  } catch (error: any) {
    console.error('Fetch SaaS status error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const subscribeToPlan = async (req: Request, res: Response) => {
  try {
    const { planName, billingCycle, cardBrand, cardLast4, gstin, billingAddress } = req.body;
    const reqUser = (req as any).user;
    if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

    if (!planName || !['Starter', 'Professional', 'Enterprise'].includes(planName)) {
      return res.status(400).json({ error: 'Invalid plan selected.' });
    }

    const ownerId = await getOwnerIdForUser(reqUser);
    const sub = await getOrCreateSaaSSubscription(ownerId);
    const now = new Date();
    const subscriptionEnd = new Date();
    if (billingCycle === 'YEARLY') {
      subscriptionEnd.setFullYear(now.getFullYear() + 1);
    } else {
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

    return res.status(200).json({ message: 'Subscribed successfully', subscription: updated });
  } catch (error: any) {
    console.error('SaaS subscription error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateBillingProfile = async (req: Request, res: Response) => {
  try {
    const { gstin, billingAddress, cardBrand, cardLast4 } = req.body;
    const reqUser = (req as any).user;
    if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

    const ownerId = await getOwnerIdForUser(reqUser);
    const sub = await getOrCreateSaaSSubscription(ownerId);

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
  } catch (error: any) {
    console.error('Update SaaS billing error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Reset SaaS state for testing and demo purposes
export const resetSaaSState = async (req: Request, res: Response) => {
  try {
    const { status, daysRemaining } = req.body;
    const reqUser = (req as any).user;
    if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

    const ownerId = await getOwnerIdForUser(reqUser);
    const sub = await getOrCreateSaaSSubscription(ownerId);

    const trialEndDate = new Date();
    if (daysRemaining !== undefined) {
      trialEndDate.setDate(trialEndDate.getDate() + Number(daysRemaining));
    } else {
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
  } catch (error: any) {
    console.error('Reset SaaS state error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
