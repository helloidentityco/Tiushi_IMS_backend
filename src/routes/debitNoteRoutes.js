import { Router } from 'express';
import {
  getAllDebitNotes,
  getDebitNoteById,
  markDebitNoteRefunded,
} from '../controllers/debitNoteController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = Router();

// Protect all Debit Note routes
router.use(protect);

// Read routes (All authenticated roles)
router.get('/', getAllDebitNotes);
router.get('/:id', getDebitNoteById);

// Refund settlement (Admin, Store Manager)
router.patch('/:id/mark-refunded', authorizeRoles('Admin', 'Store Manager'), markDebitNoteRefunded);
router.put('/:id/mark-refunded', authorizeRoles('Admin', 'Store Manager'), markDebitNoteRefunded);

export default router;
