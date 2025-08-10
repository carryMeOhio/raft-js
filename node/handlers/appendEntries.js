const { state: S, lastLogIndex: LLI } = require('../state');
const { raft: R } = require('../raft');
const { timer } = require('../timer');
const { RaftValidators } = require('../validation');
const { getLogger } = require('../logger');

function appendEntries(req, res) {
  const logger = getLogger();
  
  try {
    const { term, leaderId, prevLogIndex, prevLogTerm, entries, leaderCommit } = RaftValidators.validateAppendEntriesRequest(req.body || {});
    
    logger.rpc('Received AppendEntries', { 
      from: leaderId, 
      term, 
      prevLogIndex, 
      prevLogTerm, 
      entriesCount: entries.length,
      leaderCommit 
    });
  if (term < S.currentTerm) {
    return res.json({ term: S.currentTerm, success: false });
  }
  if (term > S.currentTerm) {
    R.becomeFollower(term, leaderId);
  } else {
    S.leaderId = leaderId;
  }

  // Reset election timer on valid heartbeat
  timer.onHeartbeatReceived();

  // Consistency check
  if (prevLogIndex > 0) {
    const local = S.log[prevLogIndex - 1];
    if (!local || local.term !== prevLogTerm) {
      // Tell leader where to backtrack
      const conflictIndex = Math.min(prevLogIndex, LLI());
      return res.json({ term: S.currentTerm, success: false, conflictIndex });
    }
  }

  // Append new entries, deleting conflicts
  let idx = prevLogIndex;
  for (const e of entries) {
    idx += 1;
    const existing = S.log[idx - 1];
    if (!existing || existing.term !== e.term) {
      S.log = S.log.slice(0, idx - 1);
      S.log.push({ index: idx, term: e.term, command: e.command });
    }
  }

  // Advance commit index
  if (leaderCommit > S.commitIndex) {
    S.commitIndex = Math.min(leaderCommit, LLI());
  }

  const response = { term: S.currentTerm, success: true, lastIndex: LLI() };
  
  logger.rpc('AppendEntries response', { 
    to: leaderId, 
    ...response 
  });
  
  return res.json(response);
  
  } catch (error) {
    logger.error('AppendEntries validation failed', { error: error.message });
    return res.status(400).json({ error: error.message });
  }
}

module.exports.appendEntriesHandler = { appendEntries };