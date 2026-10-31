import { ApiError } from '../utils/ApiError.js';
import { config } from '../config/env.js';

/**
 * Global Error Handling Middleware
 * Catches errors from synchronous code and next(err) and formats a uniform JSON response.
 */
export const errorHandler = (err, req, res, next) => {
  let error = err;

  // If error is not an instance of custom ApiError, standardize it
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal Server Error';
    error = new ApiError(statusCode, message, error?.errors || [], err.stack);
  }

  const response = {
    success: false,
    statusCode: error.statusCode,
    message: error.message,
    errors: error.errors || [],
    ...(config.nodeEnv === 'development' && { stack: error.stack }),
  };

  return res.status(error.statusCode).json(response);
};
