import { FABRIC_CONFIG, FABRIC_MSPS, FABRIC_RAFT_CLUSTER } from '../config/fabric.config.js';
import { FabricChaincodeService } from './fabricChaincodeService.js';
import { dbStore } from '../prisma/client.js';
import { initialSeedData } from '../prisma/seed.js';
import { logger } from '../utils/logger.js';

export class FabricGatewayService {
  static _ensureInit() {
    if (!dbStore.initialized) {
      dbStore.initSeed(initialSeedData);
    }
  }

  static getGatewayContext(user) {
    const identity = FabricChaincodeService.generateFabricIdentity(user);
    return {
      channelId: FABRIC_CONFIG.CHANNEL_ID,
      chaincodeId: FABRIC_CONFIG.CHAINCODE_NAME,
      identity,
      ordererEndpoint: FABRIC_CONFIG.ORDERER_ENDPOINT,
      endorsementPolicy: FABRIC_CONFIG.ENDORSEMENT_POLICY,
    };
  }

  static async submitTransaction(fnName, args, user) {
    this._ensureInit();
    const ctx = this.getGatewayContext(user);
    logger.info('FABRIC_GATEWAY', `[submitTransaction] Invoking "${fnName}" on channel "${ctx.channelId}" as [${ctx.identity.enrollmentId}] (${ctx.identity.mspId})`);

    switch (fnName) {
      case 'CreateEvidenceRecord':
        return await FabricChaincodeService.CreateEvidenceRecord(ctx, args);
      case 'TransferCustody':
        return await FabricChaincodeService.TransferCustody(ctx, args);
      default:
        throw new Error(`Unknown Fabric Chaincode method: ${fnName}`);
    }
  }

  static async evaluateTransaction(fnName, args, user = null) {
    this._ensureInit();
    const ctx = user ? this.getGatewayContext(user) : { channelId: FABRIC_CONFIG.CHANNEL_ID, chaincodeId: FABRIC_CONFIG.CHAINCODE_NAME };
    logger.info('FABRIC_GATEWAY', `[evaluateTransaction] Evaluating "${fnName}" on channel "${ctx.channelId}"`);

    switch (fnName) {
      case 'VerifyEvidenceIntegrity':
        return await FabricChaincodeService.VerifyEvidenceIntegrity(ctx, args.docId, args.localFileHash);
      case 'GetHistoryForKey':
        return await FabricChaincodeService.GetHistoryForKey(ctx, args.docId);
      case 'QueryEvidenceByCouchDB':
        return await FabricChaincodeService.QueryEvidenceByCouchDB(ctx, args.query);
      default:
        throw new Error(`Unknown Fabric Chaincode query method: ${fnName}`);
    }
  }

  static async getNetworkStatus() {
    this._ensureInit();
    const blocks = dbStore.ledgerRecords;
    const blockHeight = blocks.length > 0 ? Math.max(...blocks.map(b => b.blockIndex || 1)) : 1;

    return {
      network: FABRIC_CONFIG.NETWORK_NAME,
      channel: FABRIC_CONFIG.CHANNEL_ID,
      chaincode: {
        name: FABRIC_CONFIG.CHAINCODE_NAME,
        version: FABRIC_CONFIG.CHAINCODE_VERSION,
        endorsementPolicy: FABRIC_CONFIG.ENDORSEMENT_POLICY,
        stateDatabase: FABRIC_CONFIG.STATE_DATABASE,
      },
      ordererCluster: FABRIC_RAFT_CLUSTER,
      blockHeight,
      totalCommittedTransactions: blocks.length,
      msps: FABRIC_MSPS.map((msp, idx) => {
        const peerBlocks = blocks.filter(b => b.mspId === msp.mspId || b.nodeId === idx + 1);
        const corruptedBlocks = peerBlocks.filter(b => b.isCorrupted);
        return {
          ...msp,
          peerBlockHeight: peerBlocks.length,
          syncStatus: corruptedBlocks.length > 0 ? 'DESYNCHRONIZED' : 'IN_SYNC',
          latestBlockHash: peerBlocks.length > 0 ? peerBlocks[peerBlocks.length - 1].currentBlockHash : FABRIC_CONFIG.GENESIS_BLOCK_HASH,
        };
      }),
    };
  }

