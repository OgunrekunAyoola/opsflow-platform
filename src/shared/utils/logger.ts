import pino from 'pino';
import { getCorrelation } from './correlationContext';

const isDevelopment = process.env.NODE_ENV === 'development';

const _logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          translateTime: 'HH:MM:ss Z',
        },
      }
    : undefined,
  formatters: {
    level: (label) => ({ level: label.toUpperCase() }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Automatically inject correlationId from AsyncLocalStorage into every log line.
  mixin() {
    const ctx = getCorrelation();
    return ctx.correlationId ? ctx : {};
  },
});

// Normalise error values so pino can serialise them cleanly.
const normaliseErr = (err: unknown): object =>
  err instanceof Error ? { err: { message: err.message, stack: err.stack, name: err.name } } : { err };

type StructuredCtx = Record<string, unknown>;

// Supports two call forms:
//   logger.info('message')                          — plain message
//   logger.info('message', errorOrValue)            — legacy form (backwards compat)
//   logger.info({ event: 'foo', tenantId }, 'msg') — structured form (preferred)
function makeLevel(level: 'info' | 'warn' | 'error' | 'debug' | 'trace') {
  return (msgOrCtx: string | StructuredCtx, msgOrErr?: unknown): void => {
    if (typeof msgOrCtx === 'string') {
      // Legacy / plain form
      if (msgOrErr !== undefined) {
        _logger[level](normaliseErr(msgOrErr), msgOrCtx);
      } else {
        _logger[level](msgOrCtx);
      }
    } else {
      // Structured form: first arg is context object, second is message string
      const msg = typeof msgOrErr === 'string' ? msgOrErr : '';
      _logger[level](msgOrCtx, msg);
    }
  };
}

const logger = {
  info: makeLevel('info'),
  warn: makeLevel('warn'),
  error: makeLevel('error'),
  debug: makeLevel('debug'),
  http: makeLevel('trace'),
};

export default logger;
