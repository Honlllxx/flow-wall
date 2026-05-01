const { app, BrowserWindow, screen, ipcMain, globalShortcut, Tray, Menu, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
// ❌ 删除: const isDev = require('electron-is-dev'); 
// 我们改用 app.isPackaged (Electron 自带功能，更稳定)
const Store = require('electron-store');

// ✅【新增】应用使用追踪器
const AppUsageTracker = require('./modules/appUsageTracker');

// WebSocket 服务器
let wss = null;
let wsServerPort = 3000;

// 创建 WebSocket 服务器
function createWebSocketServer() {
  const server = http.createServer();
  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    console.log('[WebSocket] Client connected');

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        console.log('[WebSocket] Received:', data.type);

        // 处理浏览器扩展发送的数据
        if (data.type === 'website_data') {
          if (appTracker && (data.data || data.payload)) {
            appTracker.handleWebsiteData(data.data || data.payload);
          }
        } else if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        } else if (data.type === 'sync_request') {
          ws.send(JSON.stringify({ type: 'sync_response', payload: { status: 'connected' } }));
        }
      } catch (error) {
        console.error('[WebSocket] Error parsing message:', error);
      }
    });

    ws.on('close', () => {
      console.log('[WebSocket] Client disconnected');
    });

    ws.on('error', (error) => {
      console.error('[WebSocket] Client error:', error);
    });

    ws.send(JSON.stringify({ type: 'welcome', payload: { message: 'Connected to FlowWall' } }));
  });

  server.listen(wsServerPort, () => {
    console.log(`[WebSocket] Server listening on port ${wsServerPort}`);
  });

  server.on('error', (error) => {
    console.error('[WebSocket] Server error:', error);
    if (error.code === 'EADDRINUSE') {
      console.log(`[WebSocket] Port ${wsServerPort} is in use, trying ${wsServerPort + 1}`);
      wsServerPort++;
      createWebSocketServer();
    }
  });
}

const store = new Store();
let wallpaperWin = null;
let controlWin = null;
let tray = null;
let appListWin = null; // 应用列表窗口
let appDetailWin = null; // 应用详情面板窗口
let controlWinInitialX = null; // 存储controlWin的初始X坐标
let windowHistory = []; // 窗口切换历史栈，记录用户操作路径
let isDraggingWindow = false; // 标记窗口是否正在拖动
let appTracker = null; // 应用使用追踪器实例（全局变量）
// 移除重复请求检查标记
// 移除重复请求检查标记

// 关闭硬件加速 (解决 Windows 下透明窗口变白/黑的问题)
app.disableHardwareAcceleration();
// 禁用 DPI 感知，确保窗口尺寸一致
app.commandLine.appendSwitch('high-dpi-support', 'true');
app.commandLine.appendSwitch('force-device-scale-factor', '1');

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
  // 加载保存的窗口位置
  const windowPositions = loadWindowPositions();
  const controlPosition = windowPositions.controlWin || {};
  
  // 计算默认位置（屏幕中心）
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const defaultX = Math.floor((screenWidth - 400) / 2);
  const defaultY = Math.floor((screenHeight - 600) / 2);
  
  // 检查位置数据的有效性
  let finalX = defaultX;
  let finalY = defaultY;
  
  if (controlPosition.x !== undefined && controlPosition.y !== undefined) {
    // 确保位置在屏幕范围内
    const minX = 0;
    const minY = 0;
    const maxX = screenWidth - 400;
    const maxY = screenHeight - 600;
    
    finalX = Math.max(minX, Math.min(maxX, controlPosition.x));
    finalY = Math.max(minY, Math.min(maxY, controlPosition.y));
    
    // 如果位置被修正，记录日志
    if (finalX !== controlPosition.x || finalY !== controlPosition.y) {
      console.log('窗口位置修正:', { original: controlPosition, corrected: { x: finalX, y: finalY } });
    }
  }
  
  controlWin = new BrowserWindow({
    width: 400,
    height: 600,
    x: finalX,
    y: finalY,
    frame: false,
    transparent: true,
    show: false,
    resizable: false,
    alwaysOnTop: true,
    focusable: true,
    useContentSize: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      zoomFactor: 1.0
    }
  });

  // ✅ 【关键修复】同上
  if (!app.isPackaged) {
    controlWin.loadURL('http://localhost:5173/#/control');
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html');
    controlWin.loadFile(indexPath, { hash: 'control' });
  }

  // 修改 blur 事件处理：如果详情面板显示，则不隐藏 ControlPanel
  controlWin.on('blur', () => {
    // 检查详情面板是否存在且可见
    if (appDetailWin && !appDetailWin.isDestroyed() && appDetailWin.isVisible()) {
      // 详情面板显示时，保持 ControlPanel 显示
      return;
    }
    controlWin.hide();
  });
  
  // 存储controlWin的初始X坐标
  controlWin.once('ready-to-show', () => {
    const bounds = controlWin.getBounds();
    controlWinInitialX = bounds.x;
    console.log('ControlPanel初始X坐标:', controlWinInitialX);
  });

  // 为controlWin添加move事件监听器，用于检测吸附
  controlWin.on('move', () => {
    handleWindowMove(controlWin);
  });
}  

