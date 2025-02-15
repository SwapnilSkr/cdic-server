import express from 'express';
import { chat } from '../controllers/ai.controller';

const router = express.Router();

router.post('/chat', chat);

export default router; 