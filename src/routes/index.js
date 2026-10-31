import { Router } from 'express';
import authRoutes from './authRoutes.js';
import warehouseRoutes from './warehouseRoutes.js';
import productRoutes from './productRoutes.js';
import supplierRoutes from './supplierRoutes.js';
import poRoutes from './poRoutes.js';
import grnRoutes from './grnRoutes.js';
import debitNoteRoutes from './debitNoteRoutes.js';
import resourceRoutes from './resourceRoutes.js';
import saleRoutes from './saleRoutes.js';
import returnRoutes from './returnRoutes.js';
import expenseRoutes from './expenseRoutes.js';
import categoryRoutes from './categoryRoutes.js';
import variantRoutes from './variantRoutes.js';
import brandRoutes from './brandRoutes.js';
import unitRoutes from './unitRoutes.js';
import uploadRoutes from './uploadRoutes.js';
import userRoutes from './userRoutes.js';
import permissionRoutes from './permissionRoutes.js';
import { ApiResponse } from '../utils/ApiResponse.js';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        status: 'online',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        service: 'Identity IMS Backend API',
      },
      'API services operational'
    )
  );
});

// Core Route Modules
router.use('/auth', authRoutes);
router.use('/warehouses', warehouseRoutes);
router.use('/products', productRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/purchase-orders', poRoutes);
router.use('/grns', grnRoutes);
router.use('/grn', grnRoutes);
router.use('/debit-notes', debitNoteRoutes);
router.use('/resources', resourceRoutes);
router.use('/sales', saleRoutes);
router.use('/returns', returnRoutes);
router.use('/expenses', expenseRoutes);
router.use('/categories', categoryRoutes);
router.use('/variants', variantRoutes);
router.use('/brands', brandRoutes);
router.use('/units', unitRoutes);
router.use('/upload', uploadRoutes);
router.use('/users', userRoutes);
router.use('/permissions', permissionRoutes);

export default router;
