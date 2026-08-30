import { Router } from 'express';
import { CaseController } from '../controllers/caseController.js';
import { authenticateJwt } from '../middlewares/authMiddleware.js';
import { requireRoles } from '../middlewares/roleMiddleware.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.use(authenticateJwt);

router.get('/', CaseController.getAllCases);
router.get('/:caseId', CaseController.getCaseById);

router.post(
  '/',
  requireRoles([ROLES.INVESTIGATING_OFFICER, ROLES.STATION_IN_CHARGE]),
  CaseController.createCase
);

router.patch(
  '/:caseId/status',
  requireRoles([ROLES.STATION_IN_CHARGE, ROLES.PROSECUTOR, ROLES.COURT_CLERK_JUDGE]),
  CaseController.updateCaseStatus
);

export default router;
