import { LEDGER_NODES } from '../config/constants.js';
import { prisma } from '../prisma/client.js';

export class AuditService {
  static async getSystemMetrics() {
    const [
      totalCases,
      totalDocuments,
      verifiedDocuments,
      tamperedDocuments,
      totalCustodyLogs,
      totalLedgerBlocks,
      ledgerRecords,
      recentAudits,
    ] = await Promise.all([
      prisma.caseRecord.count(),
      prisma.document.count(),
      prisma.document.count({ where: { status: 'VERIFIED' } }),
      prisma.document.count({ where: { OR: [{ status: 'TAMPERED_FLAGGED' }, { isFrozen: true }] } }),
      prisma.custodyLog.count(),
      prisma.ledgerNodeRecord.count(),
      prisma.ledgerNodeRecord.findMany(),
      prisma.tamperAudit.findMany({ orderBy: { testedAt: 'desc' }, take: 10 }),
    ]);

    const nodeStatus = LEDGER_NODES.map(n => {
      const nodeBlocks = ledgerRecords.filter(r => r.nodeId === n.id || r.mspId === n.mspId);
      const corruptedBlocks = nodeBlocks.filter(r => r.isCorrupted).length;
      return {
        ...n,
        health: corruptedBlocks > 0 ? 'DEGRADED / TAMPER_DETECTED' : 'HEALTHY_SYNCED',
        corruptedBlocksCount: corruptedBlocks,
        totalBlocks: nodeBlocks.length,
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
      recentAudits,
    };
  }

  static async generateVerificationCertificate(documentId) {
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        case: true,
        ledgerRecords: true,
        custodyLogs: true,
      },
    });

    if (!doc) throw new Error(`Document ${documentId} not found`);

    const caseRecord = doc.case;
    const nodeBlocks = doc.ledgerRecords || [];
    const custodyTrail = doc.custodyLogs || [];

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
        blockSignature: nodeBlocks.find(b => b.nodeId === n.id || b.mspId === n.mspId)?.signature || 'N/A',
        timestamp: nodeBlocks.find(b => b.nodeId === n.id || b.mspId === n.mspId)?.timestamp || 'N/A',
      })),
      chainOfCustodyHandoffs: custodyTrail.length,
      digitalSeal: `LEDGER_IMMUTABLE_SEAL_V2_${doc.fileHashSha256.substring(0, 24)}`,
    };

    return certificate;
  }
}

