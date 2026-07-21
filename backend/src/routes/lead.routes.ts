import { Router } from 'express';
import { getLeads, createLead, updateLead, deleteLead, convertLeadToMember } from '../controllers/lead.controller.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken as any);

router.get('/', getLeads);
router.post('/', createLead);
router.put('/:id', updateLead);
router.delete('/:id', deleteLead);
router.post('/:id/convert', convertLeadToMember);

export default router;
