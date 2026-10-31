import { Router } from 'express';
import {
  login,
  logout,
  getMe,
  seedInitialAdmin,
} from '../controllers/authController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = Router();

// Public Routes
router.post('/login', login);
router.post('/logout', logout);
router.post('/seed', seedInitialAdmin);

// Protected Routes
router.get('/me', protect, getMe);

export default router;
