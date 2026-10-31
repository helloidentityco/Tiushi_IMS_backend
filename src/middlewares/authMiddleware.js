import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { config } from '../config/env.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { ApiError } from '../utils/ApiError.js';
import { COOKIE_NAME } from '../utils/authUtils.js';

/**
 * Protect middleware: Verifies HttpOnly JWT cookie (or Bearer auth header fallback)
 * and attaches authenticated user record to req.user (excluding password)
 */
export const protect = async (req, res, next) => {
  try {
    let token = req.cookies?.[COOKIE_NAME];

    // Optional Bearer header fallback for API testing (Postman, mobile, curl)
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new ApiError(401, 'Unauthorized: Authentication token is missing. Please log in.');
    }

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new ApiError(401, 'Unauthorized: Your session has expired. Please log in again.');
      }
      throw new ApiError(401, 'Unauthorized: Invalid authentication token.');
    }

    if (!decoded?.id) {
      throw new ApiError(401, 'Unauthorized: Malformed token payload.');
    }

    // Fetch user without password
    const [user] = await db
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
      .where(eq(users.id, decoded.id))
      .limit(1);

    if (!user) {
      throw new ApiError(401, 'Unauthorized: User account no longer exists.');
    }

    if (user.status === 'inactive') {
      throw new ApiError(403, 'Forbidden: This user account has been deactivated.');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * RBAC Authorization Middleware
 * Verifies if the authenticated user's role is in the allowed roles list
 * @param  {...string} allowedRoles
 */
export const authorizeRoles = (...allowedRoles) => {
  const roles = allowedRoles.flat();
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Unauthorized: Authentication required.'));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(
          403,
          `Forbidden: Role '${req.user.role}' is not authorized to access this resource.`
        )
      );
    }

    next();
  };
};
