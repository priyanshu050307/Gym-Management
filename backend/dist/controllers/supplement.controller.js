import prisma from '../config/prisma.js';
import { isSuperAdmin } from '../utils/superadmin.js';
export const getSupplements = async (req, res) => {
    try {
        const { branchId } = req.query;
        const activeBranchIdHeader = req.headers['x-branch-id'];
        const reqUser = req.user;
        if (!reqUser)
            return res.status(401).json({ error: 'Unauthorized' });
        const userRole = reqUser.role;
        const userBranchId = reqUser.branchId;
        const resolvedBranchId = (userRole !== 'ADMIN' ? userBranchId : (branchId || activeBranchIdHeader)) || undefined;
        const whereClause = {};
        if (resolvedBranchId) {
            whereClause.branchId = resolvedBranchId;
        }
        else {
            // Find all branches owned by this admin
            const ownedBranches = await prisma.branch.findMany({
                where: isSuperAdmin(reqUser) ? {
                    OR: [{ ownerId: reqUser.id }, { ownerId: null }]
                } : { ownerId: reqUser.id },
                select: { id: true }
            });
            whereClause.branchId = { in: ownedBranches.map(b => b.id) };
        }
        const supplements = await prisma.supplement.findMany({
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
        return res.status(200).json({ supplements });
    }
    catch (error) {
        console.error('Get supplements error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
export const createSupplement = async (req, res) => {
    try {
        const { name, price, stock, description, category, branchId } = req.body;
        if (!name || price === undefined) {
            return res.status(400).json({ error: 'Supplement name and price are required' });
        }
        const reqUser = req.user;
        if (!reqUser)
            return res.status(401).json({ error: 'Unauthorized' });
        const resolvedBranchId = reqUser.role === 'ADMIN' ? (branchId || reqUser.branchId) : reqUser.branchId;
        if (!resolvedBranchId) {
            return res.status(400).json({ error: 'A branch must be specified for this supplement.' });
        }
        const supplement = await prisma.supplement.create({
            data: {
                name,
                price: parseFloat(price),
                stock: stock !== undefined ? parseInt(stock) : 0,
                description: description || null,
                category: category || 'OTHER',
                branchId: resolvedBranchId,
            },
            include: {
                branch: {
                    select: { id: true, name: true }
                }
            }
        });
        return res.status(201).json({ message: 'Supplement created successfully', supplement });
    }
    catch (error) {
        console.error('Create supplement error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
export const updateSupplement = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, stock, description, category, branchId } = req.body;
        const reqUser = req.user;
        if (!reqUser)
            return res.status(401).json({ error: 'Unauthorized' });
        const existing = await prisma.supplement.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Supplement not found' });
        }
        if (reqUser.role !== 'ADMIN' && existing.branchId !== reqUser.branchId) {
            return res.status(403).json({ error: 'Access Denied: You can only update supplements in your own branch.' });
        }
        const updated = await prisma.supplement.update({
            where: { id },
            data: {
                name: name !== undefined ? name : existing.name,
                price: price !== undefined ? parseFloat(price) : existing.price,
                stock: stock !== undefined ? parseInt(stock) : existing.stock,
                description: description !== undefined ? description : existing.description,
                category: category !== undefined ? category : existing.category,
                branchId: (reqUser.role === 'ADMIN' && branchId) ? branchId : existing.branchId,
            },
            include: {
                branch: {
                    select: { id: true, name: true }
                }
            }
        });
        return res.status(200).json({ message: 'Supplement updated successfully', supplement: updated });
    }
    catch (error) {
        console.error('Update supplement error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
export const deleteSupplement = async (req, res) => {
    try {
        const { id } = req.params;
        const reqUser = req.user;
        if (!reqUser)
            return res.status(401).json({ error: 'Unauthorized' });
        const existing = await prisma.supplement.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Supplement not found' });
        }
        if (reqUser.role !== 'ADMIN' && existing.branchId !== reqUser.branchId) {
            return res.status(403).json({ error: 'Access Denied: You can only delete supplements in your own branch.' });
        }
        await prisma.supplement.delete({ where: { id } });
        return res.status(200).json({ message: 'Supplement deleted successfully' });
    }
    catch (error) {
        console.error('Delete supplement error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
