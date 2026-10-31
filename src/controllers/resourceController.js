import { eq, desc, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { resources, warehouseResourceStock, warehouses } from '../db/schema.js';
import {
  insertResourceSchema,
  updateResourceSchema,
  consumeResourceStockSchema,
} from '../utils/validations.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';

/**
 * Create Resource (Admin, Store Manager)
 */
export const createResource = async (req, res, next) => {
  try {
    const rawData = {
      code: req.body.code?.trim().toUpperCase(),
      name: req.body.name?.trim(),
      category: req.body.category?.trim() || 'Raw Materials',
      costPrice: req.body.costPrice !== undefined ? String(req.body.costPrice) : '0.00',
      unitOfMeasure: req.body.unitOfMeasure?.trim() || 'units',
      minStockLevel: req.body.minStockLevel !== undefined ? Number(req.body.minStockLevel) : 0,
      imageUrl: req.body.imageUrl || null,
    };

    const parseResult = insertResourceSchema.safeParse(rawData);
    if (!parseResult.success) {
      throw new ApiError(
        400,
        'Validation Error: Invalid resource details provided.',
        parseResult.error.errors
      );
    }

    const { code } = parseResult.data;

    // Check code uniqueness
    const [existingResource] = await db
      .select({ id: resources.id })
      .from(resources)
      .where(eq(resources.code, code))
      .limit(1);

    if (existingResource) {
      throw new ApiError(409, `Resource with code '${code}' already exists.`);
    }

    const [newResource] = await db
      .insert(resources)
      .values(parseResult.data)
      .returning();

    // Optionally handle initial stock allocation if warehouseId and quantity provided
    if (req.body.warehouseId && req.body.initialStock !== undefined) {
      const initialQty = Math.max(0, parseInt(req.body.initialStock, 10) || 0);
      if (initialQty > 0) {
        await db.insert(warehouseResourceStock).values({
          warehouseId: req.body.warehouseId,
          resourceId: newResource.id,
          quantity: initialQty,
          binLocation: req.body.binLocation || 'Receiving Dock',
        });
      }
    }

    return res.status(201).json(
      new ApiResponse(201, newResource, 'Resource created successfully.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get All Resources with nested multi-warehouse stock mapping
 * (All Authenticated Users)
 */
export const getAllResources = async (req, res, next) => {
  try {
    const resourceList = await db.query.resources.findMany({
      orderBy: [desc(resources.createdAt)],
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
      },
    });

    return res.status(200).json(
      new ApiResponse(200, resourceList, 'Resources retrieved successfully.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Single Resource by ID
 */
export const getResourceById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const resource = await db.query.resources.findFirst({
      where: eq(resources.id, id),
      with: {
        stock: {
          with: {
            warehouse: true,
          },
        },
      },
    });

    if (!resource) {
      throw new ApiError(404, 'Resource not found.');
    }

    return res.status(200).json(
      new ApiResponse(200, resource, 'Resource retrieved successfully.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update Resource (Admin, Store Manager)
 */
export const updateResource = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify resource exists
    const [existingResource] = await db
      .select()
      .from(resources)
      .where(eq(resources.id, id))
      .limit(1);

    if (!existingResource) {
      throw new ApiError(404, 'Resource not found.');
    }

    const rawData = {
      ...(req.body.code ? { code: req.body.code.trim().toUpperCase() } : {}),
      ...(req.body.name ? { name: req.body.name.trim() } : {}),
      ...(req.body.category !== undefined ? { category: req.body.category.trim() } : {}),
      ...(req.body.costPrice !== undefined ? { costPrice: String(req.body.costPrice) } : {}),
      ...(req.body.unitOfMeasure !== undefined ? { unitOfMeasure: req.body.unitOfMeasure.trim() } : {}),
      ...(req.body.minStockLevel !== undefined ? { minStockLevel: Number(req.body.minStockLevel) } : {}),
      ...(req.body.imageUrl !== undefined ? { imageUrl: req.body.imageUrl } : {}),
    };

    const parseResult = updateResourceSchema.safeParse(rawData);
    if (!parseResult.success) {
      throw new ApiError(
        400,
        'Validation Error: Invalid update payload provided.',
        parseResult.error.errors
      );
    }

    // If code is being changed, verify uniqueness
    if (parseResult.data.code && parseResult.data.code !== existingResource.code) {
      const [duplicate] = await db
        .select({ id: resources.id })
        .from(resources)
        .where(eq(resources.code, parseResult.data.code))
        .limit(1);

      if (duplicate) {
        throw new ApiError(
          409,
          `Resource with code '${parseResult.data.code}' already exists.`
        );
      }
    }

    const [updatedResource] = await db
      .update(resources)
      .set({
        ...parseResult.data,
        updatedAt: new Date(),
      })
      .where(eq(resources.id, id))
      .returning();

    return res.status(200).json(
      new ApiResponse(200, updatedResource, 'Resource updated successfully.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Allocate or adjust resource stock in a warehouse depot (Admin, Store Manager)
 */
export const allocateResourceStock = async (req, res, next) => {
  try {
    const { warehouseId, resourceId, quantity, binLocation } = req.body;

    if (!warehouseId || !resourceId || quantity === undefined) {
      throw new ApiError(
        400,
        'warehouseId, resourceId, and quantity are required to allocate stock.'
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

    // Verify resource exists
    const [resource] = await db
      .select({ id: resources.id })
      .from(resources)
      .where(eq(resources.id, resourceId))
      .limit(1);

    if (!resource) {
      throw new ApiError(404, 'Resource not found.');
    }

    const qty = Math.max(0, parseInt(quantity, 10));

    // Check existing stock allocation
    const [existingStock] = await db
      .select()
      .from(warehouseResourceStock)
      .where(
        and(
          eq(warehouseResourceStock.warehouseId, warehouseId),
          eq(warehouseResourceStock.resourceId, resourceId)
        )
      )
      .limit(1);

    let resultStock;

    if (existingStock) {
      const [updated] = await db
        .update(warehouseResourceStock)
        .set({
          quantity: qty,
          binLocation: binLocation !== undefined ? binLocation : existingStock.binLocation,
          updatedAt: new Date(),
        })
        .where(eq(warehouseResourceStock.id, existingStock.id))
        .returning();

      resultStock = updated;
    } else {
      const [inserted] = await db
        .insert(warehouseResourceStock)
        .values({
          warehouseId,
          resourceId,
          quantity: qty,
          binLocation: binLocation || null,
        })
        .returning();

      resultStock = inserted;
    }

    return res.status(200).json(
      new ApiResponse(200, resultStock, 'Warehouse resource stock allocated successfully.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Log resource consumption for manufacturing (deducts from warehouse stock)
 */
export const consumeResourceStock = async (req, res, next) => {
  try {
    const parseResult = consumeResourceStockSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ApiError(
        400,
        'Validation Error: Invalid consumption details provided.',
        parseResult.error.errors
      );
    }

    const { resourceId, warehouseId, quantityUsed, notes } = parseResult.data;

    // Verify warehouse exists
    const [warehouse] = await db
      .select({ id: warehouses.id, name: warehouses.name })
      .from(warehouses)
      .where(eq(warehouses.id, warehouseId))
      .limit(1);

    if (!warehouse) {
      throw new ApiError(404, 'Warehouse not found.');
    }

    // Verify resource exists
    const [resource] = await db
      .select({ id: resources.id, name: resources.name, code: resources.code })
      .from(resources)
      .where(eq(resources.id, resourceId))
      .limit(1);

    if (!resource) {
      throw new ApiError(404, 'Resource not found.');
    }

    // Query warehouse_resource_stock
    const [stockRecord] = await db
      .select()
      .from(warehouseResourceStock)
      .where(
        and(
          eq(warehouseResourceStock.warehouseId, warehouseId),
          eq(warehouseResourceStock.resourceId, resourceId)
        )
      )
      .limit(1);

    const currentQty = stockRecord ? stockRecord.quantity : 0;

    if (currentQty < quantityUsed) {
      throw new ApiError(
        400,
        `Insufficient resource stock. Available in ${warehouse.name}: ${currentQty}, requested: ${quantityUsed}.`
      );
    }

    const newQty = currentQty - quantityUsed;

    const [updatedStock] = await db
      .update(warehouseResourceStock)
      .set({
        quantity: newQty,
        updatedAt: new Date(),
      })
      .where(eq(warehouseResourceStock.id, stockRecord.id))
      .returning();

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          ...updatedStock,
          resourceName: resource.name,
          warehouseName: warehouse.name,
          quantityUsed,
          remainingQuantity: newQty,
          notes: notes || null,
        },
        `Successfully consumed ${quantityUsed} units of ${resource.name} from ${warehouse.name}.`
      )
    );
  } catch (error) {
    next(error);
  }
};
