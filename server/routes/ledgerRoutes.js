import { Router } from 'express';
import { LedgerController } from '../controllers/ledgerController.js';
import { authenticateJwt } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(authenticateJwt);

router.get('/fabric/network-status', LedgerController.getFabricNetworkStatus);
router.get('/fabric/blocks', LedgerController.getFabricBlocks);
router.get('/fabric/history/:docId', LedgerController.getFabricHistoryForKey);
router.post('/fabric/invoke', LedgerController.invokeChaincode);
router.post('/fabric/query', LedgerController.queryChaincode);
router.get('/overview', LedgerController.getLedgerOverview);
router.get('/metrics', LedgerController.getSystemMetrics);
router.get('/consensus/:docId', LedgerController.verifyConsensus);
router.post('/simulate-tamper/node/:docId', LedgerController.simulateNodeTamper);
router.post('/simulate-tamper/file/:docId', LedgerController.simulateFileTamper);
router.post('/heal/:docId', LedgerController.healNodeIntegrity);

export default router;
