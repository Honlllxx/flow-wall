CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_name TEXT NOT NULL UNIQUE,
  process_name TEXT,
  executable_path TEXT,
  icon_path TEXT,
  category TEXT DEFAULT 'other',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS websites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain TEXT NOT NULL UNIQUE,
  name TEXT,
  category TEXT DEFAULT 'other',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS app_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id INTEGER NOT NULL,
  start_time INTEGER NOT NULL,
  end_time INTEGER,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  window_title TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (app_id) REFERENCES applications(id)
);

CREATE TABLE IF NOT EXISTS website_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  website_id INTEGER NOT NULL,
  tab_id INTEGER,
  start_time INTEGER NOT NULL,
  end_time INTEGER,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  url TEXT,
  title TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (website_id) REFERENCES websites(id)
);

CREATE TABLE IF NOT EXISTS daily_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  total_duration_ms INTEGER NOT NULL DEFAULT 0,
  session_count INTEGER NOT NULL DEFAULT 0,
  hourly_data TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config_key TEXT NOT NULL UNIQUE,
  config_value TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL,
  description TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_name ON applications(app_name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_websites_domain ON websites(domain);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_config_key ON user_config(config_key);

CREATE INDEX IF NOT EXISTS idx_app_sessions_app_id ON app_sessions(app_id);
CREATE INDEX IF NOT EXISTS idx_app_sessions_time ON app_sessions(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_website_sessions_website_id ON website_sessions(website_id);
CREATE INDEX IF NOT EXISTS idx_website_sessions_time ON website_sessions(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date);
CREATE INDEX IF NOT EXISTS idx_daily_stats_target_date ON daily_stats(target_type, date);
CREATE INDEX IF NOT EXISTS idx_daily_stats_target_id ON daily_stats(target_type, target_id);
