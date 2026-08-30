import { DocumentService } from '../services/documentService.js';
import { LedgerCoordinatorService } from '../services/ledgerCoordinatorService.js';
import { AuditService } from '../services/auditService.js';
import { successResponse, errorResponse } from '../utils/responseHelper.js';

export class DocumentController {
  static async uploadDocument(req, res) {
    try {
      const file = req.file;
      const { caseId, title, documentType, rawTextContent } = req.body;

      if (!caseId) {
        return errorResponse(res, 'Target Case ID is required to bind evidence.', null, 400);
      }

      const fileBuffer = file ? file.buffer : (rawTextContent ? Buffer.from(rawTextContent, 'utf8') : null);
      const originalName = file ? file.originalname : `${title || 'document'}.txt`;
      const mimeType = file ? file.mimetype : 'text/plain';

      const result = await DocumentService.uploadAndProcessDocument(
        {
          caseId,
          title: title || originalName,
          documentType,
          fileBuffer,
          originalName,
          mimeType,
          rawTextContent,
        },
        req.user
      );

      return successResponse(res, 'Document uploaded, OCR parsed, and broadcasted to 3-Node Ledger', result, 201);
    } catch (err) {
      console.error('UPLOAD_DOC_FATAL_ERROR:', err);
      return errorResponse(res, err.message, null, 500);
    }
  }

  static async getAllDocuments(req, res) {
    try {
      const filters = {
        caseId: req.query.caseId,
        status: req.query.status,
        documentType: req.query.documentType,
      };
      const docs = await DocumentService.getAllDocuments(filters);
      return successResponse(res, 'Evidence documents retrieved', docs);
    } catch (err) {
      return errorResponse(res, err.message, null, 500);
    }
  }

  static async getDocumentById(req, res) {
    try {
      const { docId } = req.params;
      const doc = await DocumentService.getDocumentById(docId);
      return successResponse(res, 'Document details retrieved', doc);
    } catch (err) {
      return errorResponse(res, err.message, null, 404);
    }
  }

  static async verifyDocument(req, res) {
    try {
      const { docId } = req.params;
      const verification = await LedgerCoordinatorService.verifyConsensus(docId);
      return successResponse(res, '2-of-3 Consensus verification complete', verification);
    } catch (err) {
      return errorResponse(res, err.message, null, 500);
    }
  }

  static async getCertificate(req, res) {
    try {
      const { docId } = req.params;
      const cert = await AuditService.generateVerificationCertificate(docId);
      return successResponse(res, 'Evidentiary Certificate generated', cert);
    } catch (err) {
      return errorResponse(res, err.message, null, 500);
    }
  }

  static async toggleFreeze(req, res) {
    try {
      const { docId } = req.params;
      const { isFrozen, reason } = req.body;
      const doc = await DocumentService.setDocumentFrozenState(docId, !!isFrozen, reason);
      return successResponse(res, `Document freeze state set to ${isFrozen}`, doc);
    } catch (err) {
      return errorResponse(res, err.message, null, 400);
    }
  }
}
