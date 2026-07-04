import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import prisma from '../config/prisma.js';
import { AuthRequest } from '../middleware/auth.js';
import logger from '../config/logger.js';
import { cacheGet, cacheSet, cacheDel, CacheKeys } from '../config/cache.js';

export const createBranch = async (req: AuthRequest, res: Response) => {
  try {
    const { name, address, phone, gstNo, staffEmail, staffPassword, staffFirstName, staffLastName } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Branch name is required' });
    }

    if (staffEmail) {
      const existingUser = await prisma.user.findUnique({ where: { email: staffEmail } });
      if (existingUser) {
        return res.status(400).json({ error: 'Staff email is already registered' });
      }
      if (!staffPassword || !staffFirstName || !staffLastName) {
        return res.status(400).json({ error: 'All staff details (Password, First Name, Last Name) are required when adding branch staff' });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const branch = await tx.branch.create({
        data: { 
          name, 
          address, 
          phone, 
          gstNo,
          ownerId: req.user?.id || null
        },
      });

      let staffUser = null;
      if (staffEmail) {
        const passwordHash = await bcrypt.hash(staffPassword, 10);
        staffUser = await tx.user.create({
          data: {
            email: staffEmail,
            passwordHash,
            firstName: staffFirstName,
            lastName: staffLastName,
            role: UserRole.STAFF,
            branchId: branch.id,
          },
        });
      }

      return { branch, staffUser };
    });

    // Invalidate branches cache for this owner
    if (req.user?.id) cacheDel(CacheKeys.branches(req.user.id));

    logger.info('Branch created', { branchId: result.branch.id, name, ownerId: req.user?.id });

    return res.status(201).json({
      message: 'Branch created successfully',
      branch: result.branch,
      staff: result.staffUser,
    });
  } catch (error: any) {
    logger.error('Create branch error', { error: error.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAllBranches = async (req: AuthRequest, res: Response) => {
  try {
    const ownerId = req.user?.id || '';
    const cacheKey = CacheKeys.branches(ownerId);
    const cached = cacheGet<any[]>(cacheKey);
    if (cached) return res.status(200).json({ branches: cached, fromCache: true });

    let filter: any = {};
    if (req.user?.role === 'ADMIN') {
      if (req.user.email === 'admin@gym.com') {
        filter = {
          OR: [
            { ownerId: req.user.id },
            { ownerId: null }
          ]
        };
      } else {
        filter = { ownerId: req.user.id };
      }
    } else {
      filter = { id: req.user?.branchId || '' };
    }

    const branches = await prisma.branch.findMany({
      where: filter,
      orderBy: { name: 'asc' },
    });

    cacheSet(cacheKey, branches, 60);
    return res.status(200).json({ branches });
  } catch (error: any) {
    logger.error('Get all branches error', { error: error.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getBranchById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const branch = await prisma.branch.findUnique({
      where: { id },
    });

    if (!branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    // Access control
    if (req.user?.role === 'ADMIN') {
      if (req.user.email !== 'admin@gym.com' && branch.ownerId !== req.user.id) {
        return res.status(403).json({ error: 'Access Denied: You do not own this branch.' });
      }
    } else {
      if (branch.id !== req.user?.branchId) {
        return res.status(403).json({ error: 'Access Denied: You do not belong to this branch.' });
      }
    }

    return res.status(200).json({ branch });
  } catch (error: any) {
    console.error('Get branch by ID error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateBranch = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, address, phone, gstNo } = req.body;

    const existingBranch = await prisma.branch.findUnique({ where: { id } });
    if (!existingBranch) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    if (req.user?.role === 'ADMIN' && req.user.email !== 'admin@gym.com' && existingBranch.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Access Denied: You do not own this branch.' });
    }

    const branch = await prisma.branch.update({
      where: { id },
      data: { name, address, phone, gstNo },
    });

    // Invalidate cache
    if (req.user?.id) cacheDel(CacheKeys.branches(req.user.id));

    logger.info('Branch updated', { branchId: id });
    return res.status(200).json({ message: 'Branch updated successfully', branch });
  } catch (error: any) {
    logger.error('Update branch error', { error: error.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteBranch = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingBranch = await prisma.branch.findUnique({ where: { id } });
    if (!existingBranch) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    if (req.user?.role === 'ADMIN' && req.user.email !== 'admin@gym.com' && existingBranch.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Access Denied: You do not own this branch.' });
    }

    // Check if any users are still associated with this branch
    const activeUserCount = await prisma.user.count({
      where: { branchId: id },
    });

    if (activeUserCount > 0) {
      return res.status(400).json({
        error: `Cannot delete branch: ${activeUserCount} user(s) are still assigned to this branch. Reassign or remove them first.`,
      });
    }

    await prisma.branch.delete({
      where: { id },
    });

    // Invalidate cache
    if (req.user?.id) cacheDel(CacheKeys.branches(req.user.id));

    logger.info('Branch deleted', { branchId: id });
    return res.status(200).json({ message: 'Branch deleted successfully' });
  } catch (error: any) {
    logger.error('Delete branch error', { error: error.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getBranchStaff = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (req.user?.role !== 'ADMIN' && req.user?.branchId !== id) {
      return res.status(403).json({ error: 'Access Denied' });
    }

    const staff = await prisma.user.findMany({
      where: {
        branchId: id,
        role: UserRole.STAFF,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
      orderBy: { firstName: 'asc' },
    });

    return res.status(200).json({ staff });
  } catch (error: any) {
    logger.error('Get branch staff error', { error: error.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const createBranchStaff = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access Denied' });
    }

    const branch = await prisma.branch.findUnique({ where: { id } });
    if (!branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email is already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const staff = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        role: UserRole.STAFF,
        branchId: id,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    });

    logger.info('Branch staff created', { staffId: staff.id, branchId: id });
    return res.status(201).json({ message: 'Staff member created successfully', staff });
  } catch (error: any) {
    logger.error('Create branch staff error', { error: error.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateBranchStaff = async (req: AuthRequest, res: Response) => {
  try {
    const { id, staffId } = req.params;
    const { email, password, firstName, lastName } = req.body;

    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access Denied' });
    }

    const existingStaff = await prisma.user.findFirst({
      where: { id: staffId, branchId: id, role: UserRole.STAFF },
    });
    if (!existingStaff) {
      return res.status(404).json({ error: 'Staff member not found in this branch' });
    }

    if (email && email !== existingStaff.email) {
      const emailUsed = await prisma.user.findUnique({ where: { email } });
      if (emailUsed) {
        return res.status(400).json({ error: 'Email is already in use' });
      }
    }

    const updateData: any = {
      email,
      firstName,
      lastName,
    };

    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    const staff = await prisma.user.update({
      where: { id: staffId },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    logger.info('Branch staff updated', { staffId });
    return res.status(200).json({ message: 'Staff member updated successfully', staff });
  } catch (error: any) {
    logger.error('Update branch staff error', { error: error.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteBranchStaff = async (req: AuthRequest, res: Response) => {
  try {
    const { id, staffId } = req.params;

    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access Denied' });
    }

    const existingStaff = await prisma.user.findFirst({
      where: { id: staffId, branchId: id, role: UserRole.STAFF },
    });
    if (!existingStaff) {
      return res.status(404).json({ error: 'Staff member not found in this branch' });
    }

    await prisma.user.delete({
      where: { id: staffId },
    });

    logger.info('Branch staff deleted', { staffId });
    return res.status(200).json({ message: 'Staff member deleted successfully' });
  } catch (error: any) {
    logger.error('Delete branch staff error', { error: error.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
};
