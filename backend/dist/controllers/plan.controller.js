import prisma from '../config/prisma.js';
import { cacheGet, cacheSet, cacheDel, CacheKeys } from '../config/cache.js';
import { isSuperAdmin } from '../utils/superadmin.js';
export const createPlan = async (req, res) => {
    try {
        const { name, price, durationMonths, description } = req.body;
        if (!name || price === undefined || durationMonths === undefined) {
            return res.status(400).json({ error: 'Name, price, and duration are required' });
        }
        const plan = await prisma.membershipPlan.create({
            data: {
                name,
                price: parseFloat(price),
                durationMonths: parseInt(durationMonths),
                description,
                ownerId: req.user?.id || null,
            },
        });
        if (req.user?.id)
            cacheDel(CacheKeys.plans(req.user.id));
        return res.status(201).json({ message: 'Plan created successfully', plan });
    }
    catch (error) {
        console.error('Plan creation error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
export const getPlans = async (req, res) => {
    try {
        let ownerId = '';
        let filter = { isActive: true };
        if (req.user) {
            if (req.user.role === 'ADMIN') {
                ownerId = req.user.id;
                if (isSuperAdmin(req.user)) {
                    filter.OR = [
                        { ownerId: req.user.id },
                        { ownerId: null }
                    ];
                }
                else {
                    filter.ownerId = req.user.id;
                }
            }
            else {
                const branch = await prisma.branch.findUnique({
                    where: { id: req.user.branchId || '' },
                    select: { ownerId: true }
                });
                if (branch && branch.ownerId) {
                    ownerId = branch.ownerId;
                    filter.ownerId = branch.ownerId;
                }
                else {
                    ownerId = 'null';
                    filter.ownerId = null;
                }
            }
        }
        const cacheKey = CacheKeys.plans(ownerId);
        const cached = cacheGet(cacheKey);
        if (cached) {
            return res.status(200).json({ plans: cached });
        }
        const plans = await prisma.membershipPlan.findMany({
            where: filter,
            orderBy: { createdAt: 'desc' },
        });
        cacheSet(cacheKey, plans, 300);
        return res.status(200).json({ plans });
    }
    catch (error) {
        console.error('Fetch plans error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
export const getPlanById = async (req, res) => {
    try {
        const { id } = req.params;
        const plan = await prisma.membershipPlan.findUnique({
            where: { id },
        });
        if (!plan) {
            return res.status(404).json({ error: 'Plan not found' });
        }
        // Access control
        if (req.user && req.user.role === 'ADMIN') {
            if (!isSuperAdmin(req.user) && plan.ownerId !== req.user.id) {
                return res.status(403).json({ error: 'Access Denied: You do not own this plan.' });
            }
        }
        return res.status(200).json({ plan });
    }
    catch (error) {
        console.error('Fetch plan error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
export const updatePlan = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, durationMonths, description, isActive } = req.body;
        const existingPlan = await prisma.membershipPlan.findUnique({ where: { id } });
        if (!existingPlan) {
            return res.status(404).json({ error: 'Plan not found' });
        }
        if (req.user && req.user.role === 'ADMIN' && !isSuperAdmin(req.user) && existingPlan.ownerId !== req.user.id) {
            return res.status(403).json({ error: 'Access Denied: You do not own this plan.' });
        }
        const updatedData = {};
        if (name !== undefined)
            updatedData.name = name;
        if (price !== undefined)
            updatedData.price = parseFloat(price);
        if (durationMonths !== undefined)
            updatedData.durationMonths = parseInt(durationMonths);
        if (description !== undefined)
            updatedData.description = description;
        if (isActive !== undefined)
            updatedData.isActive = isActive;
        const plan = await prisma.membershipPlan.update({
            where: { id },
            data: updatedData,
        });
        if (req.user?.id)
            cacheDel(CacheKeys.plans(req.user.id));
        return res.status(200).json({ message: 'Plan updated successfully', plan });
    }
    catch (error) {
        console.error('Update plan error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
export const deletePlan = async (req, res) => {
    try {
        const { id } = req.params;
        const existingPlan = await prisma.membershipPlan.findUnique({ where: { id } });
        if (!existingPlan) {
            return res.status(404).json({ error: 'Plan not found' });
        }
        if (req.user && req.user.role === 'ADMIN' && !isSuperAdmin(req.user) && existingPlan.ownerId !== req.user.id) {
            return res.status(403).json({ error: 'Access Denied: You do not own this plan.' });
        }
        // We do a soft delete by setting isActive to false
        const plan = await prisma.membershipPlan.update({
            where: { id },
            data: { isActive: false },
        });
        if (req.user?.id)
            cacheDel(CacheKeys.plans(req.user.id));
        return res.status(200).json({ message: 'Plan deactivated successfully', plan });
    }
    catch (error) {
        console.error('Deactivate plan error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
