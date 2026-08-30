import { HashService } from './hashService.js';
import { LedgerCoordinatorService } from './ledgerCoordinatorService.js';
import { CUSTODY_STATUS } from '../config/constants.js';
import { dbStore } from '../prisma/client.js';
import { initialSeedData } from '../prisma/seed.js';
import { logger } from '../utils/logger.js';

export class CustodyService {
  static _ensureInit() {
    if (!dbStore.initialized) {
      dbStore.initSeed(initialSeedData);
    }
  }

  static async transferCustody(transferData, user) {
    this._ensureInit();

    const {
      documentId,
      toActorId,
      transferReason,
      transferLocation,
      acknowledgementNote,
    } = transferData;

    logger.info('CUSTODY_SERVICE', `Processing custody hand-off for Doc [${documentId}] to Actor [${toActorId}]`);

    const doc = dbStore.documents.find(d => d.id === documentId);
    if (!doc) {
      throw new Error(`Evidence document not found: ${documentId}`);
    }

    const toActor = dbStore.users.find(u => u.id === toActorId);
    if (!toActor) {
      throw new Error(`Recipient actor not found: ${toActorId}`);
    }

    const existingLogs = dbStore.custodyLogs.filter(cl => cl.documentId === documentId);
    const prevLog = existingLogs.length > 0 ? existingLogs[existingLogs.length - 1] : null;
    const prevCustodyHash = prevLog ? prevLog.custodyHash : doc.fileHashSha256;

    const now = new Date();
    const custodyHash = HashService.hashCustodyEvent({
      docId: documentId,
      fromActorId: user.id,
      toActorId,
      prevCustodyHash,
      timestamp: now.toISOString(),
    });

    const newCustodyLog = {
      id: `cust-${Date.now().toString().slice(-6)}`,
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
    };

    dbStore.custodyLogs.push(newCustodyLog);

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
        fromActorName: user.name,
        fromActorRole: user.role,
        toActorName: toActor.name,
        toActorRole: toActor.role,
      },
      ledgerCommit: ledgerWrite,
      custodyHash,
    };
  }

  static async getCustodyTrail(documentId) {
    this._ensureInit();

    const logs = dbStore.custodyLogs.filter(cl => cl.documentId === documentId);

    return logs.map(log => {
      const fromActor = dbStore.users.find(u => u.id === log.fromActorId);
      const toActor = dbStore.users.find(u => u.id === log.toActorId);
      return {
        ...log,
        fromActorName: fromActor ? fromActor.name : 'Unknown',
        fromActorRole: fromActor ? fromActor.role : 'Unknown',
        fromActorStation: fromActor ? fromActor.station : '',
        toActorName: toActor ? toActor.name : 'Unknown',
        toActorRole: toActor ? toActor.role : 'Unknown',
        toActorStation: toActor ? toActor.station : '',
      };
    });
  }
}
