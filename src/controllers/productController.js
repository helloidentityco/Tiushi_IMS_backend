import { eq, desc, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { products, warehouseStock, warehouses } from '../db/schema.js';
import {
  insertProductSchema,
  updateProductSchema,
  insertWarehouseStockSchema,
} from '../utils/validations.js';
import { uploadToCloudinary } from '../utils/cloudinary.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';

/**
 * Create Product with optional Cloudinary image upload (Admin, Store Manager)
 */
export const createProduct = async (req, res, next) => {
  try {
    let imageUrl = req.body.imageUrl || null;

    // Upload image to Cloudinary if file was provided via multipart/form-data
    if (req.file?.buffer) {
      const uploadResult = await uploadToCloudinary(
        req.file.buffer,
        'identity_ims/products'
      );
      imageUrl = uploadResult.secure_url;
    }

    // Parse variants if provided as string or array
    let variantsData = [];
    if (typeof req.body.variants === 'string') {
      try {
        variantsData = JSON.parse(req.body.variants);
      } catch {
        variantsData = [];
      }
    } else if (Array.isArray(req.body.variants)) {
      variantsData = req.body.variants;
    }

    const normalizeUuid = (val) => (val && typeof val === 'string' && val.trim() !== '' ? val.trim() : null);

    // Coerce multipart form text values
    const rawData = {
      sku: req.body.sku?.trim().toUpperCase(),
      name: req.body.name?.trim(),
      category: req.body.category?.trim() || 'General',
      categoryId: normalizeUuid(req.body.categoryId),
      brandId: normalizeUuid(req.body.brandId),
      unitId: normalizeUuid(req.body.unitId),
      unitOfSaleId: normalizeUuid(req.body.unitOfSaleId),
      purchaseUnitId: normalizeUuid(req.body.purchaseUnitId),
      variants: variantsData,
      costPrice: req.body.costPrice !== undefined ? String(req.body.costPrice) : '0.00',
      sellingPrice: req.body.sellingPrice !== undefined ? String(req.body.sellingPrice) : '0.00',
      minStockLevel: req.body.minStockLevel !== undefined ? Number(req.body.minStockLevel) : 0,
      imageUrl: imageUrl,
    };

    const parseResult = insertProductSchema.safeParse(rawData);
    if (!parseResult.success) {
      throw new ApiError(
        400,
        'Validation Error: Invalid product information provided.',
        parseResult.error.errors
      );
    }

    const { sku } = parseResult.data;

    // Check SKU uniqueness
    const [existingProduct] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.sku, sku))
      .limit(1);

    if (existingProduct) {
      throw new ApiError(409, `Product with SKU '${sku}' already exists.`);
    }

    const [newProduct] = await db
      .insert(products)
      .values(parseResult.data)
      .returning();

    return res.status(201).json(
      new ApiResponse(201, newProduct, 'Product created successfully.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get All Products with multi-warehouse stock mapping (All Authenticated Users)
 */
export const getAllProducts = async (req, res, next) => {
  try {
    const productList = await db.query.products.findMany({
      orderBy: [desc(products.createdAt)],
      with: {
        stock: {
          with: {
            warehouse: {
              columns: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
        categoryRef: true,
        brand: true,
        unit: true,
        unitOfSale: true,
        purchaseUnit: true,
      },
    });

    return res.status(200).json(
      new ApiResponse(200, productList, 'Products retrieved successfully.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Single Product By ID
 */
export const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await db.query.products.findFirst({
      where: eq(products.id, id),
      with: {
        stock: {
          with: {
            warehouse: true,
          },
        },
        categoryRef: true,
        brand: true,
        unit: true,
        unitOfSale: true,
        purchaseUnit: true,
      },
    });

    if (!product) {
      throw new ApiError(404, 'Product not found.');
    }

    return res.status(200).json(
      new ApiResponse(200, product, 'Product retrieved successfully.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Allocate or adjust stock in a warehouse (Admin, Store Manager)
 */
export const allocateStock = async (req, res, next) => {
  try {
    const { warehouseId, productId, quantity, binLocation } = req.body;

    if (!warehouseId || !productId || quantity === undefined) {
      throw new ApiError(
        400,
        'warehouseId, productId, and quantity are required to allocate stock.'
      );
    }

    // Verify warehouse exists
    const [warehouse] = await db
      .select({ id: warehouses.id })
      .from(warehouses)
      .where(eq(warehouses.id, warehouseId))
      .limit(1);

    if (!warehouse) {
      throw new ApiError(404, 'Warehouse not found.');
    }

    // Verify product exists
    const [product] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) {
      throw new ApiError(404, 'Product not found.');
    }

    const qty = Number(quantity);
    if (isNaN(qty) || qty < 0) {
      throw new ApiError(400, 'Quantity must be a non-negative integer.');
    }

    // Check if stock row already exists for this (warehouseId, productId)
    const [existingStock] = await db
      .select()
      .from(warehouseStock)
      .where(
        and(
          eq(warehouseStock.warehouseId, warehouseId),
          eq(warehouseStock.productId, productId)
        )
      )
      .limit(1);

    let resultStock;

    if (existingStock) {
      const [updated] = await db
        .update(warehouseStock)
        .set({
          quantity: qty,
          binLocation: binLocation !== undefined ? binLocation : existingStock.binLocation,
          updatedAt: new Date(),
        })
        .where(eq(warehouseStock.id, existingStock.id))
        .returning();

      resultStock = updated;
    } else {
      const [inserted] = await db
        .insert(warehouseStock)
        .values({
          warehouseId,
          productId,
          quantity: qty,
          binLocation: binLocation || null,
        })
        .returning();

      resultStock = inserted;
    }

    return res.status(200).json(
      new ApiResponse(200, resultStock, 'Warehouse stock allocated successfully.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update Product with optional image replacement (Admin, Store Manager)
 */
export const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check existing product
    const [existingProduct] = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (!existingProduct) {
      throw new ApiError(404, 'Product not found.');
    }

    let imageUrl = req.body.imageUrl !== undefined ? req.body.imageUrl : existingProduct.imageUrl;

    // Check if a new file was uploaded
    if (req.file?.buffer) {
      const uploadResult = await uploadToCloudinary(
        req.file.buffer,
        'identity_ims/products'
      );
      imageUrl = uploadResult.secure_url;
    }

    let variantsData = undefined;
    if (req.body.variants !== undefined) {
      if (typeof req.body.variants === 'string') {
        try {
          variantsData = JSON.parse(req.body.variants);
        } catch {
          variantsData = [];
        }
      } else if (Array.isArray(req.body.variants)) {
        variantsData = req.body.variants;
      }
    }

    const normalizeUuid = (val) => (val && typeof val === 'string' && val.trim() !== '' ? val.trim() : null);

    const updatePayload = {
      ...(req.body.sku && { sku: req.body.sku.trim().toUpperCase() }),
      ...(req.body.name && { name: req.body.name.trim() }),
      ...(req.body.category !== undefined && { category: req.body.category.trim() }),
      ...(req.body.categoryId !== undefined && { categoryId: normalizeUuid(req.body.categoryId) }),
      ...(req.body.brandId !== undefined && { brandId: normalizeUuid(req.body.brandId) }),
      ...(req.body.unitId !== undefined && { unitId: normalizeUuid(req.body.unitId) }),
      ...(req.body.unitOfSaleId !== undefined && { unitOfSaleId: normalizeUuid(req.body.unitOfSaleId) }),
      ...(req.body.purchaseUnitId !== undefined && { purchaseUnitId: normalizeUuid(req.body.purchaseUnitId) }),
      ...(variantsData !== undefined && { variants: variantsData }),
      ...(req.body.costPrice !== undefined && { costPrice: String(req.body.costPrice) }),
      ...(req.body.sellingPrice !== undefined && { sellingPrice: String(req.body.sellingPrice) }),
      ...(req.body.minStockLevel !== undefined && { minStockLevel: Number(req.body.minStockLevel) }),
      ...(imageUrl !== undefined && { imageUrl }),
    };

    const parseResult = updateProductSchema.safeParse(updatePayload);
    if (!parseResult.success) {
      throw new ApiError(
        400,
        'Validation Error: Invalid update details provided.',
        parseResult.error.errors
      );
    }

    // If SKU changed, verify uniqueness
    if (updatePayload.sku && updatePayload.sku !== existingProduct.sku) {
      const [duplicate] = await db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.sku, updatePayload.sku))
        .limit(1);

      if (duplicate && duplicate.id !== id) {
        throw new ApiError(
          409,
          `Product with SKU '${updatePayload.sku}' already exists.`
        );
      }
    }

    const [updatedProduct] = await db
      .update(products)
      .set({
        ...parseResult.data,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();

    return res.status(200).json(
      new ApiResponse(200, updatedProduct, 'Product updated successfully.')
    );
  } catch (error) {
    next(error);
  }
};
