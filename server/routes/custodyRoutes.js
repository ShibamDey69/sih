import { Router } from 'express';
import { CustodyController } from '../controllers/custodyController.js';
import { authenticateJwt } from '../middlewares/authMiddleware.js';
import { requireRoles } from '../middlewares/roleMiddleware.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.use(authenticateJwt);

router.post(
  '/transfer',
  requireRoles([
    ROLES.INVESTIGATING_OFFICER,
    ROLES.STATION_IN_CHARGE,
    ROLES.PROSECUTOR,
    ROLES.COURT_CLERK_JUDGE,
  ]),
  CustodyController.transferCustody
);

router.get('/:docId/trail', CustodyController.getCustodyTrail);
router.get('/audit/logs', CustodyController.getAuditLogs);

export default router;
