import { Router } from 'express';
import {
  createProduct,
  getAllProducts,
  getProductById,
  allocateStock,
  updateProduct,
} from '../controllers/productController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';
import { upload } from '../middlewares/uploadMiddleware.js';

const router = Router();

// All product & inventory routes require authentication
router.use(protect);

// Read routes accessible to all authenticated roles
router.get('/', getAllProducts);
router.get('/:id', getProductById);

// Product creation & modification (Admin and Store Manager)
router.post(
  '/',
  authorizeRoles('Admin', 'Store Manager'),
  upload.single('image'),
  createProduct
);

router.put(
  '/:id',
  authorizeRoles('Admin', 'Store Manager'),
  upload.single('image'),
  updateProduct
);

router.patch(
  '/:id',
  authorizeRoles('Admin', 'Store Manager'),
  upload.single('image'),
  updateProduct
);

// Stock allocation endpoint (Admin and Store Manager)
router.post(
  '/allocate-stock',
  authorizeRoles('Admin', 'Store Manager'),
  allocateStock
);

export default router;
