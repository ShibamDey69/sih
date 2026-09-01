import { HashService } from './hashService.js';
import { LedgerCoordinatorService } from './ledgerCoordinatorService.js';
import { CUSTODY_STATUS } from '../config/constants.js';
import { prisma } from '../prisma/client.js';
import { logger } from '../utils/logger.js';

export class CustodyService {
  static async transferCustody(transferData, user) {
    const {
      documentId,
      toActorId,
      transferReason,
      transferLocation,
      acknowledgementNote,
    } = transferData;

    logger.info('CUSTODY_SERVICE', `Processing custody hand-off for Doc [${documentId}] to Actor [${toActorId}]`);

    const doc = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!doc) {
      throw new Error(`Evidence document not found: ${documentId}`);
    }

    const toActor = await prisma.user.findUnique({
      where: { id: toActorId },
    });

    if (!toActor) {
      throw new Error(`Recipient actor not found: ${toActorId}`);
    }

    const prevLog = await prisma.custodyLog.findFirst({
      where: { documentId },
      orderBy: { timestamp: 'desc' },
    });

    const prevCustodyHash = prevLog ? prevLog.custodyHash : doc.fileHashSha256;
    const now = new Date();

    const custodyHash = HashService.hashCustodyEvent({
      docId: documentId,
      fromActorId: user.id,
      toActorId,
      prevCustodyHash,
      timestamp: now.toISOString(),
    });

    const newCustodyLog = await prisma.custodyLog.create({
      data: {
        documentId,
        caseId: doc.caseId,
        fromActorId: user.id,
        toActorId,
        transferReason: transferReason || 'Official evidentiary hand-over for forensic/judicial proceedings.',
        transferLocation: transferLocation || user.station || 'Police Station Evidence Locker',
        timestamp: now,
        custodyHash,
        status: CUSTODY_STATUS.RECEIVED_ACKNOWLEDGED,
        acknowledgementNote: acknowledgementNote || 'Custody transfer received and verified against 3-Node Ledger.',
      },
      include: {
        fromActor: {
          select: { id: true, name: true, role: true, badgeNumber: true, station: true },
        },
        toActor: {
          select: { id: true, name: true, role: true, badgeNumber: true, station: true },
        },
      },
    });

    const ledgerWrite = await LedgerCoordinatorService.writeToAllNodes(
      documentId,
      doc.fileHashSha256,
      custodyHash,
      user
    );

    logger.info('CUSTODY_SERVICE', `Custody hand-off logged and anchored to Hyperledger Fabric Channel (ACKs: ${ledgerWrite.ackCount}/3).`);

    return {
      custodyLog: {
        ...newCustodyLog,
        fromActorName: newCustodyLog.fromActor ? newCustodyLog.fromActor.name : user.name,
        fromActorRole: newCustodyLog.fromActor ? newCustodyLog.fromActor.role : user.role,
        toActorName: newCustodyLog.toActor ? newCustodyLog.toActor.name : toActor.name,
        toActorRole: newCustodyLog.toActor ? newCustodyLog.toActor.role : toActor.role,
      },
      ledgerCommit: ledgerWrite,
      custodyHash,
    };
  }

  static async getCustodyTrail(documentId) {
    const logs = await prisma.custodyLog.findMany({
      where: { documentId },
      include: {
        fromActor: {
          select: { id: true, name: true, role: true, badgeNumber: true, station: true },
        },
        toActor: {
          select: { id: true, name: true, role: true, badgeNumber: true, station: true },
        },
      },
      orderBy: { timestamp: 'asc' },
    });

    return logs.map(log => ({
      ...log,
      fromActorName: log.fromActor ? log.fromActor.name : 'Unknown',
      fromActorRole: log.fromActor ? log.fromActor.role : 'Unknown',
      fromActorStation: log.fromActor ? log.fromActor.station : '',
      toActorName: log.toActor ? log.toActor.name : 'Unknown',
      toActorRole: log.toActor ? log.toActor.role : 'Unknown',
      toActorStation: log.toActor ? log.toActor.station : '',
    }));
  }
}

