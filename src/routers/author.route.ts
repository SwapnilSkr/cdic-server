import { Router } from 'express';
import { fetchAllAuthors, toggleAuthorFlag } from '../controllers/author.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', fetchAllAuthors);
router.post('/:authorId/flag', authenticateToken, toggleAuthorFlag);

export default router;