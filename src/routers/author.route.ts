import { Router } from 'express';
import { fetchAllAuthors } from '../controllers/author.controller';

const router = Router();

router.get('/', fetchAllAuthors);

export default router;