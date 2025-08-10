const { state: st, lastLogIndex: lli, lastLogTerm: llt } = require('../state');
const { raft: rf } = require('../raft');
const { RaftValidators } = require('../validation');
const { getLogger } = require('../logger');

function isCandidateUpToDate(cLastIndex, cLastTerm) {
  const myLastTerm = llt();
  if (cLastTerm !== myLastTerm) return cLastTerm > myLastTerm;
  return cLastIndex >= lli();
}

function requestVote(req, res) {
  const logger = getLogger();
  
  try {
    const { term, candidateId, lastLogIndex, lastLogTerm } = RaftValidators.validateRequestVoteRequest(req.body || {});
    
    logger.rpc('Received RequestVote', { 
      from: candidateId, 
      term, 
      lastLogIndex, 
      lastLogTerm 
    });

  if (term > st.currentTerm) {
    rf.becomeFollower(term, null);
  }
  let voteGranted = false;
  if (term < st.currentTerm) {
    voteGranted = false;
  } else {
    const notVotedOrThis = (st.votedFor === null || st.votedFor === candidateId);
    if (notVotedOrThis && isCandidateUpToDate(lastLogIndex, lastLogTerm)) {
      st.votedFor = candidateId;
      voteGranted = true;
    }
  }
  
  logger.rpc('RequestVote response', { 
    to: candidateId, 
    term: st.currentTerm, 
    voteGranted 
  });
  
  return res.json({ term: st.currentTerm, voteGranted });
  
  } catch (error) {
    logger.error('RequestVote validation failed', { error: error.message });
    return res.status(400).json({ error: error.message });
  }
}

module.exports.requestVoteHandler = { requestVote };