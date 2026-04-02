const { app, BrowserWindow, screen, ipcMain, globalShortcut, Tray, Menu, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const isDev = require('electron-is-dev');
const Store = require('electron-store');
const AppUsageStore = require('./app-usage-store');
const AppUsageTracker = require('./app-usage-tracker');

const store = new Store();
const appUsageStore = new AppUsageStore();
const appUsageTracker = new AppUsageTracker();
let wallpaperWin = null;
let controlWin = null;
let tray = null;

// 关闭硬件加速防止黑屏/白屏
app.disableHardwareAcceleration();

// ==========================================
// 1. 窗口管理
// ==========================================

function createWallpaperWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  wallpaperWin = new BrowserWindow({
    width,
    height,
    x: 0, 
    y: 0,
    type: 'desktop', 
    frame: false,    
    transparent: true, 
    hasShadow: false,
    enableLargerThanScreen: true,
    resizable: false,
    focusable: false, 
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  wallpaperWin.setIgnoreMouseEvents(true, { forward: true });
  wallpaperWin.setSkipTaskbar(true);

  const startURL = isDev 
    ? 'http://localhost:5173/#/wallpaper' 
    : `file://${path.join(__dirname, '../dist/index.html')}#/wallpaper`;

  wallpaperWin.loadURL(startURL);
}

function createControlPanel() {
  controlWin = new BrowserWindow({
    width: 400,
    height: 600, // 稍微加高一点以容纳更多设置
    frame: false,
    transparent: true,
    show: false, 
    resizable: false,
    alwaysOnTop: true, 
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  const startURL = isDev 
    ? 'http://localhost:5173/#/control' 
    : `file://${path.join(__dirname, '../dist/index.html')}#/control`;

  controlWin.loadURL(startURL);

  controlWin.on('blur', () => controlWin.hide());
}

app.whenReady().then(() => {
  createWallpaperWindow();
  createControlPanel();

  globalShortcut.register('Alt+D', () => {
    if (controlWin.isVisible()) {
      controlWin.hide();
    } else {
      controlWin.center();
      controlWin.show();
      controlWin.focus();
    }
  });

  tray = new Tray(path.join(__dirname, '../public/icon.png'));
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示控制板', click: () => controlWin.show() },
    { label: '退出 FlowWall', click: () => app.quit() }
  ]);
  tray.setToolTip('FlowWall - 每日追踪');
  tray.setContextMenu(contextMenu);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});


// ==========================================
// 2. 核心业务逻辑 (IPC)
// ==========================================

// --- A. 基础数据 (增删查) ---

ipcMain.handle('get-data', () => {
  return store.get('stats', []);
});

ipcMain.on('add-entry', (event, newEntry) => {
  const currentData = store.get('stats', []) || [];
  
  // 本地日期处理
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const localDate = `${year}-${month}-${day}`;

  const entry = {
    ...newEntry,
    id: Date.now(),
    date: localDate,
    timestamp: Date.now()
  };
  
  const updatedData = [...currentData, entry];
  if (updatedData.length > 2000) updatedData.shift(); // 增加容量
  
  store.set('stats', updatedData);
  
  // 广播
  if (wallpaperWin) wallpaperWin.webContents.send('data-updated', updatedData);
  if (controlWin) controlWin.webContents.send('data-updated', updatedData);
});

ipcMain.on('delete-entry', (event, id) => {
  const currentData = store.get('stats', []) || [];
  const newData = currentData.filter(item => item.id !== id);
  
  store.set('stats', newData);
  
  if (wallpaperWin) wallpaperWin.webContents.send('data-updated', newData);
  if (controlWin) controlWin.webContents.send('data-updated', newData);
});


// --- B. 配置管理 (指标、权重、显示模式) ---

// 1. 获取/保存 指标定义 (Metrics)
ipcMain.handle('get-metrics', () => {
  const defaultMetrics = [
    { id: 'reading', label: '阅读', unit: '页', iconKey: 'book', color: '#60A5FA', target: 0, showGoal: true },
    { id: 'fitness', label: '健身', unit: '分钟', iconKey: 'activity', color: '#F87171', target: 0, showGoal: true },
    { id: 'focus',   label: '专注', unit: '小时', iconKey: 'zap', color: '#FBBF24', target: 0, showGoal: true },
    { id: 'water',   label: '饮水', unit: 'ml',   iconKey: 'coffee', color: '#34D399', target: 0, showGoal: true },
  ];
  return store.get('user-metrics', defaultMetrics);
});

ipcMain.on('save-metrics', (event, metrics) => {
  store.set('user-metrics', metrics);
  if (wallpaperWin) wallpaperWin.webContents.send('metrics-updated', metrics);
  if (controlWin) controlWin.webContents.send('metrics-updated', metrics);
});

// 2. 获取/保存 权重 (Weights)
ipcMain.handle('get-weights', () => {
  return store.get('weights', { '阅读': 10, '健身': 5, '专注': 20, '饮水': 0.1 });
});

ipcMain.on('save-weights', (event, weights) => {
  store.set('weights', weights);
  if (wallpaperWin) wallpaperWin.webContents.send('weights-updated', weights);
  if (controlWin) controlWin.webContents.send('weights-updated', weights);
});

// 3. 获取/保存 显示配置 (Display Config)
ipcMain.handle('get-display-config', () => {
  return store.get('display-config', { 
    mode: 'single', 
    combinedMetrics: [], 
    multiMetrics: [], 
    combinedColor: '#60A5FA',
    combinedGoal: 0, 
    showCombinedGoal: true,
    showIndividualGoals: true,
    individualGoalModes: ['single', 'multi', 'overlay'],
    visibleButtons: ['raw', 'hour', 'day'], 
    customRanges: []
  });
});

ipcMain.on('save-display-config', (event, config) => {
  store.set('display-config', config);
  if (wallpaperWin) wallpaperWin.webContents.send('display-config-updated', config);
  if (controlWin) controlWin.webContents.send('display-config-updated', config);
});


// --- C. 窗口交互 ---

ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    win.setIgnoreMouseEvents(ignore, options);
  }
});


