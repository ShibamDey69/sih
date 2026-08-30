import { dbStore } from '../prisma/client.js';
import { initialSeedData } from '../prisma/seed.js';
import { logger } from '../utils/logger.js';

export class CaseService {
  static _ensureInit() {
    if (!dbStore.initialized) {
      dbStore.initSeed(initialSeedData);
    }
  }

  static async getAllCases(filters = {}) {
    this._ensureInit();
    let cases = [...dbStore.cases];

    if (filters.status) {
      cases = cases.filter(c => c.status === filters.status);
    }
    if (filters.policeStation) {
      cases = cases.filter(c => c.policeStation.toLowerCase().includes(filters.policeStation.toLowerCase()));
    }

    return cases.map(c => {
      const docs = dbStore.documents.filter(d => d.caseId === c.id);
      const custody = dbStore.custodyLogs.filter(cl => cl.caseId === c.id);
      const createdBy = dbStore.users.find(u => u.id === c.createdById);
      return {
        ...c,
        documentCount: docs.length,
        documents: docs,
        custodyHistoryCount: custody.length,
        createdByName: createdBy ? createdBy.name : 'Unknown Officer',
      };
    });
  }

  static async getCaseById(caseId) {
    this._ensureInit();
    const caseRecord = dbStore.cases.find(c => c.id === caseId);
    if (!caseRecord) {
      throw new Error(`Case not found with ID: ${caseId}`);
    }

    const documents = dbStore.documents.filter(d => d.caseId === caseId);
    const custodyLogs = dbStore.custodyLogs.filter(cl => cl.caseId === caseId).map(log => {
      const fromActor = dbStore.users.find(u => u.id === log.fromActorId);
      const toActor = dbStore.users.find(u => u.id === log.toActorId);
      const doc = dbStore.documents.find(d => d.id === log.documentId);
      return {
        ...log,
        fromActorName: fromActor ? fromActor.name : 'Unknown',
        fromActorRole: fromActor ? fromActor.role : 'Unknown',
        toActorName: toActor ? toActor.name : 'Unknown',
        toActorRole: toActor ? toActor.role : 'Unknown',
        documentTitle: doc ? doc.title : 'Document',
      };
    });

    const createdBy = dbStore.users.find(u => u.id === caseRecord.createdById);

    return {
      ...caseRecord,
      createdBy: createdBy ? { id: createdBy.id, name: createdBy.name, role: createdBy.role, badge: createdBy.badgeNumber } : null,
      documents,
      custodyLogs,
    };
  }

  static async createCase(caseData, user) {
    this._ensureInit();

    const newId = `case-${Date.now().toString().slice(-6)}`;
    const now = new Date();

    const newCase = {
      id: newId,
      caseNumber: caseData.caseNumber || `CASE/${now.getFullYear()}/DIV/${Math.floor(1000 + Math.random() * 9000)}`,
      firNumber: caseData.firNumber || `FIR No. ${Math.floor(100 + Math.random() * 900)}/${now.getFullYear()}`,
      policeStation: caseData.policeStation || user.station || 'Central Division PS',
      incidentDate: caseData.incidentDate ? new Date(caseData.incidentDate) : now,
      actAndSections: caseData.actAndSections || 'IPC 302, IPC 120B | BNS 103(1)',
      complainant: caseData.complainant || 'State / Suo Motu',
      accused: caseData.accused || 'Unknown Suspects',
      description: caseData.description || 'Crime investigation docket initiated.',
      status: 'UNDER_INVESTIGATION',
      createdById: user.id,
      createdAt: now,
      updatedAt: now,
    };

    dbStore.cases.unshift(newCase);
    logger.info('CASE_SERVICE', `New Case Registered: ${newCase.firNumber} (${newCase.caseNumber})`);
    return newCase;
  }

  static async updateCaseStatus(caseId, status) {
    this._ensureInit();
    const caseRecord = dbStore.cases.find(c => c.id === caseId);
    if (!caseRecord) {
      throw new Error(`Case not found: ${caseId}`);
    }
    caseRecord.status = status;
    caseRecord.updatedAt = new Date();
    logger.info('CASE_SERVICE', `Case ${caseId} status updated to ${status}`);
    return caseRecord;
  }
}
