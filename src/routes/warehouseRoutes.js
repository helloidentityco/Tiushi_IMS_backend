import { Router } from 'express';
import {
  createWarehouse,
  getAllWarehouses,
  getWarehouseById,
  updateWarehouse,
} from '../controllers/warehouseController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = Router();

// All warehouse routes require authentication
router.use(protect);

// Read routes accessible to all authenticated roles (Admin, Store Manager, Warehouse Staff, Cashier)
router.get('/', getAllWarehouses);
router.get('/:id', getWarehouseById);

// Write routes restricted to Admin only (Strictly NO delete route)
router.post('/', authorizeRoles('Admin'), createWarehouse);
router.put('/:id', authorizeRoles('Admin'), updateWarehouse);
router.patch('/:id', authorizeRoles('Admin'), updateWarehouse);

export default router;