  static async getFabricBlocks() {
    this._ensureInit();
    const blockMap = new Map();

    dbStore.ledgerRecords.forEach(record => {
      const idx = record.blockIndex || 1;
      if (!blockMap.has(idx)) {
        blockMap.set(idx, {
          blockNumber: idx,
          channelId: FABRIC_CONFIG.CHANNEL_ID,
          currentBlockHash: record.currentBlockHash,
          previousBlockHash: record.previousBlockHash,
          dataHash: record.dataHash || record.docHash,
          txId: record.txId || `tx-${record.id}`,
          documentId: record.documentId,
          timestamp: record.timestamp,
          isCorrupted: record.isCorrupted,
          mspEndorsements: [],
        });
      }
      const blk = blockMap.get(idx);
      blk.mspEndorsements.push({
        mspId: record.mspId || (record.nodeId === 1 ? 'PoliceMSP' : record.nodeId === 2 ? 'ForensicsMSP' : 'JudiciaryMSP'),
        nodeName: record.nodeName,
        signature: record.signature,
        recordedHash: record.docHash,
        isCorrupted: record.isCorrupted,
      });
    });

    return Array.from(blockMap.values()).sort((a, b) => b.blockNumber - a.blockNumber);
  }

  static async simulatePeerTamper(documentId, targetMspId = 'ForensicsMSP') {
    this._ensureInit();
    const records = dbStore.ledgerRecords.filter(r => r.documentId === documentId && (r.mspId === targetMspId || (targetMspId === '2' && r.nodeId === 2) || (targetMspId === '1' && r.nodeId === 1) || (targetMspId === '3' && r.nodeId === 3)));
    
    if (records.length === 0) {
      throw new Error(`No ledger block found for MSP [${targetMspId}] on doc [${documentId}]`);
    }

    const fakeHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    records.forEach(r => {
      r.docHash = fakeHash;
      r.isCorrupted = true;
    });

    logger.warn('FABRIC_TAMPER_LAB', `Simulated Byzantine state corruption on MSP [${targetMspId}] for Doc [${documentId}]`);
    return { success: true, targetMspId, fakeHash, affectedBlocks: records.length };
  }

  static async simulateFileTamper(documentId) {
    this._ensureInit();
    const doc = dbStore.documents.find(d => d.id === documentId);
    if (!doc) throw new Error(`Document ${documentId} not found`);

    const alteredHash = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    doc.fileHashSha256 = alteredHash;
    doc.status = 'TAMPERED_FLAGGED';
    doc.isFrozen = true;

    logger.warn('FABRIC_TAMPER_LAB', `Simulated raw byte manipulation for Doc [${documentId}]`);
    return { success: true, alteredHash };
  }

  static async reconcilePeerState(documentId) {
    this._ensureInit();
    const doc = dbStore.documents.find(d => d.id === documentId);
    if (!doc) throw new Error(`Document ${documentId} not found`);

    const validBlocks = dbStore.ledgerRecords.filter(r => r.documentId === documentId && !r.isCorrupted);
    const validHash = validBlocks.length > 0 ? (validBlocks[0].custodyHash || validBlocks[0].docHash) : doc.fileHashSha256;

    dbStore.ledgerRecords.forEach(r => {
      if (r.documentId === documentId) {
        r.docHash = validHash;
        r.custodyHash = validHash;
        r.isCorrupted = false;
      }
    });

    doc.fileHashSha256 = validHash;
    doc.status = 'VERIFIED';
    doc.isFrozen = false;

    logger.info('FABRIC_GATEWAY', `Peer state reconciled and healed across all MSPs for Doc [${documentId}]`);
    return { success: true, restoredHash: validHash };
  }
}
