const { state } = require('./state');
const { raft } = require('./raft');

let electionHandle = null;

function randomElectionMs() {
  const [min, max] = state.cfg.electionTimeoutRange; return Math.floor(min + Math.random()*(max-min));
}

function resetElectionTimer(onTimeout) {
  clearElectionTimer();
  const ms = randomElectionMs();
  electionHandle = setTimeout(onTimeout, ms);
  state.electionTimer = electionHandle;
}

function clearElectionTimer() { if (electionHandle) { clearTimeout(electionHandle); electionHandle = null; } }

async function startElection() {
  raft.becomeCandidate();
  // vote for self; gather votes
  let votes = 1;
  const majority = Math.floor((state.peers.length + 1) / 2) + 1;
  await Promise.all(state.peers.map(async (peer) => {
    try {
      const res = await raft.sendRequestVote(peer);
      const data = res.data || {};
      if (data.term && data.term > state.currentTerm) {
        raft.becomeFollower(data.term, null);
      } else if (data.voteGranted) {
        votes += 1;
      }
    } catch {}
  }));
  if (state.role === 'candidate' && votes >= majority) {
    raft.becomeLeader();
    raft.startHeartbeat(state.cfg.heartbeatInterval);
  } else {
    // stay follower/candidate and retry later
    resetElectionTimer(onElectionTimeout);
  }
}

function onElectionTimeout() {
  if (state.role !== 'leader') startElection();
}

function onHeartbeatReceived() {
  // Any AppendEntries from a valid term should reset election timer
  resetElectionTimer(onElectionTimeout);
}

module.exports.timer = { resetElectionTimer, clearElectionTimer, onElectionTimeout, onHeartbeatReceived };