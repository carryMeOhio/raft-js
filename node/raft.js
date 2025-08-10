const { state, ROLE, lastLogIndex, lastLogTerm, persistState, persistLog } = require('./state');
const { rpc } = require('./rpc');
const { getLogger } = require('./logger');
const { getMetrics } = require('./metrics');

function becomeFollower(term, leaderId=null) {
  const logger = getLogger();
  const metrics = getMetrics();
  const oldRole = state.role;
  const oldTerm = state.currentTerm;
  
  // Record leadership end
  if (oldRole === ROLE.LEADER) {
    metrics.recordLeadershipEnd();
  }
  
  if (term !== undefined && term > state.currentTerm) {
    state.currentTerm = term; 
    state.votedFor = null;
    // Persist state changes
    persistState().catch(err => logger.error('Failed to persist state', { error: err.message }));
  }
  clearHeartbeat();
  state.role = ROLE.FOLLOWER;
  state.leaderId = leaderId;
  
  logger.state('Became follower', {
    oldRole,
    oldTerm,
    newTerm: state.currentTerm,
    leaderId: leaderId,
    reason: term > oldTerm ? 'higher_term' : 'explicit'
  });
}

function becomeCandidate() {
  const logger = getLogger();
  const metrics = getMetrics();
  
  state.role = ROLE.CANDIDATE;
  state.currentTerm += 1;
  state.votedFor = state.id;
  // Persist state changes
  persistState().catch(err => logger.error('Failed to persist state', { error: err.message }));
  
  // Record election start
  metrics.recordElectionStart();
  
  logger.election('Became candidate', {
    term: state.currentTerm,
    votedFor: state.votedFor
  });
}

function becomeLeader() {
  const logger = getLogger();
  const metrics = getMetrics();
  
  state.role = ROLE.LEADER;
  state.leaderId = state.id;
  // init leader state
  for (const peer of state.peers) {
    // Start from index 1 for new followers, or lastLogIndex + 1 for existing followers
    // assume followers might be empty and start from 1
    state.nextIndex[peer] = 1;
    state.matchIndex[peer] = 0;
  }
  
  // Record election win
  metrics.recordElectionWin();
  
  logger.election('Became leader', {
    term: state.currentTerm,
    lastLogIndex: lastLogIndex(),
    peerCount: state.peers.length,
    nextIndex: state.nextIndex
  });
}

function logAt(index) { return state.log[index - 1]; }

function applyCommitted() {
  while (state.lastApplied < state.commitIndex) {
    state.lastApplied += 1;
    const entry = logAt(state.lastApplied);
  }
}

async function sendRequestVote(peer) {
  const body = {
    term: state.currentTerm,
    candidateId: state.id,
    lastLogIndex: lastLogIndex(),
    lastLogTerm: lastLogTerm()
  };
  return rpc.postJSON(peer, '/requestVote', body);
}

async function sendAppendEntries(peer, entries=[]) {
  const nextIdx = state.nextIndex[peer] || (lastLogIndex() + 1);
  const prevLogIndex = nextIdx - 1;
  const prevLogTerm = prevLogIndex > 0 ? (logAt(prevLogIndex)?.term || 0) : 0;
  const payloadEntries = entries.length ? entries : state.log.slice(nextIdx - 1);

  const logger = getLogger();
  logger.info('Sending AppendEntries', { 
    peer, 
    nextIdx, 
    prevLogIndex, 
    prevLogTerm, 
    entriesCount: payloadEntries.length,
    logLength: state.log.length,
    firstEntry: payloadEntries[0],
    lastEntry: payloadEntries[payloadEntries.length - 1]
  });

  const body = {
    term: state.currentTerm,
    leaderId: state.id,
    prevLogIndex,
    prevLogTerm,
    entries: payloadEntries,
    leaderCommit: state.commitIndex
  };
  return rpc.postJSON(peer, '/appendEntries', body);
}

async function replicateToAll() {
  const logger = getLogger();
  if (state.role !== ROLE.LEADER) return;
  
  logger.info('Starting replication to all peers', { 
    peerCount: state.peers.length, 
    peers: state.peers,
    lastLogIndex: lastLogIndex()
  });
  
  await Promise.all(state.peers.map(async (peer) => {
    try {
      const res = await sendAppendEntries(peer);
      logger.info('Replication response', { peer, res });
      if (!res.ok) {
        logger.error('Replication failed - response not ok', { peer, res });
        return;
      }
      const { success, term, conflictIndex } = res.data || {};
      if (term && term > state.currentTerm) {
        logger.info('Higher term received, becoming follower', { term, currentTerm: state.currentTerm });
        becomeFollower(term, null); 
        return;
      }
      if (success) {
        // advance next/match indexes
        state.matchIndex[peer] = lastLogIndex();
        state.nextIndex[peer] = lastLogIndex() + 1;
        logger.info('Replication successful', { peer, matchIndex: state.matchIndex[peer], nextIndex: state.nextIndex[peer] });
      } else if (conflictIndex) {
        // backoff nextIndex and retry next heartbeat
        state.nextIndex[peer] = Math.max(1, conflictIndex);
        logger.info('Replication conflict, backing off', { peer, conflictIndex, newNextIndex: state.nextIndex[peer] });
      }
    } catch (error) {
      logger.error('Replication error', { peer, error: error.message });
    }
  }));
  
  // Update commitIndex (majority rule)
  const Nmax = lastLogIndex();
  for (let N = Nmax; N > state.commitIndex; N--) {
    const count = 1 + state.peers.filter(p => (state.matchIndex[p] || 0) >= N).length; // leader counts itself
    if (count > Math.floor((state.peers.length + 1) / 2) && (logAt(N)?.term === state.currentTerm)) {
      state.commitIndex = N; 
      applyCommitted(); 
      logger.info('Commit index advanced', { newCommitIndex: state.commitIndex });
      // Persist the updated commit index
      persistState().catch(error => {
        logger.error('Failed to persist state after commit index update', { error: error.message });
      });
      break;
    }
  }
}

let hbHandle = null;
function startHeartbeat(intervalMs) {
  clearHeartbeat();
  hbHandle = setInterval(() => { replicateToAll().catch(()=>{}); }, intervalMs);
  state.heartbeatTimer = hbHandle;
}
function clearHeartbeat() { if (hbHandle) { clearInterval(hbHandle); hbHandle = null; } }

module.exports.raft = {
  becomeFollower, becomeCandidate, becomeLeader,
  sendRequestVote, sendAppendEntries, replicateToAll,
  startHeartbeat, clearHeartbeat, applyCommitted
};