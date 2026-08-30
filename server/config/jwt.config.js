export const JWT_CONFIG = {
  SECRET: process.env.JWT_SECRET || 'lexledger-super-secure-cryptographic-evidence-secret-2026',
  EXPIRES_IN: '24h',
  ISSUER: 'lexledger-police-auth-authority',
};
