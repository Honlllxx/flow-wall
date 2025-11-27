
const { app, BrowserWindow, screen, ipcMain, globalShortcut, Tray, Menu } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const Store = require('electron-store');

const store = new Store();
let wallpaperWin = null;
let controlWin = null;
let tray = null;




// 【新增】关闭硬件加速（解决 Windows 下透明窗口变白/黑的问题）
app.disableHardwareAcceleration();


// 创建“隐形”壁纸层
function createWallpaperWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  wallpaperWin = new BrowserWindow({
    width,
    height,
    x: 0, 
    y: 0,
    type: 'desktop', // macOS 关键
    frame: false,    // 无边框
    transparent: true, // 透明背景
    hasShadow: false,
    enableLargerThanScreen: true,
    resizable: false,
    focusable: false, // 永远不抢焦点
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  // 核心：让鼠标点击完全穿透，直达桌面图标
  wallpaperWin.setIgnoreMouseEvents(true, { forward: true });
  
  // Windows下需要设为忽略任务栏
  wallpaperWin.setSkipTaskbar(true);

  const startURL = isDev 
    ? 'http://localhost:5173/#/wallpaper' 
    : `file://${path.join(__dirname, '../dist/index.html')}#/wallpaper`;

  wallpaperWin.loadURL(startURL);
}

// 创建极简控制面板
function createControlPanel() {
  controlWin = new BrowserWindow({
    width: 400,
    height: 520,
        frame: false,
    transparent: true,
    show: false, // 默认隐藏
    resizable: false,
    alwaysOnTop: true, // 确保浮在最上层
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

  // 失去焦点自动隐藏，体验更流畅
  controlWin.on('blur', () => controlWin.hide());
}

app.whenReady().then(() => {
  createWallpaperWindow();
  createControlPanel();

  // 注册全局快捷键 Alt+D
  globalShortcut.register('Alt+D', () => {
    if (controlWin.isVisible()) {
      controlWin.hide();
    } else {
      controlWin.center();
      controlWin.show();
      controlWin.focus(); // 确保输入框获得焦点
    }
  });

  // 系统托盘（防止后台运行时无法退出）
  tray = new Tray(path.join(__dirname, '../public/icon.png')); // 需自备icon
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示控制板', click: () => controlWin.show() },
    { label: '退出 FlowWall', click: () => app.quit() }
  ]);
  tray.setToolTip('FlowWall - 每日追踪');
  tray.setContextMenu(contextMenu);
});

// --- IPC 通信逻辑 ---

// 1. 获取初始数据
ipcMain.handle('get-data', () => {
  return store.get('stats', []);
});

// 【新增】获取指标列表
ipcMain.handle('get-metrics', () => {
  // 默认指标（如果第一次运行）
  const defaultMetrics = [
    { id: 'reading', label: '阅读', unit: '页', iconKey: 'book' },
    { id: 'fitness', label: '健身', unit: '分钟', iconKey: 'activity' },
    { id: 'focus',   label: '专注', unit: '小时', iconKey: 'zap' },
    { id: 'water',   label: '饮水', unit: 'ml',   iconKey: 'coffee' },
  ];
  return store.get('user-metrics', defaultMetrics);
});

// 【新增】保存指标列表
ipcMain.on('save-metrics', (event, metrics) => {
  store.set('user-metrics', metrics);
  // 广播通知前端刷新（如果有多个窗口）
  if (controlWin) controlWin.webContents.send('metrics-updated', metrics);
});

// 【新增】获取权重配置
ipcMain.handle('get-weights', () => {
  // 默认权重：阅读10分/页，健身5分/分，专注20分/小时，饮水0.1分/ml
  const defaultWeights = { '阅读': 10, '健身': 5, '专注': 20, '饮水': 0.1 };
  return store.get('weights', defaultWeights);
});

// 【新增】保存权重配置
ipcMain.on('save-weights', (event, weights) => {
  store.set('weights', weights);
  // 通知壁纸层刷新，重新计算曲线
  if (wallpaperWin) wallpaperWin.webContents.send('weights-updated', weights);
});

// 2. 保存新记录
ipcMain.on('add-entry', (event, newEntry) => {
  const currentData = store.get('stats', []) || [];
  const entry = {
    ...newEntry,
    id: Date.now(),
    date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    timestamp: Date.now()
  };
  
  const updatedData = [...currentData, entry];
  // 仅保留最近30条数据，避免文件过大
  if (updatedData.length > 30) updatedData.shift();
  
  store.set('stats', updatedData);
  
  // 广播给壁纸层更新图表
  wallpaperWin.webContents.send('data-updated', updatedData);
});


// 【新增】删除指定 ID 的记录
ipcMain.on('delete-entry', (event, id) => {
  const currentData = store.get('stats', []) || [];
  
  // 过滤掉这就条 ID 的数据
  const newData = currentData.filter(item => item.id !== id);
  
  // 保存并广播更新
  store.set('stats', newData);
  
  // 通知壁纸层刷新图表
  if (wallpaperWin) wallpaperWin.webContents.send('data-updated', newData);
  // 通知控制面板刷新列表（如果面板开着的话）
  if (controlWin) controlWin.webContents.send('data-updated', newData);

});

  // 【新增】动态控制鼠标穿透状态
ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.setIgnoreMouseEvents(ignore, options);
  }
});





app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});