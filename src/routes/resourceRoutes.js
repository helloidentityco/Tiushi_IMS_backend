import { Router } from 'express';
import {
  createResource,
  getAllResources,
  getResourceById,
  updateResource,
  allocateResourceStock,
  consumeResourceStock,
} from '../controllers/resourceController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = Router();

// Protect all resource routes
router.use(protect);

// Read routes (All authenticated users)
router.get('/', getAllResources);
router.get('/:id', getResourceById);

// Resource creation & modification (Admin and Store Manager)
router.post(
  '/',
  authorizeRoles('Admin', 'Store Manager'),
  createResource
);

router.put(
  '/:id',
  authorizeRoles('Admin', 'Store Manager'),
  updateResource
);

router.patch(
  '/:id',
  authorizeRoles('Admin', 'Store Manager'),
  updateResource
);

// Stock allocation endpoint (Admin and Store Manager)
router.post(
  '/allocate-stock',
  authorizeRoles('Admin', 'Store Manager'),
  allocateResourceStock
);

// Manufacturing stock consumption endpoint
router.post(
  '/consume-stock',
  consumeResourceStock
);

export default router;
