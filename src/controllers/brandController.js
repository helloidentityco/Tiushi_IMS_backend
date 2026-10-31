import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { brands } from '../db/schema.js';
import {
  insertBrandSchema,
  updateBrandSchema,
} from '../utils/validations.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';

export const createBrand = async (req, res, next) => {
  try {
    const parseResult = insertBrandSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ApiError(
        400,
        'Validation Error: Invalid brand data provided.',
        parseResult.error.errors
      );
    }

    const { name, description, logo } = parseResult.data;

    const [newBrand] = await db
      .insert(brands)
      .values({
        name: name.trim(),
        description: description ? description.trim() : null,
        logo: logo || null,
      })
      .returning();

    return res.status(201).json(
      new ApiResponse(201, newBrand, 'Brand created successfully.')
    );
  } catch (error) {
    if (error.code === '23505') {
      return next(
        new ApiError(409, `A brand with name '${req.body?.name}' already exists.`)
      );
    }
    next(error);
  }
};

export const getAllBrands = async (req, res, next) => {
  try {
    const allBrands = await db.query.brands.findMany({
      orderBy: [desc(brands.createdAt)],
    });

    return res.status(200).json(
      new ApiResponse(200, allBrands, 'Brands fetched successfully.')
    );
  } catch (error) {
    next(error);
  }
};

export const updateBrand = async (req, res, next) => {
  try {
    const { id } = req.params;
    const parseResult = updateBrandSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ApiError(
        400,
        'Validation Error: Invalid brand update payload.',
        parseResult.error.errors
      );
    }

    const existing = await db.query.brands.findFirst({
      where: eq(brands.id, id),
    });

    if (!existing) {
      throw new ApiError(404, `Brand with ID '${id}' not found.`);
    }

    const updatePayload = {
      ...parseResult.data,
      updatedAt: new Date(),
    };

    if (parseResult.data.name) {
      updatePayload.name = parseResult.data.name.trim();
    }

    const [updatedBrand] = await db
      .update(brands)
      .set(updatePayload)
      .where(eq(brands.id, id))
      .returning();

    return res.status(200).json(
      new ApiResponse(200, updatedBrand, 'Brand updated successfully.')
    );
  } catch (error) {
    if (error.code === '23505') {
      return next(
        new ApiError(409, `A brand with name '${req.body?.name}' already exists.`)
      );
    }
    next(error);
  }
};

export const deleteBrand = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await db.query.brands.findFirst({
      where: eq(brands.id, id),
    });

    if (!existing) {
      throw new ApiError(404, `Brand with ID '${id}' not found.`);
    }

    await db.delete(brands).where(eq(brands.id, id));

    return res.status(200).json(
      new ApiResponse(200, null, 'Brand deleted successfully.')
    );
  } catch (error) {
    next(error);
  }
};
