import express from 'express';
import { createAudit, getAudits } from '../controllers/audit.controller';
import { authenticateToken, requireRole } from '../middlewares/auth.middleware';

const router = express.Router();

router.post('/', authenticateToken, createAudit);
router.get('/', authenticateToken, requireRole(['admin']), getAudits);

export default router; 