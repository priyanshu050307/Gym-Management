import prisma from '../config/prisma.js';
import { isSuperAdmin } from '../utils/superadmin.js';
export const getLeads = async (req, res) => {
    try {
        const { branchId, status } = req.query;
        const activeBranchIdHeader = req.headers['x-branch-id'];
        const reqUser = req.user;
        if (!reqUser)
            return res.status(401).json({ error: 'Unauthorized' });
        const userRole = reqUser.role;
        const userBranchId = reqUser.branchId;
        const resolvedBranchId = (userRole !== 'ADMIN' ? userBranchId : (branchId || activeBranchIdHeader)) || undefined;
        const whereClause = {};
        if (status) {
            whereClause.status = status;
        }
        if (resolvedBranchId) {
            whereClause.branchId = resolvedBranchId;
        }
        else {
            const ownedBranches = await prisma.branch.findMany({
                where: isSuperAdmin(reqUser) ? {
                    OR: [{ ownerId: reqUser.id }, { ownerId: null }]
                } : { ownerId: reqUser.id },
                select: { id: true }
            });
            whereClause.branchId = { in: ownedBranches.map(b => b.id) };
        }
        const leads = await prisma.lead.findMany({
            where: whereClause,
            include: {
                branch: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        return res.status(200).json({ leads });
    }
    catch (error) {
        console.error('Get leads error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
export const createLead = async (req, res) => {
    try {
        const { name, email, phone, interestedPlanId, status, notes, followUpDate, branchId } = req.body;
        const activeBranchIdHeader = req.headers['x-branch-id'];
        const reqUser = req.user;
        if (!reqUser)
            return res.status(401).json({ error: 'Unauthorized' });
        const targetBranchId = branchId || activeBranchIdHeader || reqUser.branchId;
        if (!targetBranchId) {
            return res.status(400).json({ error: 'Branch ID is required' });
        }
        const lead = await prisma.lead.create({
            data: {
                name,
                email: email || null,
                phone,
                interestedPlanId: interestedPlanId || null,
                status: status || 'NEW',
                notes: notes || null,
                followUpDate: followUpDate ? new Date(followUpDate) : null,
                branchId: targetBranchId,
            },
        });
        return res.status(201).json({ message: 'Lead created successfully', lead });
    }
    catch (error) {
        console.error('Create lead error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
export const updateLead = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, phone, interestedPlanId, status, notes, followUpDate } = req.body;
        const existingLead = await prisma.lead.findUnique({ where: { id } });
        if (!existingLead) {
            return res.status(404).json({ error: 'Lead not found' });
        }
        const updatedLead = await prisma.lead.update({
            where: { id },
            data: {
                ...(name && { name }),
                ...(email !== undefined && { email }),
                ...(phone && { phone }),
                ...(interestedPlanId !== undefined && { interestedPlanId }),
                ...(status && { status }),
                ...(notes !== undefined && { notes }),
                ...(followUpDate !== undefined && { followUpDate: followUpDate ? new Date(followUpDate) : null }),
            },
        });
        return res.status(200).json({ message: 'Lead updated successfully', lead: updatedLead });
    }
    catch (error) {
        console.error('Update lead error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
export const deleteLead = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.lead.delete({ where: { id } });
        return res.status(200).json({ message: 'Lead deleted successfully' });
    }
    catch (error) {
        console.error('Delete lead error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
export const convertLeadToMember = async (req, res) => {
    try {
        const { id } = req.params;
        const { planId, durationMonths } = req.body;
        const lead = await prisma.lead.findUnique({ where: { id } });
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }
        const nameParts = lead.name.trim().split(' ');
        const firstName = nameParts[0] || 'Lead';
        const lastName = nameParts.slice(1).join(' ') || 'Member';
        const generateEmail = lead.email || `member_${Date.now()}@gymnasium.com`;
        const user = await prisma.user.create({
            data: {
                email: generateEmail,
                firstName,
                lastName,
                phoneNumber: lead.phone,
                role: 'MEMBER',
                branchId: lead.branchId,
                member: {
                    create: {
                        status: 'ACTIVE',
                        joinDate: new Date(),
                    },
                },
            },
            include: {
                member: true,
            },
        });
        // Mark lead as CONVERTED
        await prisma.lead.update({
            where: { id },
            data: { status: 'CONVERTED' },
        });
        return res.status(201).json({
            message: 'Lead converted to member successfully',
            user,
            member: user.member,
        });
    }
    catch (error) {
        console.error('Convert lead error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
