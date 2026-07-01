import { Request, Response } from 'express';
import prisma from '../config/prisma.js';

export const submitTrainerFeedback = async (req: Request, res: Response) => {
  try {
    const { id: memberId } = req.params;
    const { trainerId, rating, feedback } = req.body;

    if (!trainerId || !rating) {
      return res.status(400).json({ error: 'Trainer ID and star rating are required' });
    }

    // Verify member exists and authorization
    const member = await prisma.member.findUnique({ where: { id: memberId } });
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const reqUser = (req as any).user;
    if (reqUser && reqUser.role === 'MEMBER' && member.userId !== reqUser.id) {
      return res.status(403).json({ error: 'Access Denied: You can only submit feedback on your own behalf.' });
    }

    // Validate rating range
    const starRating = parseInt(rating);
    if (isNaN(starRating) || starRating < 1 || starRating > 5) {
      return res.status(400).json({ error: 'Rating must be a number between 1 and 5' });
    }

    const trainer = await prisma.trainer.findUnique({ where: { id: trainerId } });
    if (!trainer) {
      return res.status(404).json({ error: 'Trainer not found' });
    }

    const review = await prisma.trainerFeedback.create({
      data: {
        memberId,
        trainerId,
        rating: starRating,
        feedback,
      },
    });

    return res.status(201).json({ message: 'Feedback submitted successfully', review });
  } catch (error: any) {
    console.error('Submit trainer feedback error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTrainerFeedback = async (req: Request, res: Response) => {
  try {
    const { id: trainerId } = req.params;

    const reviews = await prisma.trainerFeedback.findMany({
      where: { trainerId },
      orderBy: { createdAt: 'desc' },
      include: {
        member: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    const avgRating = reviews.length > 0
      ? parseFloat((reviews.reduce((acc: number, r: any) => acc + r.rating, 0) / reviews.length).toFixed(1))
      : 0;

    return res.status(200).json({ reviews, avgRating });
  } catch (error: any) {
    console.error('Get trainer feedback error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
