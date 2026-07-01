import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';
import prisma from '../config/prisma.js';
import { UserRole, MemberStatus, SubscriptionStatus, PaymentStatus, PaymentMethod } from '@prisma/client';
import { createNotification } from './notification.controller.js';

export const registerMember = async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, firstName, lastName, emergencyContact, planId, branchId, trainerId } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'Core fields (email, password, firstName, lastName) are required' });
    }

    // Resolve branchId (from body if admin, else non-admin's assigned branch)
    const activeBranchIdHeader = req.headers['x-branch-id'] as string | undefined;
    const userRole = req.user?.role;
    const userBranchId = req.user?.branchId;
    const resolvedBranchId = (userRole !== 'ADMIN' ? userBranchId : (branchId || activeBranchIdHeader)) || null;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create User
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          firstName,
          lastName,
          role: UserRole.MEMBER,
          branchId: resolvedBranchId,
        },
      });

      // 2. Create Member
      const member = await tx.member.create({
        data: {
          userId: user.id,
          emergencyContact,
          status: MemberStatus.ACTIVE,
          trainerId: trainerId || null,
        },
      });

      // 3. Create Subscription if planId is provided
      if (planId) {
        const plan = await tx.membershipPlan.findUnique({ where: { id: planId } });
        if (!plan) {
          throw new Error('Membership Plan not found');
        }

        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + plan.durationMonths);

        const subscription = await tx.subscription.create({
          data: {
            memberId: member.id,
            planId: plan.id,
            startDate,
            endDate,
            status: SubscriptionStatus.ACTIVE,
          },
        });

        // Generate initial pending payment
        await tx.payment.create({
          data: {
            subscriptionId: subscription.id,
            amount: plan.price,
            status: PaymentStatus.PENDING,
            method: PaymentMethod.CASH,
          },
        });
      }

      return { user, member };
    });

    return res.status(201).json({
      message: 'Member registered successfully',
      memberId: result.member.id,
      email: result.user.email,
    });
  } catch (error: any) {
    console.error('Member registration error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const getMembers = async (req: AuthRequest, res: Response) => {
  try {
    const { search, status, branchId } = req.query;

    const filter: any = {};
    if (status) {
      filter.status = status as MemberStatus;
    }

    // Branch Filtering logic
    const activeBranchIdHeader = req.headers['x-branch-id'] as string | undefined;
    const userRole = req.user?.role;
    const userBranchId = req.user?.branchId;
    const resolvedBranchId = (userRole !== 'ADMIN' ? userBranchId : (branchId as string || activeBranchIdHeader)) || undefined;

    if (resolvedBranchId) {
      filter.user = {
        branchId: resolvedBranchId,
      };
    }

    if (search) {
      filter.user = {
        ...(filter.user || {}),
        OR: [
          { firstName: { contains: search as string, mode: 'insensitive' } },
          { lastName: { contains: search as string, mode: 'insensitive' } },
          { email: { contains: search as string, mode: 'insensitive' } },
        ],
      };
    }

    const members = await prisma.member.findMany({
      where: filter,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            branch: true,
          },
        },
        trainer: true,
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            plan: true,
          },
        },
      },
      orderBy: { joinDate: 'desc' },
    });

    return res.status(200).json({ members });
  } catch (error: any) {
    console.error('Fetch members error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMemberById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const member = await prisma.member.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            branchId: true,
            branch: true,
          },
        },
        trainer: true,
        subscriptions: {
          include: {
            plan: true,
            payments: true,
          },
          orderBy: { startDate: 'desc' },
        },
        checkIns: {
          orderBy: { timestamp: 'desc' },
          take: 20,
        },
      },
    });

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Authorization & Branch Isolation guards
    const reqUser = (req as any).user;
    if (reqUser?.role === 'MEMBER' && reqUser.id !== member.userId) {
      return res.status(403).json({ error: 'Access Denied: You can only view your own profile.' });
    }
    if (reqUser?.role !== 'ADMIN' && reqUser?.role !== 'MEMBER') {
      if (member.user.branchId !== reqUser?.branchId) {
        return res.status(403).json({ error: 'Access Denied: You can only view profiles of members in your own branch.' });
      }
    }

    return res.status(200).json({ member });
  } catch (error: any) {
    console.error('Fetch member by ID error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateMemberStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, emergencyContact } = req.body;

    const updatedData: any = {};
    if (status && Object.values(MemberStatus).includes(status)) {
      updatedData.status = status as MemberStatus;
    }
    if (emergencyContact !== undefined) {
      updatedData.emergencyContact = emergencyContact;
    }

    const member = await prisma.member.update({
      where: { id },
      data: updatedData,
    });

    return res.status(200).json({ message: 'Member status updated', member });
  } catch (error: any) {
    console.error('Update member status error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const addSubscriptionToMember = async (req: Request, res: Response) => {
  try {
    const { id: memberId } = req.params;
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({ error: 'PlanId is required' });
    }

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: { user: true },
    });
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const plan = await prisma.membershipPlan.findUnique({ where: { id: planId } });
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Cancel any currently active subscriptions to prevent overlap
      await tx.subscription.updateMany({
        where: { memberId, status: SubscriptionStatus.ACTIVE },
        data: { status: SubscriptionStatus.CANCELLED, endDate: new Date() },
      });

      // 2. Create new subscription
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + plan.durationMonths);

      const subscription = await tx.subscription.create({
        data: { memberId, planId, startDate, endDate, status: SubscriptionStatus.ACTIVE },
      });

      // 3. Generate a pending payment record
      const payment = await tx.payment.create({
        data: {
          subscriptionId: subscription.id,
          amount: plan.price,
          status: PaymentStatus.PENDING,
          method: PaymentMethod.CASH,
        },
      });

      // 4. Mark member as ACTIVE
      await tx.member.update({
        where: { id: memberId },
        data: { status: MemberStatus.ACTIVE },
      });

      return { subscription, payment };
    });

    // 5. Notify the member
    await createNotification(
      member.userId,
      'Membership Assigned',
      `A new membership plan "${plan.name}" has been added to your account. It is valid until ${new Date(result.subscription.endDate).toLocaleDateString()}.`,
      'BILLING'
    );

    return res.status(201).json({
      message: 'Subscription added successfully',
      subscription: result.subscription,
      payment: result.payment,
    });
  } catch (error: any) {
    console.error('Add subscription error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};


export const logMemberCheckIn = async (req: Request, res: Response) => {
  try {
    const { id: memberId } = req.params;

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        user: true,
        subscriptions: {
          where: { status: SubscriptionStatus.ACTIVE },
          orderBy: { endDate: 'desc' },
          take: 1,
        },
      },
    });

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Branch isolation check
    const reqUser = (req as any).user;
    if (reqUser && reqUser.role !== 'ADMIN') {
      if (member.user.branchId !== reqUser.branchId) {
        return res.status(403).json({ error: 'Access Denied: You can only check in members assigned to your own branch.' });
      }
    }

    // Verify Active Status and Subscription
    const activeSub = member.subscriptions[0];
    const isPlanValid = activeSub && new Date(activeSub.endDate) > new Date();

    if (member.status !== MemberStatus.ACTIVE || !isPlanValid) {
      return res.status(400).json({
        error: 'Access Denied: Membership expired, paused, or inactive',
        member: {
          name: `${member.user.firstName} ${member.user.lastName}`,
          status: member.status,
          expiryDate: activeSub ? activeSub.endDate : 'No active plan',
          profilePhoto: member.profilePhoto,
          medicalHistory: member.medicalHistory,
        },
      });
    }

    const checkIn = await prisma.checkIn.create({
      data: { memberId },
    });

    await createNotification(
      member.userId,
      'Check-in Logged',
      `Welcome back, ${member.user.firstName}! Your check-in was logged successfully.`,
      'INFO'
    );

    return res.status(201).json({
      message: 'Access Granted: Check-in logged successfully',
      checkIn,
      member: {
        name: `${member.user.firstName} ${member.user.lastName}`,
        status: member.status,
        expiryDate: activeSub.endDate,
        profilePhoto: member.profilePhoto,
        medicalHistory: member.medicalHistory,
      },
    });
  } catch (error: any) {
    console.error('Check-in logging error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const { branchId } = req.query;

    const activeBranchIdHeader = req.headers['x-branch-id'] as string | undefined;
    const userRole = req.user?.role;
    const userBranchId = req.user?.branchId;
    const resolvedBranchId = (userRole !== 'ADMIN' ? userBranchId : (branchId as string || activeBranchIdHeader)) || undefined;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const totalMembers = await prisma.member.count({
      where: {
        status: MemberStatus.ACTIVE,
        user: resolvedBranchId ? { branchId: resolvedBranchId } : undefined,
      },
    });

    const revenueResult = await prisma.payment.aggregate({
      where: {
        status: PaymentStatus.PAID,
        paymentDate: {
          gte: startOfMonth,
        },
        subscription: resolvedBranchId ? {
          member: {
            user: {
              branchId: resolvedBranchId,
            },
          },
        } : undefined,
      },
      _sum: {
        amount: true,
      },
    });

    const monthlyRevenue = revenueResult._sum.amount || 0;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const checkInsToday = await prisma.checkIn.count({
      where: {
        timestamp: {
          gte: startOfToday,
        },
        member: resolvedBranchId ? {
          user: {
            branchId: resolvedBranchId,
          },
        } : undefined,
      },
    });

    const pendingResult = await prisma.payment.aggregate({
      where: {
        status: PaymentStatus.PENDING,
        subscription: resolvedBranchId ? {
          member: {
            user: {
              branchId: resolvedBranchId,
            },
          },
        } : undefined,
      },
      _sum: {
        amount: true,
      },
    });

    const pendingPayments = pendingResult._sum.amount || 0;

    const recentCheckIns = await prisma.checkIn.findMany({
      where: resolvedBranchId ? {
        member: {
          user: {
            branchId: resolvedBranchId,
          },
        },
      } : undefined,
      orderBy: { timestamp: 'desc' },
      take: 5,
      include: {
        member: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    // 1. Weekly Registration Signups (Last 7 Days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const membersInLastWeek = await prisma.member.findMany({
      where: {
        joinDate: {
          gte: sevenDaysAgo,
        },
        user: resolvedBranchId ? {
          branchId: resolvedBranchId,
        } : undefined,
      },
      select: {
        joinDate: true,
      },
    });

    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const signupMap: { [key: string]: number } = {};

    // Initialize map with weekdays in correct order
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dayName = weekdays[d.getDay()];
      signupMap[dayName] = 0;
    }

    membersInLastWeek.forEach((m) => {
      const dayName = weekdays[new Date(m.joinDate).getDay()];
      if (signupMap[dayName] !== undefined) {
        signupMap[dayName]++;
      }
    });

    const weeklySignups = Object.entries(signupMap).map(([day, count]) => ({
      day,
      count,
    }));

    // 2. Peak Hours Check-Ins (Last 30 Days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const checkInsLastMonth = await prisma.checkIn.findMany({
      where: {
        timestamp: {
          gte: thirtyDaysAgo,
        },
        member: resolvedBranchId ? {
          user: {
            branchId: resolvedBranchId,
          },
        } : undefined,
      },
      select: {
        timestamp: true,
      },
    });

    const hoursList = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];
    const peakMap: { [key: string]: number } = {};
    hoursList.forEach((h) => {
      peakMap[h] = 0;
    });

    checkInsLastMonth.forEach((c) => {
      const hour = new Date(c.timestamp).getHours();
      let bucket = '06:00';
      if (hour >= 22) bucket = '22:00';
      else if (hour >= 20) bucket = '20:00';
      else if (hour >= 18) bucket = '18:00';
      else if (hour >= 16) bucket = '16:00';
      else if (hour >= 14) bucket = '14:00';
      else if (hour >= 12) bucket = '12:00';
      else if (hour >= 10) bucket = '10:00';
      else if (hour >= 8) bucket = '08:00';
      else bucket = '06:00';

      peakMap[bucket]++;
    });

    const peakHours = Object.entries(peakMap).map(([hour, count]) => ({
      hour,
      count,
    }));

    // 3. Active Trainers count
    const activeTrainers = await prisma.trainer.count({
      where: {
        isActive: true,
        ...(resolvedBranchId ? { user: { branchId: resolvedBranchId } } : {}),
      },
    });

    // 4. Members with subscriptions expiring within the next 7 days
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const now = new Date();

    const expiringIn7Days = await prisma.subscription.count({
      where: {
        status: SubscriptionStatus.ACTIVE,
        endDate: { gt: now, lte: sevenDaysFromNow },
        ...(resolvedBranchId ? { member: { user: { branchId: resolvedBranchId } } } : {}),
      },
    });

    return res.status(200).json({
      stats: {
        totalMembers,
        monthlyRevenue,
        checkInsToday,
        pendingPayments,
        activeTrainers,
        expiringIn7Days,
      },
      recentCheckIns,
      charts: {
        weeklySignups,
        peakHours,
      },
    });
  } catch (error: any) {
    console.error('Fetch dashboard stats error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const freezeMember = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required to freeze membership' });
    }

    const member = await prisma.member.update({
      where: { id },
      data: {
        status: MemberStatus.PAUSED,
        frozenStartDate: new Date(startDate),
        frozenEndDate: new Date(endDate),
      },
    });

    await createNotification(
      member.userId,
      'Membership Frozen',
      `Your membership has been frozen from ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}.`,
      'ALERT'
    );

    return res.status(200).json({ message: 'Membership frozen successfully', member });
  } catch (error: any) {
    console.error('Freeze member error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const unfreezeMember = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const member = await prisma.member.update({
      where: { id },
      data: {
        status: MemberStatus.ACTIVE,
        frozenStartDate: null,
        frozenEndDate: null,
      },
    });

    await createNotification(
      member.userId,
      'Membership Unfrozen',
      'Your membership has been successfully unfrozen. Welcome back to active workouts!',
      'ALERT'
    );

    return res.status(200).json({ message: 'Membership unfrozen successfully', member });
  } catch (error: any) {
    console.error('Unfreeze member error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateMemberProfile = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { emergencyContact, medicalHistory, profilePhoto, firstName, lastName, trainerId, branchId } = req.body;

    const reqUser = (req as any).user;
    const isAdmin = reqUser?.role === 'ADMIN';
    const isStaff = reqUser?.role === 'STAFF';

    const member = await prisma.member.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Authorization & Branch Isolation guards
    if (reqUser?.role === 'MEMBER' && reqUser.id !== member.userId) {
      return res.status(403).json({ error: 'Access Denied: You can only update your own profile.' });
    }
    if (reqUser?.role !== 'ADMIN' && reqUser?.role !== 'MEMBER') {
      if (member.user.branchId !== reqUser?.branchId) {
        return res.status(403).json({ error: 'Access Denied: You can only update profiles of members in your own branch.' });
      }
    }

    // Update user details if provided
    if (firstName || lastName || (branchId !== undefined && isAdmin)) {
      const userData: any = {};
      if (firstName) userData.firstName = firstName;
      if (lastName) userData.lastName = lastName;
      if (branchId !== undefined && isAdmin) userData.branchId = branchId || null;

      await prisma.user.update({
        where: { id: member.userId },
        data: userData,
      });
    }

    // Update member details
    const memberData: any = {
      emergencyContact: emergencyContact !== undefined ? emergencyContact : member.emergencyContact,
      medicalHistory: medicalHistory !== undefined ? medicalHistory : member.medicalHistory,
      profilePhoto: profilePhoto !== undefined ? profilePhoto : member.profilePhoto,
    };

    if (trainerId !== undefined && (isAdmin || isStaff)) {
      memberData.trainerId = trainerId || null;
    }

    const updatedMember = await prisma.member.update({
      where: { id },
      data: memberData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            branchId: true,
          },
        },
        trainer: true,
      },
    });

    return res.status(200).json({ message: 'Profile updated successfully', member: updatedMember });
  } catch (error: any) {
    console.error('Update member profile error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const upgradeDowngradeSubscription = async (req: Request, res: Response) => {
  try {
    const { id: memberId } = req.params;
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({ error: 'New planId is required' });
    }

    const plan = await prisma.membershipPlan.findUnique({ where: { id: planId } });
    if (!plan) {
      return res.status(404).json({ error: 'New membership plan not found' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Terminate/expire current active subscriptions
      await tx.subscription.updateMany({
        where: {
          memberId,
          status: SubscriptionStatus.ACTIVE,
        },
        data: {
          status: SubscriptionStatus.CANCELLED,
          endDate: new Date(),
        },
      });

      // 2. Create new subscription starting today
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + plan.durationMonths);

      const subscription = await tx.subscription.create({
        data: {
          memberId,
          planId,
          startDate,
          endDate,
          status: SubscriptionStatus.ACTIVE,
        },
      });

      // 3. Create initial pending payment
      const payment = await tx.payment.create({
        data: {
          subscriptionId: subscription.id,
          amount: plan.price,
          status: PaymentStatus.PENDING,
          method: PaymentMethod.CASH,
        },
      });

      return { subscription, payment };
    });

    return res.status(200).json({
      message: 'Plan changed successfully',
      subscription: result.subscription,
      payment: result.payment,
    });
  } catch (error: any) {
    console.error('Upgrade/Downgrade subscription error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteMember = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const reqUser = (req as any).user;
    if (reqUser?.role !== 'ADMIN' && reqUser?.role !== 'STAFF') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const member = await prisma.member.findUnique({
      where: { id },
    });

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const userRecord = await prisma.user.findUnique({
      where: { id: member.userId },
    });

    if (userRecord?.role === 'ADMIN') {
      return res.status(403).json({ error: 'Cannot delete admin accounts' });
    }

    // Delete the associated user, cascading to Member and other child tables
    await prisma.user.delete({
      where: { id: member.userId },
    });

    return res.status(200).json({ message: 'Member deleted successfully' });
  } catch (error: any) {
    console.error('Delete member error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
