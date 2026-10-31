import { eq, desc, and, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { sales, saleItems, warehouseStock, warehouses, products } from '../db/schema.js';
import { createSaleInputSchema } from '../utils/validations.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';

/**
 * Generate unique Invoice Number if not supplied
 */
const generateInvoiceNumber = () => {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `INV-${Date.now().toString().slice(-6)}-${randomSuffix}`;
};

/**
 * Create Sale with atomic stock deduction in database transaction
 * (Cashier, Store Manager, Admin)
 */
export const createSale = async (req, res, next) => {
  try {
    const rawData = {
      ...req.body,
      invoiceNumber: req.body.invoiceNumber ? req.body.invoiceNumber.trim().toUpperCase() : generateInvoiceNumber(),
    };

    const parseResult = createSaleInputSchema.safeParse(rawData);
    if (!parseResult.success) {
      throw new ApiError(
        400,
        'Validation Error: Invalid sale payload.',
        parseResult.error.errors
      );
    }

    const {
      invoiceNumber,
      warehouseId,
      customerName,
      discount = 0,
      paymentMethod = 'Cash',
      authReference,
      status = 'Completed',
      items,
    } = parseResult.data;

    // Execute atomic transaction: Check stock -> Deduct stock -> Insert Sale -> Insert Sale Items
    const completeSale = await db.transaction(async (tx) => {
      // 1. Verify warehouse depot exists
      const [warehouse] = await tx
        .select({ id: warehouses.id, name: warehouses.name })
        .from(warehouses)
        .where(eq(warehouses.id, warehouseId))
        .limit(1);

      if (!warehouse) {
        throw new ApiError(404, 'Specified warehouse does not exist.');
      }

      // 2. Check if invoiceNumber already exists
      const [existingInvoice] = await tx
        .select({ id: sales.id })
        .from(sales)
        .where(eq(sales.invoiceNumber, invoiceNumber))
        .limit(1);

      if (existingInvoice) {
        throw new ApiError(409, `Invoice number '${invoiceNumber}' already exists.`);
      }

      // 3. Inspect stock levels and calculate line totals
      let subtotalNum = 0;
      const verifiedItems = [];

      for (const item of items) {
        // Fetch product info
        const [product] = await tx
          .select({ id: products.id, name: products.name, sku: products.sku, sellingPrice: products.sellingPrice })
          .from(products)
          .where(eq(products.id, item.productId))
          .limit(1);

        if (!product) {
          throw new ApiError(404, `Product with ID '${item.productId}' not found.`);
        }

        // Fetch warehouse stock record
        const [stockRecord] = await tx
          .select()
          .from(warehouseStock)
          .where(
            and(
              eq(warehouseStock.warehouseId, warehouseId),
              eq(warehouseStock.productId, item.productId)
            )
          )
          .limit(1);

        const availableQty = stockRecord ? Number(stockRecord.quantity) : 0;
        const requestedQty = Number(item.quantity);

        if (!stockRecord || availableQty < requestedQty) {
          throw new ApiError(
            400,
            `Insufficient stock for product '${product.name}' (SKU: ${product.sku}) in warehouse '${warehouse.name}'. Available: ${availableQty}, Requested: ${requestedQty}.`
          );
        }

        const unitPriceNum = Number(item.unitPrice !== undefined ? item.unitPrice : product.sellingPrice);
        const lineTotalNum = requestedQty * unitPriceNum;
        subtotalNum += lineTotalNum;

        verifiedItems.push({
          productId: item.productId,
          stockRecordId: stockRecord.id,
          currentStock: availableQty,
          quantity: requestedQty,
          unitPrice: unitPriceNum.toFixed(2),
          lineTotal: lineTotalNum.toFixed(2),
        });
      }

      const discountNum = Math.max(0, Number(discount));
      const totalAmountNum = Math.max(0, subtotalNum - discountNum);

      // 4. Insert Main Sale record
      const [newSale] = await tx
        .insert(sales)
        .values({
          invoiceNumber,
          warehouseId,
          customerName: customerName || 'Walk-in Customer',
          totalAmount: totalAmountNum.toFixed(2),
          discount: discountNum.toFixed(2),
          paymentMethod,
          authReference: authReference ? String(authReference).trim() : null,
          status,
          fulfillmentStatus: 'Pending Pick',
        })
        .returning();

      // 5. Insert Sale Items
      const saleItemsToInsert = verifiedItems.map((vi) => ({
        saleId: newSale.id,
        productId: vi.productId,
        quantity: vi.quantity,
        unitPrice: vi.unitPrice,
        lineTotal: vi.lineTotal,
      }));

      await tx.insert(saleItems).values(saleItemsToInsert);

      // 6. Deduct stock from warehouse_stock
      for (const vi of verifiedItems) {
        const remainingQty = vi.currentStock - vi.quantity;
        await tx
          .update(warehouseStock)
          .set({
            quantity: remainingQty,
            updatedAt: new Date(),
          })
          .where(eq(warehouseStock.id, vi.stockRecordId));
      }

      // 7. Fetch complete sale with nested relations
      const result = await tx.query.sales.findFirst({
        where: eq(sales.id, newSale.id),
        with: {
          warehouse: true,
          items: {
            with: {
              product: true,
            },
          },
        },
      });

      return {
        ...result,
        sale_items: result?.items || [],
      };
    });

    return res.status(201).json(
      new ApiResponse(201, completeSale, 'Sale transaction processed and stock deducted successfully.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get All Sales for Invoice Register (All Authenticated Users)
 */
export const getAllSales = async (req, res, next) => {
  try {
    const salesList = await db.query.sales.findMany({
      orderBy: [desc(sales.createdAt)],
      with: {
        warehouse: true,
        items: {
          with: {
            product: true,
          },
        },
      },
    });

    const formattedSales = salesList.map((s) => ({
      ...s,
      sale_items: s.items || [],
    }));

    return res.status(200).json(
      new ApiResponse(200, formattedSales, 'Sales transactions retrieved successfully.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Single Sale by ID or Invoice Number
 */
export const getSaleById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const sale = await db.query.sales.findFirst({
      where: or(eq(sales.id, id), eq(sales.invoiceNumber, id)),
      with: {
        warehouse: true,
        items: {
          with: {
            product: true,
          },
        },
      },
    });

    if (!sale) {
      throw new ApiError(404, 'Sale record not found.');
    }

    const formattedSale = {
      ...sale,
      sale_items: sale.items || [],
    };

    return res.status(200).json(
      new ApiResponse(200, formattedSale, 'Sale record retrieved successfully.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update Sale Fulfillment Status (Admin, Store Manager, Warehouse Staff)
 */
export const updateSaleFulfillmentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fulfillmentStatus } = req.body;

    const validStatuses = ['Pending Pick', 'Picked', 'Packed', 'Dispatched'];
    if (!validStatuses.includes(fulfillmentStatus)) {
      throw new ApiError(400, `Invalid fulfillment status. Allowed values: ${validStatuses.join(', ')}`);
    }

    const [updatedSale] = await db
      .update(sales)
      .set({
        fulfillmentStatus,
        updatedAt: new Date(),
      })
      .where(or(eq(sales.id, id), eq(sales.invoiceNumber, id)))
      .returning();

    if (!updatedSale) {
      throw new ApiError(404, 'Sale record not found.');
    }

    return res.status(200).json(
      new ApiResponse(200, updatedSale, 'Fulfillment status updated successfully.')
    );
  } catch (error) {
    next(error);
  }
};
