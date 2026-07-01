import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import prisma from '../config/prisma.js';

export const createClass = async (req: Request, res: Response) => {
  try {
    const { name, description, trainerId, dateTime, durationMinutes, capacity } = req.body;

    if (!name || !trainerId || !dateTime) {
      return res.status(400).json({ error: 'Name, trainer, and schedule date/time are required' });
    }

    // Verify trainer exists and is active
    const trainer = await prisma.trainer.findUnique({
      where: { id: trainerId },
      include: { user: true },
    });
    if (!trainer) {
      return res.status(404).json({ error: 'Trainer not found' });
    }
    if (!trainer.isActive) {
      return res.status(400).json({ error: 'Selected trainer profile is currently inactive' });
    }

    const reqUser = (req as any).user;
    if (reqUser && reqUser.role !== 'ADMIN' && trainer.user?.branchId !== reqUser.branchId) {
      return res.status(403).json({ error: 'Access Denied: You can only schedule classes for trainers in your own branch.' });
    }

    const groupClass = await prisma.groupClass.create({
      data: {
        name,
        description: description || null,
        trainerId,
        dateTime: new Date(dateTime),
        durationMinutes: durationMinutes ? parseInt(durationMinutes) : 60,
        capacity: capacity ? parseInt(capacity) : 20,
      },
      include: {
        trainer: true,
      },
    });

    return res.status(201).json({ message: 'Class scheduled successfully', groupClass });
  } catch (error: any) {
    console.error('Create class error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getClasses = async (req: AuthRequest, res: Response) => {
  try {
    // Optional query parameter to filter by date
    const { startDate, endDate, branchId } = req.query;
    const activeBranchIdHeader = req.headers['x-branch-id'] as string | undefined;
    const userRole = req.user?.role;
    const userBranchId = req.user?.branchId;
    const resolvedBranchId = (userRole !== 'ADMIN' ? userBranchId : (branchId as string || activeBranchIdHeader)) || undefined;

    const whereClause: any = {};
    if (startDate && endDate) {
      whereClause.dateTime = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    if (resolvedBranchId) {
      whereClause.trainer = {
        user: {
          branchId: resolvedBranchId,
        },
      };
    }

    const classes = await prisma.groupClass.findMany({
      where: whereClause,
      include: {
        trainer: {
          include: {
            user: {
              select: {
                branchId: true,
              },
            },
          },
        },
        bookings: {
          include: {
            member: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { dateTime: 'asc' },
    });

    return res.status(200).json({ classes });
  } catch (error: any) {
    console.error('Fetch classes error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getClassById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const groupClass = await prisma.groupClass.findUnique({
      where: { id },
      include: {
        trainer: true,
        bookings: {
          include: {
            member: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!groupClass) {
      return res.status(404).json({ error: 'Class session not found' });
    }

    return res.status(200).json({ groupClass });
  } catch (error: any) {
    console.error('Fetch class details error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateClass = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, trainerId, dateTime, durationMinutes, capacity } = req.body;

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (durationMinutes !== undefined) data.durationMinutes = parseInt(durationMinutes);
    if (capacity !== undefined) data.capacity = parseInt(capacity);
    if (dateTime !== undefined) data.dateTime = new Date(dateTime);

    const existingClass = await prisma.groupClass.findUnique({
      where: { id },
      include: { trainer: { include: { user: true } } },
    });
    if (!existingClass) {
      return res.status(404).json({ error: 'Class session not found' });
    }
    const reqUser = (req as any).user;
    if (reqUser && reqUser.role !== 'ADMIN' && existingClass.trainer.user?.branchId !== reqUser.branchId) {
      return res.status(403).json({ error: 'Access Denied: You can only update classes scheduled in your own branch.' });
    }

    if (trainerId) {
      const trainer = await prisma.trainer.findUnique({
        where: { id: trainerId },
        include: { user: true },
      });
      if (!trainer) {
        return res.status(404).json({ error: 'Trainer not found' });
      }
      if (reqUser && reqUser.role !== 'ADMIN' && trainer.user?.branchId !== reqUser.branchId) {
        return res.status(403).json({ error: 'Access Denied: You can only assign trainers from your own branch.' });
      }
      data.trainerId = trainerId;
    }

    const groupClass = await prisma.groupClass.update({
      where: { id },
      data,
      include: {
        trainer: true,
      },
    });

    return res.status(200).json({ message: 'Class session updated successfully', groupClass });
  } catch (error: any) {
    console.error('Update class error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteClass = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.groupClass.delete({
      where: { id },
    });

    return res.status(200).json({ message: 'Class session deleted successfully' });
  } catch (error: any) {
    console.error('Delete class error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
