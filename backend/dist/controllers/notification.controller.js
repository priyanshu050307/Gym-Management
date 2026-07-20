import prisma from '../config/prisma.js';
export const getNotifications = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const notifications = await prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        return res.status(200).json({ notifications });
    }
    catch (error) {
        console.error('Fetch notifications error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
export const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const notification = await prisma.notification.findUnique({ where: { id } });
        if (!notification || notification.userId !== userId) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        const updated = await prisma.notification.update({
            where: { id },
            data: { isRead: true },
        });
        return res.status(200).json({ notification: updated });
    }
    catch (error) {
        console.error('Mark notification as read error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
export const markAllAsRead = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        await prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true },
        });
        return res.status(200).json({ message: 'All notifications marked as read' });
    }
    catch (error) {
        console.error('Mark all notifications read error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
export const createNotification = async (userId, title, message, type) => {
    try {
        const notification = await prisma.notification.create({
            data: {
                userId,
                title,
                message,
                type,
            },
        });
        return notification;
    }
    catch (error) {
        console.error('Create notification error:', error);
        return null;
    }
};
