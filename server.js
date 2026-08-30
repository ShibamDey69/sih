import 'dotenv/config';
import app from './server/app.js';
import { logger } from './server/utils/logger.js';

const PORT = 3000;

app.get('/', (req, res) => {
  res.json({
    service: 'LexLedger - Evidence Custody & Distributed Verification Network',
    architecture: 'Hyperledger Fabric Consortium (Channel: evidence-consortium-channel)',
    msps: [
      { mspId: 'PoliceMSP', organization: 'State Police Department & Crime Records Bureau', endpoint: 'peer0.police.gov.in:7051' },
      { mspId: 'ForensicsMSP', organization: 'Central Forensic Science Laboratory (CFSL)', endpoint: 'peer0.forensics.gov.in:8051' },
      { mspId: 'JudiciaryMSP', organization: 'Judicial High Court Electronic Evidence Vault', endpoint: 'peer0.judiciary.gov.in:9051' },
    ],
    consensus: '2-of-3 Byzantine Quorum Endorsement with Raft Ordering Cluster',
    ocr: 'Local Tesseract.js (Pure offline, zero external LLM dependencies)',
    endpoints: {
      health: 'GET /api/health',
      auth: {
        login: 'POST /api/auth/login',
        switchPersona: 'POST /api/auth/switch-persona/:role',
        me: 'GET /api/auth/me',
        actors: 'GET /api/auth/actors',
      },
      cases: {
        list: 'GET /api/cases',
        create: 'POST /api/cases',
        get: 'GET /api/cases/:id',
        updateStatus: 'PATCH /api/cases/:id/status',
      },
      evidenceDocuments: {
        list: 'GET /api/documents',
        uploadAndVerify: 'POST /api/documents/upload-and-verify',
        get: 'GET /api/documents/:docId',
        verifyConsensus: 'GET /api/documents/:docId/verify',
        certificate65B: 'GET /api/documents/:docId/certificate-65b',
        freeze: 'PATCH /api/documents/:docId/freeze',
      },
      chainOfCustody: {
        transfer: 'POST /api/custody/transfer',
        trail: 'GET /api/custody/:docId/trail',
        auditLogs: 'GET /api/custody/audit/logs',
      },
      fabricLedger: {
        networkStatus: 'GET /api/ledger/fabric/network-status',
        blocks: 'GET /api/ledger/fabric/blocks',
        history: 'GET /api/ledger/fabric/history/:docId',
        consensus: 'GET /api/ledger/consensus/:docId',
        overview: 'GET /api/ledger/overview',
        metrics: 'GET /api/ledger/metrics',
        simulatePeerTamper: 'POST /api/ledger/simulate-tamper/node/:docId',
        simulateFileTamper: 'POST /api/ledger/simulate-tamper/file/:docId',
        reconcileHeal: 'POST /api/ledger/heal/:docId',
        chaincodeQuery: 'POST /api/ledger/fabric/query',
        chaincodeInvoke: 'POST /api/ledger/fabric/invoke',
      },
      search: 'GET /api/search?q=query',
    },
    status: 'ONLINE',
  });
});

app.listen(PORT, '0.0.0.0', () => {
  logger.info('SERVER_STARTUP', `LexLedger Server running on port ${PORT} in production mode`);
});
