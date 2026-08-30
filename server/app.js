import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import apiRouter from './routes/index.js';
import { errorHandler } from './middlewares/errorMiddleware.js';
import { custodyAuditMiddleware } from './middlewares/morganMiddleware.js';
import { logger } from './utils/logger.js';
import { dbStore } from './prisma/client.js';
import { initialSeedData } from './prisma/seed.js';

dbStore.initSeed(initialSeedData);

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(custodyAuditMiddleware);

app.use('/api', apiRouter);

app.use(errorHandler);

export default app;
