import { errorResponse } from '../utils/responseHelper.js';
import { logger } from '../utils/logger.js';

export const requireRoles = (allowedRoles = []) => {
  const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return errorResponse(res, 'Access Denied: No authenticated role found in session.', null, 403);
    }

    if (!rolesArray.includes(req.user.role)) {
      logger.warn(
        'ROLE_MIDDLEWARE',
        `Access blocked for ${req.user.name} (${req.user.role}). Required one of: ${rolesArray.join(', ')}`
      );
      return errorResponse(
        res,
        `Forbidden: Role '${req.user.role}' is not authorized to perform this operation. Required: [${rolesArray.join(', ')}]`,
        null,
        403
      );
    }

    next();
  };
};
