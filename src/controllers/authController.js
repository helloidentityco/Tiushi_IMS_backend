import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { loginUserSchema } from '../utils/validations.js';
import {
  generateTokenAndSetCookie,
  clearAuthCookie,
  hashPassword,
  comparePassword,
} from '../utils/authUtils.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';

/**
 * Sign In / Login Controller
 * Authenticates user credentials, sets HttpOnly JWT cookie, and returns user details
 */
export const login = async (req, res, next) => {
  try {
    const parseResult = loginUserSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ApiError(
        400,
        'Validation Error: Please provide valid credentials.',
        parseResult.error.errors
      );
    }

    const { email, password } = parseResult.data;
    const cleanEmail = email.toLowerCase().trim();

    // Query user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, cleanEmail))
      .limit(1);

    if (!user) {
      throw new ApiError(401, 'Invalid email or password.');
    }

    // Check account active status
    if (user.status === 'inactive') {
      throw new ApiError(403, 'Account is inactive. Please contact an administrator.');
    }

    // Verify password hash
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      throw new ApiError(401, 'Invalid email or password.');
    }

    // Issue JWT in HttpOnly cookie
    generateTokenAndSetCookie(res, user.id);

    // Omit sensitive password hash from response
    const { password: _, ...userWithoutPassword } = user;

    return res.status(200).json(
      new ApiResponse(200, userWithoutPassword, 'Authentication successful.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Sign Out / Logout Controller
 * Clears HttpOnly JWT cookie
 */
export const logout = async (req, res, next) => {
  try {
    clearAuthCookie(res);
    return res.status(200).json(
      new ApiResponse(200, null, 'User signed out successfully.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Current User Profile Controller
 * Returns details of the currently authenticated user
 */
export const getMe = async (req, res, next) => {
  try {
    return res.status(200).json(
      new ApiResponse(200, req.user, 'Current user profile retrieved successfully.')
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Seed Initial Admin Controller
 * Checks if users exist in the database; if not, hashes password and creates admin@mail.com
 */
export const seedInitialAdmin = async (req, res, next) => {
  try {
    const existingUsers = await db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users);

    const adminUser = existingUsers.find((u) => u.email === 'admin@mail.com');

    if (adminUser) {
      return res.status(200).json(
        new ApiResponse(200, adminUser, 'Admin account already exists in database.')
      );
    }

    // Hash default initial password
    const hashedPassword = await hashPassword('12345');

    const [newAdmin] = await db
      .insert(users)
      .values({
        email: 'admin@mail.com',
        password: hashedPassword,
        role: 'Admin',
        status: 'active',
      })
      .returning({
        id: users.id,
        email: users.email,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
      });

    return res.status(201).json(
      new ApiResponse(
        201,
        newAdmin,
        'Initial administrator account successfully seeded (admin@mail.com / 12345).'
      )
    );
  } catch (error) {
    next(error);
  }
};
