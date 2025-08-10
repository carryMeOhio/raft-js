const config = {
  // Unique identifier for the node
  id: process.env.NODE_ID || 'node1',

  // Port this node will listen on
  port: process.env.PORT || 3000,

  // Static list of peer URLs (excluding self)
  peers: (process.env.PEERS && process.env.PEERS.trim() !== '')
    ? process.env.PEERS.split(',').filter(peer => peer.trim() !== '')
    : [],

  // Randomized election timeout range in ms
  electionTimeoutRange: [300, 500],

  // Heartbeat interval (for leader to send heartbeats) in ms
  heartbeatInterval: 150
};

module.exports = config;
