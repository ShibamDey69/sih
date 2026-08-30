import { logger } from '../utils/logger.js';

let prismaInstance = null;

export const getPrismaClient = async () => {
  if (!prismaInstance) {
    try {
      const prismaPkg = await import('@prisma/client');
      const PrismaClient = prismaPkg.PrismaClient || prismaPkg.default?.PrismaClient;
      if (PrismaClient) {
        prismaInstance = new PrismaClient({
          log: ['error', 'warn'],
        });
        logger.info('PRISMA_CLIENT', 'Prisma ORM Client initialized successfully');
      }
    } catch (err) {
      logger.warn('PRISMA_CLIENT', 'Standard Prisma binary fallback activated', err.message);
    }
  }
  return prismaInstance;
};

class MemoryDatabase {
  constructor() {
    this.users = [];
    this.cases = [];
    this.documents = [];
    this.custodyLogs = [];
    this.ledgerRecords = [];
    this.tamperAudits = [];
    this.initialized = false;
  }

  initSeed(seedData) {
    if (this.initialized) return;
    this.users = [...seedData.users];
    this.cases = [...seedData.cases];
    this.documents = [...seedData.documents];
    this.custodyLogs = [...seedData.custodyLogs];
    this.ledgerRecords = [...seedData.ledgerRecords];
    this.tamperAudits = [...seedData.tamperAudits];
    this.initialized = true;
    logger.info('DB_STORE', 'Database populated with initial seed records', {
      users: this.users.length,
      cases: this.cases.length,
      documents: this.documents.length,
      ledgerBlocks: this.ledgerRecords.length,
    });
  }
}

export const dbStore = new MemoryDatabase();
