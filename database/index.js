const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let instance = null;

function getDatabasePath() {
  let basePath;
  
  if (process.platform === 'win32') {
    basePath = process.env.APPDATA;
  } else if (process.platform === 'darwin') {
    basePath = path.join(process.env.HOME, 'Library', 'Application Support');
  } else {
    basePath = path.join(process.env.HOME, '.config');
  }
  
  const appPath = path.join(basePath, 'FlowWall');
  
  if (!fs.existsSync(appPath)) {
    fs.mkdirSync(appPath, { recursive: true });
  }
  
  return path.join(appPath, 'flowwall.db');
}

function getDatabase() {
  if (!instance) {
    const dbPath = getDatabasePath();
    instance = new Database(dbPath, {
      fileMustExist: false,
      timeout: 5000,
      verbose: process.env.NODE_ENV === 'development' ? console.log : null
    });
    
    instance.pragma('journal_mode = WAL');
    instance.pragma('synchronous = NORMAL');
    instance.pragma('cache_size = 2000');
    instance.pragma('foreign_keys = ON');
  }
  
  return instance;
}

function closeDatabase() {
  if (instance) {
    instance.close();
    instance = null;
  }
}

module.exports = {
  getDatabase,
  getDatabasePath,
  closeDatabase
};
