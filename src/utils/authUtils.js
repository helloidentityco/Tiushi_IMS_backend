import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config/env.js';

export const COOKIE_NAME = 'jwt';

/**
 * Generate a JWT token and attach it as an HttpOnly secure cookie
 * @param {import('express').Response} res
 * @param {string} userId
 * @returns {string} token
 */
export const generateTokenAndSetCookie = (res, userId) => {
  const token = jwt.sign({ id: userId }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn || '7d',
  });

  const isProduction = config.nodeEnv === 'production';

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    path: '/',
  });

  return token;
};

/**
 * Clear the JWT authentication cookie
 * @param {import('express').Response} res
 */
export const clearAuthCookie = (res) => {
  const isProduction = config.nodeEnv === 'production';

  res.cookie(COOKIE_NAME, '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    expires: new Date(0),
    path: '/',
  });
};

/**
 * Hash a plain text password
 * @param {string} password
 * @returns {Promise<string>}
 */
export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

/**
 * Compare plain text password with hashed password
 * @param {string} plainPassword
 * @param {string} hashedPassword
 * @returns {Promise<boolean>}
 */
export const comparePassword = async (plainPassword, hashedPassword) => {
  return bcrypt.compare(plainPassword, hashedPassword);
};
