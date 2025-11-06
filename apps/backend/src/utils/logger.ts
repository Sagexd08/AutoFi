/**
 * Simple application logger
 * Logs structured messages to console (can be replaced with winston/pino later)
 */

const isProduction = process.env.NODE_ENV === 'production';

interface LogMeta {
  [key: string]: unknown;
}

class Logger {
  private context: string;

  constructor(context = 'App') {
    this.context = context;
  }

  private format(level: string, message: string, meta?: LogMeta): string {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      context: this.context,
      message,
      ...(meta && Object.keys(meta).length > 0 ? { meta } : {}),
    };

    if (isProduction) {
      return JSON.stringify(logEntry);
    }

    // Pretty print for development
    const colorCodes: Record<string, string> = {
      error: '\x1b[31m',
      warn: '\x1b[33m',
      info: '\x1b[36m',
      debug: '\x1b[35m',
    };
    const reset = '\x1b[0m';
    const color = colorCodes[level] || '';

    return `${color}[${timestamp}] ${level.toUpperCase()}${reset} [${this.context}] ${message}${meta && Object.keys(meta).length ? ' ' + JSON.stringify(meta, null, 2) : ''}`;
  }

  error(message: string, meta?: LogMeta): void {
    const formatted = this.format('error', message, meta);
    console.error(formatted);
  }

  warn(message: string, meta?: LogMeta): void {
    const formatted = this.format('warn', message, meta);
    console.warn(formatted);
  }

  info(message: string, meta?: LogMeta): void {
    const formatted = this.format('info', message, meta);
    console.log(formatted);
  }

  debug(message: string, meta?: LogMeta): void {
    if (!isProduction) {
      const formatted = this.format('debug', message, meta);
      console.debug(formatted);
    }
  }
}

export const logger = new Logger('Backend');
export default logger;

