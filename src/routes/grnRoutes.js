import { Router } from 'express';
import {
  createGRN,
  getAllGRNs,
  reverseGRN,
  receiveGRN,
} from '../controllers/grnController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = Router();

// Protect all GRN routes
router.use(protect);

// GET / - fetch list of GRNs
router.get('/', getAllGRNs);

// POST / - create a new GRN
router.post(
  '/',
  authorizeRoles('Admin', 'Store Manager', 'Warehouse Staff'),
  createGRN
);

// POST /receive - legacy receipt endpoint
router.post(
  '/receive',
  authorizeRoles('Admin', 'Store Manager', 'Warehouse Staff'),
  receiveGRN
);

// PATCH /:id/reverse - reverse a GRN
router.patch(
  '/:id/reverse',
  authorizeRoles('Admin', 'Store Manager'),
  reverseGRN
);

export default router;
