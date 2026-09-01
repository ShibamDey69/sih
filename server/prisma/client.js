import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

if (!process.env.POSTGRES_URL) {
  logger.error('PRISMA_CLIENT', 'POSTGRES_URL environment variable is missing.');
}

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.POSTGRES_URL,
    },
  },
  log: ['error', 'warn'],
});

export const getPrismaClient = async () => {
  return prisma;
};

export const testDatabaseConnection = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('PRISMA_CLIENT', 'Connected to Neon PostgreSQL database successfully.');
    return true;
  } catch (err) {
    logger.error('PRISMA_CLIENT', 'Failed to connect to Neon PostgreSQL database', err);
    throw err;
  }
};

