import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { variants } from '../db/schema.js';
import {
  insertVariantSchema,
  updateVariantSchema,
} from '../utils/validations.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';

export const createVariant = async (req, res, next) => {
  try {
    const parseResult = insertVariantSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ApiError(
        400,
        'Validation Error: Invalid variant data provided.',
        parseResult.error.errors
      );
    }

    const { name, options } = parseResult.data;

    const [newVariant] = await db
      .insert(variants)
      .values({
        name: name.trim(),
        options: options || [],
      })
      .returning();

    return res.status(201).json(
      new ApiResponse(201, {
        ...newVariant,
        values: newVariant.options,
      }, 'Variant created successfully.')
    );
  } catch (error) {
    if (error.code === '23505') {
      return next(
        new ApiError(409, `A variant attribute with name '${req.body?.name}' already exists.`)
      );
    }
    next(error);
  }
};

export const getAllVariants = async (req, res, next) => {
  try {
    const allVariants = await db.query.variants.findMany({
      orderBy: [desc(variants.createdAt)],
    });

    const formatted = allVariants.map((v) => ({
      ...v,
      values: v.options,
    }));

    return res.status(200).json(
      new ApiResponse(200, formatted, 'Variants fetched successfully.')
    );
  } catch (error) {
    next(error);
  }
};

export const updateVariant = async (req, res, next) => {
  try {
    const { id } = req.params;
    const parseResult = updateVariantSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ApiError(
        400,
        'Validation Error: Invalid variant update payload.',
        parseResult.error.errors
      );
    }

    const existing = await db.query.variants.findFirst({
      where: eq(variants.id, id),
    });

    if (!existing) {
      throw new ApiError(404, `Variant attribute with ID '${id}' not found.`);
    }

    const updatePayload = {
      updatedAt: new Date(),
    };

    if (parseResult.data.name !== undefined) {
      updatePayload.name = parseResult.data.name.trim();
    }
    if (parseResult.data.options !== undefined) {
      updatePayload.options = parseResult.data.options;
    }

    const [updatedVariant] = await db
      .update(variants)
      .set(updatePayload)
      .where(eq(variants.id, id))
      .returning();

    return res.status(200).json(
      new ApiResponse(200, {
        ...updatedVariant,
        values: updatedVariant.options,
      }, 'Variant updated successfully.')
    );
  } catch (error) {
    if (error.code === '23505') {
      return next(
        new ApiError(409, `A variant attribute with name '${req.body?.name}' already exists.`)
      );
    }
    next(error);
  }
};

export const deleteVariant = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await db.query.variants.findFirst({
      where: eq(variants.id, id),
    });

    if (!existing) {
      throw new ApiError(404, `Variant attribute with ID '${id}' not found.`);
    }

    await db.delete(variants).where(eq(variants.id, id));

    return res.status(200).json(
      new ApiResponse(200, null, 'Variant deleted successfully.')
    );
  } catch (error) {
    next(error);
  }
};
