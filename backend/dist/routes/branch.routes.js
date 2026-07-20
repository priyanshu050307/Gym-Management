import { Router } from 'express';
import { createBranch, getAllBranches, getBranchById, updateBranch, deleteBranch, getBranchStaff, createBranchStaff, updateBranchStaff, deleteBranchStaff, } from '../controllers/branch.controller.js';
import { authenticateToken, requireRoles } from '../middleware/auth.js';
import { UserRole } from '@prisma/client';
const router = Router();
// Publicly read branches or read branches for authenticated users
router.get('/', authenticateToken, getAllBranches);
router.get('/:id', authenticateToken, getBranchById);
// Admin-only mutations
router.post('/', authenticateToken, requireRoles([UserRole.ADMIN]), createBranch);
router.put('/:id', authenticateToken, requireRoles([UserRole.ADMIN]), updateBranch);
router.delete('/:id', authenticateToken, requireRoles([UserRole.ADMIN]), deleteBranch);
// Staff management per branch
router.get('/:id/staff', authenticateToken, getBranchStaff);
router.post('/:id/staff', authenticateToken, requireRoles([UserRole.ADMIN]), createBranchStaff);
router.put('/:id/staff/:staffId', authenticateToken, requireRoles([UserRole.ADMIN]), updateBranchStaff);
router.delete('/:id/staff/:staffId', authenticateToken, requireRoles([UserRole.ADMIN]), deleteBranchStaff);
export default router;
