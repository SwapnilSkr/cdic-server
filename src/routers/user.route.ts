import express from 'express';
import { registerUser, loginUser, updateUserProfile, updateUserPassword, getAllUsers, updateUser, deleteUser } from '../controllers/user.controller';
import { authenticateToken, requireRole } from '../middlewares/auth.middleware';

const router = express.Router();

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);

// Protected routes
router.put('/profile', authenticateToken, updateUserProfile);
router.put('/password', authenticateToken, updateUserPassword);

// Admin-only routes
router.get('/all', authenticateToken, requireRole(['admin']), getAllUsers);
router.put('/', authenticateToken, requireRole(['admin']), updateUser);
router.delete('/:userId', authenticateToken, requireRole(['admin']), deleteUser);

export default router;