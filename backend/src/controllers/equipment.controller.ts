import { Request, Response } from 'express';
import prisma from '../config/prisma.js';
import { isSuperAdmin } from '../utils/superadmin.js';

export const getEquipments = async (req: Request, res: Response) => {
  try {
    const { branchId } = req.query;
    const activeBranchIdHeader = req.headers['x-branch-id'] as string | undefined;
    const reqUser = (req as any).user;
    if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

    const userRole = reqUser.role;
    const userBranchId = reqUser.branchId;
    const resolvedBranchId = (userRole !== 'ADMIN' ? userBranchId : (branchId as string || activeBranchIdHeader)) || undefined;

    const whereClause: any = {};
    if (resolvedBranchId) {
      whereClause.branchId = resolvedBranchId;
    } else {
      // Find all branches owned by this admin
      const ownedBranches = await prisma.branch.findMany({
        where: isSuperAdmin(reqUser) ? {
          OR: [{ ownerId: reqUser.id }, { ownerId: null }]
        } : { ownerId: reqUser.id },
        select: { id: true }
      });
      whereClause.branchId = { in: ownedBranches.map(b => b.id) };
    }

    const equipments = await prisma.equipment.findMany({
      where: whereClause,
      include: {
        branch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.status(200).json({ equipments });
  } catch (error) {
    console.error('Get equipments error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const createEquipment = async (req: Request, res: Response) => {
  try {
    const { name, quantity, status, notes, lastServiced, branchId } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Equipment name is required' });
    }

    const reqUser = (req as any).user;
    if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

    const resolvedBranchId = reqUser.role === 'ADMIN' ? (branchId || reqUser.branchId) : reqUser.branchId;
    if (!resolvedBranchId) {
      return res.status(400).json({ error: 'A branch must be specified for this equipment.' });
    }

    const equipment = await prisma.equipment.create({
      data: {
        name,
        quantity: quantity ? parseInt(quantity) : 1,
        status: status || 'WORKING',
        notes: notes || null,
        lastServiced: lastServiced ? new Date(lastServiced) : null,
        branchId: resolvedBranchId,
      },
      include: {
        branch: {
          select: { id: true, name: true }
        }
      }
    });

    return res.status(201).json({ message: 'Equipment created successfully', equipment });
  } catch (error) {
    console.error('Create equipment error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateEquipment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, quantity, status, notes, lastServiced, branchId } = req.body;

    const reqUser = (req as any).user;
    if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

    const existing = await prisma.equipment.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    if (reqUser.role !== 'ADMIN' && existing.branchId !== reqUser.branchId) {
      return res.status(403).json({ error: 'Access Denied: You can only update equipment in your own branch.' });
    }

    const updated = await prisma.equipment.update({
      where: { id },
      data: {
        name: name !== undefined ? name : existing.name,
        quantity: quantity !== undefined ? parseInt(quantity) : existing.quantity,
        status: status !== undefined ? status : existing.status,
        notes: notes !== undefined ? notes : existing.notes,
        lastServiced: lastServiced !== undefined ? (lastServiced ? new Date(lastServiced) : null) : existing.lastServiced,
        branchId: (reqUser.role === 'ADMIN' && branchId) ? branchId : existing.branchId,
      },
      include: {
        branch: {
          select: { id: true, name: true }
        }
      }
    });

    return res.status(200).json({ message: 'Equipment updated successfully', equipment: updated });
  } catch (error) {
    console.error('Update equipment error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteEquipment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reqUser = (req as any).user;
    if (!reqUser) return res.status(401).json({ error: 'Unauthorized' });

    const existing = await prisma.equipment.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    if (reqUser.role !== 'ADMIN' && existing.branchId !== reqUser.branchId) {
      return res.status(403).json({ error: 'Access Denied: You can only delete equipment in your own branch.' });
    }

    await prisma.equipment.delete({ where: { id } });
    return res.status(200).json({ message: 'Equipment deleted successfully' });
  } catch (error) {
    console.error('Delete equipment error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
