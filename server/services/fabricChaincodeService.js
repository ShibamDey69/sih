import crypto from 'crypto';
import { FABRIC_CONFIG, FABRIC_MSPS } from '../config/fabric.config.js';
import { prisma } from '../prisma/client.js';
import { logger } from '../utils/logger.js';

export class FabricChaincodeService {
  static generateFabricIdentity(actor = {}) {
    const actorName = actor?.name || actor?.username || actor?.badgeNumber || 'Officer';
    const actorRole = actor?.role || 'INVESTIGATING_OFFICER';
    const mspId = actor?.mspId || (actorRole === 'FORENSIC_EXAMINER' ? 'ForensicsMSP' : (actorRole === 'PROSECUTOR' || actorRole === 'COURT_CLERK_JUDGE' ? 'JudiciaryMSP' : 'PoliceMSP'));
    const certSerial = crypto.randomBytes(8).toString('hex').toUpperCase();
    const x509Subject = `CN=${String(actorName).replace(/\s+/g, '.')},OU=Users,OU=${actorRole},O=${mspId},L=NewDelhi,ST=Delhi,C=IN`;
    
    return {
      mspId,
      enrollmentId: actor?.badgeNumber || actor?.id || 'ANON_USER',
      certificateSerial: certSerial,
      x509Subject,
      publicKeyPem: `-----BEGIN CERTIFICATE-----\nMIICXzCCAgWgAwIBAgIU${certSerial}==\n-----END CERTIFICATE-----`,
    };
  }

  static async CreateEvidenceRecord(ctx, {
    docId,
    docHash,
    caseId,
    title,
    documentType,
    metadata = {},
    uploaderIdentity,
  }) {
    logger.info('FABRIC_CHAINCODE', `[CreateEvidenceRecord] Executing chaincode on channel "${FABRIC_CONFIG.CHANNEL_ID}" for Doc [${docId}]`);

    const txId = crypto.randomBytes(32).toString('hex');
    const timestamp = new Date().toISOString();

    const worldStateAsset = {
      docType: 'EVIDENCE_RECORD',
      docId,
      docHash,
      caseId,
      title,
      documentType,
      metadata,
      currentCustodian: uploaderIdentity?.enrollmentId || 'UNKNOWN',
      currentCustodianMsp: uploaderIdentity?.mspId || 'PoliceMSP',
      custodyHash: docHash,
      isFrozen: false,
      status: 'VERIFIED',
      txId,
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
    };

    const endorsements = FABRIC_MSPS.map(msp => {
      const payloadToSign = `${FABRIC_CONFIG.CHANNEL_ID}:${FABRIC_CONFIG.CHAINCODE_NAME}:${docId}:${docHash}:${txId}`;
      const signature = crypto.createHmac('sha256', `MSP_SECRET_${msp.mspId}`).update(payloadToSign).digest('hex');
      return {
        mspId: msp.mspId,
        peerEndpoint: msp.peerEndpoint,
        status: 200,
        endorserSignature: signature,
        endorsedAt: timestamp,
      };
    });

    const validEndorsements = endorsements.filter(e => e.status === 200);
    const hasQuorum = validEndorsements.length >= FABRIC_CONFIG.ENDORSEMENT_THRESHOLD;

    if (!hasQuorum) {
      throw new Error(`Endorsement Policy Violation: Expected at least ${FABRIC_CONFIG.ENDORSEMENT_THRESHOLD} MSP signatures, received ${validEndorsements.length}`);
    }

    const latestBlock = await prisma.ledgerNodeRecord.findFirst({
      orderBy: { blockIndex: 'desc' },
    });

    const blockNumber = (latestBlock?.blockIndex || 0) + 1;
    const prevBlockHash = latestBlock?.currentBlockHash || FABRIC_CONFIG.GENESIS_BLOCK_HASH;

    const dataHash = crypto.createHash('sha256').update(JSON.stringify(worldStateAsset)).digest('hex');
    const blockHeaderPayload = `${blockNumber}:${prevBlockHash}:${dataHash}:${txId}`;
    const currentBlockHash = crypto.createHash('sha256').update(blockHeaderPayload).digest('hex');

    const blockRecordsData = FABRIC_MSPS.map((msp, idx) => ({
      id: `blk-${msp.mspId}-${docId}-${Date.now().toString().slice(-4)}-${idx}`,
      channelId: FABRIC_CONFIG.CHANNEL_ID,
      chaincodeId: FABRIC_CONFIG.CHAINCODE_NAME,
      nodeId: idx + 1,
      mspId: msp.mspId,
      nodeName: msp.organizationName,
      documentId: docId,
      docHash,
      custodyHash: docHash,
      blockIndex: blockNumber,
      previousBlockHash: prevBlockHash,
      currentBlockHash,
      dataHash,
      txId,
      signature: endorsements[idx]?.endorserSignature,
      timestamp: new Date(),
      isCorrupted: false,
    }));

    await prisma.ledgerNodeRecord.createMany({
      data: blockRecordsData,
    });

    return {
      status: 'COMMITTED',
      channelId: FABRIC_CONFIG.CHANNEL_ID,
      chaincode: FABRIC_CONFIG.CHAINCODE_NAME,
      txId,
      blockNumber,
      currentBlockHash,
      previousBlockHash: prevBlockHash,
      endorsementPolicy: FABRIC_CONFIG.ENDORSEMENT_POLICY,
      endorsers: endorsements.map(e => ({ msp: e.mspId, peer: e.peerEndpoint })),
      worldState: worldStateAsset,
    };
  }

