import { prisma } from '../prisma/client.js';
import { logger } from '../utils/logger.js';

export class CaseService {
  static async getAllCases(filters = {}) {
    const where = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.policeStation) {
      where.policeStation = {
        contains: filters.policeStation,
        mode: 'insensitive',
      };
    }

    const cases = await prisma.caseRecord.findMany({
      where,
      include: {
        documents: true,
        custodyLogs: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            role: true,
            badgeNumber: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return cases.map(c => ({
      ...c,
      documentCount: c.documents ? c.documents.length : 0,
      custodyHistoryCount: c.custodyLogs ? c.custodyLogs.length : 0,
      createdByName: c.createdBy ? c.createdBy.name : 'Unknown Officer',
    }));
  }

  static async getCaseById(caseId) {
    const caseRecord = await prisma.caseRecord.findUnique({
      where: { id: caseId },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            role: true,
            badgeNumber: true,
          },
        },
        documents: {
          orderBy: { createdAt: 'desc' },
        },
        custodyLogs: {
          include: {
            fromActor: {
              select: { id: true, name: true, role: true, badgeNumber: true, station: true },
            },
            toActor: {
              select: { id: true, name: true, role: true, badgeNumber: true, station: true },
            },
            document: {
              select: { id: true, title: true, documentType: true },
            },
          },
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    if (!caseRecord) {
      throw new Error(`Case not found with ID: ${caseId}`);
    }

    const formattedCustodyLogs = (caseRecord.custodyLogs || []).map(log => ({
      ...log,
      fromActorName: log.fromActor ? log.fromActor.name : 'Unknown',
      fromActorRole: log.fromActor ? log.fromActor.role : 'Unknown',
      toActorName: log.toActor ? log.toActor.name : 'Unknown',
      toActorRole: log.toActor ? log.toActor.role : 'Unknown',
      documentTitle: log.document ? log.document.title : 'Document',
    }));

    return {
      ...caseRecord,
      custodyLogs: formattedCustodyLogs,
    };
  }

  static async createCase(caseData, user) {
    const now = new Date();

    const created = await prisma.caseRecord.create({
      data: {
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
      },
      include: {
        createdBy: {
          select: { id: true, name: true, role: true, badgeNumber: true },
        },
      },
    });

    logger.info('CASE_SERVICE', `New Case Registered: ${created.firNumber} (${created.caseNumber})`);
    return created;
  }

  static async updateCaseStatus(caseId, status) {
    const existing = await prisma.caseRecord.findUnique({
      where: { id: caseId },
    });

    if (!existing) {
      throw new Error(`Case not found: ${caseId}`);
    }

    const updated = await prisma.caseRecord.update({
      where: { id: caseId },
      data: { status },
      include: {
        createdBy: {
          select: { id: true, name: true, role: true, badgeNumber: true },
        },
      },
    });

    logger.info('CASE_SERVICE', `Case ${caseId} status updated to ${status}`);
    return updated;
  }
}

