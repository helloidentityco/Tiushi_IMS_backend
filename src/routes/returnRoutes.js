import { Router } from 'express';
import { getAllReturns, createReturn } from '../controllers/returnController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = Router();

// Protect all customer returns routes
router.use(protect);

// Read all returns (All authenticated roles)
router.get('/', getAllReturns);

// Create customer return (Admin, Store Manager, Cashier)
router.post('/', authorizeRoles('Admin', 'Store Manager', 'Cashier'), createReturn);

export default router;
