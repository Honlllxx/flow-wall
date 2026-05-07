const { getDatabase } = require('./index');

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const applications = {
  getById: (id) => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM applications WHERE id = ?').get(id);
  },
  
  getByName: (name) => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM applications WHERE app_name = ?').get(name);
  },
  
  getAll: () => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM applications ORDER BY app_name').all();
  },
  
  create: (data) => {
    const db = getDatabase();
    const now = Date.now();
    const result = db.prepare(`
      INSERT INTO applications (app_name, process_name, executable_path, icon_path, category, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(data.app_name, data.process_name, data.executable_path, data.icon_path, data.category || 'other', now, now);
    return result.lastInsertRowid;
  },
  
  update: (id, data) => {
    const db = getDatabase();
    return db.prepare(`
      UPDATE applications 
      SET app_name = ?, process_name = ?, executable_path = ?, icon_path = ?, category = ?, updated_at = ?
      WHERE id = ?
    `).run(data.app_name, data.process_name, data.executable_path, data.icon_path, data.category, Date.now(), id);
  },
  
  delete: (id) => {
    const db = getDatabase();
    return db.prepare('DELETE FROM applications WHERE id = ?').run(id);
  }
};

const websites = {
  getById: (id) => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM websites WHERE id = ?').get(id);
  },
  
  getByDomain: (domain) => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM websites WHERE domain = ?').get(domain);
  },
  
  getAll: () => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM websites ORDER BY domain').all();
  },
  
  create: (data) => {
    const db = getDatabase();
    const now = Date.now();
    const result = db.prepare(`
      INSERT INTO websites (domain, name, category, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(data.domain, data.name, data.category || 'other', now, now);
    return result.lastInsertRowid;
  },
  
  update: (id, data) => {
    const db = getDatabase();
    return db.prepare(`
      UPDATE websites SET domain = ?, name = ?, category = ?, updated_at = ? WHERE id = ?
    `).run(data.domain, data.name, data.category, Date.now(), id);
  },
  
  delete: (id) => {
    const db = getDatabase();
    return db.prepare('DELETE FROM websites WHERE id = ?').run(id);
  }
};

const appSessions = {
  getById: (id) => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM app_sessions WHERE id = ?').get(id);
  },
  
  getByAppId: (appId) => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM app_sessions WHERE app_id = ? ORDER BY start_time DESC').all(appId);
  },
  
  getRecent: (limit = 100) => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM app_sessions ORDER BY start_time DESC LIMIT ?').all(limit);
  },
  
  create: (data) => {
    const db = getDatabase();
    const now = Date.now();
    const result = db.prepare(`
      INSERT INTO app_sessions (app_id, start_time, end_time, duration_ms, window_title, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(data.app_id, data.start_time, data.end_time, data.duration_ms || 0, data.window_title, data.active || 1, now);
    return result.lastInsertRowid;
  },
  
  update: (id, data) => {
    const db = getDatabase();
    return db.prepare(`
      UPDATE app_sessions SET end_time = ?, duration_ms = ?, window_title = ?, active = ? WHERE id = ?
    `).run(data.end_time, data.duration_ms, data.window_title, data.active, id);
  },
  
  delete: (id) => {
    const db = getDatabase();
    return db.prepare('DELETE FROM app_sessions WHERE id = ?').run(id);
  }
};

const websiteSessions = {
  getById: (id) => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM website_sessions WHERE id = ?').get(id);
  },
  
  getByWebsiteId: (websiteId) => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM website_sessions WHERE website_id = ? ORDER BY start_time DESC').all(websiteId);
  },
  
  getRecent: (limit = 100) => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM website_sessions ORDER BY start_time DESC LIMIT ?').all(limit);
  },
  
  create: (data) => {
    const db = getDatabase();
    const now = Date.now();
    const result = db.prepare(`
      INSERT INTO website_sessions (website_id, tab_id, start_time, end_time, duration_ms, url, title, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(data.website_id, data.tab_id, data.start_time, data.end_time, data.duration_ms || 0, data.url, data.title, data.active || 1, now);
    return result.lastInsertRowid;
  },
  
  update: (id, data) => {
    const db = getDatabase();
    return db.prepare(`
      UPDATE website_sessions SET end_time = ?, duration_ms = ?, url = ?, title = ?, active = ? WHERE id = ?
    `).run(data.end_time, data.duration_ms, data.url, data.title, data.active, id);
  },
  
  delete: (id) => {
    const db = getDatabase();
    return db.prepare('DELETE FROM website_sessions WHERE id = ?').run(id);
  }
};

const dailyStats = {
  getByDate: (date) => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM daily_stats WHERE date = ?').all(date);
  },
  
  getByTarget: (targetType, targetId, date) => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM daily_stats WHERE target_type = ? AND target_id = ? AND date = ?').get(targetType, targetId, date);
  },
  
  createOrUpdate: (targetType, targetId, date, data) => {
    const db = getDatabase();
    const now = Date.now();
    
    const existing = dailyStats.getByTarget(targetType, targetId, date);
    
    if (existing) {
      return db.prepare(`
        UPDATE daily_stats 
        SET total_duration_ms = ?, session_count = ?, hourly_data = ?, updated_at = ?
        WHERE id = ?
      `).run(data.total_duration_ms, data.session_count, data.hourly_data, now, existing.id);
    } else {
      const result = db.prepare(`
        INSERT INTO daily_stats (target_type, target_id, date, total_duration_ms, session_count, hourly_data, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(targetType, targetId, date, data.total_duration_ms, data.session_count, data.hourly_data, now, now);
      return result.lastInsertRowid;
    }
  },
  
  delete: (id) => {
    const db = getDatabase();
    return db.prepare('DELETE FROM daily_stats WHERE id = ?').run(id);
  }
};

const userConfig = {
  getByKey: (key) => {
    const db = getDatabase();
    const result = db.prepare('SELECT config_value FROM user_config WHERE config_key = ?').get(key);
    return result ? JSON.parse(result.config_value) : null;
  },
  
  getAll: () => {
    const db = getDatabase();
    const results = db.prepare('SELECT config_key, config_value FROM user_config').all();
    return results.reduce((acc, item) => {
      acc[item.config_key] = JSON.parse(item.config_value);
      return acc;
    }, {});
  },
  
  set: (key, value) => {
    const db = getDatabase();
    const now = Date.now();
    const valueStr = JSON.stringify(value);
    
    const existing = db.prepare('SELECT id FROM user_config WHERE config_key = ?').get(key);
    
    if (existing) {
      return db.prepare('UPDATE user_config SET config_value = ?, updated_at = ? WHERE config_key = ?').run(valueStr, now, key);
    } else {
      const result = db.prepare(`
        INSERT INTO user_config (config_key, config_value, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `).run(key, valueStr, now, now);
      return result.lastInsertRowid;
    }
  },
  
  delete: (key) => {
    const db = getDatabase();
    return db.prepare('DELETE FROM user_config WHERE config_key = ?').run(key);
  }
};

const backup = {
  create: () => {
    const { getDatabasePath, closeDatabase, getDatabase } = require('./index');
    const fs = require('fs');
    const path = require('path');
    
    const dbPath = getDatabasePath();
    const backupDir = path.join(path.dirname(dbPath), 'backups');
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    const backupPath = path.join(backupDir, `flowwall_backup_${timestamp}.db`);
    
    fs.copyFileSync(dbPath, backupPath);
    
    const retentionDays = 7;
    const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(backupDir);
    
    for (const file of files) {
      const filePath = path.join(backupDir, file);
      const stats = fs.statSync(filePath);
      if (stats.mtime.getTime() < cutoffTime) {
        fs.unlinkSync(filePath);
      }
    }
    
    return backupPath;
  },
  
  restore: (backupPath) => {
    const { getDatabasePath, closeDatabase, getDatabase } = require('./index');
    const fs = require('fs');
    
    if (!fs.existsSync(backupPath)) {
      throw new Error('Backup file not found');
    }
    
    closeDatabase();
    
    const dbPath = getDatabasePath();
    fs.copyFileSync(backupPath, dbPath);
    
    return getDatabase();
  }
};

module.exports = {
  formatDate,
  applications,
  websites,
  appSessions,
  websiteSessions,
  dailyStats,
  userConfig,
  backup
};