// 创建应用列表窗口
function createAppListWindow() {
  console.log('创建应用列表窗口');
  
  // 检查 controlWin 是否存在
  if (!controlWin || controlWin.isDestroyed()) {
    console.error('Control window is not available');
    return null;
  }

  // 确保 ControlPanel 是显示的
  if (!controlWin.isVisible()) {
    controlWin.show();
  }

  // 如果应用列表窗口已存在，先关闭
  if (appListWin && !appListWin.isDestroyed()) {
    appListWin.close();
    appListWin = null;
  }

  // 使用与 ControlPanel 相同的固定尺寸
  const windowWidth = 400;
  const windowHeight = 600;
  const controlBounds = controlWin.getBounds();
  console.log('使用固定尺寸:', windowWidth, 'x', windowHeight);
  console.log('ControlPanel 外部尺寸:', controlBounds.width, 'x', controlBounds.height);

  // 初始位置在 ControlPanel 左边缘（被 ControlPanel 遮挡）
  const startX = controlBounds.x;
  // 目标位置：紧挨着 ControlPanel 左侧，没有缝隙
  const targetX = controlBounds.x - windowWidth;

  appListWin = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: startX,
    y: controlBounds.y,
    frame: false,
    transparent: true,
    show: false,
    resizable: false,
    alwaysOnTop: true,
    focusable: true,
    useContentSize: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      zoomFactor: 1.0
    }
  });

  // 加载应用列表页面
  if (!app.isPackaged) {
    appListWin.loadURL('http://localhost:5173/#/app-list');
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html');
    appListWin.loadFile(indexPath, { hash: 'app-list' });
  }

  appListWin.once('ready-to-show', () => {
    if (appListWin && !appListWin.isDestroyed()) {
      // 直接设置到目标位置并显示
      appListWin.setPosition(targetX, controlBounds.y);
      appListWin.show();
      appListWin.focus();
    }
  });

  appListWin.on('focus', () => {
    if (controlWin && !controlWin.isDestroyed() && !controlWin.isVisible()) {
      controlWin.show();
    }
  });

  appListWin.on('blur', () => {
    // 延迟检查，确保焦点已经转移
    setTimeout(() => {
      // 检查是否有其他面板窗口获得焦点
      const focusedWindow = BrowserWindow.getFocusedWindow();
      if (!focusedWindow || (focusedWindow !== appDetailWin && focusedWindow !== controlWin)) {
        // 如果焦点不在其他面板窗口上，则关闭应用列表面板
        closeAppListWindow();
      }
    }, 100);
  });

  appListWin.on('closed', () => {
    appListWin = null;
  });

  // 为appListWin添加move事件监听器，用于检测吸附
  appListWin.on('move', () => {
    handleWindowMove(appListWin);
  });

  return appListWin;
}

// 关闭应用列表窗口（带滑出动画）
// 注意：统一使用下面的closeAppListWindow函数实现

