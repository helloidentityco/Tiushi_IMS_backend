import { z } from 'zod';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import {
  users,
  warehouses,
  products,
  warehouseStock,
  resources,
  warehouseResourceStock,
  suppliers,
  purchaseOrders,
  poItems,
  debitNotes,
  sales,
  saleItems,
  expenses,
  categories,
  variants,
  brands,
  units,
} from '../db/schema.js';

// ==========================================
// 1. USERS VALIDATION SCHEMAS
// ==========================================

export const selectUserSchema = createSelectSchema(users);

export const insertUserSchema = createInsertSchema(users, {
  email: (schema) => schema.email('Invalid email address format'),
  password: (schema) => schema.min(6, 'Password must be at least 6 characters long'),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateUserSchema = createUpdateSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const loginUserSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(1, 'Password is required'),
});

// ==========================================
// 2. WAREHOUSES VALIDATION SCHEMAS
// ==========================================

export const selectWarehouseSchema = createSelectSchema(warehouses);

export const insertWarehouseSchema = createInsertSchema(warehouses, {
  code: (schema) => schema.min(2, 'Warehouse code must be at least 2 characters'),
  name: (schema) => schema.min(2, 'Warehouse name must be at least 2 characters'),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateWarehouseSchema = createUpdateSchema(warehouses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ==========================================
// 3. PRODUCTS VALIDATION SCHEMAS
// ==========================================

export const selectProductSchema = createSelectSchema(products);

export const insertProductSchema = createInsertSchema(products, {
  sku: (schema) => schema.min(2, 'SKU must be at least 2 characters'),
  name: (schema) => schema.min(2, 'Product name is required'),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateProductSchema = createUpdateSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ==========================================
// 4. WAREHOUSE STOCK VALIDATION SCHEMAS
// ==========================================

export const selectWarehouseStockSchema = createSelectSchema(warehouseStock);

export const insertWarehouseStockSchema = createInsertSchema(warehouseStock).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateWarehouseStockSchema = createUpdateSchema(warehouseStock).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ==========================================
// 4B. RESOURCES & RESOURCE STOCK VALIDATION SCHEMAS
// ==========================================

export const selectResourceSchema = createSelectSchema(resources);

export const insertResourceSchema = createInsertSchema(resources, {
  code: (schema) => schema.min(2, 'Resource code must be at least 2 characters'),
  name: (schema) => schema.min(2, 'Resource name is required'),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateResourceSchema = createUpdateSchema(resources, {
  code: (schema) => schema.min(2, 'Resource code must be at least 2 characters').optional(),
  name: (schema) => schema.min(2, 'Resource name is required').optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectWarehouseResourceStockSchema = createSelectSchema(warehouseResourceStock);

export const insertWarehouseResourceStockSchema = createInsertSchema(warehouseResourceStock).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const consumeResourceStockSchema = z.object({
  resourceId: z.string().uuid('Invalid Resource ID'),
  warehouseId: z.string().uuid('Invalid Warehouse ID'),
  quantityUsed: z.coerce.number().int().positive('Quantity used must be greater than 0'),
  notes: z.string().optional().nullable(),
});

// ==========================================
// 5. SUPPLIERS VALIDATION SCHEMAS
// ==========================================

export const selectSupplierSchema = createSelectSchema(suppliers);

export const insertSupplierSchema = createInsertSchema(suppliers, {
  name: (schema) => schema.min(2, 'Supplier name is required'),
  email: (schema) => schema.email('Invalid supplier email').optional().or(z.literal('')),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateSupplierSchema = createUpdateSchema(suppliers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ==========================================
// 6. PURCHASE ORDERS & ITEMS VALIDATION SCHEMAS
// ==========================================

export const selectPurchaseOrderSchema = createSelectSchema(purchaseOrders);

export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders, {
  poNumber: (schema) => schema.min(2, 'PO Number is required'),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updatePurchaseOrderSchema = createUpdateSchema(purchaseOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectPOItemSchema = createSelectSchema(poItems);

export const poItemInputSchema = z
  .object({
    productId: z.string().uuid('Invalid Product ID').optional().nullable(),
    resourceId: z.string().uuid('Invalid Resource ID').optional().nullable(),
    orderedQty: z.coerce.number().int().positive('Ordered quantity must be greater than 0'),
    unitPrice: z.coerce.number().nonnegative('Unit price must be non-negative'),
  })
  .refine((data) => Boolean(data.productId || data.resourceId), {
    message: 'Each PO line item must specify either productId or resourceId.',
  });

// Compound schema for PO creation with line items
export const insertPOSchema = z.object({
  poNumber: z.string().min(2, 'PO Number is required').optional(),
  supplierId: z.string().uuid('Invalid Supplier ID'),
  warehouseId: z.string().uuid('Invalid Warehouse ID'),
  orderDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  invoicePdfUrl: z.string().optional().nullable(),
  items: z.array(poItemInputSchema).min(1, 'Purchase Order must have at least one line item'),
});

// ==========================================
// 7. DEBIT NOTES (PURCHASE RETURNS) VALIDATION SCHEMAS
// ==========================================

export const selectDebitNoteSchema = createSelectSchema(debitNotes);

export const insertDebitNoteSchema = createInsertSchema(debitNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateDebitNoteSchema = createUpdateSchema(debitNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ==========================================
// 8. SALES & SALE ITEMS VALIDATION SCHEMAS
// ==========================================

export const selectSaleSchema = createSelectSchema(sales);

export const insertSaleSchema = createInsertSchema(sales).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectSaleItemSchema = createSelectSchema(saleItems);

export const saleItemInputSchema = z.object({
  productId: z.string().uuid('Invalid Product ID'),
  quantity: z.coerce.number().int().positive('Quantity must be greater than 0'),
  unitPrice: z.coerce.number().nonnegative('Unit price must be non-negative'),
});

export const createSaleInputSchema = z.object({
  invoiceNumber: z.string().min(2, 'Invoice number must be at least 2 characters').optional(),
  warehouseId: z.string().uuid('Invalid Warehouse ID'),
  customerName: z.string().optional().default('Walk-in Customer'),
  discount: z.coerce.number().nonnegative().optional().default(0),
  paymentMethod: z.string().optional().default('Cash'),
  authReference: z.string().optional().nullable(),
  status: z.string().optional().default('Completed'),
  items: z.array(saleItemInputSchema).min(1, 'Sale must include at least one item'),
});

// ==========================================
// 9. EXPENSES / BILLS VALIDATION SCHEMAS
// ==========================================

export const selectExpenseSchema = createSelectSchema(expenses);

export const createExpenseSchema = z.object({
  warehouseId: z.string().uuid('Invalid Warehouse ID'),
  billerName: z.string().min(1, 'Biller name is required'),
  category: z.string().min(1, 'Category is required'),
  referenceNumber: z.string().min(1, 'Reference number is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  totalAmount: z.coerce.number().positive('Total amount must be greater than 0'),
  amountPaid: z.coerce.number().nonnegative().optional().default(0),
  status: z.enum(['Pending', 'Partially Paid', 'Paid']).optional(),
  notes: z.string().optional().nullable(),
});

export const recordExpensePaymentSchema = z.object({
  paymentAmount: z.coerce.number().positive('Payment amount must be greater than 0').optional(),
  amountPaid: z.coerce.number().positive('Amount must be greater than 0').optional(),
}).refine(data => data.paymentAmount !== undefined || data.amountPaid !== undefined, {
  message: 'Payment amount is required',
});

// ==========================================
// 10. PRODUCT META MODULES VALIDATION SCHEMAS
// ==========================================

// Categories
export const selectCategorySchema = createSelectSchema(categories);
export const insertCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  description: z.string().optional().nullable(),
  logo: z.string().optional().nullable(),
});
export const updateCategorySchema = insertCategorySchema.partial();

// Variants
export const selectVariantSchema = createSelectSchema(variants);
export const insertVariantSchema = z.object({
  name: z.string().min(1, 'Variant name is required'),
  options: z.union([
    z.array(z.string()),
    z.string().transform((str) => str.split(',').map((s) => s.trim()).filter(Boolean))
  ]),
});
export const updateVariantSchema = z.object({
  name: z.string().min(1, 'Variant name is required').optional(),
  options: z.union([
    z.array(z.string()),
    z.string().transform((str) => str.split(',').map((s) => s.trim()).filter(Boolean))
  ]).optional(),
});

// Brands
export const selectBrandSchema = createSelectSchema(brands);
export const insertBrandSchema = z.object({
  name: z.string().min(1, 'Brand name is required'),
  description: z.string().optional().nullable(),
  logo: z.string().optional().nullable(),
});
export const updateBrandSchema = insertBrandSchema.partial();

// Units
export const selectUnitSchema = createSelectSchema(units);
export const insertUnitSchema = z.object({
  name: z.string().min(1, 'Unit name is required'),
  shortName: z.string().min(1, 'Unit short name / abbreviation is required'),
  baseUnit: z.string().optional().default('None'),
});
export const updateUnitSchema = insertUnitSchema.partial();
