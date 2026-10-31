import { Router } from 'express';
import {
  createSale,
  getAllSales,
  getSaleById,
  updateSaleFulfillmentStatus,
} from '../controllers/saleController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = Router();

// Protect all Sales routes with JWT HttpOnly authentication
router.use(protect);

// Read all sales (All authenticated users)
router.get('/', getAllSales);

// Read single sale by ID (All authenticated users)
router.get('/:id', getSaleById);

// Update sale fulfillment status (Admin, Store Manager, Warehouse Staff, Cashier)
router.patch(
  '/:id/fulfillment-status',
  authorizeRoles('Admin', 'Store Manager', 'Warehouse Staff', 'Cashier'),
  updateSaleFulfillmentStatus
);

// Create new POS sale transaction (Admin, Store Manager, Cashier)
router.post(
  '/',
  authorizeRoles('Admin', 'Store Manager', 'Cashier'),
  createSale
);

export default router;
