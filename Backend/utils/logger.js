import config from '../config/env.js';

/**
 * Log levels
 */
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  verbose: 4,
};

const LEVEL_NAMES = Object.keys(LOG_LEVELS);

/**
 * Get current log level (lazy evaluation to avoid circular dependency)
 */
function getCurrentLevel() {
  try {
    return LOG_LEVELS[config.LOG_LEVEL] || LOG_LEVELS.info;
  } catch (error) {
    // Fallback if config is not yet initialized
    return LOG_LEVELS.info;
  }
}

/**
 * Structured logger with request ID support
 */
class Logger {
  constructor(context = 'App') {
    this.context = context;
  }

  /**
   * Create a child logger with a specific context
   */
  child(context) {
    return new Logger(`${this.context}:${context}`);
  }

  /**
   * Format log entry
   */
  format(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      context: this.context,
      message,
      ...meta,
    };

    if (config.isProduction) {
      return JSON.stringify(logEntry);
    }

    // Pretty print for development
    const colorCodes = {
      error: '\x1b[31m', // Red
      warn: '\x1b[33m',  // Yellow
      info: '\x1b[36m',  // Cyan
      debug: '\x1b[35m', // Magenta
      verbose: '\x1b[90m', // Gray
    };
    const reset = '\x1b[0m';
    const color = colorCodes[level] || '';

    return `${color}[${timestamp}] ${level.toUpperCase()}${reset} [${this.context}] ${message}${Object.keys(meta).length ? ' ' + JSON.stringify(meta, null, 2) : ''}`;
  }

  /**
   * Log message if level is enabled
   */
  log(level, message, meta = {}) {
    const currentLevel = getCurrentLevel();
    if (LOG_LEVELS[level] <= currentLevel) {
      const formatted = this.format(level, message, meta);
      const output = level === 'error' ? console.error : console.log;
      output(formatted);
    }
  }

  error(message, meta = {}) {
    this.log('error', message, meta);
  }

  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  debug(message, meta = {}) {
    this.log('debug', message, meta);
  }

  verbose(message, meta = {}) {
    this.log('verbose', message, meta);
  }

  /**
   * Log HTTP request
   */
  request(req, res, responseTime) {
    if (!config.ENABLE_REQUEST_LOGGING) return;

    const meta = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      requestId: req.id || 'unknown',
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('user-agent'),
    };

    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    this.log(level, `${req.method} ${req.path} ${res.statusCode}`, meta);
  }
}

/**
 * Create logger instance
 */
export function createLogger(context) {
  return new Logger(context);
}

/**
 * Default logger instance
 */
export const logger = createLogger('App');

export default logger;
