import jwt from 'jsonwebtoken';
import { JWT_CONFIG } from '../config/jwt.config.js';
import { errorResponse } from '../utils/responseHelper.js';
import { logger } from '../utils/logger.js';

export const authenticateJwt = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'Authentication required: Missing or malformed Bearer token.', null, 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_CONFIG.SECRET);

    req.user = decoded;
    next();
  } catch (err) {
    logger.warn('AUTH_MIDDLEWARE', 'JWT validation failed', err.message);
    return errorResponse(res, 'Unauthorized: Invalid, tampered or expired token.', err.message, 401);
  }
};
