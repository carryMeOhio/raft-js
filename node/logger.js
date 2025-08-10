const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

class Logger {
  constructor(nodeId, logLevel = 'INFO') {
    this.nodeId = nodeId;
    this.logLevel = LOG_LEVELS[logLevel.toUpperCase()] || LOG_LEVELS.INFO;
    this.startTime = Date.now();
  }

  _formatMessage(level, message, context = {}) {
    const timestamp = new Date().toISOString();
    const uptime = Date.now() - this.startTime;
    
    const logEntry = {
      timestamp,
      level,
      nodeId: this.nodeId,
      uptime: `${(uptime / 1000).toFixed(2)}s`,
      message,
      ...context
    };

    return JSON.stringify(logEntry);
  }

  _log(level, levelName, message, context = {}) {
    if (level <= this.logLevel) {
      console.log(this._formatMessage(levelName, message, context));
    }
  }

  error(message, context = {}) {
    this._log(LOG_LEVELS.ERROR, 'ERROR', message, context);
  }

  warn(message, context = {}) {
    this._log(LOG_LEVELS.WARN, 'WARN', message, context);
  }

  info(message, context = {}) {
    this._log(LOG_LEVELS.INFO, 'INFO', message, context);
  }

  debug(message, context = {}) {
    this._log(LOG_LEVELS.DEBUG, 'DEBUG', message, context);
  }

  // Raft-specific logging methods
  election(message, context = {}) {
    this.info(`[ELECTION] ${message}`, { 
      category: 'election',
      ...context 
    });
  }

  replication(message, context = {}) {
    this.debug(`[REPLICATION] ${message}`, { 
      category: 'replication',
      ...context 
    });
  }

  rpc(message, context = {}) {
    this.debug(`[RPC] ${message}`, { 
      category: 'rpc',
      ...context 
    });
  }

  state(message, context = {}) {
    this.info(`[STATE] ${message}`, { 
      category: 'state',
      ...context 
    });
  }

  persistence(message, context = {}) {
    this.debug(`[PERSISTENCE] ${message}`, { 
      category: 'persistence',
      ...context 
    });
  }
}

// Global logger instance
let globalLogger = null;

function initializeLogger(nodeId, logLevel = process.env.LOG_LEVEL || 'INFO') {
  globalLogger = new Logger(nodeId, logLevel);
  return globalLogger;
}

function getLogger() {
  if (!globalLogger) {
    throw new Error('Logger not initialized. Call initializeLogger() first.');
  }
  return globalLogger;
}

module.exports = {
  Logger,
  initializeLogger,
  getLogger,
  LOG_LEVELS
};
