"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardStats = exports.logMemberCheckIn = exports.addSubscriptionToMember = exports.updateMemberStatus = exports.getMemberById = exports.getMembers = exports.registerMember = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_js_1 = __importDefault(require("../config/prisma.js"));
const client_1 = require("@prisma/client");
const registerMember = async (req, res) => {
    try {
        const { email, password, firstName, lastName, emergencyContact, planId } = req.body;
        if (!email || !password || !firstName || !lastName) {
            return res.status(400).json({ error: 'Core fields (email, password, firstName, lastName) are required' });
        }
        // Check if user already exists
        const existingUser = await prisma_js_1.default.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        // Hash password
        const salt = await bcryptjs_1.default.genSalt(10);
        const passwordHash = await bcryptjs_1.default.hash(password, salt);
        const result = await prisma_js_1.default.$transaction(async (tx) => {
            // 1. Create User
            const user = await tx.user.create({
                data: {
                    email,
                    passwordHash,
                    firstName,
                    lastName,
                    role: client_1.UserRole.MEMBER,
                },
            });
            // 2. Create Member
            const member = await tx.member.create({
                data: {
                    userId: user.id,
                    emergencyContact,
                    status: client_1.MemberStatus.ACTIVE,
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
                        status: client_1.SubscriptionStatus.ACTIVE,
                    },
                });
                // Generate initial pending payment
                await tx.payment.create({
                    data: {
                        subscriptionId: subscription.id,
                        amount: plan.price,
                        status: client_1.PaymentStatus.PENDING,
                        method: client_1.PaymentMethod.CASH,
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
    }
    catch (error) {
        console.error('Member registration error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.registerMember = registerMember;
const getMembers = async (req, res) => {
    try {
        const { search, status } = req.query;
        const filter = {};
        if (status) {
            filter.status = status;
        }
        if (search) {
            filter.user = {
                OR: [
                    { firstName: { contains: search, mode: 'insensitive' } },
                    { lastName: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                ],
            };
        }
        const members = await prisma_js_1.default.member.findMany({
            where: filter,
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        role: true,
                    },
                },
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
    }
    catch (error) {
        console.error('Fetch members error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getMembers = getMembers;
const getMemberById = async (req, res) => {
    try {
        const { id } = req.params;
        const member = await prisma_js_1.default.member.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        role: true,
                    },
                },
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
        return res.status(200).json({ member });
    }
    catch (error) {
        console.error('Fetch member by ID error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getMemberById = getMemberById;
const updateMemberStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, emergencyContact } = req.body;
        const updatedData = {};
        if (status && Object.values(client_1.MemberStatus).includes(status)) {
            updatedData.status = status;
        }
        if (emergencyContact !== undefined) {
            updatedData.emergencyContact = emergencyContact;
        }
        const member = await prisma_js_1.default.member.update({
            where: { id },
            data: updatedData,
        });
        return res.status(200).json({ message: 'Member status updated', member });
    }
    catch (error) {
        console.error('Update member status error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateMemberStatus = updateMemberStatus;
const addSubscriptionToMember = async (req, res) => {
    try {
        const { id: memberId } = req.params;
        const { planId } = req.body;
        if (!planId) {
            return res.status(400).json({ error: 'PlanId is required' });
        }
        const plan = await prisma_js_1.default.membershipPlan.findUnique({ where: { id: planId } });
        if (!plan) {
            return res.status(404).json({ error: 'Plan not found' });
        }
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + plan.durationMonths);
        // Create Subscription & Payment
        const subscription = await prisma_js_1.default.subscription.create({
            data: {
                memberId,
                planId,
                startDate,
                endDate,
                status: client_1.SubscriptionStatus.ACTIVE,
            },
        });
        const payment = await prisma_js_1.default.payment.create({
            data: {
                subscriptionId: subscription.id,
                amount: plan.price,
                status: client_1.PaymentStatus.PENDING,
                method: client_1.PaymentMethod.CASH,
            },
        });
        return res.status(201).json({
            message: 'Subscription added successfully',
            subscription,
            payment,
        });
    }
    catch (error) {
        console.error('Add subscription error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
exports.addSubscriptionToMember = addSubscriptionToMember;
const logMemberCheckIn = async (req, res) => {
    try {
        const { id: memberId } = req.params;
        const member = await prisma_js_1.default.member.findUnique({
            where: { id: memberId },
            include: {
                user: true,
                subscriptions: {
                    where: { status: client_1.SubscriptionStatus.ACTIVE },
                    orderBy: { endDate: 'desc' },
                    take: 1,
                },
            },
        });
        if (!member) {
            return res.status(404).json({ error: 'Member not found' });
        }
        // Verify Active Status and Subscription
        const activeSub = member.subscriptions[0];
        const isPlanValid = activeSub && new Date(activeSub.endDate) > new Date();
        if (member.status !== client_1.MemberStatus.ACTIVE || !isPlanValid) {
            return res.status(400).json({
                error: 'Access Denied: Membership expired, paused, or inactive',
                member: {
                    name: `${member.user.firstName} ${member.user.lastName}`,
                    status: member.status,
                    expiryDate: activeSub ? activeSub.endDate : 'No active plan',
                },
            });
        }
        const checkIn = await prisma_js_1.default.checkIn.create({
            data: { memberId },
        });
        return res.status(201).json({
            message: 'Access Granted: Check-in logged successfully',
            checkIn,
            member: {
                name: `${member.user.firstName} ${member.user.lastName}`,
                status: member.status,
                expiryDate: activeSub.endDate,
            },
        });
    }
    catch (error) {
        console.error('Check-in logging error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
exports.logMemberCheckIn = logMemberCheckIn;
const getDashboardStats = async (req, res) => {
    try {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const totalMembers = await prisma_js_1.default.member.count({
            where: { status: client_1.MemberStatus.ACTIVE },
        });
        const revenueResult = await prisma_js_1.default.payment.aggregate({
            where: {
                status: client_1.PaymentStatus.PAID,
                paymentDate: {
                    gte: startOfMonth,
                },
            },
            _sum: {
                amount: true,
            },
        });
        const monthlyRevenue = revenueResult._sum.amount || 0;
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const checkInsToday = await prisma_js_1.default.checkIn.count({
            where: {
                timestamp: {
                    gte: startOfToday,
                },
            },
        });
        const pendingResult = await prisma_js_1.default.payment.aggregate({
            where: {
                status: client_1.PaymentStatus.PENDING,
            },
            _sum: {
                amount: true,
            },
        });
        const pendingPayments = pendingResult._sum.amount || 0;
        const recentCheckIns = await prisma_js_1.default.checkIn.findMany({
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
        const membersInLastWeek = await prisma_js_1.default.member.findMany({
            where: {
                joinDate: {
                    gte: sevenDaysAgo,
                },
            },
            select: {
                joinDate: true,
            },
        });
        const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const signupMap = {};
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
        const checkInsLastMonth = await prisma_js_1.default.checkIn.findMany({
            where: {
                timestamp: {
                    gte: thirtyDaysAgo,
                },
            },
            select: {
                timestamp: true,
            },
        });
        const hoursList = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];
        const peakMap = {};
        hoursList.forEach((h) => {
            peakMap[h] = 0;
        });
        checkInsLastMonth.forEach((c) => {
            const hour = new Date(c.timestamp).getHours();
            let bucket = '06:00';
            if (hour >= 22)
                bucket = '22:00';
            else if (hour >= 20)
                bucket = '20:00';
            else if (hour >= 18)
                bucket = '18:00';
            else if (hour >= 16)
                bucket = '16:00';
            else if (hour >= 14)
                bucket = '14:00';
            else if (hour >= 12)
                bucket = '12:00';
            else if (hour >= 10)
                bucket = '10:00';
            else if (hour >= 8)
                bucket = '08:00';
            else
                bucket = '06:00';
            peakMap[bucket]++;
        });
        const peakHours = Object.entries(peakMap).map(([hour, count]) => ({
            hour,
            count,
        }));
        return res.status(200).json({
            stats: {
                totalMembers,
                monthlyRevenue,
                checkInsToday,
                pendingPayments,
            },
            recentCheckIns,
            charts: {
                weeklySignups,
                peakHours,
            },
        });
    }
    catch (error) {
        console.error('Fetch dashboard stats error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getDashboardStats = getDashboardStats;
