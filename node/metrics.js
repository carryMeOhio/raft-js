class Metrics {
  constructor() {
    this.data = {
      // Election metrics
      electionsStarted: 0,
      electionsWon: 0,
      electionsLost: 0,
      
      // RPC metrics
      requestVoteSent: 0,
      requestVoteReceived: 0,
      appendEntriesSent: 0,
      appendEntriesReceived: 0,
      
      // Success/failure rates
      requestVoteSuccess: 0,
      requestVoteFailure: 0,
      appendEntriesSuccess: 0,
      appendEntriesFailure: 0,
      
      // Log metrics
      logEntriesAppended: 0,
      logEntriesCommitted: 0,
      
      // Client metrics
      clientRequestsReceived: 0,
      clientRequestsSuccessful: 0,
      clientRequestsRedirected: 0,
      
      // Leadership metrics
      leadershipTerms: 0,
      leadershipDuration: 0,
      lastLeadershipStart: null,
      
      // Performance metrics
      averageElectionTime: 0,
      averageReplicationTime: 0,
      
      // Error metrics
      networkErrors: 0,
      persistenceErrors: 0,
      validationErrors: 0,
      
      // System metrics
      startTime: Date.now(),
      uptime: 0
    };
    
    this.timers = new Map();
  }

  increment(metric, value = 1) {
    if (this.data.hasOwnProperty(metric)) {
      this.data[metric] += value;
    }
  }

  set(metric, value) {
    if (this.data.hasOwnProperty(metric)) {
      this.data[metric] = value;
    }
  }

  startTimer(name) {
    this.timers.set(name, Date.now());
  }

  endTimer(name) {
    const startTime = this.timers.get(name);
    if (startTime) {
      this.timers.delete(name);
      return Date.now() - startTime;
    }
    return 0;
  }

  recordElectionStart() {
    this.increment('electionsStarted');
    this.startTimer('election');
  }

  recordElectionWin() {
    this.increment('electionsWon');
    this.increment('leadershipTerms');
    this.set('lastLeadershipStart', Date.now());
    
    const electionTime = this.endTimer('election');
    if (electionTime > 0) {
      this.data.averageElectionTime = (this.data.averageElectionTime * 0.9) + (electionTime * 0.1);
    }
  }

  recordElectionLoss() {
    this.increment('electionsLost');
    this.endTimer('election');
  }

  recordLeadershipEnd() {
    if (this.data.lastLeadershipStart) {
      const duration = Date.now() - this.data.lastLeadershipStart;
      this.data.leadershipDuration += duration;
      this.data.lastLeadershipStart = null;
    }
  }

  recordReplicationStart() {
    this.startTimer('replication');
  }

  recordReplicationEnd() {
    const replicationTime = this.endTimer('replication');
    if (replicationTime > 0) {
      this.data.averageReplicationTime = (this.data.averageReplicationTime * 0.9) + (replicationTime * 0.1);
    }
  }

  getSnapshot() {
    this.data.uptime = Date.now() - this.data.startTime;
    return { ...this.data };
  }

  reset() {
    const startTime = this.data.startTime;
    this.data = {
      ...Object.keys(this.data).reduce((acc, key) => {
        acc[key] = typeof this.data[key] === 'number' ? 0 : null;
        return acc;
      }, {}),
      startTime
    };
    this.timers.clear();
  }
}

// Global metrics instance
let globalMetrics = null;

function initializeMetrics() {
  globalMetrics = new Metrics();
  return globalMetrics;
}

function getMetrics() {
  if (!globalMetrics) {
    throw new Error('Metrics not initialized. Call initializeMetrics() first.');
  }
  return globalMetrics;
}

module.exports = {
  Metrics,
  initializeMetrics,
  getMetrics
};
