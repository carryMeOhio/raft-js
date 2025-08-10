const { PersistentStorage } = require('./persistence');

const ROLE = { FOLLOWER: 'follower', CANDIDATE: 'candidate', LEADER: 'leader' };

const state = {
  // Persistent (in-memory)
  currentTerm: 0,
  votedFor: null,
  log: [],

  // Volatile
  // 1 - based; 0 - nothing commited
  commitIndex: 0,   
  lastApplied: 0,

  // Leader state (re-initialized on election)
  // peerId -> next index to send
  nextIndex: {},  
  // peerId -> highest replicated index 
  matchIndex: {},

  // Cluster/meta
  id: null,
  port: null,
  role: ROLE.FOLLOWER,
  // array of peer base URLs
  peers: [], 
  peerIds: [],            
  peerMap: {},
  // leader info (from heartbeats)            
  leaderId: null,

  // Timers
  electionTimer: null,
  heartbeatTimer: null,

  // filled from config.js
  cfg: null,

  // Persistence
  storage: null
};

function lastLogIndex() { return state.log.length; }
function lastLogTerm()  { return state.log.length ? state.log[state.log.length - 1].term : 0; }

// Persistence helper functions
async function initializePersistence(nodeId) {
  state.storage = new PersistentStorage(nodeId);
  
  try {
    // Load persistent state
    const persistentState = await state.storage.loadState();
    state.currentTerm = persistentState.currentTerm;
    state.votedFor = persistentState.votedFor;
    
    // Load log
    state.log = await state.storage.loadLog();
    
    console.log(`Loaded persistent state: term=${state.currentTerm}, votedFor=${state.votedFor}, logEntries=${state.log.length}`);
  } catch (error) {
    console.error('Failed to initialize persistence:', error);
    throw error;
  }
}

async function persistState() {
  if (state.storage) {
    try {
      await state.storage.saveState(state.currentTerm, state.votedFor);
    } catch (error) {
      console.error('Failed to persist state:', error);
    }
  }
}

async function persistLog() {
  if (state.storage) {
    try {
      await state.storage.saveLog(state.log);
    } catch (error) {
      console.error('Failed to persist log:', error);
    }
  }
}

module.exports = { 
  state, 
  ROLE, 
  lastLogIndex, 
  lastLogTerm, 
  initializePersistence, 
  persistState, 
  persistLog 
};