const fs = require('fs').promises;
const path = require('path');

class PersistentStorage {
  constructor(nodeId) {
    this.dataDir = path.join(process.cwd(), 'data');
    this.stateFile = path.join(this.dataDir, `${nodeId}-state.json`);
    this.logFile = path.join(this.dataDir, `${nodeId}-log.json`);
  }

  async ensureDataDir() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }

  async saveState(currentTerm, votedFor) {
    await this.ensureDataDir();
    const state = {
      currentTerm: currentTerm || 0,
      votedFor: votedFor || null,
      timestamp: new Date().toISOString()
    };
    
    try {
      await fs.writeFile(this.stateFile, JSON.stringify(state, null, 2));
    } catch (error) {
      console.error('Failed to save persistent state:', error);
      throw error;
    }
  }

  async loadState() {
    try {
      const data = await fs.readFile(this.stateFile, 'utf8');
      const state = JSON.parse(data);
      return {
        currentTerm: state.currentTerm || 0,
        votedFor: state.votedFor || null
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, return defaults
        return { currentTerm: 0, votedFor: null };
      }
      console.error('Failed to load persistent state:', error);
      throw error;
    }
  }

  async saveLog(log) {
    await this.ensureDataDir();
    const logData = {
      entries: log || [],
      timestamp: new Date().toISOString()
    };
    
    try {
      await fs.writeFile(this.logFile, JSON.stringify(logData, null, 2));
    } catch (error) {
      console.error('Failed to save log:', error);
      throw error;
    }
  }

  async loadLog() {
    try {
      const data = await fs.readFile(this.logFile, 'utf8');
      const logData = JSON.parse(data);
      return logData.entries || [];
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, return empty log
        return [];
      }
      console.error('Failed to load log:', error);
      throw error;
    }
  }

  async appendLogEntry(entry) {
    const log = await this.loadLog();
    log.push(entry);
    await this.saveLog(log);
  }

  async clearData() {
    try {
      await fs.unlink(this.stateFile);
      await fs.unlink(this.logFile);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Failed to clear data:', error);
      }
    }
  }
}

module.exports = { PersistentStorage };
