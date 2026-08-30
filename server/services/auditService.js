import { dbStore } from '../prisma/client.js';
import { initialSeedData } from '../prisma/seed.js';
import { LEDGER_NODES } from '../config/constants.js';

export class AuditService {
  static _ensureInit() {
    if (!dbStore.initialized) {
      dbStore.initSeed(initialSeedData);
    }
  }

  static async getSystemMetrics() {
    this._ensureInit();

    const totalCases = dbStore.cases.length;
    const totalDocuments = dbStore.documents.length;
    const verifiedDocuments = dbStore.documents.filter(d => d.status === 'VERIFIED').length;
    const tamperedDocuments = dbStore.documents.filter(d => d.status === 'TAMPERED_FLAGGED' || d.isFrozen).length;
    const totalCustodyLogs = dbStore.custodyLogs.length;
    const totalLedgerBlocks = dbStore.ledgerRecords.length;

    const nodeStatus = LEDGER_NODES.map(n => {
      const corruptedBlocks = dbStore.ledgerRecords.filter(r => r.nodeId === n.id && r.isCorrupted).length;
      return {
        ...n,
        health: corruptedBlocks > 0 ? 'DEGRADED / TAMPER_DETECTED' : 'HEALTHY_SYNCED',
        corruptedBlocksCount: corruptedBlocks,
        totalBlocks: dbStore.ledgerRecords.filter(r => r.nodeId === n.id).length,
      };
    });

    return {
      totalCases,
      totalDocuments,
      verifiedDocuments,
      tamperedDocuments,
      totalCustodyLogs,
      totalLedgerBlocks,
      nodeStatus,
      recentAudits: dbStore.tamperAudits.slice(0, 10),
    };
  }

  static async generateVerificationCertificate(documentId) {
    this._ensureInit();
    const doc = dbStore.documents.find(d => d.id === documentId);
    if (!doc) throw new Error(`Document ${documentId} not found`);

    const caseRecord = dbStore.cases.find(c => c.id === doc.caseId);
    const nodeBlocks = dbStore.ledgerRecords.filter(r => r.documentId === documentId);
    const custodyTrail = dbStore.custodyLogs.filter(cl => cl.documentId === documentId);

    const certificate = {
      certificateNumber: `CERT-SEC65B-2026-${Math.floor(100000 + Math.random() * 900000)}`,
      statutoryCompliance: 'Issued under Section 65B Indian Evidence Act / Section 63 Bharatiya Sakshya Adhiniyam (BSA) 2023',
      issuedAt: new Date().toISOString(),
      documentTitle: doc.title,
      originalFileName: doc.originalName,
      sha256Hash: doc.fileHashSha256,
      caseNumber: caseRecord?.caseNumber || 'N/A',
      firNumber: caseRecord?.firNumber || 'N/A',
      policeStation: caseRecord?.policeStation || 'N/A',
      legalSections: caseRecord?.actAndSections || 'N/A',
      ledgerConsensusStatus: doc.status === 'VERIFIED' ? 'VALID_AND_AUTHENTIC' : 'INVALID_OR_TAMPERED',
      participatingNodes: LEDGER_NODES.map(n => ({
        nodeId: n.id,
        nodeName: n.name,
        authority: n.authority,
        blockSignature: nodeBlocks.find(b => b.nodeId === n.id)?.signature || 'N/A',
        timestamp: nodeBlocks.find(b => b.nodeId === n.id)?.timestamp || 'N/A',
      })),
      chainOfCustodyHandoffs: custodyTrail.length,
      digitalSeal: `LEDGER_IMMUTABLE_SEAL_V2_${doc.fileHashSha256.substring(0, 24)}`,
    };

    return certificate;
  }
}
