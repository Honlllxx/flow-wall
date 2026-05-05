
# FlowWall SQLite 数据库解决方案

## 目录
1. [需求分析与业务场景](#一需求分析与业务场景)
2. [数据库结构设计](#二数据库结构设计)
3. [索引策略](#三索引策略)
4. [版本控制与迁移方案](#四版本控制与迁移方案)
5. [事务管理机制](#五事务管理机制)
6. [性能优化措施](#六性能优化措施)
7. [安全策略](#七安全策略)
8. [备份与恢复机制](#八备份与恢复机制)
9. [实施步骤](#九实施步骤)
10. [验证方法](#十验证方法)
11. [代码示例](#十一代码示例)

---

## 一、需求分析与业务场景

### 业务数据类型
根据项目架构，需要存储以下核心数据：

| 数据类型 | 业务描述 | 数据特征 |
|---------|---------|---------|
| **应用使用记录** | 追踪各应用的使用时长、启动次数 | 高频写入、按时间查询 |
| **网站访问记录** | 浏览器扩展上报的网站访问数据 | 高频写入、需按域名/时间聚合 |
| **会话记录** | 每次应用/网站访问的详细会话 | 大量明细数据、需关联查询 |
| **用户配置** | 权重、指标、显示设置等 | 低频读写、结构相对稳定 |
| **每日统计汇总** | 按天聚合的统计数据 | 用于快速展示、减少实时计算 |

### 核心业务需求
1. **数据一致性**：会话记录与使用统计需保持同步
2. **查询效率**：支持按时间范围、应用名称、域名快速查询
3. **数据可靠性**：支持事务、防止数据丢失
4. **版本兼容**：支持数据库结构升级，不破坏现有数据
5. **跨平台支持**：Windows/macOS/Linux 路径适配

---

## 二、数据库结构设计

### 2.1 数据库文件路径规划

```
# 开发环境
./data/flowwall.db

# 生产环境（Electron）
Windows: %APPDATA%\FlowWall\flowwall.db
macOS: ~/Library/Application Support/FlowWall/flowwall.db
Linux: ~/.config/FlowWall/flowwall.db
```

### 2.2 表结构设计

#### 表 1：`applications`（应用信息表）
存储已识别的应用程序信息

| 字段名 | 类型 | 约束 | 说明 |
|-------|------|------|------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | 应用唯一标识 |
| `app_name` | TEXT | NOT NULL UNIQUE | 应用名称（如 "Chrome", "VS Code"） |
| `process_name` | TEXT | | 进程名（用于匹配） |
| `executable_path` | TEXT | | 可执行文件路径 |
| `icon_path` | TEXT | | 应用图标路径 |
| `category` | TEXT | DEFAULT 'other' | 应用分类（work/entertainment/utility） |
| `created_at` | INTEGER | NOT NULL | 创建时间戳 |
| `updated_at` | INTEGER | NOT NULL | 更新时间戳 |

#### 表 2：`websites`（网站信息表）
存储已访问的网站信息

| 字段名 | 类型 | 约束 | 说明 |
|-------|------|------|------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | 网站唯一标识 |
| `domain` | TEXT | NOT NULL UNIQUE | 域名（如 "google.com"） |
| `name` | TEXT | | 网站名称（从标题提取） |
| `category` | TEXT | DEFAULT 'other' | 网站分类 |
| `created_at` | INTEGER | NOT NULL | 创建时间戳 |
| `updated_at` | INTEGER | NOT NULL | 更新时间戳 |

#### 表 3：`app_sessions`（应用会话表）
记录每次应用使用的详细会话

| 字段名 | 类型 | 约束 | 说明 |
|-------|------|------|------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | 会话唯一标识 |
| `app_id` | INTEGER | NOT NULL, FOREIGN KEY | 关联应用 ID |
| `start_time` | INTEGER | NOT NULL | 会话开始时间戳 |
| `end_time` | INTEGER | | 会话结束时间戳（NULL 表示进行中） |
| `duration_ms` | INTEGER | NOT NULL DEFAULT 0 | 会话时长（毫秒） |
| `window_title` | TEXT | | 窗口标题 |
| `active` | INTEGER | NOT NULL DEFAULT 1 | 是否活跃（0/1） |
| `created_at` | INTEGER | NOT NULL | 创建时间戳 |

#### 表 4：`website_sessions`（网站会话表）
记录每次网站访问的详细会话

| 字段名 | 类型 | 约束 | 说明 |
|-------|------|------|------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | 会话唯一标识 |
| `website_id` | INTEGER | NOT NULL, FOREIGN KEY | 关联网站 ID |
| `tab_id` | INTEGER | | 浏览器标签页 ID |
| `start_time` | INTEGER | NOT NULL | 会话开始时间戳 |
| `end_time` | INTEGER | | 会话结束时间戳 |
| `duration_ms` | INTEGER | NOT NULL DEFAULT 0 | 会话时长（毫秒） |
| `url` | TEXT | | 完整访问 URL |
| `title` | TEXT | | 页面标题 |
| `active` | INTEGER | NOT NULL DEFAULT 1 | 是否活跃 |
| `created_at` | INTEGER | NOT NULL | 创建时间戳 |

#### 表 5：`daily_stats`（每日统计表）
按天聚合的统计数据（预计算，提升查询性能）

| 字段名 | 类型 | 约束 | 说明 |
|-------|------|------|------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | 记录唯一标识 |
| `target_type` | TEXT | NOT NULL | 目标类型（'app'/'website'） |
| `target_id` | INTEGER | NOT NULL | 关联应用/网站 ID |
| `date` | TEXT | NOT NULL | 日期（格式：YYYY-MM-DD） |
| `total_duration_ms` | INTEGER | NOT NULL DEFAULT 0 | 当日总时长 |
| `session_count` | INTEGER | NOT NULL DEFAULT 0 | 会话次数 |
| `hourly_data` | TEXT | | 24小时数据（JSON 数组） |
| `created_at` | INTEGER | NOT NULL | 创建时间戳 |
| `updated_at` | INTEGER | NOT NULL | 更新时间戳 |

#### 表 6：`user_config`（用户配置表）
存储用户配置项

| 字段名 | 类型 | 约束 | 说明 |
|-------|------|------|------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | 配置唯一标识 |
| `config_key` | TEXT | NOT NULL UNIQUE | 配置键名 |
| `config_value` | TEXT | NOT NULL | 配置值（JSON 格式） |
| `created_at` | INTEGER | NOT NULL | 创建时间戳 |
| `updated_at` | INTEGER | NOT NULL | 更新时间戳 |

#### 表 7：`schema_version`（版本控制表）
记录数据库结构版本，支持迁移

| 字段名 | 类型 | 约束 | 说明 |
|-------|------|------|------|
| `version` | INTEGER | PRIMARY KEY | 当前版本号 |
| `applied_at` | INTEGER | NOT NULL | 版本应用时间戳 |
| `description` | TEXT | | 版本变更描述 |

---

## 三、索引策略

### 3.1 主键索引（自动创建）
- `applications.id`
- `websites.id`
- `app_sessions.id`
- `website_sessions.id`
- `daily_stats.id`
- `user_config.id`
- `schema_version.version`

### 3.2 唯一索引
```sql
CREATE UNIQUE INDEX idx_applications_name ON applications(app_name);
CREATE UNIQUE INDEX idx_websites_domain ON websites(domain);
CREATE UNIQUE INDEX idx_user_config_key ON user_config(config_key);
```

### 3.3 普通索引（优化查询性能）
```sql
-- 按应用查询会话
CREATE INDEX idx_app_sessions_app_id ON app_sessions(app_id);
-- 按时间范围查询应用会话
CREATE INDEX idx_app_sessions_time ON app_sessions(start_time, end_time);

-- 按网站查询会话
CREATE INDEX idx_website_sessions_website_id ON website_sessions(website_id);
-- 按时间范围查询网站会话
CREATE INDEX idx_website_sessions_time ON website_sessions(start_time, end_time);

-- 按日期查询每日统计
CREATE INDEX idx_daily_stats_date ON daily_stats(date);
-- 按目标类型和日期查询
CREATE INDEX idx_daily_stats_target_date ON daily_stats(target_type, date);
-- 按目标ID查询统计
CREATE INDEX idx_daily_stats_target_id ON daily_stats(target_type, target_id);
```

---

## 四、版本控制与迁移方案

### 4.1 版本号管理
采用递增整数版本号，初始版本为 1

### 4.2 迁移脚本结构
```
./database/migrations/
  ├── 001_initial.sql        # 初始表结构
  ├── 002_add_category.sql   # 添加分类字段
  ├── 003_add_hourly_data.sql # 添加小时数据字段
  └── migration.js           # 迁移执行器
```

### 4.3 迁移执行流程
```javascript
// migration.js 核心逻辑
async function runMigrations(db) {
  // 获取当前版本
  const currentVersion = await getCurrentVersion(db);
  
  // 获取所有迁移文件并排序
  const migrations = await getMigrationFiles();
  
  // 依次执行未应用的迁移
  for (const migration of migrations) {
    const version = parseInt(migration.version);
    if (version > currentVersion) {
      await executeMigration(db, migration);
      await updateVersion(db, version);
    }
  }
}
```

### 4.4 迁移事务保障
每个迁移脚本作为独立事务执行，失败时自动回滚

---

## 五、事务管理机制

### 5.1 事务边界定义

| 操作场景 | 事务策略 | 隔离级别 |
|---------|---------|---------|
| 插入会话记录 | 独立事务 | DEFAULT |
| 更新会话结束时间 | 独立事务 | DEFAULT |
| 批量导入历史数据 | 批量事务 | DEFAULT |
| 更新每日统计 | 独立事务 | DEFAULT |
| 数据库迁移 | 每版本独立事务 | DEFAULT |

### 5.2 事务代码示例
```javascript
const db = require('better-sqlite3')('flowwall.db');

function createAppSession(appId, startTime) {
  const transaction = db.transaction((appId, startTime) => {
    // 1. 插入会话记录
    const insertSession = db.prepare(`
      INSERT INTO app_sessions (app_id, start_time, created_at)
      VALUES (?, ?, ?)
    `);
    const result = insertSession.run(appId, startTime, Date.now());
    
    // 2. 更新或创建当日统计
    const date = formatDate(startTime);
    const upsertStats = db.prepare(`
      INSERT INTO daily_stats (target_type, target_id, date, total_duration_ms, session_count, created_at, updated_at)
      VALUES ('app', ?, ?, 0, 1, ?, ?)
      ON CONFLICT(target_type, target_id, date) 
      DO UPDATE SET session_count = session_count + 1, updated_at = ?
    `);
    upsertStats.run(appId, date, Date.now(), Date.now(), Date.now());
    
    return result.lastInsertRowid;
  });
  
  return transaction(appId, startTime);
}
```

### 5.3 错误处理
```javascript
try {
  const sessionId = createAppSession(appId, startTime);
  console.log('Session created:', sessionId);
} catch (error) {
  console.error('Transaction failed:', error);
  // 事务已自动回滚，可进行重试或错误上报
}
```

---

## 六、性能优化措施

### 6.1 查询优化

#### 避免 SELECT *
```sql
-- 优化前
SELECT * FROM app_sessions WHERE app_id = 1;

-- 优化后
SELECT id, start_time, end_time, duration_ms FROM app_sessions WHERE app_id = 1;
```

#### 合理使用 LIMIT
```sql
-- 获取最近100条记录
SELECT * FROM app_sessions ORDER BY start_time DESC LIMIT 100;
```

#### 使用覆盖索引
```sql
-- 查询当日活跃应用（索引覆盖）
SELECT target_id, total_duration_ms 
FROM daily_stats 
WHERE date = '2024-01-15' AND target_type = 'app';
-- 索引 idx_daily_stats_target_date 可覆盖此查询
```

### 6.2 写入优化

#### 批量插入
```javascript
// 使用 prepare + run 批量插入
const insert = db.prepare(`
  INSERT INTO app_sessions (app_id, start_time, end_time, duration_ms, created_at)
  VALUES (?, ?, ?, ?, ?)
`);

const transaction = db.transaction((sessions) => {
  for (const session of sessions) {
    insert.run(session.appId, session.startTime, session.endTime, session.duration, Date.now());
  }
});

transaction(batchData); // 批量提交
```

#### WAL 模式（Write-Ahead Logging）
```sql
-- 启用 WAL 模式（提升写入性能）
PRAGMA journal_mode = WAL;
```

### 6.3 连接池配置
由于 SQLite 是嵌入式数据库，无需传统连接池。采用单例模式管理数据库连接：

```javascript
// db.js - 单例数据库连接
const Database = require('better-sqlite3');

let instance = null;

function getDatabase() {
  if (!instance) {
    const dbPath = getDatabasePath(); // 根据平台获取路径
    instance = new Database(dbPath, {
      fileMustExist: false,
      timeout: 5000, // 锁等待超时
      verbose: process.env.NODE_ENV === 'development' ? console.log : null
    });
    
    // 启用 WAL 模式
    instance.pragma('journal_mode = WAL');
    // 设置同步模式
    instance.pragma('synchronous = NORMAL');
    // 设置缓存大小（单位：页，每页 4KB）
    instance.pragma('cache_size = 2000');
  }
  return instance;
}

module.exports = getDatabase;
```

---

## 七、安全策略

### 7.1 数据加密

#### 敏感配置加密存储
```javascript
const crypto = require('crypto');

// 加密函数
function encrypt(text, secretKey) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', secretKey, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// 解密函数
function decrypt(text, secretKey) {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encrypted = Buffer.from(parts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', secretKey, iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}
```

#### 数据库文件权限控制
```javascript
// 设置数据库文件权限（仅当前用户可读）
const fs = require('fs');
const dbPath = getDatabasePath();

// Windows: 设置文件权限
if (process.platform === 'win32') {
  // 使用 icacls 或 win32-api 设置权限
} else {
  // macOS/Linux: 设置权限为 600
  fs.chmodSync(dbPath, 0o600);
}
```

### 7.2 输入验证与参数化查询

#### 防止 SQL 注入
```javascript
// 正确：使用参数化查询
const query = db.prepare('SELECT * FROM applications WHERE app_name = ?');
const result = query.get(userInput);

// 错误：字符串拼接（存在注入风险）
// const query = db.prepare(`SELECT * FROM applications WHERE app_name = '${userInput}'`);
```

#### 输入验证
```javascript
function validateAppName(name) {
  // 限制长度
  if (name.length > 255) throw new Error('应用名称过长');
  // 禁止特殊字符
  if (/[<>:"|?*]/.test(name)) throw new Error('应用名称包含非法字符');
  return name;
}
```

---

## 八、备份与恢复机制

### 8.1 自动备份策略

#### 备份时机
- 应用启动时（首次运行后）
- 每日定时备份（如凌晨 2:00）
- 用户手动触发备份
- 数据库结构迁移前

#### 备份路径
```
# 备份文件命名格式
flowwall_backup_YYYYMMDD_HHMMSS.db

# 备份目录
Windows: %APPDATA%\FlowWall\backups\
macOS: ~/Library/Application Support/FlowWall/backups/
Linux: ~/.config/FlowWall/backups/
```

#### 自动备份代码示例
```javascript
const fs = require('fs');
const path = require('path');

function createBackup() {
  const dbPath = getDatabasePath();
  const backupDir = getBackupDirectory();
  
  // 确保备份目录存在
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  // 生成备份文件名
  const timestamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
  const backupPath = path.join(backupDir, `flowwall_backup_${timestamp}.db`);
  
  // 复制数据库文件
  fs.copyFileSync(dbPath, backupPath);
  
  // 清理旧备份（保留最近 7 天）
  cleanupOldBackups(backupDir, 7);
  
  return backupPath;
}

function cleanupOldBackups(backupDir, retentionDays) {
  const files = fs.readdirSync(backupDir);
  const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  
  for (const file of files) {
    const filePath = path.join(backupDir, file);
    const stats = fs.statSync(filePath);
    if (stats.mtime.getTime() < cutoffTime) {
      fs.unlinkSync(filePath);
    }
  }
}
```

### 8.2 数据恢复流程

```javascript
function restoreFromBackup(backupPath) {
  const dbPath = getDatabasePath();
  
  // 验证备份文件
  if (!fs.existsSync(backupPath)) {
    throw new Error('备份文件不存在');
  }
  
  // 关闭数据库连接
  if (instance) {
    instance.close();
    instance = null;
  }
  
  // 复制备份文件到数据库路径
  fs.copyFileSync(backupPath, dbPath);
  
  // 重新打开数据库
  return getDatabase();
}
```

---

## 九、实施步骤

### 阶段 1：环境准备（第 1-2 天）
1. 安装依赖：`npm install better-sqlite3`
2. 创建数据库目录结构
3. 编写数据库连接单例模块

### 阶段 2：表结构创建（第 3-4 天）
1. 创建初始迁移脚本（001_initial.sql）
2. 实现迁移执行器
3. 编写表结构单元测试

### 阶段 3：索引优化（第 5 天）
1. 根据查询需求创建索引
2. 编写查询性能测试

### 阶段 4：事务与业务逻辑集成（第 6-8 天）
1. 实现应用会话 CRUD
2. 实现网站会话 CRUD
3. 实现每日统计聚合逻辑

### 阶段 5：安全与备份（第 9-10 天）
1. 实现数据加密模块
2. 实现自动备份机制
3. 实现数据恢复功能

### 阶段 6：测试与验证（第 11-12 天）
1. 单元测试覆盖
2. 性能测试
3. 数据一致性验证

---

## 十、验证方法

### 10.1 功能验证

#### 数据写入验证
```javascript
// 验证应用会话写入
function testSessionInsert() {
  const db = getDatabase();
  
  // 1. 插入测试应用
  const insertApp = db.prepare(`
    INSERT INTO applications (app_name, category, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `);
  const appResult = insertApp.run('TestApp', 'work', Date.now(), Date.now());
  
  // 2. 插入测试会话
  const insertSession = db.prepare(`
    INSERT INTO app_sessions (app_id, start_time, duration_ms, created_at)
    VALUES (?, ?, ?, ?)
  `);
  const sessionResult = insertSession.run(appResult.lastInsertRowid, Date.now(), 3600000, Date.now());
  
  // 3. 查询验证
  const query = db.prepare('SELECT * FROM app_sessions WHERE id = ?');
  const session = query.get(sessionResult.lastInsertRowid);
  
  console.assert(session.app_id === appResult.lastInsertRowid, '应用ID不匹配');
  console.assert(session.duration_ms === 3600000, '时长不匹配');
  
  console.log('会话写入测试通过');
}
```

### 10.2 性能验证

#### 查询性能测试
```javascript
function testQueryPerformance() {
  const db = getDatabase();
  
  // 测试：查询某应用最近100条会话
  const appId = 1;
  const iterations = 100;
  
  const startTime = Date.now();
  for (let i = 0; i < iterations; i++) {
    const query = db.prepare(`
      SELECT id, start_time, end_time 
      FROM app_sessions 
      WHERE app_id = ? 
      ORDER BY start_time DESC 
      LIMIT 100
    `);
    query.all(appId);
  }
  const endTime = Date.now();
  
  const avgTime = (endTime - startTime) / iterations;
  console.log(`平均查询时间: ${avgTime.toFixed(2)}ms`);
  
  // 性能指标：单次查询应 < 10ms
  console.assert(avgTime < 10, '查询性能不达标');
}
```

### 10.3 数据一致性验证

#### 事务回滚测试
```javascript
function testTransactionRollback() {
  const db = getDatabase();
  
  try {
    const transaction = db.transaction(() => {
      // 第一步成功
      db.prepare('INSERT INTO applications (app_name, created_at, updated_at) VALUES (?, ?, ?)')
        .run('TempApp', Date.now(), Date.now());
      
      // 第二步故意失败
      db.prepare('INSERT INTO non_existent_table (col) VALUES (1)').run();
    });
    
    transaction();
    console.log('测试失败：事务应抛出异常');
  } catch (error) {
    // 验证数据未被写入
    const count = db.prepare('SELECT COUNT(*) as cnt FROM applications WHERE app_name = ?')
      .get('TempApp').cnt;
    
    console.assert(count === 0, '事务未正确回滚');
    console.log('事务回滚测试通过');
  }
}
```

---

## 十一、代码示例

### 数据库初始化模块
```javascript
// database/index.js
const Database = require('better-sqlite3');
const path = require('path');

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
  
  // 确保目录存在
  require('fs').mkdirSync(appPath, { recursive: true });
  
  return path.join(appPath, 'flowwall.db');
}

function getDatabase() {
  if (!instance) {
    instance = new Database(getDatabasePath(), {
      fileMustExist: false,
      timeout: 5000,
      verbose: process.env.NODE_ENV === 'development' ? console.log : null
    });
    
    // 配置优化
    instance.pragma('journal_mode = WAL');
    instance.pragma('synchronous = NORMAL');
    instance.pragma('cache_size = 2000');
    instance.pragma('foreign_keys = ON'); // 启用外键约束
  }
  
  return instance;
}

module.exports = {
  getDatabase,
  getDatabasePath
};
```

### 迁移执行器
```javascript
// database/migration.js
const fs = require('fs');
const path = require('path');
const { getDatabase } = require('./index');

async function runMigrations() {
  const db = getDatabase();
  
  // 确保版本表存在
  db.prepare(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL,
      description TEXT
    )
  `).run();
  
  // 获取当前版本
  const currentVersion = db.prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1').get();
  const current = currentVersion ? currentVersion.version : 0;
  
  // 获取迁移文件
  const migrationDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationDir).filter(f => f.endsWith('.sql'));
  files.sort();
  
  // 执行迁移
  for (const file of files) {
    const version = parseInt(file.split('_')[0]);
    if (version > current) {
      console.log(`Applying migration ${version}...`);
      
      const sql = fs.readFileSync(path.join(migrationDir, file), 'utf-8');
      
      // 事务执行
      const transaction = db.transaction(() => {
        db.exec(sql);
      });
      
      try {
        transaction();
        
        // 记录版本
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
```

---

## 总结

本方案针对 FlowWall 项目的业务特点设计，核心优势：

1. **数据结构清晰**：分离应用/网站信息与会话记录，便于数据管理
2. **性能优化到位**：WAL 模式、合理索引、批量写入提升读写效率
3. **数据可靠性强**：事务支持、自动备份、版本迁移保障数据安全
4. **安全策略完善**：参数化查询防注入、文件权限控制、敏感数据加密
5. **易于维护扩展**：版本控制机制支持平滑升级

建议在实施时先进行小规模测试，验证性能和数据一致性，再逐步推广到生产环境。

---

**文档版本**: 1.0  
**创建日期**: 2024年1月  
**适用项目**: FlowWall Desktop App
