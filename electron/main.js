const { app, BrowserWindow, screen, ipcMain, globalShortcut, Tray, Menu, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
// ❌ 删除: const isDev = require('electron-is-dev'); 
// 我们改用 app.isPackaged (Electron 自带功能，更稳定)
const Store = require('electron-store');

// ✅【新增】应用使用追踪器
const { getAppUsageTracker } = require('./modules/appUsageTracker');

const store = new Store();
let wallpaperWin = null;
let controlWin = null;
let tray = null;

// 关闭硬件加速 (解决 Windows 下透明窗口变白/黑的问题)
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

  // ✅ 【关键修复】使用 app.isPackaged 判断环境
  if (!app.isPackaged) {
    // 开发环境：连接 Vite 服务器
    wallpaperWin.loadURL('http://localhost:5173/#/wallpaper');
    // wallpaperWin.webContents.openDevTools({ mode: 'detach' }); // 可选：开发时打开控制台
  } else {
    // 生产环境 (.exe)：加载本地文件
    // main.js 在 /resources/app/electron/ 下，index.html 在 /resources/app/dist/ 下
    const indexPath = path.join(__dirname, '../dist/index.html');
    wallpaperWin.loadFile(indexPath, { hash: 'wallpaper' });
  }
}

function createControlPanel() {
  controlWin = new BrowserWindow({
    width: 400,
    height: 600,
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

  // ✅ 【关键修复】同上
  if (!app.isPackaged) {
    controlWin.loadURL('http://localhost:5173/#/control');
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html');
    controlWin.loadFile(indexPath, { hash: 'control' });
  }

  controlWin.on('blur', () => controlWin.hide());
}

app.whenReady().then(() => {
  // 生产环境下注册开机自启
  if (app.isPackaged) {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: app.getPath('exe'),
      args: ['--process-start-args', `"--hidden"`]
    });
  }

  // ✅【新增】初始化应用使用追踪器
  const appTracker = getAppUsageTracker();
  appTracker.setupIPC();
  
  // 自动开始追踪（可选）
  appTracker.start();

  createWallpaperWindow();
  createControlPanel();

  globalShortcut.register('Alt+D', () => {
    if (controlWin && !controlWin.isDestroyed()) {
      if (controlWin.isVisible()) {
        controlWin.hide();
      } else {
        controlWin.center();
        controlWin.show();
        controlWin.focus();
      }
    }
  });

  // ✅ 【关键修复】图标路径
  const iconPath = !app.isPackaged
    ? path.join(__dirname, '../public/icon.png') // 开发环境
    : path.join(process.resourcesPath, 'icon.png'); // 生产环境

  if (fs.existsSync(iconPath)) {
      tray = new Tray(iconPath);
      const contextMenu = Menu.buildFromTemplate([
        { label: 'Show Panel', click: () => controlWin.show() },
        { label: 'Exit', click: () => app.quit() }
      ]);
      tray.setToolTip('FlowWall');
      tray.setContextMenu(contextMenu);
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  
  // ✅【新增】停止应用使用追踪
  const appTracker = getAppUsageTracker();
  appTracker.stop();
});

// ==========================================
// 2. IPC 核心逻辑
// ==========================================

ipcMain.handle('get-data', () => store.get('stats', []));

ipcMain.on('add-entry', (event, newEntry) => {
  const currentData = store.get('stats', []) || [];
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const localDate = `${year}-${month}-${day}`;

  const entry = { ...newEntry, id: Date.now(), date: localDate, timestamp: Date.now() };
  const updatedData = [...currentData, entry];
  if (updatedData.length > 2000) updatedData.shift();
  
  store.set('stats', updatedData);
  
  // 广播更新
  [wallpaperWin, controlWin].forEach(w => {
    if (w && !w.isDestroyed()) w.webContents.send('data-updated', updatedData);
  });
});

ipcMain.on('delete-entry', (event, id) => {
  const currentData = store.get('stats', []) || [];
  const newData = currentData.filter(item => item.id !== id);
  store.set('stats', newData);
  
  [wallpaperWin, controlWin].forEach(w => {
    if (w && !w.isDestroyed()) w.webContents.send('data-updated', newData);
  });
});

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
  [wallpaperWin, controlWin].forEach(w => {
    if (w && !w.isDestroyed()) w.webContents.send('metrics-updated', metrics);
  });
});

ipcMain.handle('get-weights', () => store.get('weights', { '阅读': 10, '健身': 5, '专注': 20, '饮水': 0.1 }));

ipcMain.on('save-weights', (event, weights) => {
  store.set('weights', weights);
  [wallpaperWin, controlWin].forEach(w => {
    if (w && !w.isDestroyed()) w.webContents.send('weights-updated', weights);
  });
});

ipcMain.handle('get-display-config', () => {
  return store.get('display-config', { 
    mode: 'single', combinedMetrics: [], multiMetrics: [], combinedColor: '#60A5FA',
    combinedGoal: 0, showCombinedGoal: true, showIndividualGoals: true, 
    individualGoalModes: ['single', 'multi', 'overlay'],
    visibleButtons: ['raw', 'hour', 'day'], customRanges: [],
    theme: 'dark', panelOpacity: 0.6
  });
});

ipcMain.on('save-display-config', (event, config) => {
  store.set('display-config', config);
  [wallpaperWin, controlWin].forEach(w => {
    if (w && !w.isDestroyed()) w.webContents.send('display-config-updated', config);
  });
});

ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(ignore, options);
});

ipcMain.handle('get-auto-launch', () => app.getLoginItemSettings().openAtLogin);
ipcMain.on('toggle-auto-launch', (event, openAtLogin) => {
  app.setLoginItemSettings({
    openAtLogin: openAtLogin,
    path: app.getPath('exe'),
    args: ['--process-start-args', `"--hidden"`]
  });
});

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
    try { fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2)); return { success: true }; } catch (e) { return { success: false, error: e.message }; }
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
      store.set('stats', data.stats);
      store.set('weights', data.weights);
      if (data.metrics) store.set('user-metrics', data.metrics);
      if (data.displayConfig) store.set('display-config', data.displayConfig);
      
      [wallpaperWin, controlWin].forEach(w => {
        if (w && !w.isDestroyed()) {
          w.webContents.send('data-updated', data.stats);
          w.webContents.send('weights-updated', data.weights);
          if (data.metrics) w.webContents.send('metrics-updated', data.metrics);
          if (data.displayConfig) w.webContents.send('display-config-updated', data.displayConfig);
        }
      });
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  }
  return { success: false, cancelled: true };
});