// 创建应用详情面板窗口
function createAppDetailWindow(appData) {
  console.log('创建应用详情窗口，数据:', appData?.appName);
  
  // 检查 controlWin 是否存在
  if (!controlWin || controlWin.isDestroyed()) {
    console.error('Control window is not available');
    return null;
  }

  // 确保 ControlPanel 是显示的
  if (!controlWin.isVisible()) {
    controlWin.show();
  }
  controlWin.focus();

  // 如果详情窗口已存在，先关闭
  if (appDetailWin && !appDetailWin.isDestroyed()) {
    appDetailWin.close();
    appDetailWin = null;
  }

  // 使用与 ControlPanel 相同的固定尺寸
  const windowWidth = 400;
  const windowHeight = 600;
  const controlBounds = controlWin.getBounds();
  console.log('使用固定尺寸:', windowWidth, 'x', windowHeight);
  console.log('ControlPanel 外部尺寸:', controlBounds.width, 'x', controlBounds.height);
  console.log('详情面板窗口尺寸:', windowWidth, 'x', windowHeight);

  // 检查AppListPanel是否存在（可能已经移动了位置）
  let targetX;
  if (appListWin && !appListWin.isDestroyed()) {
    const appListBounds = appListWin.getBounds();
    // 目标位置：紧挨着 AppListPanel 右侧，没有缝隙
    targetX = appListBounds.x + appListBounds.width;
  } else {
    //  fallback: 紧挨着 ControlPanel 右侧
    targetX = controlBounds.x + controlBounds.width;
  }
  // 初始位置在屏幕外右侧（用于滑入动画）
  const startX = targetX + windowWidth;

  appDetailWin = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: startX,
    y: controlBounds.y,
    frame: false,
    transparent: true,
    show: false,
    resizable: false,
    alwaysOnTop: true,
    focusable: true,
    useContentSize: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      zoomFactor: 1.0
    }
  });

  // 将数据存储在全局，供详情面板读取
  global.appDetailData = appData;

  // 加载详情面板页面
  if (!app.isPackaged) {
    appDetailWin.loadURL('http://localhost:5173/#/app-detail');
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html');
    appDetailWin.loadFile(indexPath, { hash: 'app-detail' });
  }

  appDetailWin.once('ready-to-show', () => {
    if (appDetailWin && !appDetailWin.isDestroyed()) {
      // 直接设置到目标位置并显示
      appDetailWin.setPosition(targetX, controlBounds.y);
      appDetailWin.show();
      appDetailWin.focus();
    }
  });

  // 当详情面板获得焦点时，确保 ControlPanel 也保持显示
  appDetailWin.on('focus', () => {
    if (controlWin && !controlWin.isDestroyed() && !controlWin.isVisible()) {
      controlWin.show();
    }
  });

  appDetailWin.on('blur', () => {
    // 延迟检查，确保焦点已经转移
    setTimeout(() => {
      // 检查是否有其他面板窗口获得焦点
      const focusedWindow = BrowserWindow.getFocusedWindow();
      if (!focusedWindow || (focusedWindow !== appListWin && focusedWindow !== controlWin)) {
        // 如果焦点不在其他面板窗口上，则关闭应用详情面板
        closeAppDetailWindow();
      }
    }, 100);
  });

  appDetailWin.on('closed', () => {
    // 通知 ControlPanel 详情面板已关闭
    if (controlWin && !controlWin.isDestroyed()) {
      controlWin.webContents.send('app-detail-closed');
    }
    if (appDetailWin) {
      appDetailWin = null;
    }
  });

  // 为appDetailWin添加move事件监听器，用于检测吸附
  appDetailWin.on('move', () => {
    handleWindowMove(appDetailWin);
  });

  return appDetailWin;
}

