import { errorResponse } from '../utils/responseHelper.js';
import { logger } from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
  logger.error('EXPRESS_SERVER', `Unhandled exception on ${req.method} ${req.originalUrl}:`, err);
  const status = err.statusCode || 500;
  const message = err.message || 'Internal Server Error occurred.';
  return errorResponse(res, message, err, status);
};
