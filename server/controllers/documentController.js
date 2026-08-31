import { DocumentService } from '../services/documentService.js';
import { LedgerCoordinatorService } from '../services/ledgerCoordinatorService.js';
import { AuditService } from '../services/auditService.js';
import { OcrEntityService, pageImageCache } from '../services/ocrEntityService.js';
import { successResponse, errorResponse } from '../utils/responseHelper.js';

export class DocumentController {
  static async uploadDocument(req, res) {
    try {
      const file = req.file;
      const { caseId, title, documentType, rawTextContent } = req.body;

      if (!caseId) {
        return errorResponse(res, 'Target Case ID is required to bind evidence.', null, 400);
      }

      if (!file && !rawTextContent) {
        return errorResponse(res, 'A file or raw text content is required for document upload.', null, 400);
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
      const statusCode = err.message.includes('Corrupted') || err.message.includes('empty') || err.message.includes('Invalid') || err.message.includes('not found') ? 400 : 500;
      return errorResponse(res, err.message, null, statusCode);
    }
  }

  static async ocrPreview(req, res) {
    try {
      const file = req.file;
      const { rawTextContent } = req.body;

      if (!file && !rawTextContent) {
        return errorResponse(res, 'A PDF or Image file (or raw text) is required for OCR processing.', null, 400);
      }

      const fileBuffer = file ? file.buffer : Buffer.from(rawTextContent, 'utf8');
      const originalName = file ? file.originalname : 'document.txt';
      const mimeType = file ? file.mimetype : 'text/plain';

      const ocrResult = await OcrEntityService.processDocumentOcr(
        fileBuffer,
        mimeType,
        originalName,
        { includePageImages: true }
      );

      return successResponse(res, 'OCR extraction and page rendering complete', ocrResult, 200);
    } catch (err) {
      console.error('OCR_PREVIEW_ERROR:', err);
      const statusCode = err.message.includes('Invalid') || err.message.includes('empty') || err.message.includes('Corrupted') || err.message.includes('Unsupported') ? 400 : 500;
      return errorResponse(res, err.message, null, statusCode);
    }
  }

  static async getPageImage(req, res) {
    try {
      const docId = req.params.docId || req.query.docId;
      const pageNumber = req.params.pageNumber || req.query.page || req.query.pageNumber;
      const { key } = req.query;

      const cacheKey = key || (docId && pageNumber ? `${docId}_page_${pageNumber}` : null);
      const cached = cacheKey ? pageImageCache.get(cacheKey) : null;

      if (cached && cached.buffer) {
        res.setHeader('Content-Type', cached.mimeType || 'image/png');
        res.setHeader('Content-Disposition', 'inline; filename="page.png"');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.send(cached.buffer);
      }

      if (docId) {
        try {
          const doc = await DocumentService.getDocumentById(docId);
          const pageIdx = (parseInt(pageNumber, 10) || 1) - 1;
          const page = doc.pages && doc.pages[pageIdx];
          if (page && page.imageBase64) {
            const base64Data = page.imageBase64.replace(/^data:image\/\w+;base64,/, '');
            const imgBuffer = Buffer.from(base64Data, 'base64');
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Content-Disposition', 'inline; filename="page.png"');
            return res.send(imgBuffer);
          }
        } catch {
          // Document not found in store, continue to 404
        }
      }

      return res.status(404).json({ error: 'Page image not found.' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
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