// 关闭当前激活的窗口
function closeFocusedWindow() {
  // 首先尝试获取焦点窗口
  const focusedWindow = BrowserWindow.getFocusedWindow();
  
  if (focusedWindow) {
    console.log('Found focused window');
    // 检查是哪个窗口
    if (focusedWindow === appDetailWin) {
      console.log('Closing app detail window');
      closeAppDetailWindow();
      return;
    } else if (focusedWindow === appListWin) {
      console.log('Closing app list window');
      closeAppListWindow();
      return;
    } else if (focusedWindow === controlWin) {
      console.log('Closing control window');
      controlWin.hide(); // 隐藏控制面板而不是关闭
      return;
    }
  }
  
  // 如果没有焦点窗口，检查可见窗口（备用方案）
  console.log('No focused window found, checking visible windows');
  
  // 优先级：appDetailWin > appListWin > controlWin
  if (appDetailWin && !appDetailWin.isDestroyed() && appDetailWin.isVisible()) {
    console.log('App detail window is visible, closing it');
    closeAppDetailWindow();
  } else if (appListWin && !appListWin.isDestroyed() && appListWin.isVisible()) {
    console.log('App list window is visible, closing it');
    closeAppListWindow();
  } else if (controlWin && !controlWin.isDestroyed() && controlWin.isVisible()) {
    console.log('Control window is visible, hiding it');
    controlWin.hide();
  } else {
    console.log('No visible window found to close');
  }
}

// 关闭应用列表面板窗口
function closeAppListWindow() {
  if (appListWin && !appListWin.isDestroyed()) {
    // 保存窗口2的位置
    const appListBounds = appListWin.getBounds();
    const appListX = appListBounds.x;
    const appListY = appListBounds.y;
    const windowWidth = 400; // 固定窗口宽度
    
    appListWin.close();
    appListWin = null;
    
    // 检查是否存在窗口1（control）和窗口3（appDetail）
    if (controlWin && !controlWin.isDestroyed() && appDetailWin && !appDetailWin.isDestroyed()) {
      const controlBounds = controlWin.getBounds();
      const appDetailBounds = appDetailWin.getBounds();
      
      // 检查窗口排列顺序：窗口1（control） < 窗口2（appList） < 窗口3（appDetail）
      if (controlBounds.x < appListX && appListX < appDetailBounds.x) {
        // 将窗口1移动到窗口2的位置
        controlWin.setPosition(appListX, appListY);
        
        // 将窗口3向左移动一个窗口宽度，保持布局连贯
        const appDetailTargetX = appDetailBounds.x - windowWidth;
        appDetailWin.setPosition(appDetailTargetX, appDetailBounds.y);
      }
    }
    // 移除当只有control面板存在时的位置移动逻辑
  }
}

// 关闭应用详情面板窗口
function closeAppDetailWindow() {
  if (appDetailWin && !appDetailWin.isDestroyed()) {
    appDetailWin.close();
    appDetailWin = null;
    
    // 关闭后检查并执行位置交换逻辑
    handlePanelPositionAfterClose();
  } else {
    handlePanelPositionAfterClose();
  }
}

// 关闭appDetailPanel后处理面板位置
function handlePanelPositionAfterClose() {
  console.log('处理关闭后的面板位置');
  
  // 检查窗口是否存在
  if (!controlWin || controlWin.isDestroyed() || !appListWin || appListWin.isDestroyed()) {
    console.log('窗口不存在，跳过位置调整');
    return;
  }
  
  const controlBounds = controlWin.getBounds();
  const appListBounds = appListWin.getBounds();
  const windowWidth = 400; // 固定窗口宽度
  
  // 判断当前位置关系
  // 位置1是最左边，位置2是中间
  const controlX = controlBounds.x;
  const appListX = appListBounds.x;
  
  console.log('当前位置 - Control:', controlX, 'AppList:', appListX);
  
  // 如果control在位置1（左边）且appListPanel在位置2（右边），则交换它们的位置
  // 即：controlX < appListX 表示control在左边
  if (controlX < appListX) {
    console.log('Control在位置1，AppList在位置2，执行位置交换');
    
    // 计算目标位置：交换位置
    const controlTargetX = controlX + windowWidth;
    const appListTargetX = appListX - windowWidth;
    
    // 执行位置交换动画
    animatePanelSwap(controlTargetX, appListTargetX);
  } else {
    console.log('AppList在位置1，Control在位置2，保持当前位置不变');
    // 保持当前位置不变，不执行任何操作
  }
}

