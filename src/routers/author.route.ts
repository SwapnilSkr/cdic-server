import { Router } from 'express';
import { fetchAllAuthors, toggleAuthorFlag } from '../controllers/author.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

router.post('/:authorId/flag', authenticateToken, toggleAuthorFlag);
router.get('/', fetchAllAuthors);

export default router;