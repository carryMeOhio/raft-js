const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
const { NetworkError, ErrorRecovery } = require('./errors');

const DEFAULT_TIMEOUT = 5000;
const MAX_RETRIES = 3;

async function postJSON(url, path, body, options = {}) {
  const {
    timeout = DEFAULT_TIMEOUT,
    retries = MAX_RETRIES,
    retryOnError = true
  } = options;

  const operation = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(`${url}${path}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'raft-node/1.0'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      const text = await res.text();
      let data;
      
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        data = text;
      }

      const result = { 
        ok: res.ok, 
        status: res.status, 
        data,
        headers: Object.fromEntries(res.headers.entries())
      };

      if (!res.ok && res.status >= 500) {
        throw new NetworkError(
          `Server error: ${res.status} ${res.statusText}`,
          url,
          null,
          null
        );
      }

      return result;

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new NetworkError(`Request timeout after ${timeout}ms`, url);
      }
      
      if (error.code === 'ECONNREFUSED' || 
          error.code === 'ENOTFOUND' || 
          error.code === 'ETIMEDOUT') {
        throw new NetworkError(`Connection failed: ${error.message}`, url);
      }
      
      throw error;
    }
  };

  if (retryOnError) {
    return ErrorRecovery.withRetry(operation, retries, 100);
  } else {
    return operation();
  }
}

// Health check
async function healthCheck(url) {
  try {
    const result = await postJSON(url, '/health', {}, { 
      timeout: 2000, 
      retries: 1, 
      retryOnError: false 
    });
    return result.ok;
  } catch (error) {
    return false;
  }
}

module.exports.rpc = { postJSON, healthCheck };