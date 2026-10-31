import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { hashPassword } from '../utils/authUtils.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';

// Helper to normalize role strings from frontend to Postgres enum
const mapRole = (role) => {
  if (!role) return 'Cashier';
  const lower = role.toLowerCase().trim();
  if (lower === 'admin') return 'Admin';
  if (lower === 'manager' || lower === 'store manager') return 'Store Manager';
  if (lower === 'warehouse' || lower === 'warehouse staff') return 'Warehouse Staff';
  if (lower === 'cashier') return 'Cashier';
  return 'Cashier';
};

// Helper to normalize status strings from frontend to Postgres enum
const mapStatus = (status) => {
  if (!status) return 'active';
  const lower = status.toLowerCase().trim();
  return lower === 'inactive' ? 'inactive' : 'active';
};

/**
 * Get All Users (Protected, Admin & Managers)
 * Returns all registered accounts excluding password hashes
 */
export const getAllUsers = async (req, res, next) => {
  try {
    const userList = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    return res.status(200).json(
      new ApiResponse(200, userList, 'Users retrieved successfully.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Create New User (Protected, Admin Only)
 * Hashes password with bcrypt securely on the backend
 */
export const createUser = async (req, res, next) => {
  try {
    const { email, password, name, role, status } = req.body;

    if (!email || !password) {
      throw new ApiError(400, 'Validation Error: Email and Password are required.');
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (cleanPassword.length < 4) {
      throw new ApiError(400, 'Password must be at least 4 characters long.');
    }

    // Check email uniqueness
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, cleanEmail))
      .limit(1);

    if (existing) {
      throw new ApiError(409, `A user account with email '${cleanEmail}' already exists.`);
    }

    // Secure bcrypt hash on the backend
    const hashedPassword = await hashPassword(cleanPassword);
    const normalizedRole = mapRole(role);
    const normalizedStatus = mapStatus(status);
    const cleanName = (name || cleanEmail.split('@')[0]).trim();

    const [newUser] = await db
      .insert(users)
      .values({
        name: cleanName,
        email: cleanEmail,
        password: hashedPassword,
        role: normalizedRole,
        status: normalizedStatus,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    return res.status(201).json(
      new ApiResponse(201, newUser, 'User created successfully.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Update User (Protected, Admin Only)
 * Allows updating name, role, status, and/or resetting password
 */
export const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, role, status, password } = req.body;

    // Check existing user
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!existing) {
      throw new ApiError(404, 'User not found.');
    }

    const updateData = {
      ...(name !== undefined && { name: name.trim() }),
      ...(role !== undefined && { role: mapRole(role) }),
      ...(status !== undefined && { status: mapStatus(status) }),
      updatedAt: new Date(),
    };

    if (password && password.trim()) {
      if (password.trim().length < 4) {
        throw new ApiError(400, 'Password must be at least 4 characters long.');
      }
      updateData.password = await hashPassword(password.trim());
    }

    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    return res.status(200).json(
      new ApiResponse(200, updatedUser, 'User updated successfully.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Safe Delete User (Protected, Admin Only)
 * Safeguard: Authenticated user CANNOT delete themselves
 */
export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Fetch target user to be deleted
    const [targetUser] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!targetUser) {
      throw new ApiError(404, 'User not found.');
    }

    // Crucial safeguard: check if user is attempting to delete their own account
    if (
      req.user?.id === targetUser.id ||
      req.user?.email?.toLowerCase() === targetUser.email.toLowerCase()
    ) {
      throw new ApiError(
        403,
        'Security Restriction: You cannot delete your own currently active account.'
      );
    }

    // Delete user from database
    await db.delete(users).where(eq(users.id, id));

    return res.status(200).json(
      new ApiResponse(200, { id }, 'User account deleted successfully.')
    );
  } catch (error) {
    next(error);
  }
};
