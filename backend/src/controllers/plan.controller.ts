import { Request, Response } from 'express';
import prisma from '../config/prisma.js';

export const createPlan = async (req: Request, res: Response) => {
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
      },
    });

    return res.status(201).json({ message: 'Plan created successfully', plan });
  } catch (error: any) {
    console.error('Plan creation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPlans = async (req: Request, res: Response) => {
  try {
    const plans = await prisma.membershipPlan.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({ plans });
  } catch (error: any) {
    console.error('Fetch plans error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPlanById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const plan = await prisma.membershipPlan.findUnique({
      where: { id },
    });

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    return res.status(200).json({ plan });
  } catch (error: any) {
    console.error('Fetch plan error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const updatePlan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, price, durationMonths, description, isActive } = req.body;

    const updatedData: any = {};
    if (name !== undefined) updatedData.name = name;
    if (price !== undefined) updatedData.price = parseFloat(price);
    if (durationMonths !== undefined) updatedData.durationMonths = parseInt(durationMonths);
    if (description !== undefined) updatedData.description = description;
    if (isActive !== undefined) updatedData.isActive = isActive;

    const plan = await prisma.membershipPlan.update({
      where: { id },
      data: updatedData,
    });

    return res.status(200).json({ message: 'Plan updated successfully', plan });
  } catch (error: any) {
    console.error('Update plan error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const deletePlan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // We do a soft delete by setting isActive to false
    const plan = await prisma.membershipPlan.update({
      where: { id },
      data: { isActive: false },
    });

    return res.status(200).json({ message: 'Plan deactivated successfully', plan });
  } catch (error: any) {
    console.error('Deactivate plan error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
