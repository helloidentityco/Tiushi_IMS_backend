import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { purchaseOrders, poItems, suppliers, warehouses, products, resources } from '../db/schema.js';
import { insertPOSchema } from '../utils/validations.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';

/**
 * Generate unique PO Number if none is provided
 */
const generatePONumber = () => {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `PO-${Date.now().toString().slice(-6)}-${randomSuffix}`;
};

/**
 * Create Purchase Order with Line Items (Admin, Store Manager)
 */
export const createPO = async (req, res, next) => {
  try {
    const rawData = {
      ...req.body,
      poNumber: req.body.poNumber ? req.body.poNumber.trim().toUpperCase() : generatePONumber(),
    };

    // Validate payload against compound schema
    const parseResult = insertPOSchema.safeParse(rawData);
    if (!parseResult.success) {
      throw new ApiError(
        400,
        'Validation Error: Invalid Purchase Order payload.',
        parseResult.error.errors
      );
    }

    const {
      poNumber,
      supplierId,
      warehouseId,
      orderDate,
      dueDate,
      invoicePdfUrl,
      items,
    } = parseResult.data;

    // Verify supplier exists
    const [supplier] = await db
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(eq(suppliers.id, supplierId))
      .limit(1);

    if (!supplier) {
      throw new ApiError(404, 'Supplier does not exist.');
    }

    // Verify warehouse exists
    const [warehouse] = await db
      .select({ id: warehouses.id })
      .from(warehouses)
      .where(eq(warehouses.id, warehouseId))
      .limit(1);

    if (!warehouse) {
      throw new ApiError(404, 'Warehouse depot does not exist.');
    }

    // Check duplicate PO number
    const [existingPO] = await db
      .select({ id: purchaseOrders.id })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.poNumber, poNumber))
      .limit(1);

    if (existingPO) {
      throw new ApiError(409, `Purchase Order number '${poNumber}' already exists.`);
    }

    // Calculate grand total from items
    let grandTotalNum = 0;
    const formattedItems = [];

    for (const item of items) {
      const orderedQty = Number(item.orderedQty);
      const unitPrice = Number(item.unitPrice);

      if (orderedQty <= 0 || unitPrice < 0) {
        throw new ApiError(400, 'Ordered quantity must be > 0 and unit price >= 0.');
      }

      const lineTotal = orderedQty * unitPrice;
      grandTotalNum += lineTotal;

      formattedItems.push({
        productId: item.productId || null,
        resourceId: item.resourceId || null,
        orderedQty,
        receivedQty: 0,
        unitPrice: unitPrice.toFixed(2),
        lineTotal: lineTotal.toFixed(2),
      });
    }

    const grandTotalStr = grandTotalNum.toFixed(2);

    // Atomically execute PO header & po_items insertion inside a database transaction
    const completePO = await db.transaction(async (tx) => {
      // Insert Purchase Order Header
      const [newPO] = await tx
        .insert(purchaseOrders)
        .values({
          poNumber,
          supplierId,
          warehouseId,
          status: 'Issued',
          paymentStatus: 'Pending',
          grandTotal: grandTotalStr,
          balanceDue: grandTotalStr,
          amountPaid: '0.00',
          orderDate: orderDate ? orderDate.split('T')[0] : null,
          dueDate: dueDate ? dueDate.split('T')[0] : null,
          invoicePdfUrl: invoicePdfUrl || null,
        })
        .returning();

      // Insert Purchase Order Line Items
      const itemsToInsert = formattedItems.map((item) => ({
        poId: newPO.id,
        ...item,
      }));

      await tx.insert(poItems).values(itemsToInsert);

      // Fetch complete PO record with nested relations inside the same transaction
      const result = await tx.query.purchaseOrders.findFirst({
        where: eq(purchaseOrders.id, newPO.id),
        with: {
          supplier: true,
          warehouse: true,
          items: {
            with: {
              product: true,
              resource: true,
            },
          },
        },
      });

      return result;
    });

    return res.status(201).json(
      new ApiResponse(201, completePO, 'Purchase Order issued successfully.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get All Purchase Orders sorted newest first (All Authenticated)
 */
export const getAllPOs = async (req, res, next) => {
  try {
    const poList = await db.query.purchaseOrders.findMany({
      orderBy: [desc(purchaseOrders.createdAt)],
      with: {
        supplier: true,
        warehouse: true,
        items: {
          with: {
            product: true,
            resource: true,
          },
        },
        debitNotes: true,
      },
    });

    return res.status(200).json(
      new ApiResponse(200, poList, 'Purchase Orders retrieved successfully.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Single Purchase Order by ID
 */
export const getPOById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const po = await db.query.purchaseOrders.findFirst({
      where: eq(purchaseOrders.id, id),
      with: {
        supplier: true,
        warehouse: true,
        items: {
          with: {
            product: true,
            resource: true,
          },
        },
        debitNotes: true,
      },
    });

    if (!po) {
      throw new ApiError(404, 'Purchase Order not found.');
    }

    return res.status(200).json(
      new ApiResponse(200, po, 'Purchase Order retrieved successfully.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Record Supplier Payment against a Purchase Order (Admin, Store Manager)
 */
export const recordPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount, note } = req.body;

    const paymentAmount = Number(amount);
    if (!paymentAmount || isNaN(paymentAmount) || paymentAmount <= 0) {
      throw new ApiError(400, 'Valid positive payment amount is required.');
    }

    // Verify PO exists
    const [po] = await db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, id))
      .limit(1);

    if (!po) {
      throw new ApiError(404, 'Purchase Order not found.');
    }

    const currentBalanceDue = Number(po.balanceDue);
    const currentAmountPaid = Number(po.amountPaid);

    if (currentBalanceDue <= 0.001) {
      throw new ApiError(400, 'This Purchase Order is already fully settled (Paid).');
    }

    if (paymentAmount > currentBalanceDue + 0.001) {
      throw new ApiError(
        400,
        `Payment amount ($${paymentAmount.toFixed(2)}) exceeds remaining balance due ($${currentBalanceDue.toFixed(2)}).`
      );
    }

    const newAmountPaid = currentAmountPaid + paymentAmount;
    const newBalanceDue = Math.max(0, currentBalanceDue - paymentAmount);
    const newPaymentStatus = newBalanceDue <= 0.001 ? 'Paid' : 'Partially Paid';

    const [updatedPO] = await db
      .update(purchaseOrders)
      .set({
        amountPaid: newAmountPaid.toFixed(2),
        balanceDue: newBalanceDue.toFixed(2),
        paymentStatus: newPaymentStatus,
        updatedAt: new Date(),
      })
      .where(eq(purchaseOrders.id, id))
      .returning();

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          po: updatedPO,
          paymentRecorded: {
            amount: paymentAmount.toFixed(2),
            previousBalance: currentBalanceDue.toFixed(2),
            remainingBalance: newBalanceDue.toFixed(2),
            note: note || 'Supplier payment recorded',
            recordedAt: new Date(),
          },
        },
        'Payment recorded successfully.'
      )
    );
  } catch (error) {
    next(error);
  }
};
