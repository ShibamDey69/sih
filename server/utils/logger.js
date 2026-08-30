export const logger = {
  info: (module, message, data = null) => {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` | Data: ${JSON.stringify(data)}` : '';
    console.log(`\x1b[36m[${timestamp}] [INFO]\x1b[0m \x1b[33m[${module}]\x1b[0m ${message}${dataStr}`);
  },
  warn: (module, message, data = null) => {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` | Data: ${JSON.stringify(data)}` : '';
    console.warn(`\x1b[33m[${timestamp}] [WARN]\x1b[0m \x1b[33m[${module}]\x1b[0m ${message}${dataStr}`);
  },
  error: (module, message, error = null) => {
    const timestamp = new Date().toISOString();
    const errStr = error ? ` | Error: ${error.message || error}` : '';
    console.error(`\x1b[31m[${timestamp}] [ERROR]\x1b[0m \x1b[33m[${module}]\x1b[0m ${message}${errStr}`);
  },
  consensus: (module, verdict, details = {}) => {
    const timestamp = new Date().toISOString();
    const color = verdict === 'VERIFIED' ? '\x1b[32m' : '\x1b[41m\x1b[37m';
    console.log(`${color}[${timestamp}] [CONSENSUS-ENGINE: ${verdict}]\x1b[0m \x1b[33m[${module}]\x1b[0m ${JSON.stringify(details)}`);
  },
};