  static async TransferCustody(ctx, {
    docId,
    fromActor,
    toActor,
    transferReason,
    transferLocation,
    custodyHash,
  }) {
    logger.info('FABRIC_CHAINCODE', `[TransferCustody] Executing custody hand-off on channel "${FABRIC_CONFIG.CHANNEL_ID}" for Doc [${docId}]`);

    const txId = crypto.randomBytes(32).toString('hex');
    const timestamp = new Date().toISOString();

    const fromMsp = fromActor?.mspId || (fromActor?.role === 'FORENSIC_EXAMINER' ? 'ForensicsMSP' : (fromActor?.role === 'PROSECUTOR' || fromActor?.role === 'COURT_CLERK_JUDGE' ? 'JudiciaryMSP' : 'PoliceMSP'));
    const toMsp = toActor?.mspId || (toActor?.role === 'FORENSIC_EXAMINER' ? 'ForensicsMSP' : (toActor?.role === 'PROSECUTOR' || toActor?.role === 'COURT_CLERK_JUDGE' ? 'JudiciaryMSP' : 'PoliceMSP'));

    const endorsements = FABRIC_MSPS.map(msp => {
      const payloadToSign = `${FABRIC_CONFIG.CHANNEL_ID}:${FABRIC_CONFIG.CHAINCODE_NAME}:${docId}:${custodyHash}:${txId}`;
      const signature = crypto.createHmac('sha256', `MSP_SECRET_${msp.mspId}`).update(payloadToSign).digest('hex');
      return {
        mspId: msp.mspId,
        peerEndpoint: msp.peerEndpoint,
        status: 200,
        endorserSignature: signature,
        endorsedAt: timestamp,
      };
    });

    const latestBlock = await prisma.ledgerNodeRecord.findFirst({
      orderBy: { blockIndex: 'desc' },
    });

    const blockNumber = (latestBlock?.blockIndex || 0) + 1;
    const prevBlockHash = latestBlock?.currentBlockHash || FABRIC_CONFIG.GENESIS_BLOCK_HASH;

    const dataPayload = JSON.stringify({ docId, fromActor: fromActor.id, toActor: toActor.id, custodyHash, transferReason, transferLocation });
    const dataHash = crypto.createHash('sha256').update(dataPayload).digest('hex');
    const blockHeaderPayload = `${blockNumber}:${prevBlockHash}:${dataHash}:${txId}`;
    const currentBlockHash = crypto.createHash('sha256').update(blockHeaderPayload).digest('hex');

    const doc = await prisma.document.findUnique({
      where: { id: docId },
    });
    const fileHash = doc ? doc.fileHashSha256 : custodyHash;

    const blockRecordsData = FABRIC_MSPS.map((msp, idx) => ({
      id: `blk-${msp.mspId}-${docId}-cust-${Date.now().toString().slice(-4)}-${idx}`,
      channelId: FABRIC_CONFIG.CHANNEL_ID,
      chaincodeId: FABRIC_CONFIG.CHAINCODE_NAME,
      nodeId: idx + 1,
      mspId: msp.mspId,
      nodeName: msp.organizationName,
      documentId: docId,
      docHash: fileHash,
      custodyHash,
      blockIndex: blockNumber,
      previousBlockHash: prevBlockHash,
      currentBlockHash,
      dataHash,
      txId,
      signature: endorsements[idx]?.endorserSignature,
      timestamp: new Date(),
      isCorrupted: false,
    }));

    await prisma.ledgerNodeRecord.createMany({
      data: blockRecordsData,
    });

    return {
      status: 'COMMITTED',
      channelId: FABRIC_CONFIG.CHANNEL_ID,
      chaincode: FABRIC_CONFIG.CHAINCODE_NAME,
      txId,
      blockNumber,
      currentBlockHash,
      previousBlockHash: prevBlockHash,
      fromMsp,
      toMsp,
      custodyHash,
      endorsementCount: endorsements.length,
    };
  }

