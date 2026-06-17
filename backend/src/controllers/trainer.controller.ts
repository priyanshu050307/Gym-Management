import { Request, Response } from 'express';
import prisma from '../config/prisma.js';

export const createTrainer = async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, specialty, email, phone } = req.body;

    if (!firstName || !lastName || !specialty) {
      return res.status(400).json({ error: 'First name, last name, and specialty are required' });
    }

    // Check if email already registered
    if (email) {
      const existing = await prisma.trainer.findUnique({ where: { email } });
      if (existing) {
        return res.status(400).json({ error: 'Email already registered for another trainer' });
      }
    }

    const trainer = await prisma.trainer.create({
      data: {
        firstName,
        lastName,
        specialty,
        email: email || null,
        phone: phone || null,
      },
    });

    return res.status(201).json({ message: 'Trainer added successfully', trainer });
  } catch (error: any) {
    console.error('Create trainer error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTrainers = async (req: Request, res: Response) => {
  try {
    const trainers = await prisma.trainer.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json({ trainers });
  } catch (error: any) {
    console.error('Fetch trainers error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTrainerById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const trainer = await prisma.trainer.findUnique({
      where: { id },
    });

    if (!trainer) {
      return res.status(404).json({ error: 'Trainer not found' });
    }

    return res.status(200).json({ trainer });
  } catch (error: any) {
    console.error('Fetch trainer error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateTrainer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, specialty, email, phone, isActive } = req.body;

    const data: any = {};
    if (firstName !== undefined) data.firstName = firstName;
    if (lastName !== undefined) data.lastName = lastName;
    if (specialty !== undefined) data.specialty = specialty;
    if (email !== undefined) data.email = email || null;
    if (phone !== undefined) data.phone = phone || null;
    if (isActive !== undefined) data.isActive = isActive;

    // Check duplicate email
    if (email) {
      const existing = await prisma.trainer.findUnique({ where: { email } });
      if (existing && existing.id !== id) {
        return res.status(400).json({ error: 'Email already registered for another trainer' });
      }
    }

    const trainer = await prisma.trainer.update({
      where: { id },
      data,
    });

    return res.status(200).json({ message: 'Trainer updated successfully', trainer });
  } catch (error: any) {
    console.error('Update trainer error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteTrainer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if there are scheduled classes linked to this trainer
    const classCount = await prisma.groupClass.count({
      where: { trainerId: id },
    });

    if (classCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete trainer. They are currently scheduled to teach active classes. Deactivate their profile instead.',
      });
    }

    await prisma.trainer.delete({
      where: { id },
    });

    return res.status(200).json({ message: 'Trainer profile deleted successfully' });
  } catch (error: any) {
    console.error('Delete trainer error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
