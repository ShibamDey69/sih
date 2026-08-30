import crypto from 'crypto';
import { logger } from '../utils/logger.js';

export class HashService {
  static hashRawBytes(fileBuffer) {
    if (!fileBuffer) {
      throw new Error('File buffer is required for cryptographic hashing.');
    }
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    logger.info('HASH_SERVICE', `Computed SHA-256 for file buffer: ${hash.substring(0, 16)}...`);
    return hash;
  }

  static hashCustodyEvent(custodyPayload) {
    const { docId, fromActorId, toActorId, prevCustodyHash, timestamp } = custodyPayload;
    const rawData = `CUSTODY_EVENT:${docId}:${fromActorId}:${toActorId}:${prevCustodyHash || 'GENESIS'}:${timestamp || new Date().toISOString()}`;
    const hash = crypto.createHash('sha256').update(rawData).digest('hex');
    logger.info('HASH_SERVICE', `Computed Custody SHA-256: ${hash.substring(0, 16)}...`);
    return hash;
  }

  static generateNodeSignature(nodeId, blockHash) {
    const nodeSecret = `NODE_${nodeId}_AUTHENTICATOR_KEY_GOV_2026`;
    return crypto.createHmac('sha256', nodeSecret).update(blockHash).digest('hex');
  }

  static computeBlockHash(nodeId, docId, docHash, custodyHash, blockIndex, previousBlockHash) {
    const raw = `${nodeId}:${docId}:${docHash}:${custodyHash || ''}:${blockIndex}:${previousBlockHash}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }
}
