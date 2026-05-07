const fs = require('fs');
const path = require('path');
const { getDatabase } = require('./index');

async function runMigrations() {
  const db = getDatabase();
  
  db.prepare(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL,
      description TEXT
    )
  `).run();
  
  const currentVersion = db.prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1').get();
  const current = currentVersion ? currentVersion.version : 0;
  
  const migrationDir = path.join(__dirname, 'migrations');
  let files;
  
  try {
    files = fs.readdirSync(migrationDir).filter(f => f.endsWith('.sql'));
  } catch (error) {
    console.error('Migration directory not found:', migrationDir);
    return;
  }
  
  files.sort();
  
  for (const file of files) {
    const match = file.match(/^(\d+)/);
    if (!match) continue;
    
    const version = parseInt(match[1]);
    if (version > current) {
      console.log(`Applying migration ${version}...`);
      
      const sql = fs.readFileSync(path.join(migrationDir, file), 'utf-8');
      
      const transaction = db.transaction(() => {
        db.exec(sql);
      });
      
      try {
        transaction();
        
        db.prepare(`
          INSERT INTO schema_version (version, applied_at, description)
          VALUES (?, ?, ?)
        `).run(version, Date.now(), file);
        
        console.log(`Migration ${version} applied successfully`);
      } catch (error) {
        console.error(`Migration ${version} failed:`, error);
        throw error;
      }
    }
  }
}

module.exports = {
  runMigrations
};
