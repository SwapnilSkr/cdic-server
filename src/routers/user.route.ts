import express from 'express';
import { registerUser, loginUser, updateUserProfile, updateUserPassword, getAllUsers, updateUser, deleteUser, updateBlockedAccounts, getBlockedAccounts, removeBlockedAccount } from '../controllers/user.controller';
import { authenticateToken, requireRole } from '../middlewares/auth.middleware';

const router = express.Router();

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);

// Protected routes
router.put('/profile', authenticateToken, updateUserProfile);
router.put('/password', authenticateToken, updateUserPassword);
router.get('/me/blocked-accounts', authenticateToken, async (req, res, next) => {
  try {
    await getBlockedAccounts(req, res);
  } catch (error) {
    next(error);
  }
});
router.put('/me/blocked-accounts', authenticateToken, async (req, res, next) => {
  try {
    await updateBlockedAccounts(req, res);
  } catch (error) {
    next(error);
  }
});
router.delete('/me/blocked-accounts', authenticateToken, async (req, res, next) => {
  try {
    await removeBlockedAccount(req, res);
  } catch (error) {
    next(error);
  }
});

// Admin-only routes
router.get('/all', authenticateToken, requireRole(['admin']), getAllUsers);
router.put('/', authenticateToken, requireRole(['admin']), updateUser);
router.delete('/:userId', authenticateToken, requireRole(['admin']), deleteUser);

export default router;