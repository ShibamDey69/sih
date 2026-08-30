import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';
import { authenticateJwt } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/login', AuthController.login);
router.post('/switch-persona/:role', AuthController.quickLoginAsRole);

router.get('/me', authenticateJwt, AuthController.getMe);
router.get('/actors', authenticateJwt, AuthController.getAllActors);

export default router;
