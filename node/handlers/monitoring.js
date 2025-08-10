const { state } = require('../state');
const { getMetrics } = require('../metrics');
const { getLogger } = require('../logger');

function healthCheck(req, res) {
  const logger = getLogger();
  
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      node: {
        id: state.id,
        role: state.role,
        term: state.currentTerm,
        uptime: Date.now() - getMetrics().getSnapshot().startTime
      },
      cluster: {
        leaderId: state.leaderId,
        peerCount: state.peers.length,
        commitIndex: state.commitIndex,
        lastApplied: state.lastApplied,
        logSize: state.log.length
      }
    };

    // Determine health status
    let statusCode = 200;
    
    // Check if this node is functional
    if (!state.id || !state.cfg) {
      health.status = 'unhealthy';
      health.reason = 'Configuration not loaded';
      statusCode = 503;
    }
    
    // Check if cluster has a leader (for followers)
    if (state.role === 'follower' && !state.leaderId) {
      health.status = 'degraded';
      health.reason = 'No known leader';
      statusCode = 200;
    }
    
    // Check if too far behind (arbitrary threshold)
    if (state.commitIndex > 0 && (state.commitIndex - state.lastApplied) > 100) {
      health.status = 'degraded';
      health.reason = 'Far behind in log application';
      statusCode = 200;
    }

    res.status(statusCode).json(health);
    
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(500).json({
      status: 'unhealthy',
      reason: 'Health check error',
      timestamp: new Date().toISOString()
    });
  }
}

function readinessCheck(req, res) {
  const logger = getLogger();
  
  try {
    const readiness = {
      ready: true,
      timestamp: new Date().toISOString(),
      checks: {}
    };

    // Check if node is initialized
    readiness.checks.initialized = !!(state.id && state.cfg);
    
    // Check if persistence is working (if enabled)
    readiness.checks.persistence = !!state.storage;
    
    if (state.peers.length > 0) {
      readiness.checks.peerConnectivity = true;
      readiness.checks.peerConnectivity = true;
    }

    // Overall readiness
    readiness.ready = Object.values(readiness.checks).every(check => check === true);

    const statusCode = readiness.ready ? 200 : 503;
    res.status(statusCode).json(readiness);
    
  } catch (error) {
    logger.error('Readiness check failed', { error: error.message });
    res.status(503).json({
      ready: false,
      reason: 'Readiness check error',
      timestamp: new Date().toISOString()
    });
  }
}

function metricsEndpoint(req, res) {
  const logger = getLogger();
  
  try {
    const metrics = getMetrics().getSnapshot();
    
    // Add current state information
    const enrichedMetrics = {
      ...metrics,
      currentState: {
        nodeId: state.id,
        role: state.role,
        term: state.currentTerm,
        leaderId: state.leaderId,
        commitIndex: state.commitIndex,
        lastApplied: state.lastApplied,
        logSize: state.log.length,
        peerCount: state.peers.length
      },
      timestamp: new Date().toISOString()
    };

    res.json(enrichedMetrics);
    
  } catch (error) {
    logger.error('Metrics endpoint failed', { error: error.message });
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      timestamp: new Date().toISOString()
    });
  }
}

function statusEndpoint(req, res) {
  const logger = getLogger();
  
  try {
    const detailed = req.query.detailed === 'true';
    
    const status = {
      nodeId: state.id,
      role: state.role,
      term: state.currentTerm,
      votedFor: state.votedFor,
      leaderId: state.leaderId,
      commitIndex: state.commitIndex,
      lastApplied: state.lastApplied,
      logSize: state.log.length,
      peerCount: state.peers.length,
      timestamp: new Date().toISOString()
    };

    if (detailed) {
      status.log = state.log;
      status.peers = state.peers;
      status.nextIndex = state.nextIndex;
      status.matchIndex = state.matchIndex;
      status.config = {
        electionTimeoutRange: state.cfg?.electionTimeoutRange,
        heartbeatInterval: state.cfg?.heartbeatInterval
      };
    }

    res.json(status);
    
  } catch (error) {
    logger.error('Status endpoint failed', { error: error.message });
    res.status(500).json({
      error: 'Failed to retrieve status',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  healthCheck,
  readinessCheck,
  metricsEndpoint,
  statusEndpoint
};
