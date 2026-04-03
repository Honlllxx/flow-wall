const { app, BrowserWindow, screen, ipcMain, globalShortcut, Tray, Menu, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const isDev = require('electron-is-dev');
const Store = require('electron-store');

const store = new Store();
let wallpaperWin = null;
let controlWin = null;
let tray = null;

// 关闭硬件加速 (解决透明窗口黑屏/白屏的关键)
app.disableHardwareAcceleration();

// ==========================================
// 0. 开机自启配置
// ==========================================
function updateAutoLaunch() {
  // 获取当前可执行文件路径
  const exePath = app.getPath('exe');
  
  app.setLoginItemSettings({
    openAtLogin: true, // 开启开机自启
    path: exePath,
    args: [
      '--process-start-args', `"--hidden"` // 可选：如果想静默启动
    ]
  });
}

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
      // 生产环境下，preload 需要指向正确的位置
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  wallpaperWin.setIgnoreMouseEvents(true, { forward: true });
  wallpaperWin.setSkipTaskbar(true);

  // ✅ 生产环境路径修正
  // 打包后，dist 和 electron 文件夹通常是兄弟关系
  const startURL = isDev 
    ? 'http://localhost:5173/#/wallpaper' 
    : `file://${path.join(__dirname, '../dist/index.html')}#/wallpaper`;

  wallpaperWin.loadURL(startURL);
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

  const startURL = isDev 
    ? 'http://localhost:5173/#/control' 
    : `file://${path.join(__dirname, '../dist/index.html')}#/control`;

  controlWin.loadURL(startURL);

  controlWin.on('blur', () => controlWin.hide());
}

app.whenReady().then(() => {
  // ✅ 注册开机自启
  if (!isDev) {
    updateAutoLaunch();
  }

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

  // ✅ 托盘图标路径修正 (生产环境需要找资源文件夹)
  const iconPath = isDev 
    ? path.join(__dirname, '../public/icon.png')
    : path.join(process.resourcesPath, 'icon.png'); // 打包后图标位置

  // 防止图标丢失导致报错，加个判断
  if (fs.existsSync(iconPath)) {
      tray = new Tray(iconPath);
      const contextMenu = Menu.buildFromTemplate([
        { label: '显示控制板', click: () => controlWin.show() },
        { label: '开机自启', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: () => {
            const settings = app.getLoginItemSettings();
            app.setLoginItemSettings({ openAtLogin: !settings.openAtLogin });
        }},
        { type: 'separator' },
        { label: '退出 FlowWall', click: () => app.quit() }
      ]);
      tray.setToolTip('FlowWall - 每日追踪');
      tray.setContextMenu(contextMenu);
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});


// ==========================================
// 2. 核心业务逻辑 (IPC)
// ==========================================

ipcMain.handle('get-data', () => store.get('stats', []));

ipcMain.on('add-entry', (event, newEntry) => {
  const currentData = store.get('stats', []) || [];
  const now = new Date();
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const entry = {
    ...newEntry,
    id: Date.now(),
    date: localDate,
    timestamp: Date.now()
  };
  
  const updatedData = [...currentData, entry];
  if (updatedData.length > 2000) updatedData.shift();
  
  store.set('stats', updatedData);
  
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

ipcMain.handle('get-weights', () => store.get('weights', { '阅读': 10, '健身': 5, '专注': 20, '饮水': 0.1 }));

ipcMain.on('save-weights', (event, weights) => {
  store.set('weights', weights);
  if (wallpaperWin) wallpaperWin.webContents.send('weights-updated', weights);
  if (controlWin) controlWin.webContents.send('weights-updated', weights);
});

ipcMain.handle('get-display-config', () => {
  return store.get('display-config', { 
    mode: 'single', combinedMetrics: [], multiMetrics: [], combinedColor: '#60A5FA',
    combinedGoal: 0, showCombinedGoal: true, showIndividualGoals: true, 
    individualGoalModes: ['single', 'multi', 'overlay'],
    visibleButtons: ['raw', 'hour', 'day'], customRanges: []
  });
});

ipcMain.on('save-display-config', (event, config) => {
  store.set('display-config', config);
  if (wallpaperWin) wallpaperWin.webContents.send('display-config-updated', config);
  if (controlWin) controlWin.webContents.send('display-config-updated', config);
});

ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(ignore, options);
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