import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import prisma from '../config/prisma.js';

export const createBranch = async (req: Request, res: Response) => {
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
        data: { name, address, phone, gstNo },
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

    return res.status(201).json({
      message: 'Branch created successfully',
      branch: result.branch,
      staff: result.staffUser,
    });
  } catch (error: any) {
    console.error('Create branch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAllBranches = async (req: Request, res: Response) => {
  try {
    const branches = await prisma.branch.findMany({
      orderBy: { name: 'asc' },
    });
    return res.status(200).json({ branches });
  } catch (error: any) {
    console.error('Get all branches error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getBranchById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const branch = await prisma.branch.findUnique({
      where: { id },
    });

    if (!branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    return res.status(200).json({ branch });
  } catch (error: any) {
    console.error('Get branch by ID error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateBranch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, address, phone, gstNo } = req.body;

    const branch = await prisma.branch.update({
      where: { id },
      data: { name, address, phone, gstNo },
    });

    return res.status(200).json({ message: 'Branch updated successfully', branch });
  } catch (error: any) {
    console.error('Update branch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteBranch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

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

    return res.status(200).json({ message: 'Branch deleted successfully' });
  } catch (error: any) {
    console.error('Delete branch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
