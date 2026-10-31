import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { categories } from '../db/schema.js';
import {
  insertCategorySchema,
  updateCategorySchema,
} from '../utils/validations.js';
import { cloudinary } from '../utils/cloudinary.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';

export const createCategory = async (req, res, next) => {
  try {
    const parseResult = insertCategorySchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ApiError(
        400,
        'Validation Error: Invalid category data provided.',
        parseResult.error.errors
      );
    }

    const { name, description, logo } = parseResult.data;

    let finalLogo = logo || null;
    if (finalLogo && finalLogo.startsWith('data:image/')) {
      const uploadResult = await cloudinary.uploader.upload(finalLogo, {
        folder: 'identity_ims/categories',
        resource_type: 'image',
      });
      finalLogo = uploadResult.secure_url;
    }

    const [newCategory] = await db
      .insert(categories)
      .values({
        name: name.trim(),
        description: description ? description.trim() : null,
        logo: finalLogo,
      })
      .returning();

    return res.status(201).json(
      new ApiResponse(201, newCategory, 'Category created successfully.')
    );
  } catch (error) {
    if (error.code === '23505') {
      return next(
        new ApiError(409, `A category with name '${req.body?.name}' already exists.`)
      );
    }
    next(error);
  }
};

export const getAllCategories = async (req, res, next) => {
  try {
    const allCategories = await db.query.categories.findMany({
      orderBy: [desc(categories.createdAt)],
    });

    return res.status(200).json(
      new ApiResponse(200, allCategories, 'Categories fetched successfully.')
    );
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const parseResult = updateCategorySchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ApiError(
        400,
        'Validation Error: Invalid category update payload.',
        parseResult.error.errors
      );
    }

    const existing = await db.query.categories.findFirst({
      where: eq(categories.id, id),
    });

    if (!existing) {
      throw new ApiError(404, `Category with ID '${id}' not found.`);
    }

    const updatePayload = {
      ...parseResult.data,
      updatedAt: new Date(),
    };

    if (updatePayload.logo && updatePayload.logo.startsWith('data:image/')) {
      const uploadResult = await cloudinary.uploader.upload(updatePayload.logo, {
        folder: 'identity_ims/categories',
        resource_type: 'image',
      });
      updatePayload.logo = uploadResult.secure_url;
    }

    if (parseResult.data.name) {
      updatePayload.name = parseResult.data.name.trim();
    }

    const [updatedCategory] = await db
      .update(categories)
      .set(updatePayload)
      .where(eq(categories.id, id))
      .returning();

    return res.status(200).json(
      new ApiResponse(200, updatedCategory, 'Category updated successfully.')
    );
  } catch (error) {
    if (error.code === '23505') {
      return next(
        new ApiError(409, `A category with name '${req.body?.name}' already exists.`)
      );
    }
    next(error);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await db.query.categories.findFirst({
      where: eq(categories.id, id),
    });

    if (!existing) {
      throw new ApiError(404, `Category with ID '${id}' not found.`);
    }

    await db.delete(categories).where(eq(categories.id, id));

    return res.status(200).json(
      new ApiResponse(200, null, 'Category deleted successfully.')
    );
  } catch (error) {
    next(error);
  }
};
