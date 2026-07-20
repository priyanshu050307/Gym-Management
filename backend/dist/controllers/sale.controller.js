import prisma from '../config/prisma.js';
import { isSuperAdmin } from '../utils/superadmin.js';
export const recordSupplementSale = async (req, res) => {
    try {
        const { supplementId, memberId, quantity, soldPrice, saleType, notes } = req.body;
        const reqUser = req.user;
        if (!reqUser)
            return res.status(401).json({ error: 'Unauthorized' });
        if (!supplementId || !memberId || !quantity || soldPrice === undefined || !saleType) {
            return res.status(400).json({ error: 'Supplement, member, quantity, sold price, and sale type are required.' });
        }
        const parsedQty = parseInt(quantity);
        const parsedPrice = parseFloat(soldPrice);
        if (parsedQty <= 0) {
            return res.status(400).json({ error: 'Quantity must be greater than zero.' });
        }
        // Resolve branchId of current operator (ADMIN can choose, STAFF uses their own)
        const operatorBranchId = reqUser.branchId;
        // 1. Verify supplement
        const supplement = await prisma.supplement.findUnique({
            where: { id: supplementId },
        });
        if (!supplement) {
            return res.status(404).json({ error: 'Supplement not found.' });
        }
        // Enforce branch isolation for non-admins
        if (reqUser.role !== 'ADMIN' && supplement.branchId !== operatorBranchId) {
            return res.status(403).json({ error: 'Access Denied: You cannot sell supplements from another branch.' });
        }
        // Verify stock
        if (supplement.stock < parsedQty) {
            return res.status(400).json({ error: `Insufficient stock. Current stock is ${supplement.stock}.` });
        }
        // 2. Verify member
        const member = await prisma.member.findUnique({
            where: { id: memberId },
            include: { user: true }
        });
        if (!member) {
            return res.status(404).json({ error: 'Member not found.' });
        }
        // Enforce same-branch check: member must belong to the supplement's branch
        if (member.user.branchId !== supplement.branchId) {
            return res.status(400).json({ error: 'This member belongs to a different branch. You can only sell to members in the same branch.' });
        }
        // 3. Process Transaction
        const result = await prisma.$transaction(async (tx) => {
            // Create sale record
            const sale = await tx.supplementSale.create({
                data: {
                    supplementId,
                    memberId,
                    quantity: parsedQty,
                    soldPrice: saleType === 'FREE_WITH_SUBSCRIPTION' ? 0 : parsedPrice,
                    saleType,
                    notes: notes || null,
                    branchId: supplement.branchId,
                },
                include: {
                    supplement: true,
                    member: {
                        include: {
                            user: {
                                select: { firstName: true, lastName: true }
                            }
                        }
                    },
                    branch: true,
                }
            });
            // Update supplement stock
            await tx.supplement.update({
                where: { id: supplementId },
                data: {
                    stock: {
                        decrement: parsedQty
                    }
                }
            });
            return sale;
        });
        return res.status(201).json({ message: 'Supplement sale recorded successfully', sale: result });
    }
    catch (error) {
        console.error('Record supplement sale error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
export const getSupplementSales = async (req, res) => {
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
        const sales = await prisma.supplementSale.findMany({
            where: whereClause,
            include: {
                supplement: true,
                member: {
                    include: {
                        user: {
                            select: {
                                firstName: true,
                                lastName: true,
                            }
                        }
                    }
                },
                branch: {
                    select: {
                        id: true,
                        name: true,
                    }
                }
            },
            orderBy: {
                createdAt: 'desc',
            }
        });
        return res.status(200).json({ sales });
    }
    catch (error) {
        console.error('Get supplement sales error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
