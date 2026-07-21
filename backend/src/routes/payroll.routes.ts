import { Router } from 'express';
import { getPayrolls, createOrUpdatePayroll, updatePayrollStatus, deletePayroll } from '../controllers/payroll.controller.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken as any);

router.get('/', getPayrolls);
router.post('/', createOrUpdatePayroll);
router.put('/:id/status', updatePayrollStatus);
router.delete('/:id', deletePayroll);

export default router;
