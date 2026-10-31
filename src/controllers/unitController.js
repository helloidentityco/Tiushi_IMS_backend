import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { units } from '../db/schema.js';
import {
  insertUnitSchema,
  updateUnitSchema,
} from '../utils/validations.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';

export const createUnit = async (req, res, next) => {
  try {
    const parseResult = insertUnitSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ApiError(
        400,
        'Validation Error: Invalid unit data provided.',
        parseResult.error.errors
      );
    }

    const { name, shortName, baseUnit } = parseResult.data;

    const [newUnit] = await db
      .insert(units)
      .values({
        name: name.trim(),
        shortName: shortName.trim(),
        baseUnit: baseUnit ? baseUnit.trim() : 'None',
      })
      .returning();

    return res.status(201).json(
      new ApiResponse(201, {
        ...newUnit,
        abbreviation: newUnit.shortName,
      }, 'Unit created successfully.')
    );
  } catch (error) {
    next(error);
  }
};

export const getAllUnits = async (req, res, next) => {
  try {
    const allUnits = await db.query.units.findMany({
      orderBy: [desc(units.createdAt)],
    });

    const formatted = allUnits.map((u) => ({
      ...u,
      abbreviation: u.shortName,
    }));

    return res.status(200).json(
      new ApiResponse(200, formatted, 'Units fetched successfully.')
    );
  } catch (error) {
    next(error);
  }
};

export const updateUnit = async (req, res, next) => {
  try {
    const { id } = req.params;
    const parseResult = updateUnitSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ApiError(
        400,
        'Validation Error: Invalid unit update payload.',
        parseResult.error.errors
      );
    }

    const existing = await db.query.units.findFirst({
      where: eq(units.id, id),
    });

    if (!existing) {
      throw new ApiError(404, `Unit with ID '${id}' not found.`);
    }

    const updatePayload = {
      updatedAt: new Date(),
    };

    if (parseResult.data.name !== undefined) {
      updatePayload.name = parseResult.data.name.trim();
    }
    if (parseResult.data.shortName !== undefined) {
      updatePayload.shortName = parseResult.data.shortName.trim();
    }
    if (parseResult.data.baseUnit !== undefined) {
      updatePayload.baseUnit = parseResult.data.baseUnit ? parseResult.data.baseUnit.trim() : 'None';
    }

    const [updatedUnit] = await db
      .update(units)
      .set(updatePayload)
      .where(eq(units.id, id))
      .returning();

    return res.status(200).json(
      new ApiResponse(200, {
        ...updatedUnit,
        abbreviation: updatedUnit.shortName,
      }, 'Unit updated successfully.')
    );
  } catch (error) {
    next(error);
  }
};

export const deleteUnit = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await db.query.units.findFirst({
      where: eq(units.id, id),
    });

    if (!existing) {
      throw new ApiError(404, `Unit with ID '${id}' not found.`);
    }

    await db.delete(units).where(eq(units.id, id));

    return res.status(200).json(
      new ApiResponse(200, null, 'Unit deleted successfully.')
    );
  } catch (error) {
    next(error);
  }
};
