import prisma from '../config/prisma.js';
import { isSuperAdmin } from '../utils/superadmin.js';
export const getPayrolls = async (req, res) => {
    try {
        const { branchId, month, year } = req.query;
        const activeBranchIdHeader = req.headers['x-branch-id'];
        const reqUser = req.user;
        if (!reqUser)
            return res.status(401).json({ error: 'Unauthorized' });
        const userRole = reqUser.role;
        const userBranchId = reqUser.branchId;
        const resolvedBranchId = (userRole !== 'ADMIN' ? userBranchId : (branchId || activeBranchIdHeader)) || undefined;
        const whereClause = {};
        if (month)
            whereClause.month = parseInt(month, 10);
        if (year)
            whereClause.year = parseInt(year, 10);
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
        const payrolls = await prisma.payroll.findMany({
            where: whereClause,
            include: {
                trainer: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        specialty: true,
                        email: true,
                        phone: true,
                    },
                },
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
        return res.status(200).json({ payrolls });
    }
    catch (error) {
        console.error('Get payrolls error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
export const createOrUpdatePayroll = async (req, res) => {
    try {
        const { trainerId, month, year, baseSalary, sessionCount, sessionRate, bonus, deductions, status, notes, branchId } = req.body;
        const activeBranchIdHeader = req.headers['x-branch-id'];
        const reqUser = req.user;
        if (!reqUser)
            return res.status(401).json({ error: 'Unauthorized' });
        const targetBranchId = branchId || activeBranchIdHeader || reqUser.branchId;
        if (!targetBranchId) {
            return res.status(400).json({ error: 'Branch ID is required' });
        }
        const calculatedBase = parseFloat(baseSalary || 0);
        const calculatedSessions = parseInt(sessionCount || 0, 10);
        const calculatedRate = parseFloat(sessionRate || 0);
        const calculatedBonus = parseFloat(bonus || 0);
        const calculatedDeductions = parseFloat(deductions || 0);
        const totalAmount = (calculatedBase + (calculatedSessions * calculatedRate) + calculatedBonus) - calculatedDeductions;
        // Check if payroll record already exists for trainer for this month/year
        const existing = await prisma.payroll.findFirst({
            where: {
                trainerId,
                month: parseInt(month, 10),
                year: parseInt(year, 10),
                branchId: targetBranchId,
            },
        });
        let payroll;
        if (existing) {
            payroll = await prisma.payroll.update({
                where: { id: existing.id },
                data: {
                    baseSalary: calculatedBase,
                    sessionCount: calculatedSessions,
                    sessionRate: calculatedRate,
                    bonus: calculatedBonus,
                    deductions: calculatedDeductions,
                    totalAmount,
                    status: status || existing.status,
                    paymentDate: status === 'PAID' ? new Date() : existing.paymentDate,
                    notes: notes || existing.notes,
                },
            });
        }
        else {
            payroll = await prisma.payroll.create({
                data: {
                    trainerId,
                    month: parseInt(month, 10),
                    year: parseInt(year, 10),
                    baseSalary: calculatedBase,
                    sessionCount: calculatedSessions,
                    sessionRate: calculatedRate,
                    bonus: calculatedBonus,
                    deductions: calculatedDeductions,
                    totalAmount,
                    status: status || 'PENDING',
                    paymentDate: status === 'PAID' ? new Date() : null,
                    notes: notes || null,
                    branchId: targetBranchId,
                },
            });
        }
        return res.status(200).json({ message: 'Payroll saved successfully', payroll });
    }
    catch (error) {
        console.error('Save payroll error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
export const updatePayrollStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const payroll = await prisma.payroll.update({
            where: { id },
            data: {
                status,
                paymentDate: status === 'PAID' ? new Date() : null,
            },
        });
        return res.status(200).json({ message: 'Payroll status updated', payroll });
    }
    catch (error) {
        console.error('Update payroll status error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
export const deletePayroll = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.payroll.delete({ where: { id } });
        return res.status(200).json({ message: 'Payroll record deleted' });
    }
    catch (error) {
        console.error('Delete payroll error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