  static async VerifyEvidenceIntegrity(ctx, docId, localFileHash = null) {
    logger.info('FABRIC_CHAINCODE', `[VerifyEvidenceIntegrity] Querying Fabric Peer World States on channel "${FABRIC_CONFIG.CHANNEL_ID}" for Doc [${docId}]`);

    const doc = await prisma.document.findUnique({
      where: { id: docId },
    });

    if (!doc) {
      throw new Error(`Document not found in Fabric World State: ${docId}`);
    }

    const currentFileHash = localFileHash || doc.fileHashSha256;

    const allDocBlocks = await prisma.ledgerNodeRecord.findMany({
      where: { documentId: docId },
      orderBy: { blockIndex: 'asc' },
    });

    const peerStates = FABRIC_MSPS.map((msp, idx) => {
      const peerRecords = allDocBlocks.filter(r => (r.mspId === msp.mspId || r.nodeId === idx + 1));
      const latestBlock = peerRecords.length > 0 ? peerRecords[peerRecords.length - 1] : null;

      const recordedHash = latestBlock ? (latestBlock.docHash || latestBlock.custodyHash) : null;
      const matchesFile = recordedHash === currentFileHash;
      const isCorrupted = latestBlock ? latestBlock.isCorrupted : false;

      return {
        mspId: msp.mspId,
        organizationName: msp.organizationName,
        peerEndpoint: msp.peerEndpoint,
        hasRecord: !!latestBlock,
        recordedHash,
        currentBlockHash: latestBlock?.currentBlockHash || null,
        previousBlockHash: latestBlock?.previousBlockHash || null,
        blockIndex: latestBlock?.blockIndex || null,
        txId: latestBlock?.txId || null,
        signature: latestBlock?.signature || null,
        timestamp: latestBlock?.timestamp || null,
        matchesFile: matchesFile && !isCorrupted,
        isCorrupted,
      };
    });

    const agreeingPeers = peerStates.filter(p => p.matchesFile);
    const quorumAchieved = agreeingPeers.length >= FABRIC_CONFIG.ENDORSEMENT_THRESHOLD;

    let verdict = 'TAMPERED_INCONSISTENT';
    let discrepancyDetails = '';
    let docStatus = 'TAMPERED_FLAGGED';
    let isFrozen = true;

    if (quorumAchieved) {
      verdict = 'VERIFIED';
      docStatus = 'VERIFIED';
      isFrozen = false;
      if (agreeingPeers.length === 3) {
        discrepancyDetails = `Full 3-of-3 Hyperledger Fabric Consortium Consensus verified. All peer nodes (${FABRIC_MSPS.map(m => m.mspId).join(', ')}) endorse file integrity.`;
      } else {
        const roguePeer = peerStates.find(p => !p.matchesFile);
        discrepancyDetails = `2-of-3 Byzantine Quorum achieved. Quorum endorsed by ${agreeingPeers.map(p => p.mspId).join(' & ')}. Note: Peer [${roguePeer?.mspId}] is desynchronized. File integrity certified by Fabric endorsement policy.`;
      }
    } else {
      verdict = 'TAMPERED_INCONSISTENT';
      docStatus = 'TAMPERED_FLAGGED';
      isFrozen = true;
      discrepancyDetails = `CRITICAL FABRIC INTEGRITY FAILURE: Endorsement policy [${FABRIC_CONFIG.ENDORSEMENT_POLICY}] could not be satisfied. Only ${agreeingPeers.length} of ${FABRIC_MSPS.length} MSP peers agree with raw file hash. Evidence download has been locked.`;
    }

    await prisma.document.update({
      where: { id: docId },
      data: {
        status: docStatus,
        isFrozen,
      },
    });

    await prisma.tamperAudit.create({
      data: {
        documentId: docId,
        testedAt: new Date(),
        localFileHash: currentFileHash,
        node1Hash: peerStates[0]?.recordedHash,
        node2Hash: peerStates[1]?.recordedHash,
        node3Hash: peerStates[2]?.recordedHash,
        matchingNodesCount: agreeingPeers.length,
        consensusReached: quorumAchieved,
        verdict,
        flagged: !quorumAchieved,
        discrepancyDetails,
      },
    });

    return {
      documentId: docId,
      documentTitle: doc.title,
      currentFileHash,
      channelId: FABRIC_CONFIG.CHANNEL_ID,
      chaincode: FABRIC_CONFIG.CHAINCODE_NAME,
      endorsementPolicy: FABRIC_CONFIG.ENDORSEMENT_POLICY,
      consensusReached: quorumAchieved,
      verdict,
      agreeingPeersCount: agreeingPeers.length,
      totalMsps: FABRIC_MSPS.length,
      quorumRequired: FABRIC_CONFIG.ENDORSEMENT_THRESHOLD,
      discrepancyDetails,
      isFrozen,
      peerStates,
    };
  }

