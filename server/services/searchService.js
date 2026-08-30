import { dbStore } from '../prisma/client.js';
import { initialSeedData } from '../prisma/seed.js';
import { logger } from '../utils/logger.js';

export class SearchService {
  static _ensureInit() {
    if (!dbStore.initialized) {
      dbStore.initSeed(initialSeedData);
    }
  }

  static async search(query = '') {
    this._ensureInit();
    const term = (query || '').trim().toLowerCase();

    if (!term) {
      return {
        matchedCases: dbStore.cases.slice(0, 10),
        matchedDocuments: dbStore.documents.slice(0, 10),
        matchedCustody: dbStore.custodyLogs.slice(0, 10),
        query: '',
        totalMatches: dbStore.cases.length + dbStore.documents.length,
      };
    }

    logger.info('SEARCH_SERVICE', `Executing multi-vector search for: "${term}"`);

    const matchedCases = dbStore.cases.filter(c => {
      return (
        c.caseNumber.toLowerCase().includes(term) ||
        c.firNumber.toLowerCase().includes(term) ||
        c.policeStation.toLowerCase().includes(term) ||
        c.actAndSections.toLowerCase().includes(term) ||
        c.complainant.toLowerCase().includes(term) ||
        c.accused.toLowerCase().includes(term) ||
        c.description.toLowerCase().includes(term)
      );
    });

    const matchedDocuments = dbStore.documents.filter(d => {
      const inBasic =
        d.title.toLowerCase().includes(term) ||
        d.originalName.toLowerCase().includes(term) ||
        d.fileHashSha256.toLowerCase().includes(term) ||
        d.documentType.toLowerCase().includes(term);

      const inOcr = d.ocrText ? d.ocrText.toLowerCase().includes(term) : false;
      const inEntities = d.extractedEntities ? d.extractedEntities.toLowerCase().includes(term) : false;

      return inBasic || inOcr || inEntities;
    }).map(doc => {
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

    const matchedCustody = dbStore.custodyLogs.filter(cl => {
      return (
        cl.transferReason.toLowerCase().includes(term) ||
        cl.transferLocation.toLowerCase().includes(term) ||
        cl.custodyHash.toLowerCase().includes(term)
      );
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
