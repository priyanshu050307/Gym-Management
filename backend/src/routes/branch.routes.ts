import { Router } from 'express';
import {
  createBranch,
  getAllBranches,
  getBranchById,
  updateBranch,
  deleteBranch,
  getBranchStaff,
  createBranchStaff,
  updateBranchStaff,
  deleteBranchStaff,
} from '../controllers/branch.controller.js';
import { authenticateToken, requireRoles } from '../middleware/auth.js';
import { UserRole } from '@prisma/client';

const router = Router();

// Publicly read branches or read branches for authenticated users
router.get('/', authenticateToken as any, getAllBranches);
router.get('/:id', authenticateToken as any, getBranchById);

// Admin-only mutations
router.post('/', authenticateToken as any, requireRoles([UserRole.ADMIN]) as any, createBranch);
router.put('/:id', authenticateToken as any, requireRoles([UserRole.ADMIN]) as any, updateBranch);
router.delete('/:id', authenticateToken as any, requireRoles([UserRole.ADMIN]) as any, deleteBranch);

// Staff management per branch
router.get('/:id/staff', authenticateToken as any, getBranchStaff);
router.post('/:id/staff', authenticateToken as any, requireRoles([UserRole.ADMIN]) as any, createBranchStaff);
router.put('/:id/staff/:staffId', authenticateToken as any, requireRoles([UserRole.ADMIN]) as any, updateBranchStaff);
router.delete('/:id/staff/:staffId', authenticateToken as any, requireRoles([UserRole.ADMIN]) as any, deleteBranchStaff);

export default router;
