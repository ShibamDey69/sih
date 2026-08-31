import { Router } from 'express';
import { DocumentController } from '../controllers/documentController.js';
import { authenticateJwt } from '../middlewares/authMiddleware.js';
import { requireRoles } from '../middlewares/roleMiddleware.js';
import { upload } from '../middlewares/uploadMiddleware.js';
import { ROLES } from '../config/constants.js';

const router = Router();

// Public / Playground OCR pipeline testing endpoint
router.post('/ocr-preview', upload.single('file'), DocumentController.ocrPreview);
router.post('/ocr-process', upload.single('file'), DocumentController.ocrPreview);

// Public Direct Page Image Viewer (opens in browser directly)
router.get('/page-image', DocumentController.getPageImage);
router.get('/:docId/page/:pageNumber/image', DocumentController.getPageImage);

router.use(authenticateJwt);

router.get('/', DocumentController.getAllDocuments);
router.get('/:docId', DocumentController.getDocumentById);

router.post(
  '/upload',
  requireRoles([ROLES.INVESTIGATING_OFFICER, ROLES.STATION_IN_CHARGE]),
  upload.single('file'),
  DocumentController.uploadDocument
);

router.post(
  '/upload-and-verify',
  requireRoles([ROLES.INVESTIGATING_OFFICER, ROLES.STATION_IN_CHARGE]),
  upload.single('file'),
  DocumentController.uploadDocument
);

router.get('/:docId/verify', DocumentController.verifyDocument);
router.get('/:docId/certificate', DocumentController.getCertificate);
router.get('/:docId/certificate-65b', DocumentController.getCertificate);

router.patch(
  '/:docId/freeze',
  requireRoles([ROLES.STATION_IN_CHARGE, ROLES.COURT_CLERK_JUDGE]),
  DocumentController.toggleFreeze
);

export default router;
