import prisma from '../config/prisma.js';
import { isSuperAdmin } from '../utils/superadmin.js';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
const checkTrainerAccess = async (reqUser, trainerId) => {
    if (!reqUser) {
        return { errorStatus: 401, error: 'Unauthorized', trainer: null };
    }
    const trainer = await prisma.trainer.findUnique({
        where: { id: trainerId },
        include: { user: true },
    });
    if (!trainer) {
        return { errorStatus: 404, error: 'Trainer not found', trainer: null };
    }
    // 1. Global Admin isSuperAdmin bypasses all checks
    if (isSuperAdmin(reqUser)) {
        return { trainer };
    }
    // 2. Tenant owner (ADMIN role) checks
    if (reqUser.role === 'ADMIN') {
        if (trainer.user?.branchId) {
            const branch = await prisma.branch.findUnique({
                where: { id: trainer.user.branchId },
                select: { ownerId: true },
            });
            if (branch && branch.ownerId !== reqUser.id) {
                return { errorStatus: 403, error: 'Access Denied: You do not own the branch this trainer belongs to.', trainer: null };
            }
        }
        return { trainer };
    }
    // 3. Trainer & Staff roles checks
    if (trainer.user?.branchId !== reqUser.branchId) {
        return { errorStatus: 403, error: 'Access Denied: You can only access trainers belonging to your own branch.', trainer: null };
    }
    return { trainer };
};
export const createTrainer = async (req, res) => {
    try {
        const { firstName, lastName, specialty, email, phone, branchId } = req.body;
        if (!firstName || !lastName || !specialty) {
            return res.status(400).json({ error: 'First name, last name, and specialty are required' });
        }
        // Check if email already registered
        const trainerEmail = email || `trainer.${firstName.toLowerCase()}.${lastName.toLowerCase()}@gymflow.com`;
        const existing = await prisma.user.findUnique({ where: { email: trainerEmail } });
        if (existing) {
            return res.status(400).json({ error: 'Email already registered for another user/trainer' });
        }
        // Resolve branch ID
        const activeBranchIdHeader = req.headers['x-branch-id'];
        const userRole = req.user?.role;
        const userBranchId = req.user?.branchId;
        const resolvedBranchId = (userRole !== 'ADMIN' ? userBranchId : (branchId || activeBranchIdHeader)) || null;
        // Create User record for the trainer
        const hashedPassword = await bcrypt.hash('Password123', 10);
        const user = await prisma.user.create({
            data: {
                email: trainerEmail,
                passwordHash: hashedPassword,
                firstName,
                lastName,
                role: UserRole.TRAINER,
                branchId: resolvedBranchId,
            },
        });
        const trainer = await prisma.trainer.create({
            data: {
                userId: user.id,
                firstName,
                lastName,
                specialty,
                email: trainerEmail,
                phone: phone || null,
            },
        });
        return res.status(201).json({ message: 'Trainer added successfully', trainer });
    }
    catch (error) {
        console.error('Create trainer error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
export const getTrainers = async (req, res) => {
    try {
        const { branchId } = req.query;
        const activeBranchIdHeader = req.headers['x-branch-id'];
        const userRole = req.user?.role;
        const userBranchId = req.user?.branchId;
        const resolvedBranchId = (userRole !== 'ADMIN' ? userBranchId : (branchId || activeBranchIdHeader)) || undefined;
        const whereClause = {};
        if (resolvedBranchId) {
            whereClause.user = {
                branchId: resolvedBranchId,
            };
        }
        else {
            const ownedBranches = await prisma.branch.findMany({
                where: isSuperAdmin(req.user) ? {
                    OR: [{ ownerId: req.user?.id || '' }, { ownerId: null }]
                } : { ownerId: req.user?.id || '' },
                select: { id: true }
            });
            whereClause.user = {
                branchId: { in: ownedBranches.map(b => b.id) }
            };
        }
        const trainers = await prisma.trainer.findMany({
            where: whereClause,
            include: {
                user: {
                    select: {
                        branchId: true,
                        branch: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
                feedbacks: {
                    select: {
                        rating: true,
                    },
                },
                _count: {
                    select: { ptMembers: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        const trainersWithRatings = trainers.map(t => {
            const feedbacks = t.feedbacks || [];
            const ratingSum = feedbacks.reduce((sum, f) => sum + f.rating, 0);
            const averageRating = feedbacks.length > 0 ? (ratingSum / feedbacks.length) : 0;
            return {
                ...t,
                averageRating: Number(averageRating.toFixed(1)),
                feedbackCount: feedbacks.length,
                ptMembersCount: t._count?.ptMembers ?? 0,
            };
        });
        return res.status(200).json({ trainers: trainersWithRatings });
    }
    catch (error) {
        console.error('Fetch trainers error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
export const getTrainerById = async (req, res) => {
    try {
        const { id } = req.params;
        const reqUser = req.user;
        const access = await checkTrainerAccess(reqUser, id);
        if (access.error) {
            return res.status(access.errorStatus).json({ error: access.error });
        }
        return res.status(200).json({ trainer: access.trainer });
    }
    catch (error) {
        console.error('Fetch trainer error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
export const updateTrainer = async (req, res) => {
    try {
        const { id } = req.params;
        const { firstName, lastName, specialty, email, phone, isActive, branchId } = req.body;
        const reqUser = req.user;
        const access = await checkTrainerAccess(reqUser, id);
        if (access.error) {
            return res.status(access.errorStatus).json({ error: access.error });
        }
        const trainer = access.trainer;
        const data = {};
        if (firstName !== undefined)
            data.firstName = firstName;
        if (lastName !== undefined)
            data.lastName = lastName;
        if (specialty !== undefined)
            data.specialty = specialty;
        if (email !== undefined)
            data.email = email || null;
        if (phone !== undefined)
            data.phone = phone || null;
        if (isActive !== undefined)
            data.isActive = isActive;
        const updatedTrainer = await prisma.trainer.update({
            where: { id },
            data,
        });
        // Update User record if linked
        if (trainer.userId) {
            const userData = {};
            if (firstName !== undefined)
                userData.firstName = firstName;
            if (lastName !== undefined)
                userData.lastName = lastName;
            if (email !== undefined)
                userData.email = email || undefined;
            if (branchId !== undefined && req.user?.role === 'ADMIN')
                userData.branchId = branchId || null;
            await prisma.user.update({
                where: { id: trainer.userId },
                data: userData,
            });
        }
        return res.status(200).json({ message: 'Trainer updated successfully', trainer: updatedTrainer });
    }
    catch (error) {
        console.error('Update trainer error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
export const deleteTrainer = async (req, res) => {
    try {
        const { id } = req.params;
        const reqUser = req.user;
        const access = await checkTrainerAccess(reqUser, id);
        if (access.error) {
            return res.status(access.errorStatus).json({ error: access.error });
        }
        const trainer = await prisma.trainer.findUnique({
            where: { id },
            include: {
                ptMembers: {
                    include: { user: true },
                },
            },
        });
        if (!trainer) {
            return res.status(404).json({ error: 'Trainer not found' });
        }
        // Check if there are scheduled classes linked to this trainer
        const classCount = await prisma.groupClass.count({
            where: { trainerId: id },
        });
        if (classCount > 0) {
            return res.status(400).json({
                error: 'Cannot delete trainer. They are currently scheduled to teach active classes. Deactivate their profile instead.',
            });
        }
        if (trainer.userId) {
            const userRecord = await prisma.user.findUnique({
                where: { id: trainer.userId },
            });
            if (userRecord?.role === 'ADMIN') {
                return res.status(403).json({ error: 'Cannot delete admin accounts' });
            }
        }
        // Notify all PT members who will lose their assigned trainer
        const trainerFullName = `${trainer.firstName} ${trainer.lastName}`;
        for (const ptMember of trainer.ptMembers || []) {
            const { createNotification } = await import('./notification.controller.js');
            await createNotification(ptMember.userId, 'Trainer Removed', `Your personal trainer ${trainerFullName} has been removed from the system. Please contact the front desk to arrange a new trainer assignment.`, 'ALERT');
        }
        if (trainer.userId) {
            // Deleting the user record cascades to delete the trainer profile
            await prisma.user.delete({ where: { id: trainer.userId } });
        }
        else {
            await prisma.trainer.delete({ where: { id } });
        }
        return res.status(200).json({
            message: 'Trainer profile deleted successfully',
            affectedMembers: trainer.ptMembers?.length ?? 0,
        });
    }
    catch (error) {
        console.error('Delete trainer error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
// GET /api/trainers/me/members — Trainer sees only their assigned PT members
export const getMyPTMembers = async (req, res) => {
    try {
        const reqUser = req.user;
        if (!reqUser || reqUser.role !== 'TRAINER') {
            return res.status(403).json({ error: 'Access Denied: Only trainers can access this endpoint.' });
        }
        const trainer = await prisma.trainer.findUnique({ where: { userId: reqUser.id } });
        if (!trainer) {
            return res.status(404).json({ error: 'Trainer profile not found for this user.' });
        }
        const ptMembers = await prisma.member.findMany({
            where: { trainerId: trainer.id },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        branchId: true,
                    },
                },
                subscriptions: {
                    where: { status: 'ACTIVE' },
                    orderBy: { endDate: 'desc' },
                    take: 1,
                    include: { plan: true },
                },
                progressLogs: {
                    orderBy: { loggedAt: 'desc' },
                    take: 1,
                },
                checkIns: {
                    orderBy: { timestamp: 'desc' },
                    take: 1,
                },
                workoutPlan: {
                    select: { id: true, name: true, updatedAt: true },
                },
                dietPlan: {
                    select: { id: true, name: true, updatedAt: true },
                },
            },
            orderBy: { joinDate: 'desc' },
        });
        return res.status(200).json({ trainer, ptMembers });
    }
    catch (error) {
        console.error('Get my PT members error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
// GET /api/trainers/me/schedule — Trainer sees their upcoming group class schedule
export const getMySchedule = async (req, res) => {
    try {
        const reqUser = req.user;
        if (!reqUser || reqUser.role !== 'TRAINER') {
            return res.status(403).json({ error: 'Access Denied: Only trainers can access this endpoint.' });
        }
        const trainer = await prisma.trainer.findUnique({ where: { userId: reqUser.id } });
        if (!trainer) {
            return res.status(404).json({ error: 'Trainer profile not found for this user.' });
        }
        const now = new Date();
        const classes = await prisma.groupClass.findMany({
            where: {
                trainerId: trainer.id,
                dateTime: { gte: now },
            },
            include: {
                bookings: {
                    where: { status: 'CONFIRMED' },
                    include: {
                        member: {
                            include: {
                                user: { select: { firstName: true, lastName: true } },
                            },
                        },
                    },
                },
            },
            orderBy: { dateTime: 'asc' },
            take: 20,
        });
        return res.status(200).json({ trainer, classes, isActive: trainer.isActive });
    }
    catch (error) {
        console.error('Get my schedule error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
