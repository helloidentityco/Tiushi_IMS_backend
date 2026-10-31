import { Router } from 'express';
import {
  createPO,
  getAllPOs,
  getPOById,
  recordPayment,
} from '../controllers/poController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = Router();

// Protect all Purchase Order routes
router.use(protect);

// Read routes (All authenticated roles)
router.get('/', getAllPOs);
router.get('/:id', getPOById);

// Creation (Admin, Store Manager)
router.post('/', authorizeRoles('Admin', 'Store Manager'), createPO);

// Payment Recording (Admin, Store Manager)
router.post('/:id/payment', authorizeRoles('Admin', 'Store Manager'), recordPayment);

export default router;
