import express from 'express';
import { chat, getChatHistoryController } from '../controllers/ai.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = express.Router();

router.post('/chat', authenticateToken, chat);
router.get('/history', authenticateToken, getChatHistoryController);

export default router; 