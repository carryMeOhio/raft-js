// Custom error classes
class RaftError extends Error {
  constructor(message, code, term = null, nodeId = null) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.term = term;
    this.nodeId = nodeId;
    this.timestamp = new Date().toISOString();
  }
}

class ElectionError extends RaftError {
  constructor(message, term, nodeId) {
    super(message, 'ELECTION_ERROR', term, nodeId);
  }
}

class ReplicationError extends RaftError {
  constructor(message, term, nodeId) {
    super(message, 'REPLICATION_ERROR', term, nodeId);
  }
}

class NetworkError extends RaftError {
  constructor(message, peer, term, nodeId) {
    super(message, 'NETWORK_ERROR', term, nodeId);
    this.peer = peer;
  }
}

class ValidationError extends RaftError {
  constructor(message, field) {
    super(message, 'VALIDATION_ERROR');
    this.field = field;
  }
}

class PersistenceError extends RaftError {
  constructor(message, operation) {
    super(message, 'PERSISTENCE_ERROR');
    this.operation = operation;
  }
}

// Error recovery utilities
class ErrorRecovery {
  static async withRetry(operation, maxRetries = 3, backoffMs = 100) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) {
          throw new RaftError(
            `Operation failed after ${maxRetries} attempts: ${error.message}`,
            'MAX_RETRIES_EXCEEDED'
          );
        }
        
        // Exponential backoff
        const delay = backoffMs * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  static async safeAsync(operation, fallback = null, logError = true) {
    try {
      return await operation();
    } catch (error) {
      if (logError) {
        console.error('Safe async operation failed:', error);
      }
      return fallback;
    }
  }

  static isRetryableError(error) {
    if (error.code === 'ECONNREFUSED' || 
        error.code === 'ENOTFOUND' || 
        error.code === 'ETIMEDOUT') {
      return true;
    }
    
    if (error.status >= 500 && error.status < 600) {
      return true;
    }
    
    return false;
  }
}

module.exports = {
  RaftError,
  ElectionError,
  ReplicationError,
  NetworkError,
  ValidationError,
  PersistenceError,
  ErrorRecovery
};
