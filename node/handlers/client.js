const { state, lastLogIndex, persistLog } = require('../state');
const { raft } = require('../raft');
const { RaftValidators } = require('../validation');
const { getLogger } = require('../logger');

async function postAppend(req, res) {
  const logger = getLogger();
  
  try {
    const { command } = RaftValidators.validateClientAppendRequest(req.body || {});
    
    logger.info('Client append request', { command: command.substring(0, 100) });
    
    if (state.role !== 'leader') {
      logger.warn('Append request rejected - not leader', { 
        currentRole: state.role, 
        leaderId: state.leaderId 
      });
      return res.status(307).json({ error: 'not leader', leaderId: state.leaderId });
    }
  // Append to leader log (optimistically)
  const entry = { index: lastLogIndex() + 1, term: state.currentTerm, command };
  state.log.push(entry);
  
  // Persist the log entry
  persistLog().catch(err => console.error('Failed to persist log:', err));
  
  await raft.replicateToAll();
  
  const response = { 
    ok: true, 
    index: entry.index, 
    term: entry.term, 
    committed: entry.index <= state.commitIndex 
  };
  
  logger.info('Entry appended successfully', response);
  return res.json(response);
  
  } catch (error) {
    logger.error('Client append validation failed', { error: error.message });
    return res.status(400).json({ error: error.message });
  }
}

function getStatus(req, res) {
  res.json({
    id: state.id,
    role: state.role,
    term: state.currentTerm,
    votedFor: state.votedFor,
    leaderId: state.leaderId,
    commitIndex: state.commitIndex,
    lastApplied: state.lastApplied,
    log: state.log
  });
}

module.exports.clientHandlers = { postAppend, getStatus };