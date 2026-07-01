import { Router } from 'express';
import {
  createBranch,
  getAllBranches,
  getBranchById,
  updateBranch,
  deleteBranch,
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

export default router;
