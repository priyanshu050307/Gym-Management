import prisma from '../config/prisma.js';
export const getMemberDietPlan = async (req, res) => {
    try {
        const { id: memberId } = req.params;
        const reqUser = req.user;
        const member = await prisma.member.findUnique({
            where: { id: memberId },
            include: { user: true },
        });
        if (!member) {
            return res.status(404).json({ error: 'Member not found' });
        }
        if (reqUser && reqUser.role === 'MEMBER' && member.userId !== reqUser.id) {
            return res.status(403).json({ error: 'Access Denied: You can only retrieve your own diet plan.' });
        }
        if (reqUser && reqUser.role !== 'ADMIN' && reqUser.role !== 'MEMBER') {
            if (member.user.branchId !== reqUser.branchId) {
                return res.status(403).json({ error: 'Access Denied: You can only view plans of members in your own branch.' });
            }
        }
        const dietPlan = await prisma.dietPlan.findUnique({
            where: { memberId },
            include: {
                meals: true,
            },
        });
        return res.status(200).json({ dietPlan });
    }
    catch (error) {
        console.error('Get diet plan error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
export const assignDietPlan = async (req, res) => {
    try {
        const { id: memberId } = req.params;
        const { name, description, meals } = req.body;
        const member = await prisma.member.findUnique({
            where: { id: memberId },
            include: { user: true },
        });
        if (!member) {
            return res.status(404).json({ error: 'Member not found' });
        }
        const reqUser = req.user;
        let trainerId = null;
        if (reqUser && reqUser.role === 'TRAINER') {
            const trainer = await prisma.trainer.findUnique({ where: { userId: reqUser.id } });
            if (!trainer) {
                return res.status(403).json({ error: 'Trainer profile not found.' });
            }
            trainerId = trainer.id;
            // Verify that this member is assigned to this trainer as PT
            if (member.trainerId !== trainerId) {
                return res.status(403).json({ error: 'Access Denied: Trainers can only prep plans for members assigned to them as PT.' });
            }
        }
        else if (!reqUser || reqUser.role !== 'ADMIN') {
            // Non-admins (e.g. STAFF) cannot assign diet plans
            return res.status(403).json({ error: 'Access Denied: Only Admins can assign general plans.' });
        }
        // Delete existing plan if any
        const existing = await prisma.dietPlan.findUnique({ where: { memberId } });
        if (existing) {
            await prisma.dietPlan.delete({ where: { memberId } });
        }
        // Create new plan with nested meals
        const dietPlan = await prisma.dietPlan.create({
            data: {
                memberId,
                name: name || 'Custom Diet Plan',
                description,
                trainerId,
                meals: {
                    create: (meals || []).map((meal) => ({
                        name: meal.name,
                        time: meal.time,
                        items: meal.items,
                        calories: meal.calories ? parseInt(meal.calories) : null,
                        protein: meal.protein ? parseInt(meal.protein) : null,
                        carbs: meal.carbs ? parseInt(meal.carbs) : null,
                        fat: meal.fat ? parseInt(meal.fat) : null,
                    })),
                },
            },
            include: {
                meals: true,
            },
        });
        return res.status(201).json({ message: 'Diet plan assigned successfully', dietPlan });
    }
    catch (error) {
        console.error('Assign diet plan error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
export const deleteDietPlan = async (req, res) => {
    try {
        const { id: memberId } = req.params;
        const member = await prisma.member.findUnique({
            where: { id: memberId },
            include: { user: true },
        });
        if (!member) {
            return res.status(404).json({ error: 'Member not found' });
        }
        const reqUser = req.user;
        if (reqUser && reqUser.role === 'TRAINER') {
            const trainer = await prisma.trainer.findUnique({ where: { userId: reqUser.id } });
            if (!trainer) {
                return res.status(403).json({ error: 'Trainer profile not found.' });
            }
            if (member.trainerId !== trainer.id) {
                return res.status(403).json({ error: 'Access Denied: Trainers can only delete plans for members assigned to them as PT.' });
            }
        }
        else if (!reqUser || (reqUser.role !== 'ADMIN' && reqUser.role !== 'STAFF')) {
            return res.status(403).json({ error: 'Access Denied.' });
        }
        await prisma.dietPlan.delete({ where: { memberId } });
        return res.status(200).json({ message: 'Diet plan deleted successfully' });
    }
    catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'No diet plan found for this member.' });
        }
        console.error('Delete diet plan error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
