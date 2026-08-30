import { Router } from 'express';
import { SearchController } from '../controllers/searchController.js';
import { authenticateJwt } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(authenticateJwt);

router.get('/', SearchController.search);

export default router;
