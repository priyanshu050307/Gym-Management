import prisma from '../config/prisma.js';
export const getMemberWorkoutPlan = async (req, res) => {
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
            return res.status(403).json({ error: 'Access Denied: You can only retrieve your own workout plan.' });
        }
        if (reqUser && reqUser.role !== 'ADMIN' && reqUser.role !== 'MEMBER') {
            if (member.user.branchId !== reqUser.branchId) {
                return res.status(403).json({ error: 'Access Denied: You can only view plans of members in your own branch.' });
            }
        }
        const workoutPlan = await prisma.workoutPlan.findUnique({
            where: { memberId },
            include: {
                days: {
                    include: {
                        exercises: true,
                    },
                },
            },
        });
        return res.status(200).json({ workoutPlan });
    }
    catch (error) {
        console.error('Get workout plan error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
export const assignWorkoutPlan = async (req, res) => {
    try {
        const { id: memberId } = req.params;
        const { name, description, days } = req.body;
        const member = await prisma.member.findUnique({
            where: { id: memberId },
            include: { user: true },
        });
        if (!member) {
            return res.status(404).json({ error: 'Member not found' });
        }
        // Find the trainer's trainer record id if user role is TRAINER
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
            // Non-admins (e.g. STAFF) cannot assign workout plans
            return res.status(403).json({ error: 'Access Denied: Only Admins can assign general plans.' });
        }
        // Delete existing plan if any (to clean cascade relations easily)
        const existing = await prisma.workoutPlan.findUnique({ where: { memberId } });
        if (existing) {
            await prisma.workoutPlan.delete({ where: { memberId } });
        }
        // Create new plan with nested days and exercises
        const workoutPlan = await prisma.workoutPlan.create({
            data: {
                memberId,
                name: name || 'Custom Workout Plan',
                description,
                trainerId,
                days: {
                    create: (days || []).map((day) => ({
                        dayOfWeek: day.dayOfWeek,
                        exercises: {
                            create: (day.exercises || []).map((ex) => ({
                                name: ex.name,
                                sets: parseInt(ex.sets) || 3,
                                reps: String(ex.reps || '10'),
                                weightLbs: ex.weightLbs ? parseFloat(ex.weightLbs) : null,
                                notes: ex.notes,
                            })),
                        },
                    })),
                },
            },
            include: {
                days: {
                    include: {
                        exercises: true,
                    },
                },
            },
        });
        return res.status(201).json({ message: 'Workout plan assigned successfully', workoutPlan });
    }
    catch (error) {
        console.error('Assign workout plan error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
export const deleteWorkoutPlan = async (req, res) => {
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
        await prisma.workoutPlan.delete({ where: { memberId } });
        return res.status(200).json({ message: 'Workout plan deleted successfully' });
    }
    catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'No workout plan found for this member.' });
        }
        console.error('Delete workout plan error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
