import { HashService } from './hashService.js';
import { OcrEntityService } from './ocrEntityService.js';
import { LedgerCoordinatorService } from './ledgerCoordinatorService.js';
import { DOCUMENT_STATUS } from '../config/constants.js';
import { prisma } from '../prisma/client.js';
import { logger } from '../utils/logger.js';

export class DocumentService {
  static async uploadAndProcessDocument(fileData, user) {
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

    const caseRecord = await prisma.caseRecord.findUnique({
      where: { id: caseId },
    });

    if (!caseRecord) {
      throw new Error(`Target Case record not found for ID: ${caseId}`);
    }

    const bufferToHash = fileBuffer || Buffer.from(rawTextContent || title || Date.now().toString());
    const fileHashSha256 = HashService.hashRawBytes(bufferToHash);

    const now = new Date();
    const docId = `doc-${Date.now().toString().slice(-6)}`;

    const ocrResult = await OcrEntityService.processDocumentOcr(
      fileBuffer || rawTextContent || '',
      mimeType,
      originalName,
      { docId }
    );

    const createdDoc = await prisma.document.create({
      data: {
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
      },
      include: {
        case: true,
        uploadedBy: {
          select: { id: true, name: true, role: true, badgeNumber: true },
        },
      },
    });

    const ledgerResult = await LedgerCoordinatorService.writeToAllNodes(
      createdDoc.id,
      fileHashSha256,
      null,
      user
    );

    let finalDoc = createdDoc;
    if (ledgerResult.success) {
      finalDoc = await prisma.document.update({
        where: { id: createdDoc.id },
        data: { status: DOCUMENT_STATUS.VERIFIED },
        include: {
          case: true,
          uploadedBy: {
            select: { id: true, name: true, role: true, badgeNumber: true },
          },
        },
      });
    }

    logger.info('DOCUMENT_SERVICE', `Document [${docId}] successfully created, OCR parsed (${ocrResult.pageCount || 1} pages, ${ocrResult.confidence}% confidence), and written to 3-Node Ledger.`);

    return {
      document: {
        ...finalDoc,
        extractedEntitiesParsed: ocrResult.entities,
        ocrBreakdown: {
          pageCount: ocrResult.pageCount,
          successfulPages: ocrResult.successfulPages,
          failedPages: ocrResult.failedPages,
          confidence: ocrResult.confidence,
          ocrEngine: ocrResult.ocrEngine,
          pages: ocrResult.pages,
        },
      },
      ledgerCommit: ledgerResult,
      sha256: fileHashSha256,
      ocrResult,
    };
  }

  static async getDocumentById(documentId) {
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        case: true,
        uploadedBy: {
          select: { id: true, name: true, role: true, badgeNumber: true },
        },
        custodyLogs: {
          include: {
            fromActor: {
              select: { id: true, name: true, role: true, badgeNumber: true, station: true },
            },
            toActor: {
              select: { id: true, name: true, role: true, badgeNumber: true, station: true },
            },
          },
          orderBy: { timestamp: 'asc' },
        },
        ledgerRecords: {
          orderBy: { blockIndex: 'asc' },
        },
        tamperAudits: {
          orderBy: { testedAt: 'desc' },
        },
      },
    });

    if (!doc) {
      throw new Error(`Document not found with ID: ${documentId}`);
    }

    let parsedEntities = null;
    try {
      parsedEntities = doc.extractedEntities ? JSON.parse(doc.extractedEntities) : null;
    } catch {
      parsedEntities = null;
    }

    return {
      ...doc,
      caseRecord: doc.case,
      uploader: doc.uploadedBy,
      extractedEntitiesParsed: parsedEntities,
      ledgerBlocks: doc.ledgerRecords,
    };
  }

  static async getAllDocuments(filters = {}) {
    const where = {};

    if (filters.caseId) {
      where.caseId = filters.caseId;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.documentType) {
      where.documentType = filters.documentType;
    }

    const docs = await prisma.document.findMany({
      where,
      include: {
        case: true,
        uploadedBy: {
          select: { id: true, name: true, role: true, badgeNumber: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

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
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!doc) throw new Error(`Document not found: ${documentId}`);

    const updated = await prisma.document.update({
      where: { id: documentId },
      data: {
        isFrozen: !!isFrozen,
        status: isFrozen ? DOCUMENT_STATUS.FROZEN : DOCUMENT_STATUS.VERIFIED,
      },
    });

    logger.warn('DOCUMENT_SERVICE', `Document ${documentId} frozen state set to ${isFrozen}. Reason: ${reason}`);
    return updated;
  }
}

