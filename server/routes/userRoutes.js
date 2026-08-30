import { Router } from 'express';
import { UserController } from '../controllers/userController.js';
import { authenticateJwt } from '../middlewares/authMiddleware.js';
import { requireRoles } from '../middlewares/roleMiddleware.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.post('/register', UserController.createUser);

router.get('/', authenticateJwt, UserController.getAllUsers);
router.post(
  '/',
  authenticateJwt,
  requireRoles([ROLES.ADMIN, ROLES.STATION_IN_CHARGE, 'STATION_HOUSE_OFFICER', ROLES.INVESTIGATING_OFFICER]),
  UserController.createUser
);
router.get('/:id', authenticateJwt, UserController.getUserById);
router.put('/:id', authenticateJwt, UserController.updateUser);
router.patch('/:id', authenticateJwt, UserController.updateUser);
router.delete(
  '/:id',
  authenticateJwt,
  requireRoles([ROLES.ADMIN, ROLES.STATION_IN_CHARGE, 'STATION_HOUSE_OFFICER']),
  UserController.deleteUser
);

export default router;
