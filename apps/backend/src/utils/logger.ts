import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

const pinoLogger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
  base: {
    env: process.env.NODE_ENV || 'development',
  },
});

// Wrapper to handle both (message, obj) and (obj, message) formats
export const logger = {
  info: (message: string, obj?: Record<string, unknown>) => {
    if (obj) {
      pinoLogger.info(obj, message);
    } else {
      pinoLogger.info(message);
    }
  },
  error: (message: string, obj?: Record<string, unknown>) => {
    if (obj) {
      pinoLogger.error(obj, message);
    } else {
      pinoLogger.error(message);
    }
  },
  warn: (message: string, obj?: Record<string, unknown>) => {
    if (obj) {
      pinoLogger.warn(obj, message);
    } else {
      pinoLogger.warn(message);
    }
  },
  debug: (message: string, obj?: Record<string, unknown>) => {
    if (obj) {
      pinoLogger.debug(obj, message);
    } else {
      pinoLogger.debug(message);
    }
  },
  fatal: (message: string, obj?: Record<string, unknown>) => {
    if (obj) {
      pinoLogger.fatal(obj, message);
    } else {
      pinoLogger.fatal(message);
    }
  },
};

export default logger;
