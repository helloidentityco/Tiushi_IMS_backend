import { Router } from 'express';
import {
  createExpense,
  getAllExpenses,
  recordExpensePayment,
} from '../controllers/expenseController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = Router();

// Protect all Expense routes with JWT authentication
router.use(protect);

// Read all expense records
router.get('/', getAllExpenses);

// Create new expense bill
router.post('/', createExpense);

// Record payment towards an expense bill
router.patch('/:id/pay', recordExpensePayment);

export default router;