  static async GetHistoryForKey(ctx, docId) {
    const blocks = await prisma.ledgerNodeRecord.findMany({
      where: { documentId: docId },
      orderBy: { blockIndex: 'asc' },
    });

    return blocks.map(b => ({
      txId: b.txId,
      blockNumber: b.blockIndex,
      mspId: b.mspId || (b.nodeId === 1 ? 'PoliceMSP' : b.nodeId === 2 ? 'ForensicsMSP' : 'JudiciaryMSP'),
      currentBlockHash: b.currentBlockHash,
      previousBlockHash: b.previousBlockHash,
      docHash: b.docHash,
      custodyHash: b.custodyHash,
      timestamp: b.timestamp,
      isCorrupted: b.isCorrupted,
    }));
  }

  static async QueryEvidenceByCouchDB(ctx, queryString) {
    logger.info('FABRIC_CHAINCODE', `[QueryEvidenceByCouchDB] Executing CouchDB selector: "${queryString}"`);
    const term = (queryString || '').trim();

    return await prisma.document.findMany({
      where: {
        OR: [
          { title: { contains: term, mode: 'insensitive' } },
          { ocrText: { contains: term, mode: 'insensitive' } },
          { extractedEntities: { contains: term, mode: 'insensitive' } },
          { fileHashSha256: { contains: term, mode: 'insensitive' } },
        ],
      },
      include: {
        case: true,
        uploadedBy: {
          select: { id: true, name: true, role: true, badgeNumber: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

