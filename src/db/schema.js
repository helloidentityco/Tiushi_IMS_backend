import { relations } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  timestamp,
  pgEnum,
  uniqueIndex,
  date,
  jsonb,
  boolean,
} from 'drizzle-orm/pg-core';

// ==========================================
// ENUMS
// ==========================================

export const userRoleEnum = pgEnum('user_role', [
  'Admin',
  'Store Manager',
  'Warehouse Staff',
  'Cashier',
]);

export const userStatusEnum = pgEnum('user_status', [
  'active',
  'inactive',
]);

export const poStatusEnum = pgEnum('po_status', [
  'Issued',
  'Partially Received',
  'Completed',
]);

export const poPaymentStatusEnum = pgEnum('po_payment_status', [
  'Pending',
  'Partially Paid',
  'Paid',
]);

export const refundStatusEnum = pgEnum('refund_status', [
  'Pending',
  'Deducted',
  'Refunded',
]);

// ==========================================
// 1. USERS & RBAC TABLE
// ==========================================

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  role: userRoleEnum('role').default('Warehouse Staff').notNull(),
  status: userStatusEnum('status').default('active').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const rolePermissions = pgTable('role_permissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  role: varchar('role', { length: 100 }).notNull(),
  feature: varchar('feature', { length: 255 }).notNull(),
  featureId: varchar('feature_id', { length: 100 }),
  isAllowed: boolean('is_allowed').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// 2. PRODUCT META MODULES (CATEGORIES, VARIANTS, BRANDS, UNITS)
// ==========================================

export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  description: varchar('description', { length: 500 }),
  logo: text('logo'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const variants = pgTable('variants', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  options: jsonb('options').notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const brands = pgTable('brands', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  description: varchar('description', { length: 500 }),
  logo: text('logo'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const units = pgTable('units', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  shortName: varchar('short_name', { length: 50 }).notNull(),
  baseUnit: varchar('base_unit', { length: 100 }).default('None'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// 2B. WAREHOUSES & MULTI-NODE INVENTORY TABLES
// ==========================================

export const warehouses = pgTable('warehouses', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  address: text('address'),
  capacitySqFt: integer('capacity_sq_ft'),
  managerName: varchar('manager_name', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  sku: varchar('sku', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  brandId: uuid('brand_id').references(() => brands.id, { onDelete: 'set null' }),
  unitId: uuid('unit_id').references(() => units.id, { onDelete: 'set null' }),
  unitOfSaleId: uuid('unit_of_sale_id').references(() => units.id, { onDelete: 'set null' }),
  purchaseUnitId: uuid('purchase_unit_id').references(() => units.id, { onDelete: 'set null' }),
  variants: jsonb('variants').default([]),
  costPrice: numeric('cost_price', { precision: 12, scale: 2 }).default('0.00').notNull(),
  sellingPrice: numeric('selling_price', { precision: 12, scale: 2 }).default('0.00').notNull(),
  minStockLevel: integer('min_stock_level').default(0).notNull(),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const warehouseStock = pgTable(
  'warehouse_stock',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    warehouseId: uuid('warehouse_id')
      .notNull()
      .references(() => warehouses.id, { onDelete: 'restrict' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    quantity: integer('quantity').default(0).notNull(),
    binLocation: varchar('bin_location', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('warehouse_product_idx').on(table.warehouseId, table.productId),
  ]
);

// ==========================================
// 2B. RESOURCES & MULTI-NODE INVENTORY TABLES
// ==========================================

export const resources = pgTable('resources', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }),
  costPrice: numeric('cost_price', { precision: 12, scale: 2 }).default('0.00').notNull(),
  unitOfMeasure: varchar('unit_of_measure', { length: 50 }).default('units').notNull(),
  minStockLevel: integer('min_stock_level').default(0).notNull(),
  imageUrl: varchar('image_url', { length: 500 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const warehouseResourceStock = pgTable(
  'warehouse_resource_stock',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    warehouseId: uuid('warehouse_id')
      .notNull()
      .references(() => warehouses.id, { onDelete: 'restrict' }),
    resourceId: uuid('resource_id')
      .notNull()
      .references(() => resources.id, { onDelete: 'restrict' }),
    quantity: integer('quantity').default(0).notNull(),
    binLocation: varchar('bin_location', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('warehouse_resource_idx').on(table.warehouseId, table.resourceId),
  ]
);

// ==========================================
// 3. PROCUREMENT, SUPPLIERS & GRN TABLES
// ==========================================

export const suppliers = pgTable('suppliers', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  contact: varchar('contact', { length: 100 }),
  phone: varchar('phone', { length: 255 }),
  address: text('address'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const purchaseOrders = pgTable('purchase_orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  poNumber: varchar('po_number', { length: 100 }).notNull().unique(),
  supplierId: uuid('supplier_id')
    .notNull()
    .references(() => suppliers.id, { onDelete: 'restrict' }),
  warehouseId: uuid('warehouse_id')
    .notNull()
    .references(() => warehouses.id, { onDelete: 'restrict' }),
  status: poStatusEnum('status').default('Issued').notNull(),
  paymentStatus: poPaymentStatusEnum('payment_status').default('Pending').notNull(),
  grandTotal: numeric('grand_total', { precision: 12, scale: 2 }).default('0.00').notNull(),
  balanceDue: numeric('balance_due', { precision: 12, scale: 2 }).default('0.00').notNull(),
  amountPaid: numeric('amount_paid', { precision: 12, scale: 2 }).default('0.00').notNull(),
  orderDate: date('order_date'),
  dueDate: date('due_date'),
  invoicePdfUrl: text('invoice_pdf_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const poItems = pgTable('po_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  poId: uuid('po_id')
    .notNull()
    .references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id')
    .references(() => products.id, { onDelete: 'restrict' }),
  resourceId: uuid('resource_id')
    .references(() => resources.id, { onDelete: 'restrict' }),
  orderedQty: integer('ordered_qty').notNull(),
  receivedQty: integer('received_qty').default(0).notNull(),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
  lineTotal: numeric('line_total', { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const grns = pgTable('grns', {
  id: uuid('id').defaultRandom().primaryKey(),
  grnNumber: varchar('grn_number', { length: 100 }).notNull().unique(),
  poId: uuid('po_id')
    .notNull()
    .references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  batchNumber: varchar('batch_number', { length: 100 }),
  expiryDate: date('expiry_date'),
  unitsReceived: integer('units_received').notNull().default(0),
  receivingDate: date('receiving_date').notNull(),
  qualityStatus: varchar('quality_status', { length: 50 }).notNull().default('QA Passed'),
  warehouseId: uuid('warehouse_id')
    .notNull()
    .references(() => warehouses.id, { onDelete: 'restrict' }),
  deliveryNote: varchar('delivery_note', { length: 100 }),
  notes: text('notes'),
  items: jsonb('items').default([]),
  status: varchar('status', { length: 50 }).default('Completed'),
  isReversed: boolean('is_reversed').default(false),
  totalRejectedValue: numeric('total_rejected_value', { precision: 12, scale: 2 }).default('0.00'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// 4. DEBIT NOTES (PURCHASE RETURNS) TABLE
// ==========================================

export const debitNotes = pgTable('debit_notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  poId: uuid('po_id')
    .notNull()
    .references(() => purchaseOrders.id, { onDelete: 'restrict' }),
  supplierId: uuid('supplier_id')
    .notNull()
    .references(() => suppliers.id, { onDelete: 'restrict' }),
  warehouseId: uuid('warehouse_id')
    .notNull()
    .references(() => warehouses.id, { onDelete: 'restrict' }),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  refundStatus: refundStatusEnum('refund_status').default('Pending').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const debitNoteItems = pgTable('debit_note_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  debitNoteId: uuid('debit_note_id')
    .notNull()
    .references(() => debitNotes.id, { onDelete: 'cascade' }),
  productId: uuid('product_id')
    .references(() => products.id, { onDelete: 'restrict' }),
  resourceId: uuid('resource_id')
    .references(() => resources.id, { onDelete: 'restrict' }),
  quantity: integer('quantity').notNull().default(1),
  unitCost: numeric('unit_cost', { precision: 12, scale: 2 }).notNull().default('0.00'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// 5. SALES & POS TRANSACTIONS TABLES
// ==========================================

export const sales = pgTable('sales', {
  id: uuid('id').defaultRandom().primaryKey(),
  invoiceNumber: varchar('invoice_number', { length: 100 }).notNull().unique(),
  warehouseId: uuid('warehouse_id')
    .notNull()
    .references(() => warehouses.id, { onDelete: 'restrict' }),
  customerName: varchar('customer_name', { length: 255 }).default('Walk-in Customer'),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  discount: numeric('discount', { precision: 12, scale: 2 }).default('0.00'),
  paymentMethod: varchar('payment_method', { length: 50 }).default('Cash').notNull(),
  authReference: varchar('auth_reference', { length: 255 }),
  status: varchar('status', { length: 50 }).default('Completed').notNull(),
  fulfillmentStatus: varchar('fulfillment_status', { length: 50 }).default('Pending Pick').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const saleItems = pgTable('sale_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  saleId: uuid('sale_id')
    .notNull()
    .references(() => sales.id, { onDelete: 'cascade' }),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'restrict' }),
  quantity: integer('quantity').notNull(),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
  lineTotal: numeric('line_total', { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// 6. CUSTOMER RETURNS TABLE
// ==========================================

export const customerReturns = pgTable('customer_returns', {
  id: uuid('id').defaultRandom().primaryKey(),
  saleId: uuid('sale_id').references(() => sales.id, { onDelete: 'set null' }),
  returnNumber: varchar('return_number', { length: 100 }).notNull().unique(),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'restrict' }),
  warehouseId: uuid('warehouse_id').references(() => warehouses.id, { onDelete: 'restrict' }),
  quantity: integer('quantity').notNull().default(1),
  refundAmount: numeric('refund_amount', { precision: 12, scale: 2 }).notNull().default('0.00'),
  reason: text('reason'),
  status: varchar('status', { length: 50 }).notNull().default('Completed'),
  customerContact: varchar('customer_contact', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// 7. EXPENSES / BILLS TABLE
// ==========================================

export const expenses = pgTable('expenses', {
  id: uuid('id').defaultRandom().primaryKey(),
  warehouseId: uuid('warehouse_id')
    .notNull()
    .references(() => warehouses.id, { onDelete: 'restrict' }),
  billerName: varchar('biller_name', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  referenceNumber: varchar('reference_number', { length: 100 }).notNull().unique(),
  dueDate: date('due_date').notNull(),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
  amountPaid: numeric('amount_paid', { precision: 12, scale: 2 }).default('0.00').notNull(),
  status: varchar('status', { length: 50 }).default('Pending').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// RELATIONS
// ==========================================

export const usersRelations = relations(users, () => ({}));

export const warehousesRelations = relations(warehouses, ({ many }) => ({
  stock: many(warehouseStock),
  resourceStock: many(warehouseResourceStock),
  purchaseOrders: many(purchaseOrders),
  debitNotes: many(debitNotes),
  sales: many(sales),
  customerReturns: many(customerReturns),
  expenses: many(expenses),
  grns: many(grns),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  stock: many(warehouseStock),
  poItems: many(poItems),
  saleItems: many(saleItems),
  customerReturns: many(customerReturns),
  categoryRef: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  brand: one(brands, {
    fields: [products.brandId],
    references: [brands.id],
  }),
  unit: one(units, {
    fields: [products.unitId],
    references: [units.id],
  }),
  unitOfSale: one(units, {
    fields: [products.unitOfSaleId],
    references: [units.id],
  }),
  purchaseUnit: one(units, {
    fields: [products.purchaseUnitId],
    references: [units.id],
  }),
}));

export const warehouseStockRelations = relations(warehouseStock, ({ one }) => ({
  warehouse: one(warehouses, {
    fields: [warehouseStock.warehouseId],
    references: [warehouses.id],
  }),
  product: one(products, {
    fields: [warehouseStock.productId],
    references: [products.id],
  }),
}));

export const resourcesRelations = relations(resources, ({ many }) => ({
  stock: many(warehouseResourceStock),
  poItems: many(poItems),
}));

export const warehouseResourceStockRelations = relations(warehouseResourceStock, ({ one }) => ({
  warehouse: one(warehouses, {
    fields: [warehouseResourceStock.warehouseId],
    references: [warehouses.id],
  }),
  resource: one(resources, {
    fields: [warehouseResourceStock.resourceId],
    references: [resources.id],
  }),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  purchaseOrders: many(purchaseOrders),
  debitNotes: many(debitNotes),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [purchaseOrders.supplierId],
    references: [suppliers.id],
  }),
  warehouse: one(warehouses, {
    fields: [purchaseOrders.warehouseId],
    references: [warehouses.id],
  }),
  items: many(poItems),
  debitNotes: many(debitNotes),
  grns: many(grns),
}));

export const grnsRelations = relations(grns, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [grns.poId],
    references: [purchaseOrders.id],
  }),
  warehouse: one(warehouses, {
    fields: [grns.warehouseId],
    references: [warehouses.id],
  }),
}));

export const poItemsRelations = relations(poItems, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [poItems.poId],
    references: [purchaseOrders.id],
  }),
  product: one(products, {
    fields: [poItems.productId],
    references: [products.id],
  }),
  resource: one(resources, {
    fields: [poItems.resourceId],
    references: [resources.id],
  }),
}));

export const debitNotesRelations = relations(debitNotes, ({ one, many }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [debitNotes.poId],
    references: [purchaseOrders.id],
  }),
  supplier: one(suppliers, {
    fields: [debitNotes.supplierId],
    references: [suppliers.id],
  }),
  warehouse: one(warehouses, {
    fields: [debitNotes.warehouseId],
    references: [warehouses.id],
  }),
  items: many(debitNoteItems),
}));

export const debitNoteItemsRelations = relations(debitNoteItems, ({ one }) => ({
  debitNote: one(debitNotes, {
    fields: [debitNoteItems.debitNoteId],
    references: [debitNotes.id],
  }),
  product: one(products, {
    fields: [debitNoteItems.productId],
    references: [products.id],
  }),
  resource: one(resources, {
    fields: [debitNoteItems.resourceId],
    references: [resources.id],
  }),
}));

export const salesRelations = relations(sales, ({ one, many }) => ({
  warehouse: one(warehouses, {
    fields: [sales.warehouseId],
    references: [warehouses.id],
  }),
  items: many(saleItems),
  returns: many(customerReturns),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, {
    fields: [saleItems.saleId],
    references: [sales.id],
  }),
  product: one(products, {
    fields: [saleItems.productId],
    references: [products.id],
  }),
}));

export const customerReturnsRelations = relations(customerReturns, ({ one }) => ({
  sale: one(sales, {
    fields: [customerReturns.saleId],
    references: [sales.id],
  }),
  product: one(products, {
    fields: [customerReturns.productId],
    references: [products.id],
  }),
  warehouse: one(warehouses, {
    fields: [customerReturns.warehouseId],
    references: [warehouses.id],
  }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  warehouse: one(warehouses, {
    fields: [expenses.warehouseId],
    references: [warehouses.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));
export const variantsRelations = relations(variants, () => ({}));
export const brandsRelations = relations(brands, ({ many }) => ({
  products: many(products),
}));
export const unitsRelations = relations(units, ({ many }) => ({
  products: many(products),
}));
