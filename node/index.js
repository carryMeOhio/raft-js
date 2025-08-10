const express = require('express');
const bodyParser = require('body-parser');
const CFG = require('./config');
const { state, ROLE, initializePersistence } = require('./state');
const { clientHandlers } = require('./handlers/client');
const { requestVoteHandler } = require('./handlers/requestVote');
const { appendEntriesHandler } = require('./handlers/appendEntries');
const { timer } = require('./timer');
const { initializeLogger, getLogger } = require('./logger');
const { initializeMetrics } = require('./metrics');
const { healthCheck, readinessCheck, metricsEndpoint, statusEndpoint } = require('./handlers/monitoring');

// Initialize state from config
state.id = CFG.id; state.port = CFG.port; state.cfg = CFG;
state.peers = CFG.peers.filter(u => !u.endsWith(`:${CFG.port}`));
state.peerMap = Object.fromEntries(state.peers.map(u => [u, u]));

const app = express();
app.use(bodyParser.json());

// Client endpoints
app.post('/append', clientHandlers.postAppend);
app.get('/status', statusEndpoint); // Enhanced status endpoint

// Raft RPC endpoints
app.post('/requestVote', requestVoteHandler.requestVote);
app.post('/appendEntries', appendEntriesHandler.appendEntries);

// Monitoring endpoints
app.get('/health', healthCheck);
app.get('/ready', readinessCheck);
app.get('/metrics', metricsEndpoint);

async function startServer() {
  try {
    // Initialize logger first
    const logger = initializeLogger(CFG.id);
    logger.info('Starting Raft node', { 
      nodeId: CFG.id, 
      port: CFG.port,
      peers: state.peers
    });

    // Initialize metrics
    initializeMetrics();
    logger.info('Metrics initialized');

    // Initialize persistence before starting
    await initializePersistence(CFG.id);
    logger.info('Persistence initialized');
    
    app.listen(CFG.port, () => {
      logger.info('Server started', {
        port: CFG.port,
        peerCount: state.peers.length,
        peers: state.peers
      });
      
      // Start as follower: arm election timer
      timer.resetElectionTimer(timer.onElectionTimeout);
      logger.state('Node initialized as follower', {
        role: state.role,
        term: state.currentTerm
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();