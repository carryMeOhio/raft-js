const { ValidationError } = require('./errors');

class Validator {
  static required(value, fieldName) {
    if (value === undefined || value === null) {
      throw new ValidationError(`${fieldName} is required`, fieldName);
    }
    return value;
  }

  static string(value, fieldName, { minLength = 0, maxLength = Infinity } = {}) {
    Validator.required(value, fieldName);
    
    if (typeof value !== 'string') {
      throw new ValidationError(`${fieldName} must be a string`, fieldName);
    }
    
    if (value.length < minLength) {
      throw new ValidationError(`${fieldName} must be at least ${minLength} characters`, fieldName);
    }
    
    if (value.length > maxLength) {
      throw new ValidationError(`${fieldName} must be at most ${maxLength} characters`, fieldName);
    }
    
    return value;
  }

  static number(value, fieldName, { min = -Infinity, max = Infinity, integer = false } = {}) {
    Validator.required(value, fieldName);
    
    if (typeof value !== 'number' || isNaN(value)) {
      throw new ValidationError(`${fieldName} must be a number`, fieldName);
    }
    
    if (integer && !Number.isInteger(value)) {
      throw new ValidationError(`${fieldName} must be an integer`, fieldName);
    }
    
    if (value < min) {
      throw new ValidationError(`${fieldName} must be at least ${min}`, fieldName);
    }
    
    if (value > max) {
      throw new ValidationError(`${fieldName} must be at most ${max}`, fieldName);
    }
    
    return value;
  }

  static array(value, fieldName, { minLength = 0, maxLength = Infinity } = {}) {
    Validator.required(value, fieldName);
    
    if (!Array.isArray(value)) {
      throw new ValidationError(`${fieldName} must be an array`, fieldName);
    }
    
    if (value.length < minLength) {
      throw new ValidationError(`${fieldName} must have at least ${minLength} items`, fieldName);
    }
    
    if (value.length > maxLength) {
      throw new ValidationError(`${fieldName} must have at most ${maxLength} items`, fieldName);
    }
    
    return value;
  }

  static boolean(value, fieldName) {
    Validator.required(value, fieldName);
    
    if (typeof value !== 'boolean') {
      throw new ValidationError(`${fieldName} must be a boolean`, fieldName);
    }
    
    return value;
  }

  static optional(value, validator) {
    if (value === undefined || value === null) {
      return value;
    }
    return validator(value);
  }
}

// Raft-specific validation schemas
const RaftValidators = {
  validateRequestVoteRequest(body) {
    const validated = {};
    
    validated.term = Validator.number(body.term, 'term', { min: 0, integer: true });
    validated.candidateId = Validator.string(body.candidateId, 'candidateId', { minLength: 1 });
    validated.lastLogIndex = Validator.number(body.lastLogIndex, 'lastLogIndex', { min: 0, integer: true });
    validated.lastLogTerm = Validator.number(body.lastLogTerm, 'lastLogTerm', { min: 0, integer: true });
    
    return validated;
  },

  validateAppendEntriesRequest(body) {
    const validated = {};
    
    validated.term = Validator.number(body.term, 'term', { min: 0, integer: true });
    validated.leaderId = Validator.string(body.leaderId, 'leaderId', { minLength: 1 });
    validated.prevLogIndex = Validator.number(body.prevLogIndex, 'prevLogIndex', { min: 0, integer: true });
    validated.prevLogTerm = Validator.number(body.prevLogTerm, 'prevLogTerm', { min: 0, integer: true });
    validated.leaderCommit = Validator.number(body.leaderCommit, 'leaderCommit', { min: 0, integer: true });
    
    // Entries is optional but if present must be an array
    if (body.entries !== undefined) {
      validated.entries = Validator.array(body.entries, 'entries', { maxLength: 1000 });
      
      // Validate each entry
      validated.entries.forEach((entry, index) => {
        if (!entry || typeof entry !== 'object') {
          throw new ValidationError(`entries[${index}] must be an object`, `entries[${index}]`);
        }
        
        if (entry.index !== undefined) {
          Validator.number(entry.index, `entries[${index}].index`, { min: 1, integer: true });
        }
        
        if (entry.term !== undefined) {
          Validator.number(entry.term, `entries[${index}].term`, { min: 0, integer: true });
        }
        
        if (entry.command !== undefined) {
          Validator.string(entry.command, `entries[${index}].command`, { maxLength: 10000 });
        }
      });
    } else {
      validated.entries = [];
    }
    
    return validated;
  },

  validateClientAppendRequest(body) {
    const validated = {};
    
    validated.command = Validator.string(body.command, 'command', { 
      minLength: 1, 
      maxLength: 10000 
    });
    
    return validated;
  }
};

// Middleware for Express validation
function createValidationMiddleware(validatorFn) {
  return (req, res, next) => {
    try {
      req.validatedBody = validatorFn(req.body || {});
      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          error: 'Validation failed',
          message: error.message,
          field: error.field
        });
      }
      next(error);
    }
  };
}

module.exports = {
  Validator,
  RaftValidators,
  createValidationMiddleware
};