// ==========================================
// 4. 应用使用时间追踪 (App Usage Tracking)
// ==========================================

// --- A. 应用使用记录管理 ---

ipcMain.handle('get-app-usage-records', (event, options = {}) => {
  return appUsageStore.getAppUsageRecords(options);
});

ipcMain.handle('get-app-usage-summary', (event, dateRange = 'today') => {
  return appUsageStore.getAppUsageSummary(dateRange);
});

ipcMain.handle('get-top-apps', (event, limit = 10) => {
  const summary = appUsageStore.getAppUsageSummary('month');
  return summary.topApps.slice(0, limit);
});

ipcMain.on('add-app-usage-record', (event, record) => {
  const newRecord = appUsageStore.addAppUsageRecord(record);
  // 广播更新
  if (wallpaperWin) wallpaperWin.webContents.send('app-usage-updated', newRecord);
  if (controlWin) controlWin.webContents.send('app-usage-updated', newRecord);
});

ipcMain.on('delete-app-usage-record', (event, id) => {
  const deleted = appUsageStore.deleteAppUsageRecord(id);
  if (deleted) {
    // 广播更新
    if (wallpaperWin) wallpaperWin.webContents.send('app-usage-record-deleted', id);
    if (controlWin) controlWin.webContents.send('app-usage-record-deleted', id);
  }
});

ipcMain.handle('update-app-category', (event, appName, category) => {
  appUsageStore.updateAppCategory(appName, category);
  return { success: true };
});

ipcMain.handle('get-app-category', (event, appName) => {
  return appUsageStore.getAppCategory(appName);
});

ipcMain.handle('cleanup-app-usage-records', (event, maxAgeDays = 90) => {
  const removedCount = appUsageStore.cleanupOldRecords(maxAgeDays);
  return { success: true, removedCount };
});

// --- B. 浏览器使用记录管理 ---

ipcMain.handle('get-browser-usage-records', (event, options = {}) => {
  return appUsageStore.getBrowserUsageRecords(options);
});

ipcMain.handle('import-browser-usage-records', async (event, records) => {
  const importedCount = appUsageStore.importBrowserUsageRecords(records);
  // 广播更新
  if (wallpaperWin) wallpaperWin.webContents.send('browser-usage-imported', importedCount);
  if (controlWin) controlWin.webContents.send('browser-usage-imported', importedCount);
  return { success: true, importedCount };
});