// 执行面板位置交换（无动画）
function animatePanelSwap(controlTargetX, appListTargetX) {
  if (!controlWin || controlWin.isDestroyed() || !appListWin || appListWin.isDestroyed()) {
    return;
  }
  
  const controlBounds = controlWin.getBounds();
  const appListBounds = appListWin.getBounds();
  
  // 直接设置位置
  controlWin.setPosition(controlTargetX, controlBounds.y);
  appListWin.setPosition(appListTargetX, appListBounds.y);
}

// 恢复面板到原始位置（无动画）
function restorePanelPositions() {
  if (!controlWin || controlWin.isDestroyed() || !appListWin || appListWin.isDestroyed()) {
    return;
  }
  
  const controlBounds = controlWin.getBounds();
  const appListBounds = appListWin.getBounds();
  const windowWidth = 400; // 固定窗口宽度
  
  // 计算原始位置
  // 如果有初始X坐标，则使用初始X坐标，否则使用当前X坐标 + windowWidth
  const controlOriginalX = controlWinInitialX !== null ? controlWinInitialX : controlBounds.x + windowWidth;
  const appListOriginalX = controlBounds.x - windowWidth;
  
  // 直接设置位置
  controlWin.setPosition(controlOriginalX, controlBounds.y);
  appListWin.setPosition(appListOriginalX, appListBounds.y);
  
  // 重置动画标志，允许下次重新执行动画
  hasPerformedSwapAnimation = false;
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
  appTracker = new AppUsageTracker();
  appTracker.setupIPC();
  
  // 自动开始追踪（可选）
  appTracker.start();

  // ✅【新增】启动 WebSocket 服务器
  createWebSocketServer();

  createWallpaperWindow();
  createControlPanel();

  globalShortcut.register('Alt+D', () => {
    if (controlWin && !controlWin.isDestroyed()) {
      if (controlWin.isVisible()) {
        // 先关闭应用详情面板
        if (appDetailWin && !appDetailWin.isDestroyed()) {
          closeAppDetailWindow();
        }
        // 再关闭应用列表面板
        if (appListWin && !appListWin.isDestroyed()) {
          closeAppListWindow();
        }
        // 最后隐藏控制面板
        controlWin.hide();
      } else {
        controlWin.center();
        controlWin.show();
        controlWin.focus();
      }
    }
  });
  
  // 注册ESC键关闭当前激活窗口
  globalShortcut.register('Escape', () => {
    console.log('ESC key pressed, closing focused window');
    closeFocusedWindow();
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

// 获取吸附灵敏度（像素），从electron-store中读取，默认为10
function getSnapThreshold() {
  try {
    return store.get('snapThreshold', 10);
  } catch (error) {
    console.error('读取吸附灵敏度失败:', error);
    return 10;
  }
}

// 节流函数
function throttle(func, delay) {
  let inProgress = false;
  return function(...args) {
    if (!inProgress) {
      inProgress = true;
      func.apply(this, args);
      setTimeout(() => {
        inProgress = false;
      }, delay);
    }
  };
}

// 处理窗口移动事件，实现吸附功能
const handleWindowMove = throttle(function(window) {
  if (!window || window.isDestroyed()) return;
  
  const bounds = window.getBounds();
  let newX = bounds.x;
  let newY = bounds.y;
  
  // 获取吸附灵敏度
  const snapThreshold = getSnapThreshold();
  
  // 检测屏幕边界吸附
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  
  // 左边界吸附
  if (Math.abs(bounds.x) < snapThreshold) {
    newX = 0;
  }
  
  // 右边界吸附
  if (Math.abs(screenWidth - (bounds.x + bounds.width)) < snapThreshold) {
    newX = screenWidth - bounds.width;
  }
  
  // 上边界吸附
  if (Math.abs(bounds.y) < snapThreshold) {
    newY = 0;
  }
  
  // 下边界吸附
  if (Math.abs(screenHeight - (bounds.y + bounds.height)) < snapThreshold) {
    newY = screenHeight - bounds.height;
  }
  
  // 检测其他窗口吸附
  const otherWindows = [];
  
  // 添加应用内部窗口
  if (window !== controlWin && controlWin && !controlWin.isDestroyed() && controlWin.isVisible()) {
    otherWindows.push(controlWin);
  }
  if (window !== appListWin && appListWin && !appListWin.isDestroyed() && appListWin.isVisible()) {
    otherWindows.push(appListWin);
  }
  if (window !== appDetailWin && appDetailWin && !appDetailWin.isDestroyed() && appDetailWin.isVisible()) {
    otherWindows.push(appDetailWin);
  }
  
  // 添加外部窗口
  try {
    const allWindows = BrowserWindow.getAllWindows();
    for (const win of allWindows) {
      if (win !== window && win.isVisible() && !win.isDestroyed()) {
        // 检查是否是应用内部窗口
        if (win !== controlWin && win !== appListWin && win !== appDetailWin) {
          otherWindows.push(win);
        }
      }
    }
  } catch (error) {
    console.error('获取外部窗口失败:', error);
  }
  
  for (const otherWindow of otherWindows) {
    const otherBounds = otherWindow.getBounds();
    
    // 水平吸附（左对齐）
    if (Math.abs(bounds.x - (otherBounds.x + otherBounds.width)) < snapThreshold) {
      newX = otherBounds.x + otherBounds.width;
    }
    
    // 水平吸附（右对齐）
    if (Math.abs((bounds.x + bounds.width) - otherBounds.x) < snapThreshold) {
      newX = otherBounds.x - bounds.width;
    }
    
    // 垂直吸附（顶部对齐）
    if (Math.abs(bounds.y - otherBounds.y) < snapThreshold) {
      newY = otherBounds.y;
    }
    
    // 垂直吸附（底部对齐）
    if (Math.abs((bounds.y + bounds.height) - (otherBounds.y + otherBounds.height)) < snapThreshold) {
      newY = otherBounds.y + otherBounds.height - bounds.height;
    }
  }
  
  // 如果位置有变化，直接更新窗口位置（无动画）
  if (newX !== bounds.x || newY !== bounds.y) {
    window.setPosition(newX, newY);
  }
}, 16); // 约60fps的节流

// 加载窗口位置
function loadWindowPositions() {
  try {
    const windowPositions = store.get('windowPositions', {});
    console.log('加载窗口位置:', windowPositions);
    return windowPositions;
  } catch (error) {
    console.error('加载窗口位置失败:', error);
    return {};
  }
}

// 保存窗口位置
function saveWindowPositions() {
  const windowPositions = {};
  
  // 保存ControlPanel位置
  if (controlWin && !controlWin.isDestroyed()) {
    const bounds = controlWin.getBounds();
    windowPositions.controlWin = { x: bounds.x, y: bounds.y };
  }
  
  // 保存AppListPanel位置
  if (appListWin && !appListWin.isDestroyed()) {
    const bounds = appListWin.getBounds();
    windowPositions.appListWin = { x: bounds.x, y: bounds.y };
  }
  
  // 保存AppDetailPanel位置
  if (appDetailWin && !appDetailWin.isDestroyed()) {
    const bounds = appDetailWin.getBounds();
    windowPositions.appDetailWin = { x: bounds.x, y: bounds.y };
  }
  
  // 存储到electron-store
  store.set('windowPositions', windowPositions);
  console.log('窗口位置已保存:', windowPositions);
}

app.on('will-quit', () => {
  // 保存窗口位置
  saveWindowPositions();
  
  globalShortcut.unregisterAll();
  
  // ✅【新增】停止应用使用追踪
  if (appTracker) {
    appTracker.stop();
  }
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

// 调整控制面板窗口宽度
ipcMain.on('resize-control-window', (event, width) => {
  if (controlWin && !controlWin.isDestroyed()) {
    const currentBounds = controlWin.getBounds();
    // 保持窗口中心点不变，向左右两侧扩展
    const newX = currentBounds.x - (width - currentBounds.width) / 2;
    controlWin.setBounds({
      x: Math.round(newX),
      y: currentBounds.y,
      width: Math.round(width),
      height: currentBounds.height
    });
  }
});

// 显示应用列表窗口
ipcMain.on('show-app-list', () => {
  // 检查应用列表面板是否已打开
  if (appListWin && !appListWin.isDestroyed()) {
    // 如果已打开，则关闭它
    // 从历史栈中移除最后的记录
    if (windowHistory.length > 0) {
      windowHistory.pop();
      console.log('窗口切换历史:', windowHistory);
    }
    closeAppListWindow();
  } else {
    // 如果未打开，则创建新的应用列表面板
    // 记录窗口切换历史
    windowHistory.push({ type: 'app-list' });
    console.log('窗口切换历史:', windowHistory);
    createAppListWindow();
  }
});

// 关闭应用列表窗口
ipcMain.on('close-app-list', () => {
  // 从历史栈中移除最后的记录
  if (windowHistory.length > 0) {
    windowHistory.pop();
    console.log('窗口切换历史:', windowHistory);
  }
  closeAppListWindow();
});

// 显示应用详情面板窗口
ipcMain.on('show-app-detail', (event, appData) => {
  // 记录窗口切换历史
  windowHistory.push({ type: 'app-detail', appData });
  console.log('窗口切换历史:', windowHistory);
  createAppDetailWindow(appData);
});

// 关闭应用详情面板窗口
ipcMain.on('close-app-detail', () => {
  // 从历史栈中移除最后的记录
  if (windowHistory.length > 0) {
    windowHistory.pop();
    console.log('窗口切换历史:', windowHistory);
  }
  closeAppDetailWindow();
});

// 窗口拖动交互锁定
ipcMain.on('start-window-drag', () => {
  console.log('窗口开始拖动，锁定交互');
  isDraggingWindow = true;
  // 通知所有窗口拖动状态改变
  notifyAllWindowsDragStateChange(true);
});

ipcMain.on('end-window-drag', () => {
  console.log('窗口结束拖动，恢复交互');
  isDraggingWindow = false;
  // 通知所有窗口拖动状态改变
  notifyAllWindowsDragStateChange(false);
});

// 通知所有窗口拖动状态改变
function notifyAllWindowsDragStateChange(isDragging) {
  const windows = [controlWin, appListWin, appDetailWin].filter(win => win && !win.isDestroyed());
  windows.forEach(win => {
    win.webContents.send('window-drag-state-change', isDragging);
  });
}

// 通知所有窗口交互锁定状态改变
function notifyAllWindowsInteractionLocked(isLocked, message) {
  const windows = [controlWin, appListWin, appDetailWin].filter(win => win && !win.isDestroyed());
  windows.forEach(win => {
    win.webContents.send('window-interaction-locked', { isLocked, message });
  });
}

// 窗口返回功能
ipcMain.on('window-back', () => {
  console.log('执行窗口返回操作');
  
  // 检查历史栈是否有记录
  if (windowHistory.length === 0) {
    console.log('没有历史记录，无法返回');
    return;
  }
  
  // 弹出当前窗口记录
  windowHistory.pop();
  
  // 检查是否还有历史记录
  if (windowHistory.length === 0) {
    console.log('已到达历史记录开头，关闭所有外部窗口');
    // 关闭所有外部窗口
    if (appDetailWin && !appDetailWin.isDestroyed()) {
      closeAppDetailWindow();
    }
    if (appListWin && !appListWin.isDestroyed()) {
      closeAppListWindow();
    }
    return;
  }
  
  // 获取上一个窗口记录
  const previousWindow = windowHistory[windowHistory.length - 1];
  console.log('返回至上一个窗口:', previousWindow);
  
  // 关闭当前所有外部窗口
  if (appDetailWin && !appDetailWin.isDestroyed()) {
    closeAppDetailWindow();
  }
  if (appListWin && !appListWin.isDestroyed()) {
    closeAppListWindow();
  }
  
  // 延迟一段时间后打开上一个窗口
  setTimeout(() => {
    if (previousWindow.type === 'app-list') {
      createAppListWindow();
    } else if (previousWindow.type === 'app-detail' && previousWindow.appData) {
      // 先打开应用列表窗口，再打开应用详情窗口
      const appList = createAppListWindow();
      if (appList) {
        // 延迟确保应用列表窗口已创建
        setTimeout(() => {
          createAppDetailWindow(previousWindow.appData);
        }, 100);
      }
    }
  }, 200);
  
  console.log('窗口切换历史:', windowHistory);
});

// 获取应用详情数据
ipcMain.handle('get-app-detail-data', () => {
  const appData = global.appDetailData || {};
  // 确保返回完整的数据结构
  return {
    ...appData,
    hourlyData: appData.hourlyData || [],
    sessions: appData.sessions || []
  };
});

// 应用列表选择应用后通知详情面板
ipcMain.on('app-list-select', (event, appData) => {
  // 从应用使用追踪器中获取完整的应用数据
  if (!appTracker) return;
  const todayStats = appTracker.getTodayStatistics();
  const fullAppData = todayStats.find(app => app.appName === appData.appName);
  
  // 确保数据结构完整
  const completeAppData = {
    ...appData,
    ...fullAppData,
    hourlyData: fullAppData?.hourlyData || [],
    sessions: fullAppData?.sessions || []
  };
  
  // 存储数据
  global.appDetailData = completeAppData;
  
  // 检查AppDetailPanel是否已存在
  if (appDetailWin && !appDetailWin.isDestroyed() && appDetailWin.isVisible()) {
    console.log('AppDetailPanel已存在，直接更新数据');
    // 通知渲染进程数据已更新
    if (appDetailWin.webContents) {
      appDetailWin.webContents.send('app-detail-updated', completeAppData);
    }
    return;
  }
  
  // 记录窗口切换历史
  windowHistory.push({ type: 'app-detail', appData: completeAppData });
  console.log('窗口切换历史:', windowHistory);
  
  // 检查窗口是否存在
  if (!controlWin || controlWin.isDestroyed() || !appListWin || appListWin.isDestroyed()) {
    console.error('窗口不存在，无法执行位置互换动画');
    createAppDetailWindow(completeAppData);
    return;
  }
  
  // 执行位置互换动画
  performPanelSwapAnimation(completeAppData);
});

// 执行面板位置互换（无动画）
function performPanelSwapAnimation(appData) {
  if (!controlWin || controlWin.isDestroyed() || !appListWin || appListWin.isDestroyed()) {
    createAppDetailWindow(appData);
    return;
  }
  
  const controlBounds = controlWin.getBounds();
  const appListBounds = appListWin.getBounds();
  const windowWidth = 400; // 固定窗口宽度
  
  // 计算目标位置
  const controlTargetX = controlBounds.x - windowWidth;
  const appListTargetX = appListBounds.x + windowWidth;
  
  // 直接设置位置
  controlWin.setPosition(controlTargetX, controlBounds.y);
  appListWin.setPosition(appListTargetX, appListBounds.y);
  
  // 显示AppDetailPanel
  createAppDetailWindow(appData);
}

// 恢复面板位置函数（无动画）
function restorePanelPositions() {
  if (controlWin && !controlWin.isDestroyed() && appListWin && !appListWin.isDestroyed()) {
    const controlBounds = controlWin.getBounds();
    const windowWidth = 400; // 固定窗口宽度
    
    // 计算恢复位置
    const controlTargetX = controlBounds.x + windowWidth;
    const appListTargetX = appListWin.getBounds().x - windowWidth;
    
    // 直接设置位置
    controlWin.setPosition(controlTargetX, controlBounds.y);
    appListWin.setPosition(appListTargetX, appListWin.getBounds().y);
  }
}

// ease-in-out缓动函数
function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

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