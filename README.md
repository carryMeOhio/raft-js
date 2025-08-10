POC or simple version of RAFT protocol with javascript implementation

Created by Kyrylo Brener

Now running in local mode using node, dockerization - TBD

How to run:

# run first node
NODE_ID=node1 PORT=3000 PEERS=http://localhost:3001,http://localhost:3002 node node/index.js
# run secon node
NODE_ID=node2 PORT=3001 PEERS=http://localhost:3000,http://localhost:3002 node node/index.js
# run third node
NODE_ID=node3 PORT=3002 PEERS=http://localhost:3000,http://localhost:3001 node node/index.js

#check cluster status (which node is leader, how election went)
sleep 10
echo "=== Initial Cluster Status ==="
echo "Node 1:" && curl -s http://localhost:3000/status | jq '.role, .term, .leaderId, .commitIndex'
echo "Node 2:" && curl -s http://localhost:3001/status | jq '.role, .term, .leaderId, .commitIndex'
echo "Node 3:" && curl -s http://localhost:3002/status | jq '.role, .term, .leaderId, .commitIndex'

#post message and verify replication
# Post message to leader
echo "=== Posting Message ==="
# check leader node
curl -X POST http://localhost:3001/append -H "Content-Type: application/json" -d '{"command": "test-message"}' | jq '.'

echo "=== Verifying Replication ==="
echo "Node 1:" && curl -s http://localhost:3000/status | jq '.commitIndex, .lastApplied'
echo "Node 2:" && curl -s http://localhost:3001/status | jq '.commitIndex, .lastApplied'
echo "Node 3:" && curl -s http://localhost:3002/status | jq '.commitIndex, .lastApplied'

# Find and kill the leader node
echo "=== Killing Current Leader ==="
ps aux | grep "node node/index.js" | grep -v grep
# Kill the leader process
kill <LEADER_PID>

# wait for new leader election
sleep 15
echo "=== Status After Leader Failure ==="
echo "Node 1:" && curl -s http://localhost:3000/status | jq '.role, .term, .leaderId, .commitIndex'
echo "Node 2:" && curl -s http://localhost:3001/status | jq '.role, .term, .leaderId, .commitIndex'
echo "Node 3:" && curl -s http://localhost:3002/status | jq '.role, .term, .leaderId, .commitIndex'

# cleanup
pkill -f "node node/index.js"