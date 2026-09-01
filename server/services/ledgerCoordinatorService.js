import { FABRIC_CONFIG, FABRIC_MSPS } from '../config/fabric.config.js';
import { FabricGatewayService } from './fabricGatewayService.js';
import { FabricChaincodeService } from './fabricChaincodeService.js';
import { prisma } from '../prisma/client.js';
import { logger } from '../utils/logger.js';

export class LedgerCoordinatorService {
  static async writeToAllNodes(documentId, docHash, custodyHash = null, user = null) {
    logger.info('FABRIC_LEDGER', `Executing Hyperledger Fabric transaction for Doc [${documentId}] on channel "${FABRIC_CONFIG.CHANNEL_ID}"`);

    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        uploadedBy: {
          select: { id: true, name: true, role: true, badgeNumber: true, station: true, email: true },
        },
      },
    });

    const actor = user || (doc ? doc.uploadedBy : null) || { id: 'usr-io-01', name: 'Inspector Amit Sharma', role: 'INVESTIGATING_OFFICER', badgeNumber: 'IO-9842' };

    let fabricResult;
    if (custodyHash) {
      fabricResult = await FabricGatewayService.submitTransaction('TransferCustody', {
        docId: documentId,
        fromActor: actor,
        toActor: actor,
        transferReason: 'Custody record update on Hyperledger Fabric',
        transferLocation: actor.station || 'State Police Station / Evidence Locker',
        custodyHash,
      }, actor);
    } else {
      fabricResult = await FabricGatewayService.submitTransaction('CreateEvidenceRecord', {
        docId: documentId,
        docHash,
        caseId: doc?.caseId || 'case-1',
        title: doc?.title || 'Evidence Document',
        documentType: doc?.documentType || 'EVIDENCE_PHOTO',
        metadata: { ocrConfidence: 95.0 },
        uploaderIdentity: FabricChaincodeService.generateFabricIdentity(actor),
      }, actor);
    }

    const nodeAcks = FABRIC_MSPS.map((msp, idx) => ({
      nodeId: idx + 1,
      mspId: msp.mspId,
      nodeName: msp.organizationName,
      ack: true,
      blockIndex: fabricResult.blockNumber,
      currentBlockHash: fabricResult.currentBlockHash,
      latencyMs: Math.floor(Math.random() * 20) + 10,
    }));

    return {
      success: true,
      ackCount: FABRIC_MSPS.length,
      requiredThreshold: FABRIC_CONFIG.ENDORSEMENT_THRESHOLD,
      totalNodes: FABRIC_MSPS.length,
      nodeAcks,
      fabricTransaction: fabricResult,
    };
  }

  static async queryAllNodes(documentId) {
    const allDocBlocks = await prisma.ledgerNodeRecord.findMany({
      where: { documentId },
      orderBy: { blockIndex: 'asc' },
    });

    return FABRIC_MSPS.map((msp, idx) => {
      const records = allDocBlocks.filter(r => (r.mspId === msp.mspId || r.nodeId === idx + 1));
      const latestBlock = records.length > 0 ? records[records.length - 1] : null;

      return {
        nodeId: idx + 1,
        mspId: msp.mspId,
        nodeName: msp.organizationName,
        shortName: msp.shortName,
        authority: msp.organizationName,
        peerEndpoint: msp.peerEndpoint,
        status: msp.status,
        hasRecord: !!latestBlock,
        block: latestBlock,
        docHash: latestBlock ? (latestBlock.docHash || latestBlock.custodyHash) : null,
        isCorrupted: latestBlock ? latestBlock.isCorrupted : false,
      };
    });
  }

  static async verifyConsensus(documentId, localFileHash = null) {
    return await FabricGatewayService.evaluateTransaction('VerifyEvidenceIntegrity', {
      docId: documentId,
      localFileHash,
    });
  }

  static async simulateNodeTamper(documentId, targetNodeId = 2) {
    const mspId = targetNodeId === 1 ? 'PoliceMSP' : targetNodeId === 3 ? 'JudiciaryMSP' : 'ForensicsMSP';
    return await FabricGatewayService.simulatePeerTamper(documentId, mspId);
  }

  static async simulateFileTamper(documentId) {
    return await FabricGatewayService.simulateFileTamper(documentId);
  }

  static async healNodeIntegrity(documentId) {
    return await FabricGatewayService.reconcilePeerState(documentId);
  }

  static async getFullLedgerOverview() {
    const networkStatus = await FabricGatewayService.getNetworkStatus();
    const blocks = await FabricGatewayService.getFabricBlocks();

    const allRecords = await prisma.ledgerNodeRecord.findMany({
      orderBy: { blockIndex: 'asc' },
    });

    return {
      networkStatus,
      recentBlocks: blocks,
      nodes: FABRIC_MSPS.map((msp, idx) => {
        const peerBlocks = allRecords.filter(r => r.mspId === msp.mspId || r.nodeId === idx + 1);
        return {
          nodeId: idx + 1,
          mspId: msp.mspId,
          nodeName: msp.organizationName,
          shortName: msp.shortName,
          authority: msp.organizationName,
          peerEndpoint: msp.peerEndpoint,
          status: msp.status,
          blockHeight: peerBlocks.length,
          blocks: peerBlocks,
        };
      }),
    };
  }
}

