import { desc, eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { customerReturns, warehouseStock, products, warehouses, sales } from '../db/schema.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';

/**
 * Generate unique Return Number
 */
const generateReturnNumber = () => {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `RET-${Date.now().toString().slice(-6)}-${randomSuffix}`;
};

/**
 * Get All Customer Returns (All authenticated users)
 */
export const getAllReturns = async (req, res, next) => {
  try {
    const returnsList = await db.query.customerReturns.findMany({
      orderBy: [desc(customerReturns.createdAt)],
      with: {
        sale: {
          columns: {
            id: true,
            invoiceNumber: true,
            customerName: true,
            totalAmount: true,
          },
        },
        product: {
          columns: {
            id: true,
            sku: true,
            name: true,
            category: true,
            sellingPrice: true,
          },
        },
        warehouse: {
          columns: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    return res.status(200).json(
      new ApiResponse(200, returnsList, 'Customer returns retrieved successfully.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Create Customer Return (Admin, Store Manager, Cashier)
 */
export const createReturn = async (req, res, next) => {
  try {
    const {
      saleId,
      returnNumber = generateReturnNumber(),
      productId,
      warehouseId,
      quantity = 1,
      refundAmount = '0.00',
      reason = 'Customer return',
      status = 'Completed',
      customerContact = '',
      condition = 'Restockable',
    } = req.body;

    const returnQty = Math.max(1, Number(quantity) || 1);
    const refundAmt = Math.max(0, Number(refundAmount) || 0).toFixed(2);

    const result = await db.transaction(async (tx) => {
      // 1. Insert customer return record
      const [newReturn] = await tx
        .insert(customerReturns)
        .values({
          saleId: saleId || null,
          returnNumber,
          productId: productId || null,
          warehouseId: warehouseId || null,
          quantity: returnQty,
          refundAmount: refundAmt,
          reason,
          status,
          customerContact,
        })
        .returning();

      // 2. If condition is Restockable and warehouse + product are provided, increment warehouseStock
      if (condition === 'Restockable' && productId && warehouseId) {
        const [existingStock] = await tx
          .select()
          .from(warehouseStock)
          .where(
            and(
              eq(warehouseStock.warehouseId, warehouseId),
              eq(warehouseStock.productId, productId)
            )
          )
          .limit(1);

        if (existingStock) {
          await tx
            .update(warehouseStock)
            .set({
              quantity: existingStock.quantity + returnQty,
              updatedAt: new Date(),
            })
            .where(eq(warehouseStock.id, existingStock.id));
        } else {
          await tx.insert(warehouseStock).values({
            warehouseId,
            productId,
            quantity: returnQty,
          });
        }
      }

      // 3. Return full record with relations
      const completeReturn = await tx.query.customerReturns.findFirst({
        where: eq(customerReturns.id, newReturn.id),
        with: {
          sale: true,
          product: true,
          warehouse: true,
        },
      });

      return completeReturn;
    });

    return res.status(201).json(
      new ApiResponse(201, result, 'Customer return processed and logged successfully.')
    );
  } catch (error) {
    next(error);
  }
};
