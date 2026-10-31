import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { warehouses } from '../db/schema.js';
import {
  insertWarehouseSchema,
  updateWarehouseSchema,
} from '../utils/validations.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';

/**
 * Create New Warehouse (Admin Only)
 */
export const createWarehouse = async (req, res, next) => {
  try {
    const parseResult = insertWarehouseSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ApiError(
        400,
        'Validation Error: Invalid warehouse details provided.',
        parseResult.error.errors
      );
    }

    const { code, name, address, capacitySqFt, managerName } = parseResult.data;
    const formattedCode = code.trim().toUpperCase();

    // Check for duplicate code
    const [existingCode] = await db
      .select({ id: warehouses.id })
      .from(warehouses)
      .where(eq(warehouses.code, formattedCode))
      .limit(1);

    if (existingCode) {
      throw new ApiError(
        409,
        `Warehouse with code '${formattedCode}' already exists.`
      );
    }

    const [newWarehouse] = await db
      .insert(warehouses)
      .values({
        code: formattedCode,
        name: name.trim(),
        address: address?.trim() || null,
        capacitySqFt: capacitySqFt ? Number(capacitySqFt) : null,
        managerName: managerName?.trim() || null,
      })
      .returning();

    return res.status(201).json(
      new ApiResponse(201, newWarehouse, 'Warehouse registered successfully.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get All Warehouses (All Authenticated Users)
 */
export const getAllWarehouses = async (req, res, next) => {
  try {
    const warehouseList = await db.query.warehouses.findMany({
      orderBy: [desc(warehouses.createdAt)],
      with: {
        stock: true,
      },
    });

    return res.status(200).json(
      new ApiResponse(200, warehouseList, 'Warehouses retrieved successfully.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Single Warehouse By ID
 */
export const getWarehouseById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const warehouse = await db.query.warehouses.findFirst({
      where: eq(warehouses.id, id),
      with: {
        stock: true,
      },
    });

    if (!warehouse) {
      throw new ApiError(404, 'Warehouse not found.');
    }

    return res.status(200).json(
      new ApiResponse(200, warehouse, 'Warehouse retrieved successfully.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update Warehouse (Admin Only)
 * Note: Deletion is strictly omitted to preserve relational inventory integrity.
 */
export const updateWarehouse = async (req, res, next) => {
  try {
    const { id } = req.params;

    const parseResult = updateWarehouseSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ApiError(
        400,
        'Validation Error: Invalid update data provided.',
        parseResult.error.errors
      );
    }

    // Verify warehouse exists
    const [existingWarehouse] = await db
      .select()
      .from(warehouses)
      .where(eq(warehouses.id, id))
      .limit(1);

    if (!existingWarehouse) {
      throw new ApiError(404, 'Warehouse not found.');
    }

    const updateData = { ...parseResult.data };

    if (updateData.code) {
      updateData.code = updateData.code.trim().toUpperCase();
      // Ensure code is unique if changed
      const [duplicate] = await db
        .select({ id: warehouses.id })
        .from(warehouses)
        .where(eq(warehouses.code, updateData.code))
        .limit(1);

      if (duplicate && duplicate.id !== id) {
        throw new ApiError(
          409,
          `Warehouse with code '${updateData.code}' already exists.`
        );
      }
    }

    if (updateData.capacitySqFt !== undefined && updateData.capacitySqFt !== null) {
      updateData.capacitySqFt = Number(updateData.capacitySqFt);
    }

    const [updatedWarehouse] = await db
      .update(warehouses)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(warehouses.id, id))
      .returning();

    return res.status(200).json(
      new ApiResponse(200, updatedWarehouse, 'Warehouse updated successfully.')
    );
  } catch (error) {
    next(error);
  }
};
