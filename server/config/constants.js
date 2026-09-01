import 'dotenv/config';
export const ROLES = {
  INVESTIGATING_OFFICER: 'INVESTIGATING_OFFICER',
  STATION_IN_CHARGE: 'STATION_IN_CHARGE',
  FORENSIC_EXAMINER: 'FORENSIC_EXAMINER',
  PROSECUTOR: 'PROSECUTOR',
  COURT_CLERK_JUDGE: 'COURT_CLERK_JUDGE',
  ADMIN: 'ADMIN',
};

export const ROLE_TO_MSP_MAP = {
  INVESTIGATING_OFFICER: 'PoliceMSP',
  STATION_IN_CHARGE: 'PoliceMSP',
  ADMIN: 'PoliceMSP',
  FORENSIC_EXAMINER: 'ForensicsMSP',
  PROSECUTOR: 'JudiciaryMSP',
  COURT_CLERK_JUDGE: 'JudiciaryMSP',
};

export const DOCUMENT_STATUS = {
  VERIFIED: 'VERIFIED',
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  TAMPERED_FLAGGED: 'TAMPERED_FLAGGED',
  FROZEN: 'FROZEN',
};

export const CUSTODY_STATUS = {
  SUBMITTED: 'SUBMITTED',
  IN_TRANSIT: 'IN_TRANSIT',
  RECEIVED_ACKNOWLEDGED: 'RECEIVED_ACKNOWLEDGED',
  DISPUTED: 'DISPUTED',
};

export const DOCUMENT_TYPES = [
  { id: 'FIR_COPY', label: 'First Information Report (FIR)' },
  { id: 'SEIZURE_MEMO', label: 'Seizure & Recovery Memo' },
  { id: 'WITNESS_STATEMENT', label: 'Witness Statement (CrPC 161/BNSS 180)' },
  { id: 'FORENSIC_REPORT', label: 'Forensic & Chemical Analysis Report' },
  { id: 'BALLISTICS_REPORT', label: 'Ballistics & Firearm Expert Report' },
  { id: 'EVIDENCE_PHOTO', label: 'Crime Scene / Evidence Photography' },
  { id: 'AUDIO_VIDEO_CCTV', label: 'CCTV / Digital Audio Recording' },
];

export const LEDGER_NODES = [
  {
    id: 1,
    mspId: 'PoliceMSP',
    name: 'Peer 0 - Police Central MSP',
    shortName: 'Police MSP',
    authority: 'State Police Headquarters / Crime Records Bureau',
    peerEndpoint: process.env.POLICE_MSP_PEER.toString(),
    
  },
  {
    id: 2,
    mspId: 'ForensicsMSP',
    name: 'Peer 0 - Forensic & State CFSL MSP',
    shortName: 'State Forensic Lab',
    authority: 'Central Forensic Science Laboratory (CFSL)',
    peerEndpoint: process.env.FORENSICS_MSP_PEER.toString(),
    
  },
  {
    id: 3,
    mspId: 'JudiciaryMSP',
    name: 'Peer 0 - Judicial High Court MSP',
    shortName: 'Judiciary MSP',
    authority: 'High Court Electronic Vault / Judicial Registry',
    peerEndpoint: process.env.JUDICIARY_MSP_PEER.toString(),
    
  },
];
