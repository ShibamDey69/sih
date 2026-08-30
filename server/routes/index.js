import { Router } from 'express';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import caseRoutes from './caseRoutes.js';
import documentRoutes from './documentRoutes.js';
import custodyRoutes from './custodyRoutes.js';
import ledgerRoutes from './ledgerRoutes.js';
import searchRoutes from './searchRoutes.js';

const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/cases', caseRoutes);
apiRouter.use('/documents', documentRoutes);
apiRouter.use('/custody', custodyRoutes);
apiRouter.use('/ledger', ledgerRoutes);
apiRouter.use('/search', searchRoutes);

apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'LexLedger Hyperledger Fabric Evidence Consortium & Distributed Verification Engine',
    blockchainFramework: 'Hyperledger Fabric v2.5+ (Permissioned Consortium)',
    channel: 'evidence-consortium-channel',
    chaincode: 'evidence_custody_cc v2.0.0',
    ordererService: 'etcdraft (Raft Consensus Cluster)',
    endorsementPolicy: "OutOf(2, 'PoliceMSP.peer', 'ForensicsMSP.peer', 'JudiciaryMSP.peer')",
    timestamp: new Date().toISOString(),
    msps: [
      { mspId: 'PoliceMSP', name: 'State Police Department & Crime Records Bureau', peer: 'peer0.police.gov.in:7051', status: 'ONLINE' },
      { mspId: 'ForensicsMSP', name: 'Central Forensic Science Laboratory (CFSL)', peer: 'peer0.forensics.gov.in:8051', status: 'ONLINE' },
      { mspId: 'JudiciaryMSP', name: 'Judicial High Court Electronic Evidence Vault', peer: 'peer0.judiciary.gov.in:9051', status: 'ONLINE' },
    ],
  });
});

apiRouter.get('/docs', (req, res) => {
  res.json({
    title: 'LexLedger Hyperledger Fabric Backend API Specification',
    version: '2.0.0',
    description: 'Independent RESTful API backed by Hyperledger Fabric Channel ("evidence-consortium-channel"), Smart Contract ("evidence_custody_cc"), 3 MSPs (Police, Forensics, Judiciary), Raft Orderer, Local Tesseract OCR Engine, and Morgan Audit Middleware.',
    baseUrl: '/api',
    endpoints: {
      auth: [
        { method: 'POST', path: '/api/auth/login', desc: 'Authenticate with identifier (email/badge) & password, enrolls Fabric X.509 cert' },
        { method: 'POST', path: '/api/auth/switch-persona/:role', desc: 'Quick persona impersonation for authorized officials' },
        { method: 'GET', path: '/api/auth/me', desc: 'Get authenticated actor profile and Fabric MSP affiliation' },
        { method: 'GET', path: '/api/auth/actors', desc: 'Get all authorized actors for handoff selection' },
      ],
      users: [
        { method: 'POST', path: '/api/users/register', desc: 'Public or initial user registration' },
        { method: 'GET', path: '/api/users', desc: 'List all users with filtering by role/department/search' },
        { method: 'POST', path: '/api/users', desc: 'Create user and enroll in Fabric CA' },
        { method: 'GET', path: '/api/users/:id', desc: 'Get user profile by ID' },
        { method: 'PUT', path: '/api/users/:id', desc: 'Update/Edit user details, role, or station' },
        { method: 'DELETE', path: '/api/users/:id', desc: 'Delete or deactivate user' },
      ],
      cases: [
        { method: 'GET', path: '/api/cases', desc: 'List criminal case dockets' },
        { method: 'POST', path: '/api/cases', desc: 'Create new FIR / criminal case docket' },
        { method: 'GET', path: '/api/cases/:id', desc: 'Get case by ID with attached documents' },
      ],
      documents: [
        { method: 'POST', path: '/api/documents/upload-and-verify', desc: 'Ingest evidence file, compute SHA-256, run local Tesseract OCR, and submit CreateEvidenceRecord transaction to Fabric Channel with 2-of-3 MSP Endorsements' },
        { method: 'GET', path: '/api/documents', desc: 'List all evidence documents' },
        { method: 'GET', path: '/api/documents/:id', desc: 'Get single document with custody chain & Fabric block headers' },
        { method: 'GET', path: '/api/documents/:id/certificate-65b', desc: 'Generate Section 65B (IEA) / Section 63 (BSA) statutory electronic admissibility certificate' },
      ],
      custody: [
        { method: 'POST', path: '/api/custody/transfer', desc: 'Transfer custody to another officer and commit TransferCustody transaction to Fabric ledger' },
        { method: 'GET', path: '/api/custody/:docId/trail', desc: 'Retrieve full chained custody audit trail for document' },
        { method: 'GET', path: '/api/custody/audit/logs', desc: 'Get real-time Morgan custody access and HTTP audit logs' },
      ],
      ledger: [
        { method: 'GET', path: '/api/ledger/fabric/network-status', desc: 'Query Hyperledger Fabric Channel, Chaincode, MSPs, and Raft Orderer status' },
        { method: 'GET', path: '/api/ledger/fabric/blocks', desc: 'Browse Hyperledger Fabric Channel Blocks with Tx IDs, Merkle roots, and MSP Endorsements' },
        { method: 'GET', path: '/api/ledger/fabric/history/:docId', desc: 'Execute Hyperledger Fabric GetHistoryForKey immutable provenance query' },
        { method: 'GET', path: '/api/ledger/consensus/:docId', desc: 'Execute 2-of-3 Byzantine Quorum & Fabric Endorsement Policy verification across MSP peers' },
        { method: 'GET', path: '/api/ledger/overview', desc: 'Query status and recent blocks across all 3 MSP peer nodes' },
        { method: 'GET', path: '/api/ledger/metrics', desc: 'Consortium health, block counts, and tamper audits' },
        { method: 'POST', path: '/api/ledger/simulate-tamper/node/:docId', desc: 'Simulate Byzantine state corruption on a specific MSP peer' },
        { method: 'POST', path: '/api/ledger/simulate-tamper/file/:docId', desc: 'Simulate disk byte corruption on raw evidence file' },
        { method: 'POST', path: '/api/ledger/heal/:docId', desc: 'Reconcile peer state using Fabric consensus majority' },
        { method: 'POST', path: '/api/ledger/fabric/invoke', desc: 'Generic Fabric Chaincode transaction invocation' },
        { method: 'POST', path: '/api/ledger/fabric/query', desc: 'Generic Fabric Chaincode transaction evaluation' },
      ],
      search: [
        { method: 'GET', path: '/api/search?q=keyword', desc: 'Universal full-text legal intelligence search backed by CouchDB selectors, OCR transcripts, IPC/BNS sections, FIRs, and accused names' },
      ],
    },
  });
});

export default apiRouter;
