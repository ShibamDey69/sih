import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logDirectory = path.join(__dirname, '../logs');
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory, { recursive: true });
}

const auditLogFilePath = path.join(logDirectory, 'custody-audit.log');
const auditLogStream = fs.createWriteStream(auditLogFilePath, { flags: 'a' });

export const recentAuditLogs = [];
const MAX_LOG_ENTRIES = 200;

export const recordAuditEntry = (entry) => {
  recentAuditLogs.unshift(entry);
  if (recentAuditLogs.length > MAX_LOG_ENTRIES) {
    recentAuditLogs.pop();
  }
};

morgan.token('actor-badge', (req) => {
  return req.user?.badgeNumber || req.headers['x-actor-badge'] || 'ANON_ACTOR';
});

morgan.token('actor-role', (req) => {
  return req.user?.role || 'PUBLIC';
});

morgan.token('custody-flag', (req) => {
  const url = req.originalUrl || req.url;
  if (url.includes('/custody')) return '[CUSTODY_TRANSFER]';
  if (url.includes('/documents')) return '[EVIDENCE_DOC]';
  if (url.includes('/ledger')) return '[LEDGER_CONSENSUS]';
  if (url.includes('/cases')) return '[CASE_DOCKET]';
  if (url.includes('/users')) return '[USER_MGMT]';
  if (url.includes('/auth')) return '[AUTH_EVENT]';
  return '[HTTP_ACCESS]';
});

morgan.token('latency-ms', (req, res, digits) => {
  if (!req._startAt || !res._startAt) return '0.00ms';
  const ms = (res._startAt[0] - req._startAt[0]) * 1e3 + (res._startAt[1] - req._startAt[1]) * 1e-6;
  return `${ms.toFixed(digits === undefined ? 2 : digits)}ms`;
});

const fileFormat = (tokens, req, res) => {
  const status = Number(tokens.status(req, res));
  const latency = parseFloat(tokens['response-time'](req, res) || '0');
  
  const logEntry = {
    timestamp: new Date().toISOString(),
    method: tokens.method(req, res),
    url: tokens.url(req, res),
    status: status || 500,
    latencyMs: latency,
    actorBadge: tokens['actor-badge'](req, res),
    actorRole: tokens['actor-role'](req, res),
    category: tokens['custody-flag'](req, res),
    remoteAddr: req.ip || req.connection?.remoteAddress || '127.0.0.1',
    userAgent: req.get('user-agent') || 'Unknown',
  };

  recordAuditEntry(logEntry);
  return JSON.stringify(logEntry);
};

const consoleFormat = (tokens, req, res) => {
  const status = Number(tokens.status(req, res));
  let statusColor = '\x1b[32m';
  if (status >= 500) statusColor = '\x1b[31m';
  else if (status >= 400) statusColor = '\x1b[33m';
  else if (status >= 300) statusColor = '\x1b[36m';

  const method = tokens.method(req, res);
  const url = tokens.url(req, res);
  const latency = tokens['latency-ms'](req, res, 2);
  const actor = tokens['actor-badge'](req, res);
  const category = tokens['custody-flag'](req, res);
  const timestamp = new Date().toISOString();

  return `\x1b[90m[${timestamp}]\x1b[0m \x1b[35m${category}\x1b[0m \x1b[1m${method}\x1b[0m ${url} ${statusColor}${status}\x1b[0m \x1b[36m${latency}\x1b[0m \x1b[90m(Actor: ${actor})\x1b[0m`;
};

export const consoleAuditLogger = morgan(consoleFormat);
export const fileAuditLogger = morgan(fileFormat, { stream: auditLogStream });

export const custodyAuditMiddleware = (req, res, next) => {
  consoleAuditLogger(req, res, (err) => {
    if (err) return next(err);
    fileAuditLogger(req, res, next);
  });
};

export default custodyAuditMiddleware;
