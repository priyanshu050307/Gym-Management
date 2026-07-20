import prisma from '../config/prisma.js';
export const getProgressLogs = async (req, res) => {
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
            return res.status(403).json({ error: 'Access Denied: You can only access your own progress logs.' });
        }
        if (reqUser && reqUser.role !== 'ADMIN' && reqUser.role !== 'MEMBER') {
            if (member.user.branchId !== reqUser.branchId) {
                return res.status(403).json({ error: 'Access Denied: You can only view progress logs of members in your own branch.' });
            }
        }
        const logs = await prisma.progressLog.findMany({
            where: { memberId },
            orderBy: { loggedAt: 'desc' },
        });
        return res.status(200).json({ logs });
    }
    catch (error) {
        console.error('Get progress logs error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
export const createProgressLog = async (req, res) => {
    try {
        const { id: memberId } = req.params;
        const { weightKg, bodyFat, muscleMass } = req.body;
        const reqUser = req.user;
        const member = await prisma.member.findUnique({
            where: { id: memberId },
            include: { user: true },
        });
        if (!member) {
            return res.status(404).json({ error: 'Member not found' });
        }
        if (reqUser && reqUser.role === 'MEMBER' && member.userId !== reqUser.id) {
            return res.status(403).json({ error: 'Access Denied: You can only log your own progress.' });
        }
        if (reqUser && reqUser.role !== 'ADMIN' && reqUser.role !== 'MEMBER') {
            if (member.user.branchId !== reqUser.branchId) {
                return res.status(403).json({ error: 'Access Denied: You can only log progress for members in your own branch.' });
            }
        }
        if (!weightKg) {
            return res.status(400).json({ error: 'Weight in kg is required' });
        }
        const log = await prisma.progressLog.create({
            data: {
                memberId,
                weightKg: parseFloat(weightKg),
                bodyFat: bodyFat ? parseFloat(bodyFat) : null,
                muscleMass: muscleMass ? parseFloat(muscleMass) : null,
            },
        });
        return res.status(201).json({ message: 'Progress logged successfully', log });
    }
    catch (error) {
        console.error('Create progress log error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
export const getMemberAttendance = async (req, res) => {
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
            return res.status(403).json({ error: 'Access Denied: You can only view your own attendance history.' });
        }
        if (reqUser && reqUser.role !== 'ADMIN' && reqUser.role !== 'MEMBER') {
            if (member.user.branchId !== reqUser.branchId) {
                return res.status(403).json({ error: 'Access Denied: You can only view attendance of members in your own branch.' });
            }
        }
        const attendance = await prisma.checkIn.findMany({
            where: { memberId },
            orderBy: { timestamp: 'desc' },
            take: 50,
        });
        return res.status(200).json({ attendance });
    }
    catch (error) {
        console.error('Get member attendance error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
