import { HashService } from './hashService.js';
import { OcrEntityService } from './ocrEntityService.js';
import { LedgerCoordinatorService } from './ledgerCoordinatorService.js';
import { DOCUMENT_STATUS } from '../config/constants.js';
import { dbStore } from '../prisma/client.js';
import { initialSeedData } from '../prisma/seed.js';
import { logger } from '../utils/logger.js';

export class DocumentService {
  static _ensureInit() {
    if (!dbStore.initialized) {
      dbStore.initSeed(initialSeedData);
    }
  }

  static async uploadAndProcessDocument(fileData, user) {
    this._ensureInit();

    const {
      caseId,
      title,
      documentType,
      fileBuffer,
      originalName,
      mimeType,
      rawTextContent,
    } = fileData;

    logger.info('DOCUMENT_SERVICE', `Starting upload pipeline for: ${originalName} (Case: ${caseId})`);

    const caseRecord = dbStore.cases.find(c => c.id === caseId);
    if (!caseRecord) {
      throw new Error(`Target Case record not found for ID: ${caseId}`);
    }

    const bufferToHash = fileBuffer || Buffer.from(rawTextContent || title || Date.now().toString());
    const fileHashSha256 = HashService.hashRawBytes(bufferToHash);

    const ocrResult = await OcrEntityService.processDocumentOcr(
      fileBuffer || rawTextContent || '',
      mimeType,
      originalName
    );

    const docId = `doc-${Date.now().toString().slice(-6)}`;
    const now = new Date();

    const newDocument = {
      id: docId,
      caseId,
      title: title || originalName || 'Evidence Document',
      originalName: originalName || 'evidence.pdf',
      mimeType: mimeType || 'application/pdf',
      fileSizeBytes: bufferToHash.length,
      filePath: `/evidence/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${docId}_${originalName}`,
      fileHashSha256,
      ocrText: ocrResult.ocrText,
      extractedEntities: JSON.stringify(ocrResult.entities),
      documentType: documentType || 'EVIDENCE_PHOTO',
      status: DOCUMENT_STATUS.PENDING_VERIFICATION,
      isFrozen: false,
      uploadedById: user.id,
      createdAt: now,
      updatedAt: now,
    };

    dbStore.documents.unshift(newDocument);

    const ledgerResult = await LedgerCoordinatorService.writeToAllNodes(
      docId,
      fileHashSha256,
      null,
      user
    );

    if (ledgerResult.success) {
      newDocument.status = DOCUMENT_STATUS.VERIFIED;
    }

    logger.info('DOCUMENT_SERVICE', `Document [${docId}] successfully created, OCR parsed, and written to 3-Node Ledger.`);

    return {
      document: {
        ...newDocument,
        extractedEntitiesParsed: ocrResult.entities,
      },
      ledgerCommit: ledgerResult,
      sha256: fileHashSha256,
    };
  }

  static async getDocumentById(documentId) {
    this._ensureInit();
    const doc = dbStore.documents.find(d => d.id === documentId);
    if (!doc) {
      throw new Error(`Document not found with ID: ${documentId}`);
    }

    const caseRecord = dbStore.cases.find(c => c.id === doc.caseId);
    const uploader = dbStore.users.find(u => u.id === doc.uploadedById);
    const custodyLogs = dbStore.custodyLogs.filter(cl => cl.documentId === documentId);
    const ledgerBlocks = dbStore.ledgerRecords.filter(lr => lr.documentId === documentId);

    let parsedEntities = null;
    try {
      parsedEntities = doc.extractedEntities ? JSON.parse(doc.extractedEntities) : null;
    } catch {
      parsedEntities = null;
    }

    return {
      ...doc,
      caseRecord,
      uploader: uploader ? { id: uploader.id, name: uploader.name, role: uploader.role, badge: uploader.badgeNumber } : null,
      extractedEntitiesParsed: parsedEntities,
      custodyLogs,
      ledgerBlocks,
    };
  }

  static async getAllDocuments(filters = {}) {
    this._ensureInit();
    let docs = [...dbStore.documents];

    if (filters.caseId) {
      docs = docs.filter(d => d.caseId === filters.caseId);
    }
    if (filters.status) {
      docs = docs.filter(d => d.status === filters.status);
    }
    if (filters.documentType) {
      docs = docs.filter(d => d.documentType === filters.documentType);
    }

    return docs.map(d => {
      let parsed = null;
      try {
        parsed = d.extractedEntities ? JSON.parse(d.extractedEntities) : null;
      } catch {
        parsed = null;
      }
      return {
        ...d,
        extractedEntitiesParsed: parsed,
      };
    });
  }

  static async setDocumentFrozenState(documentId, isFrozen, reason = '') {
    this._ensureInit();
    const doc = dbStore.documents.find(d => d.id === documentId);
    if (!doc) throw new Error(`Document not found: ${documentId}`);

    doc.isFrozen = isFrozen;
    if (isFrozen) {
      doc.status = DOCUMENT_STATUS.FROZEN;
    } else {
      doc.status = DOCUMENT_STATUS.VERIFIED;
    }
    doc.updatedAt = new Date();

    logger.warn('DOCUMENT_SERVICE', `Document ${documentId} frozen state set to ${isFrozen}. Reason: ${reason}`);
    return doc;
  }
}