// --- C. 设置管理 ---

ipcMain.handle('get-app-usage-settings', (event) => {
  return appUsageStore.getAppUsageSettings();
});

ipcMain.on('update-app-usage-settings', (event, settings) => {
  appUsageTracker.updateSettings(settings);
});

ipcMain.handle('get-browser-usage-settings', (event) => {
  return appUsageStore.getBrowserUsageSettings();
});

ipcMain.on('update-browser-usage-settings', (event, settings) => {
  appUsageStore.updateBrowserUsageSettings(settings);
});

// --- D. 数据导出 ---

ipcMain.handle('export-app-usage-data', async (event, format = 'json') => {
  const data = appUsageStore.exportAppUsageData(format);

  if (format === 'json') {
    const { filePath } = await dialog.showSaveDialog({
      title: 'Export App Usage Data',
      defaultPath: `app-usage-export-${Date.now()}.json`,
      filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });

    if (filePath) {
      try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return { success: true, filePath };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
    return { success: false, cancelled: true };
  } else if (format === 'csv') {
    const { filePath } = await dialog.showSaveDialog({
      title: 'Export App Usage Data',
      defaultPath: `app-usage-export-${Date.now()}.csv`,
      filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    });

    if (filePath) {
      try {
        fs.writeFileSync(filePath, data);
        return { success: true, filePath };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
    return { success: false, cancelled: true };
  }

  return { success: false, error: 'Unsupported format' };
});

// --- E. 追踪控制 ---

ipcMain.handle('start-app-tracking', async (event, options = {}) => {
  const success = appUsageTracker.startTracking(options);
  if (success) {
    // 广播追踪状态更新
    const status = appUsageTracker.getTrackingStatus();
    if (wallpaperWin) wallpaperWin.webContents.send('app-tracking-started', status);
    if (controlWin) controlWin.webContents.send('app-tracking-started', status);
  }
  return success;
});

ipcMain.handle('stop-app-tracking', async (event) => {
  const success = appUsageTracker.stopTracking();
  if (success) {
    // 广播追踪状态更新
    const status = appUsageTracker.getTrackingStatus();
    if (wallpaperWin) wallpaperWin.webContents.send('app-tracking-stopped', status);
    if (controlWin) controlWin.webContents.send('app-tracking-stopped', status);
  }
  return success;
});

ipcMain.handle('get-app-tracking-status', (event) => {
  return appUsageTracker.getTrackingStatus();
});




// ==========================================
// 3. 数据备份与恢复 (Import/Export)
// ==========================================

ipcMain.handle('export-data', async () => {
  const backupData = {
    timestamp: Date.now(),
    version: '1.0',
    stats: store.get('stats', []),
    weights: store.get('weights', {}),
    metrics: store.get('user-metrics', []),
    displayConfig: store.get('display-config', {})
  };

  const { filePath } = await dialog.showSaveDialog({
    title: 'Export FlowWall Data',
    defaultPath: 'flow-wall-backup.json',
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  });

  if (filePath) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  return { success: false, cancelled: true };
});

ipcMain.handle('import-data', async () => {
  const { filePaths } = await dialog.showOpenDialog({
    title: 'Import FlowWall Backup',
    properties: ['openFile'],
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  });

  if (filePaths && filePaths.length > 0) {
    try {
      const content = fs.readFileSync(filePaths[0], 'utf-8');
      const data = JSON.parse(content);

      if (!data.stats || !data.weights) {
        throw new Error('Invalid backup file format');
      }

      store.set('stats', data.stats);
      store.set('weights', data.weights);
      if (data.metrics) store.set('user-metrics', data.metrics);
      if (data.displayConfig) store.set('display-config', data.displayConfig);

      // 刷新所有窗口
      const wins = [wallpaperWin, controlWin];
      wins.forEach(w => {
        if (w && !w.isDestroyed()) {
          w.webContents.send('data-updated', data.stats);
          w.webContents.send('weights-updated', data.weights);
          if (data.metrics) w.webContents.send('metrics-updated', data.metrics);
          if (data.displayConfig) w.webContents.send('display-config-updated', data.displayConfig);
        }
      });

      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  return { success: false, cancelled: true };
});