import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from './client.js';
import { ROLES, DOCUMENT_STATUS, CUSTODY_STATUS } from '../config/constants.js';
import { logger } from '../utils/logger.js';

/*export const generateSha256 = (content) => {
  return crypto.createHash('sha256').update(content).digest('hex');
};

const passwordHash = bcrypt.hashSync('Pass@1234', 10);

export const defaultUsers = [
  {
    id: 'usr-io-01',
    badgeNumber: 'IO-9842',
    name: 'Inspector Amit Sharma',
    email: 'officer@police.gov.in',
    passwordHash,
    role: ROLES.INVESTIGATING_OFFICER,
    department: 'Special Crime Branch & Homicide',
    station: 'Central Division Police Station, New Delhi',
    designation: 'Senior Investigating Officer',
    createdAt: new Date('2026-08-01T09:00:00Z'),
    updatedAt: new Date('2026-08-01T09:00:00Z'),
  },
  {
    id: 'usr-sho-01',
    badgeNumber: 'SHO-1001',
    name: 'Station House Officer Rajesh Verma',
    email: 'sho@police.gov.in',
    passwordHash,
    role: ROLES.STATION_IN_CHARGE,
    department: 'Station Command & Administration',
    station: 'Central Division Police Station, New Delhi',
    designation: 'Station In-Charge (SHO)',
    createdAt: new Date('2026-08-01T09:00:00Z'),
    updatedAt: new Date('2026-08-01T09:00:00Z'),
  },
  {
    id: 'usr-fsl-01',
    badgeNumber: 'FSL-3309',
    name: 'Dr. Swati Sengupta',
    email: 'examiner@cfsl.gov.in',
    passwordHash,
    role: ROLES.FORENSIC_EXAMINER,
    department: 'Forensic Ballistics & Chemical Division',
    station: 'Central Forensic Science Laboratory (CFSL), New Delhi',
    designation: 'Senior Scientific Officer (Forensic Ballistics)',
    createdAt: new Date('2026-08-01T09:00:00Z'),
    updatedAt: new Date('2026-08-01T09:00:00Z'),
  },
  {
    id: 'usr-pros-01',
    badgeNumber: 'PP-4521',
    name: 'Advocate Sunita Rao',
    email: 'prosecutor@judiciary.gov.in',
    passwordHash,
    role: ROLES.PROSECUTOR,
    department: 'Directorate of Public Prosecution',
    station: 'State Legal & Prosecution Bureau',
    designation: 'Chief Public Prosecutor',
    createdAt: new Date('2026-08-01T09:00:00Z'),
    updatedAt: new Date('2026-08-01T09:00:00Z'),
  },
  {
    id: 'usr-judge-01',
    badgeNumber: 'JD-0077',
    name: 'Registrar Justice Anand Sen',
    email: 'judge@court.gov.in',
    passwordHash,
    role: ROLES.COURT_CLERK_JUDGE,
    department: 'High Court Judicial Registry',
    station: 'Principal Bench, Court Room 04',
    designation: 'Judicial Registrar / Magistrate',
    createdAt: new Date('2026-08-01T09:00:00Z'),
    updatedAt: new Date('2026-08-01T09:00:00Z'),
  },
];

export const defaultCases = [
  {
    id: 'case-2026-001',
    caseNumber: 'CASE/2026/DEL/0418',
    firNumber: 'FIR No. 142/2026',
    policeStation: 'Connaught Place Police Station',
    incidentDate: new Date('2026-08-14T21:30:00Z'),
    actAndSections: 'IPC 302, IPC 120B | BNS 103(1), BNS 61',
    complainant: 'Dr. Alok Nath Mukherjee',
    accused: 'Vikram Malhotra, Sameer Sheikh',
    description: 'Homicide investigation involving forged pharmaceutical supply chain and premeditated conspiracy at South Avenue warehouse.',
    status: 'UNDER_INVESTIGATION',
    createdById: 'usr-io-01',
    createdAt: new Date('2026-08-15T04:30:00Z'),
    updatedAt: new Date('2026-08-15T04:30:00Z'),
  },
  {
    id: 'case-2026-002',
    caseNumber: 'CASE/2026/DEL/0789',
    firNumber: 'FIR No. 89/2026',
    policeStation: 'Cyber Crime Police Station, South District',
    incidentDate: new Date('2026-08-18T14:15:00Z'),
    actAndSections: 'IPC 420, IT Act Sec 66C/66D | BNS 318(4), BNS 316',
    complainant: 'Apex Financial Services Ltd.',
    accused: 'Rohan Deshmukh, Global Crypto Liquidity LLP',
    description: 'Unauthorized SWIFT gateway intrusion and INR 42.5 Crore digital ledger siphon into decentralized mixing pools.',
    status: 'CHARGESHEET_FILED',
    createdById: 'usr-io-01',
    createdAt: new Date('2026-08-19T10:00:00Z'),
    updatedAt: new Date('2026-08-19T10:00:00Z'),
  },
];

const rawFir1Content = `FIRST INFORMATION REPORT (Under Section 154 Cr.P.C. / BNSS 173)
District: New Delhi | P.S.: Connaught Place | Year: 2026 | FIR No: 142/2026 | Date: 15/08/2026
1. Acts & Sections: Section 302 IPC (Murder), Section 120B IPC (Conspiracy), BNS 103(1), BNS 61
2. Occurrence of Offence: Date 14/08/2026 Time 21:30 hrs at Warehouse 4B, South Avenue
3. Complainant / Informant: Dr. Alok Nath Mukherjee, Resident of 12 Barakhamba Road
4. Accused Details: Vikram Malhotra S/o K.K. Malhotra, Sameer Sheikh
5. Investigating Officer: Inspector Amit Sharma (Badge #IO-9842)
6. Recovered Items: 9mm Beretta Pistol (Serial #BTA-99214), 2 spent cartridges, CCTV DVR
Details of Incident: Victim deceased found with ballistic trauma. Physical evidence sealed on spot.`;

const fir1Hash = generateSha256(rawFir1Content);

const rawBallisticsContent = `CENTRAL FORENSIC SCIENCE LABORATORY (CFSL) - BALLISTICS DIVISION
Report Ref: CFSL/DEL/BAL/2026/9942 | Related to FIR No: 142/2026 PS Connaught Place
Specimen: 9mm Beretta Pistol (Serial #BTA-99214) & Two 9mm spent brass cartridges
Findings: Striation microscopic comparison confirms cartridge casing B1 & B2 fired from recovered weapon.
Microscopic Toolmarks match suspect weapon breech face. Digital hash verified.
Analyst: Dr. Swati Sengupta, Senior Scientific Officer (Forensics)`;

const ballisticsHash = generateSha256(rawBallisticsContent);

export const defaultDocuments = [
  {
    id: 'doc-001',
    caseId: 'case-2026-001',
    title: 'Certified First Information Report (FIR Copy)',
    originalName: 'FIR_142_2026_Certified_Scan.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 245892,
    filePath: '/evidence/2026/08/fir_142_2026.pdf',
    fileHashSha256: fir1Hash,
    ocrText: rawFir1Content,
    extractedEntities: JSON.stringify({
      legalSections: ['Section 302 IPC', 'Section 120B IPC', 'BNS 103(1)', 'BNS 61'],
      firNumbers: ['FIR No. 142/2026'],
      policeStations: ['Connaught Place Police Station'],
      dates: ['14/08/2026', '15/08/2026'],
      accusedPersons: ['Vikram Malhotra', 'Sameer Sheikh'],
      complainants: ['Dr. Alok Nath Mukherjee'],
      investigatingOfficers: ['Inspector Amit Sharma (Badge #IO-9842)'],
      seizedArticles: ['9mm Beretta Pistol (Serial #BTA-99214)', '2 spent cartridges', 'CCTV DVR'],
    }),
    documentType: 'FIR_COPY',
    status: DOCUMENT_STATUS.VERIFIED,
    isFrozen: false,
    uploadedById: 'usr-io-01',
    createdAt: new Date('2026-08-15T05:00:00Z'),
    updatedAt: new Date('2026-08-15T05:00:00Z'),
  },
  {
    id: 'doc-002',
    caseId: 'case-2026-001',
    title: 'CFSL Ballistics & Striation Analysis Report',
    originalName: 'CFSL_Ballistics_Report_9942.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 1845120,
    filePath: '/evidence/2026/08/cfsl_ballistics_9942.pdf',
    fileHashSha256: ballisticsHash,
    ocrText: rawBallisticsContent,
    extractedEntities: JSON.stringify({
      legalSections: ['FIR No: 142/2026', 'Arms Act Section 25/27'],
      firNumbers: ['FIR No: 142/2026'],
      policeStations: ['Connaught Place'],
      dates: ['18/08/2026'],
      accusedPersons: ['Vikram Malhotra'],
      complainants: ['State Prosecution'],
      investigatingOfficers: ['Dr. Swati Sengupta (Forensic Officer)', 'Inspector Amit Sharma'],
      seizedArticles: ['9mm Beretta Pistol Serial #BTA-99214', 'Two 9mm spent brass cartridges'],
    }),
    documentType: 'BALLISTICS_REPORT',
    status: DOCUMENT_STATUS.VERIFIED,
    isFrozen: false,
    uploadedById: 'usr-io-01',
    createdAt: new Date('2026-08-18T16:00:00Z'),
    updatedAt: new Date('2026-08-18T16:00:00Z'),
  },
];

const custodyHash1 = generateSha256(`CUSTODY:doc-001:usr-io-01:usr-sho-01:${fir1Hash}`);
const custodyHash2 = generateSha256(`CUSTODY:doc-001:usr-sho-01:usr-pros-01:${custodyHash1}`);

export const defaultCustodyLogs = [
  {
    id: 'cust-001',
    documentId: 'doc-001',
    caseId: 'case-2026-001',
    fromActorId: 'usr-io-01',
    toActorId: 'usr-sho-01',
    transferReason: 'Submission of Original FIR physical & digital file to Station House Officer for supervisory sign-off.',
    transferLocation: 'Connaught Place PS - Station Command Room',
    timestamp: new Date('2026-08-15T06:00:00Z'),
    custodyHash: custodyHash1,
    status: CUSTODY_STATUS.RECEIVED_ACKNOWLEDGED,
    acknowledgementNote: 'Verified original ink signatures and digital cryptographic hash.',
  },
  {
    id: 'cust-002',
    documentId: 'doc-001',
    caseId: 'case-2026-001',
    fromActorId: 'usr-sho-01',
    toActorId: 'usr-pros-01',
    transferReason: 'Hand-over of Certified FIR and Case Diary to Directorate of Public Prosecution for remand hearing.',
    transferLocation: 'Patiala House Courts - Public Prosecutor Registry',
    timestamp: new Date('2026-08-16T10:30:00Z'),
    custodyHash: custodyHash2,
    status: CUSTODY_STATUS.RECEIVED_ACKNOWLEDGED,
    acknowledgementNote: 'Received in sealed electronic docket. Hash matches police ledger node.',
  },
];

export const buildLedgerBlock = (nodeId, nodeName, docId, docHash, custodyHash, blockIdx, prevHash, mspId) => {
  const payload = `${nodeId}:${docId}:${docHash}:${custodyHash || ''}:${blockIdx}:${prevHash}`;
  const currentBlockHash = generateSha256(payload);
  const signature = `SIG_NODE_${nodeId}_` + generateSha256(`SIGN:${nodeId}:${currentBlockHash}`).substring(0, 32);
  return {
    id: `blk-n${nodeId}-${blockIdx}`,
    channelId: 'evidence-consortium-channel',
    chaincodeId: 'evidence_custody_cc',
    nodeName,
    nodeId,
    mspId: mspId || (nodeId === 1 ? 'PoliceMSP' : nodeId === 2 ? 'ForensicsMSP' : 'JudiciaryMSP'),
    documentId: docId,
    docHash,
    custodyHash,
    blockIndex: blockIdx,
    previousBlockHash: prevHash,
    currentBlockHash,
    signature,
    timestamp: new Date('2026-08-15T05:05:00Z'),
    isCorrupted: false,
  };
};

const GENESIS = '0000000000000000000000000000000000000000000000000000000000000000';

export const defaultLedgerRecords = [
  buildLedgerBlock(1, 'Peer 0 - Police Central MSP', 'doc-001', fir1Hash, custodyHash1, 1, GENESIS, 'PoliceMSP'),
  buildLedgerBlock(1, 'Peer 0 - Police Central MSP', 'doc-002', ballisticsHash, null, 2, 'b17a89ffc9029a1b667e41', 'PoliceMSP'),

  buildLedgerBlock(2, 'Peer 0 - Forensic & State CFSL MSP', 'doc-001', fir1Hash, custodyHash1, 1, GENESIS, 'ForensicsMSP'),
  buildLedgerBlock(2, 'Peer 0 - Forensic & State CFSL MSP', 'doc-002', ballisticsHash, null, 2, 'b17a89ffc9029a1b667e41', 'ForensicsMSP'),

  buildLedgerBlock(3, 'Peer 0 - Judicial High Court MSP', 'doc-001', fir1Hash, custodyHash1, 1, GENESIS, 'JudiciaryMSP'),
  buildLedgerBlock(3, 'Peer 0 - Judicial High Court MSP', 'doc-002', ballisticsHash, null, 2, 'b17a89ffc9029a1b667e41', 'JudiciaryMSP'),
];

export const defaultTamperAudits = [
  {
    id: 'audit-001',
    documentId: 'doc-001',
    testedAt: new Date('2026-08-16T11:00:00Z'),
    localFileHash: fir1Hash,
    node1Hash: fir1Hash,
    node2Hash: fir1Hash,
    node3Hash: fir1Hash,
    matchingNodesCount: 3,
    consensusReached: true,
    verdict: 'VERIFIED',
    flagged: false,
    discrepancyDetails: 'All 3 independent ledger nodes agree with 100% cryptographic consensus.',
  },
];

export const seedDatabase = async () => {
  logger.info('PRISMA_SEED', 'Starting database seeding into Neon PostgreSQL...');

  for (const user of defaultUsers) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: user,
    });
  }
  logger.info('PRISMA_SEED', `Seeded ${defaultUsers.length} authorized users.`);

  for (const c of defaultCases) {
    await prisma.caseRecord.upsert({
      where: { caseNumber: c.caseNumber },
      update: {},
      create: c,
    });
  }
  logger.info('PRISMA_SEED', `Seeded ${defaultCases.length} case dockets.`);

  for (const doc of defaultDocuments) {
    await prisma.document.upsert({
      where: { id: doc.id },
      update: {},
      create: doc,
    });
  }
  logger.info('PRISMA_SEED', `Seeded ${defaultDocuments.length} evidence documents.`);

  for (const log of defaultCustodyLogs) {
    await prisma.custodyLog.upsert({
      where: { id: log.id },
      update: {},
      create: log,
    });
  }
  logger.info('PRISMA_SEED', `Seeded ${defaultCustodyLogs.length} chain of custody logs.`);

  for (const block of defaultLedgerRecords) {
    await prisma.ledgerNodeRecord.upsert({
      where: { id: block.id },
      update: {},
      create: block,
    });
  }
  logger.info('PRISMA_SEED', `Seeded ${defaultLedgerRecords.length} Hyperledger Fabric ledger block records.`);

  for (const audit of defaultTamperAudits) {
    await prisma.tamperAudit.upsert({
      where: { id: audit.id },
      update: {},
      create: audit,
    });
  }
  logger.info('PRISMA_SEED', `Seeded ${defaultTamperAudits.length} tamper audit records.`);

  logger.info('PRISMA_SEED', 'Neon PostgreSQL database seeding completed successfully.');
};

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error('PRISMA_SEED', 'Database seeding failed', err);
      process.exit(1);
    });
}

*/