import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { expenses, warehouses } from '../db/schema.js';
import {
  createExpenseSchema,
  recordExpensePaymentSchema,
} from '../utils/validations.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';

/**
 * Record a New Bill / Expense
 */
export const createExpense = async (req, res, next) => {
  try {
    const parseResult = createExpenseSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ApiError(
        400,
        'Validation Error: Invalid expense payload.',
        parseResult.error.errors
      );
    }

    const {
      warehouseId,
      billerName,
      category,
      referenceNumber,
      dueDate,
      totalAmount,
      amountPaid = 0,
      notes,
    } = parseResult.data;

    // Verify warehouse exists
    const warehouse = await db.query.warehouses.findFirst({
      where: eq(warehouses.id, warehouseId),
    });

    if (!warehouse) {
      throw new ApiError(404, `Warehouse with ID '${warehouseId}' not found.`);
    }

    const total = Number(totalAmount);
    const paid = Math.min(total, Number(amountPaid) || 0);

    let status = parseResult.data.status;
    if (!status) {
      if (paid >= total) {
        status = 'Paid';
      } else if (paid > 0) {
        status = 'Partially Paid';
      } else {
        status = 'Pending';
      }
    }

    const [newExpense] = await db
      .insert(expenses)
      .values({
        warehouseId,
        billerName: billerName.trim(),
        category: category.trim(),
        referenceNumber: referenceNumber.trim(),
        dueDate,
        totalAmount: total.toFixed(2),
        amountPaid: paid.toFixed(2),
        status,
        notes: notes ? notes.trim() : null,
      })
      .returning();

    // Fetch complete record with warehouse details
    const completeExpense = await db.query.expenses.findFirst({
      where: eq(expenses.id, newExpense.id),
      with: {
        warehouse: true,
      },
    });

    return res.status(201).json(
      new ApiResponse(201, completeExpense, 'Expense bill recorded successfully.')
    );
  } catch (error) {
    if (error.code === '23505') {
      return next(
        new ApiError(409, `An expense with reference number '${req.body?.referenceNumber}' already exists.`)
      );
    }
    next(error);
  }
};

/**
 * Get All Expenses with Warehouse Details
 */
export const getAllExpenses = async (req, res, next) => {
  try {
    const allExpenses = await db.query.expenses.findMany({
      orderBy: [desc(expenses.createdAt)],
      with: {
        warehouse: true,
      },
    });

    return res.status(200).json(
      new ApiResponse(200, allExpenses, 'All expense records fetched successfully.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Record a Payment for an Expense Bill
 */
export const recordExpensePayment = async (req, res, next) => {
  try {
    const { id } = req.params;

    const parseResult = recordExpensePaymentSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ApiError(
        400,
        'Validation Error: Invalid payment amount.',
        parseResult.error.errors
      );
    }

    const existingExpense = await db.query.expenses.findFirst({
      where: eq(expenses.id, id),
    });

    if (!existingExpense) {
      throw new ApiError(404, `Expense record with ID '${id}' not found.`);
    }

    const total = Number(existingExpense.totalAmount);
    const currentPaid = Number(existingExpense.amountPaid);
    
    let newPaid = currentPaid;
    if (parseResult.data.paymentAmount !== undefined) {
      newPaid = Math.min(total, currentPaid + Number(parseResult.data.paymentAmount));
    } else if (parseResult.data.amountPaid !== undefined) {
      newPaid = Math.min(total, Number(parseResult.data.amountPaid));
    }

    const newStatus = newPaid >= total ? 'Paid' : (newPaid > 0 ? 'Partially Paid' : 'Pending');

    const [updatedExpense] = await db
      .update(expenses)
      .set({
        amountPaid: newPaid.toFixed(2),
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(expenses.id, id))
      .returning();

    const completeUpdated = await db.query.expenses.findFirst({
      where: eq(expenses.id, updatedExpense.id),
      with: {
        warehouse: true,
      },
    });

    return res.status(200).json(
      new ApiResponse(200, completeUpdated, 'Expense payment recorded successfully.')
    );
  } catch (error) {
    next(error);
  }
};
