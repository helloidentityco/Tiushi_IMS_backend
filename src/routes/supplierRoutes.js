import { Router } from 'express';
import {
  createSupplier,
  getAllSuppliers,
  getSupplierById,
  updateSupplier,
} from '../controllers/supplierController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = Router();

// Protect all supplier routes
router.use(protect);

// Read routes (All authenticated roles)
router.get('/', getAllSuppliers);
router.get('/:id', getSupplierById);

// Creation & Modification (Admin, Store Manager)
router.post('/', authorizeRoles('Admin', 'Store Manager'), createSupplier);
router.put('/:id', authorizeRoles('Admin', 'Store Manager'), updateSupplier);
router.patch('/:id', authorizeRoles('Admin', 'Store Manager'), updateSupplier);

export default router;
