import { prisma } from '../prisma/client.js';
import { logger } from '../utils/logger.js';

export class SearchService {
  static async search(query = '') {
    const term = (query || '').trim();

    if (!term) {
      const [matchedCases, matchedDocuments, matchedCustody, caseCount, docCount] = await Promise.all([
        prisma.caseRecord.findMany({ take: 10, orderBy: { createdAt: 'desc' } }),
        prisma.document.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            case: true,
            uploadedBy: { select: { id: true, name: true, role: true, badgeNumber: true } },
          },
        }),
        prisma.custodyLog.findMany({
          take: 10,
          orderBy: { timestamp: 'desc' },
          include: {
            fromActor: { select: { id: true, name: true, role: true, badgeNumber: true } },
            toActor: { select: { id: true, name: true, role: true, badgeNumber: true } },
          },
        }),
        prisma.caseRecord.count(),
        prisma.document.count(),
      ]);

      const formattedDocs = matchedDocuments.map(doc => {
        let parsed = null;
        try {
          parsed = doc.extractedEntities ? JSON.parse(doc.extractedEntities) : null;
        } catch {
          parsed = null;
        }
        return {
          ...doc,
          extractedEntitiesParsed: parsed,
        };
      });

      return {
        query: '',
        totalMatches: caseCount + docCount,
        matchedCases,
        matchedDocuments: formattedDocs,
        matchedCustody,
      };
    }

    logger.info('SEARCH_SERVICE', `Executing multi-vector search for: "${term}"`);

    const [matchedCases, rawDocs, matchedCustody] = await Promise.all([
      prisma.caseRecord.findMany({
        where: {
          OR: [
            { caseNumber: { contains: term, mode: 'insensitive' } },
            { firNumber: { contains: term, mode: 'insensitive' } },
            { policeStation: { contains: term, mode: 'insensitive' } },
            { actAndSections: { contains: term, mode: 'insensitive' } },
            { complainant: { contains: term, mode: 'insensitive' } },
            { accused: { contains: term, mode: 'insensitive' } },
            { description: { contains: term, mode: 'insensitive' } },
          ],
        },
        include: {
          documents: true,
          createdBy: { select: { id: true, name: true, role: true, badgeNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.document.findMany({
        where: {
          OR: [
            { title: { contains: term, mode: 'insensitive' } },
            { originalName: { contains: term, mode: 'insensitive' } },
            { fileHashSha256: { contains: term, mode: 'insensitive' } },
            { documentType: { contains: term, mode: 'insensitive' } },
            { ocrText: { contains: term, mode: 'insensitive' } },
            { extractedEntities: { contains: term, mode: 'insensitive' } },
          ],
        },
        include: {
          case: true,
          uploadedBy: { select: { id: true, name: true, role: true, badgeNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.custodyLog.findMany({
        where: {
          OR: [
            { transferReason: { contains: term, mode: 'insensitive' } },
            { transferLocation: { contains: term, mode: 'insensitive' } },
            { custodyHash: { contains: term, mode: 'insensitive' } },
            { acknowledgementNote: { contains: term, mode: 'insensitive' } },
          ],
        },
        include: {
          fromActor: { select: { id: true, name: true, role: true, badgeNumber: true } },
          toActor: { select: { id: true, name: true, role: true, badgeNumber: true } },
          document: { select: { id: true, title: true, documentType: true } },
        },
        orderBy: { timestamp: 'desc' },
      }),
    ]);

    const matchedDocuments = rawDocs.map(doc => {
      let parsed = null;
      try {
        parsed = doc.extractedEntities ? JSON.parse(doc.extractedEntities) : null;
      } catch {
        parsed = null;
      }
      return {
        ...doc,
        extractedEntitiesParsed: parsed,
      };
    });

    const totalMatches = matchedCases.length + matchedDocuments.length + matchedCustody.length;

    return {
      query: term,
      totalMatches,
      matchedCases,
      matchedDocuments,
      matchedCustody,
    };
  }
}

