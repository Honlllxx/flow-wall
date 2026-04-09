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
let appListWin = null; // 应用列表窗口
let appDetailWin = null; // 应用详情面板窗口
let controlWinInitialX = null; // 存储controlWin的初始X坐标
let windowHistory = []; // 窗口切换历史栈，记录用户操作路径
let isDraggingWindow = false; // 标记窗口是否正在拖动
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
  // 从electron-store中获取保存的窗口位置
  const savedPosition = store.get('windowPositions', {}).controlWin;
  
  controlWin = new BrowserWindow({
    width: 400,
    height: 600,
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

  // 设置窗口位置
  controlWin.once('ready-to-show', () => {
    if (savedPosition && typeof savedPosition.x === 'number' && typeof savedPosition.y === 'number') {
      // 使用保存的位置
      controlWin.setPosition(savedPosition.x, savedPosition.y);
      console.log('ControlPanel已恢复到保存位置:', savedPosition);
    } else {
      // 没有保存的位置，使用默认位置（屏幕中心）
      controlWin.center();
      console.log('ControlPanel使用默认位置（屏幕中心）');
    }
    
    const bounds = controlWin.getBounds();
    controlWinInitialX = bounds.x;
    console.log('ControlPanel初始X坐标:', controlWinInitialX);
  });

  // 修改 blur 事件处理：如果详情面板显示，则不隐藏 ControlPanel
  controlWin.on('blur', () => {
    // 检查详情面板是否存在且可见
    if (appDetailWin && !appDetailWin.isDestroyed() && appDetailWin.isVisible()) {
      // 详情面板显示时，保持 ControlPanel 显示
      return;
    }
    controlWin.hide();
  });
  
  // 监听窗口位置改变事件，保存位置到electron-store
  controlWin.on('move', () => {
    try {
      const bounds = controlWin.getBounds();
      const currentPositions = store.get('windowPositions', {});
      store.set('windowPositions', {
        ...currentPositions,
        controlWin: {
          x: bounds.x,
          y: bounds.y
        }
      });
      console.log('ControlPanel位置已保存:', { x: bounds.x, y: bounds.y });
    } catch (error) {
      console.error('保存ControlPanel位置失败:', error);
    }
  });
  
  // 监听窗口关闭事件，确保位置被保存
  controlWin.on('closed', () => {
    try {
      if (!controlWin.isDestroyed()) {
        const bounds = controlWin.getBounds();
        const currentPositions = store.get('windowPositions', {});
        store.set('windowPositions', {
          ...currentPositions,
          controlWin: {
            x: bounds.x,
            y: bounds.y
          }
        });
        console.log('ControlPanel关闭时位置已保存:', { x: bounds.x, y: bounds.y });
      }
    } catch (error) {
      console.error('关闭时保存ControlPanel位置失败:', error);
    }
    controlWin = null;
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

  // 从electron-store中获取保存的窗口位置
  const savedPosition = store.get('windowPositions', {}).appListWin;
  
  // 初始位置在 ControlPanel 左边缘（被 ControlPanel 遮挡）
  const startX = savedPosition && typeof savedPosition.x === 'number' && typeof savedPosition.y === 'number' ? savedPosition.x : controlBounds.x;
  const startY = savedPosition && typeof savedPosition.y === 'number' ? savedPosition.y : controlBounds.y;
  // 目标位置：紧挨着 ControlPanel 左侧，没有缝隙
  const targetX = controlBounds.x - windowWidth;

  appListWin = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: startX,
    y: startY,
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
      appListWin.show();
      appListWin.focus(); // 确保窗口获得焦点
      
      // 执行从右向左的滑出动画（从 ControlPanel 边缘滑出到左侧）
      const animateSlide = () => {
        if (!appListWin || appListWin.isDestroyed()) return;
        
        const currentBounds = appListWin.getBounds();
        const step = 20; // 每次移动的距离
        
        if (currentBounds.x > targetX) {
          const newX = Math.max(currentBounds.x - step, targetX);
          appListWin.setPosition(newX, currentBounds.y);
          
          if (newX > targetX) {
            setTimeout(animateSlide, 16); // ~60fps
          } else {
            console.log('应用列表窗口滑动动画完成');
          }
        }
      };
      
      // 开始动画
      setTimeout(animateSlide, 16);
    } else {
      // 窗口销毁
    }
  });

  // 监听窗口位置改变事件，保存位置到electron-store
  appListWin.on('move', () => {
    try {
      const bounds = appListWin.getBounds();
      const currentPositions = store.get('windowPositions', {});
      store.set('windowPositions', {
        ...currentPositions,
        appListWin: {
          x: bounds.x,
          y: bounds.y
        }
      });
      console.log('AppListWin位置已保存:', { x: bounds.x, y: bounds.y });
    } catch (error) {
      console.error('保存AppListWin位置失败:', error);
    }
  });

  appListWin.on('focus', () => {
    if (controlWin && !controlWin.isDestroyed() && !controlWin.isVisible()) {
      controlWin.show();
    }
  });

  appListWin.on('closed', () => {
    try {
      if (!appListWin.isDestroyed()) {
        const bounds = appListWin.getBounds();
        const currentPositions = store.get('windowPositions', {});
        store.set('windowPositions', {
          ...currentPositions,
          appListWin: {
            x: bounds.x,
            y: bounds.y
          }
        });
        console.log('AppListWin关闭时位置已保存:', { x: bounds.x, y: bounds.y });
      }
    } catch (error) {
      console.error('关闭时保存AppListWin位置失败:', error);
    }
    appListWin = null;
  });

  return appListWin;
}

// 关闭应用列表窗口（带滑出动画）
function closeAppListWindow() {
  console.log('关闭应用列表窗口');
  if (appListWin && !appListWin.isDestroyed()) {
    const controlBounds = controlWin.getBounds();
    // 滑动到 ControlPanel 左边缘（被遮挡）
    const endX = controlBounds.x;
    
    const animateSlideOut = () => {
      if (!appListWin || appListWin.isDestroyed()) return;
      
      const bounds = appListWin.getBounds();
      const step = 25; // 关闭时更快
      
      if (bounds.x < endX) {
        const newX = Math.min(bounds.x + step, endX);
        appListWin.setPosition(newX, bounds.y);
        
        if (newX < endX) {
          setTimeout(animateSlideOut, 16);
        } else {
          appListWin.close();
          appListWin = null;
          // 恢复controlWin到初始位置
          if (controlWin && !controlWin.isDestroyed() && controlWinInitialX !== null) {
            console.log('恢复controlWin到初始位置:', controlWinInitialX);
            controlWin.setPosition(controlWinInitialX, controlBounds.y);
          }
        }
      } else {
        appListWin.close();
        appListWin = null;
        // 恢复controlWin到初始位置
        if (controlWin && !controlWin.isDestroyed() && controlWinInitialX !== null) {
          console.log('恢复controlWin到初始位置:', controlWinInitialX);
          controlWin.setPosition(controlWinInitialX, controlBounds.y);
        }
      }
    };
    
    setTimeout(animateSlideOut, 16);
  }
}

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
  // 从electron-store中获取保存的窗口位置
  const savedPosition = store.get('windowPositions', {}).appDetailWin;
  
  // 初始位置在屏幕外右侧（用于滑入动画）
  const startX = savedPosition && typeof savedPosition.x === 'number' && typeof savedPosition.y === 'number' ? savedPosition.x : targetX + windowWidth;
  const startY = savedPosition && typeof savedPosition.y === 'number' ? savedPosition.y : controlBounds.y;

  appDetailWin = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: startX,
    y: startY,
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
    console.log('应用详情窗口 ready-to-show');
    if (appDetailWin && !appDetailWin.isDestroyed()) {
      appDetailWin.show();
      appDetailWin.focus(); // 确保窗口获得焦点
      
      // 执行从右向左的滑入动画（从屏幕外右侧滑入到 ControlPanel 右侧）
      const animateSlide = () => {
        if (!appDetailWin || appDetailWin.isDestroyed()) return;
        
        const currentBounds = appDetailWin.getBounds();
        const step = 20; // 每次移动的距离
        
        if (currentBounds.x > targetX) {
          const newX = Math.max(currentBounds.x - step, targetX);
          appDetailWin.setPosition(newX, currentBounds.y);
          
          if (newX > targetX) {
            setTimeout(animateSlide, 16);
          } else {
            console.log('应用详情窗口滑动动画完成');
          }
        }
      };
      
      // 开始动画
      setTimeout(animateSlide, 16);
    } else {
      console.error('应用详情窗口已销毁，无法显示');
    }
  });

  // 监听窗口位置改变事件，保存位置到electron-store
  appDetailWin.on('move', () => {
    try {
      const bounds = appDetailWin.getBounds();
      const currentPositions = store.get('windowPositions', {});
      store.set('windowPositions', {
        ...currentPositions,
        appDetailWin: {
          x: bounds.x,
          y: bounds.y
        }
      });
      console.log('AppDetailWin位置已保存:', { x: bounds.x, y: bounds.y });
    } catch (error) {
      console.error('保存AppDetailWin位置失败:', error);
    }
  });

  // 当详情面板获得焦点时，确保 ControlPanel 也保持显示
  appDetailWin.on('focus', () => {
    if (controlWin && !controlWin.isDestroyed() && !controlWin.isVisible()) {
      controlWin.show();
    }
  });

  appDetailWin.on('closed', () => {
    try {
      if (!appDetailWin.isDestroyed()) {
        const bounds = appDetailWin.getBounds();
        const currentPositions = store.get('windowPositions', {});
        store.set('windowPositions', {
          ...currentPositions,
          appDetailWin: {
            x: bounds.x,
            y: bounds.y
          }
        });
        console.log('AppDetailWin关闭时位置已保存:', { x: bounds.x, y: bounds.y });
      }
    } catch (error) {
      console.error('关闭时保存AppDetailWin位置失败:', error);
    }
    
    // 通知 ControlPanel 详情面板已关闭
    if (controlWin && !controlWin.isDestroyed()) {
      controlWin.webContents.send('app-detail-closed');
    }
    if (appDetailWin) {
      appDetailWin = null;
    }
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
    console.log('关闭应用列表面板窗口');
    
    // 执行关闭动画
    const bounds = appListWin.getBounds();
    const windowWidth = 400; // 使用固定尺寸
    // 向左滑出到屏幕外
    const endX = -windowWidth;
    
    // 动画配置
    const duration = 400; // 400ms动画
    const frameDuration = 16; // ~60fps
    const totalFrames = duration / frameDuration;
    let currentFrame = 0;
    
    const animateSlideOut = () => {
      if (!appListWin || appListWin.isDestroyed()) return;
      
      if (currentFrame >= totalFrames) {
        appListWin.close();
        appListWin = null;
        console.log('应用列表面板窗口已关闭');
        return;
      }
      
      // 计算当前帧的位置和透明度（使用ease-in-out缓动）
      const progress = currentFrame / totalFrames;
      const easedProgress = easeInOutQuad(progress);
      
      const currentX = bounds.x - (bounds.x - endX) * easedProgress;
      const opacity = 1 - progress;
      
      // 更新位置和透明度
      appListWin.setPosition(Math.round(currentX), bounds.y);
      appListWin.setOpacity(opacity);
      
      currentFrame++;
      setTimeout(animateSlideOut, frameDuration);
    };
    
    // 开始动画
    animateSlideOut();
  } else {
    console.log('应用列表面板窗口已不存在或已销毁');
  }
}

// 关闭应用详情面板窗口（带滑出动画）
function closeAppDetailWindow() {
  console.log('关闭应用详情窗口');
  if (appDetailWin && !appDetailWin.isDestroyed()) {
    const bounds = appDetailWin.getBounds();
    const windowWidth = 400; // 使用固定尺寸
    // 向左滑出到屏幕外
    const endX = -windowWidth;
    
    // 动画配置
    const duration = 400; // 400ms动画
    const frameDuration = 16; // ~60fps
    const totalFrames = duration / frameDuration;
    let currentFrame = 0;
    
    const animateSlideOut = () => {
      if (!appDetailWin || appDetailWin.isDestroyed()) return;
      
      if (currentFrame >= totalFrames) {
        appDetailWin.close();
        appDetailWin = null;
        console.log('应用详情窗口已关闭');
        
        // 重置创建状态
        isCreatingAppDetail = false;
        
        // 关闭后检查并执行位置交换逻辑
        setTimeout(() => {
          handlePanelPositionAfterClose();
        }, 50);
        
        return;
      }
      
      // 计算当前帧的位置和透明度（使用ease-in-out缓动）
      const progress = currentFrame / totalFrames;
      const easedProgress = easeInOutQuad(progress);
      
      const currentX = bounds.x - (bounds.x - endX) * easedProgress;
      const opacity = 1 - progress;
      
      // 更新位置和透明度
      appDetailWin.setPosition(Math.round(currentX), bounds.y);
      appDetailWin.setOpacity(opacity);
      
      currentFrame++;
      setTimeout(animateSlideOut, frameDuration);
    };
    
    setTimeout(animateSlideOut, 16);
  } else {
    console.log('应用详情窗口已不存在或已销毁');
    // 关闭后检查并执行位置交换逻辑
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

// 执行面板位置交换动画
function animatePanelSwap(controlTargetX, appListTargetX) {
  console.log('执行面板位置交换动画');
  
  if (!controlWin || controlWin.isDestroyed() || !appListWin || appListWin.isDestroyed()) {
    console.error('窗口不存在，无法执行位置交换');
    return;
  }
  
  // 禁用交互，显示提示
  notifyAllWindowsInteractionLocked(true, '正在调整窗口位置，请稍候...');
  
  const controlBounds = controlWin.getBounds();
  const appListBounds = appListWin.getBounds();
  
  // 动画配置
  const duration = 400; // 400ms动画
  const frameDuration = 16; // ~60fps
  const totalFrames = duration / frameDuration;
  let currentFrame = 0;
  
  // 初始位置
  const controlStartX = controlBounds.x;
  const appListStartX = appListBounds.x;
  
  // 执行动画
  const animate = () => {
    if (currentFrame >= totalFrames || !controlWin || controlWin.isDestroyed() || !appListWin || appListWin.isDestroyed()) {
      // 动画结束，确保最终位置正确
      if (controlWin && !controlWin.isDestroyed()) {
        controlWin.setPosition(controlTargetX, controlBounds.y);
      }
      if (appListWin && !appListWin.isDestroyed()) {
        appListWin.setPosition(appListTargetX, appListBounds.y);
      }
      
      console.log('面板位置交换动画完成');
      
      // 恢复交互
      notifyAllWindowsInteractionLocked(false, '');
      
      return;
    }
    
    // 计算当前帧的位置（使用ease-in-out缓动）
    const progress = currentFrame / totalFrames;
    const easedProgress = easeInOutQuad(progress);
    
    const controlCurrentX = controlStartX + (controlTargetX - controlStartX) * easedProgress;
    const appListCurrentX = appListStartX + (appListTargetX - appListStartX) * easedProgress;
    
    // 更新位置
    if (controlWin && !controlWin.isDestroyed()) {
      controlWin.setPosition(Math.round(controlCurrentX), controlBounds.y);
    }
    if (appListWin && !appListWin.isDestroyed()) {
      appListWin.setPosition(Math.round(appListCurrentX), appListBounds.y);
    }
    
    currentFrame++;
    setTimeout(animate, frameDuration);
  };
  
  // 开始动画
  animate();
}

// 恢复面板到原始位置
function restorePanelPositions() {
  console.log('恢复面板到原始位置');
  
  if (!controlWin || controlWin.isDestroyed() || !appListWin || appListWin.isDestroyed()) {
    console.error('窗口不存在，无法恢复位置');
    return;
  }
  
  // 禁用交互，显示提示
  notifyAllWindowsInteractionLocked(true, '正在调整窗口位置，请稍候...');
  
  const controlBounds = controlWin.getBounds();
  const appListBounds = appListWin.getBounds();
  const windowWidth = 400; // 固定窗口宽度
  
  // 计算原始位置
  // 如果有初始X坐标，则使用初始X坐标，否则使用当前X坐标 + windowWidth
  const controlOriginalX = controlWinInitialX !== null ? controlWinInitialX : controlBounds.x + windowWidth;
  const appListOriginalX = controlBounds.x - windowWidth;
  
  // 动画配置
  const duration = 400; // 400ms动画
  const frameDuration = 16; // ~60fps
  const totalFrames = duration / frameDuration;
  let currentFrame = 0;
  
  // 执行动画
  const animate = () => {
    if (currentFrame >= totalFrames || !controlWin || controlWin.isDestroyed() || !appListWin || appListWin.isDestroyed()) {
      // 动画结束，确保最终位置正确
      if (controlWin && !controlWin.isDestroyed()) {
        controlWin.setPosition(controlOriginalX, controlBounds.y);
      }
      if (appListWin && !appListWin.isDestroyed()) {
        appListWin.setPosition(appListOriginalX, appListBounds.y);
      }
      
      // 恢复交互
      notifyAllWindowsInteractionLocked(false, '');
      
      // 重置动画标志，允许下次重新执行动画
      hasPerformedSwapAnimation = false;
      console.log('面板位置恢复完成，动画标志已重置');
      return;
    }
    
    // 计算当前帧的位置（使用ease-in-out缓动）
    const progress = currentFrame / totalFrames;
    const easedProgress = easeInOutQuad(progress);
    
    const controlCurrentX = controlBounds.x + (controlOriginalX - controlBounds.x) * easedProgress;
    const appListCurrentX = appListBounds.x + (appListOriginalX - appListBounds.x) * easedProgress;
    
    // 更新位置
    if (controlWin && !controlWin.isDestroyed()) {
      controlWin.setPosition(Math.round(controlCurrentX), controlBounds.y);
    }
    if (appListWin && !appListWin.isDestroyed()) {
      appListWin.setPosition(Math.round(appListCurrentX), appListBounds.y);
    }
    
    currentFrame++;
    setTimeout(animate, frameDuration);
  };
  
  // 开始动画
  animate();
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
  return global.appDetailData || null;
});

// 应用列表选择应用后通知详情面板
ipcMain.on('app-list-select', (event, appData) => {
  // 存储数据
  global.appDetailData = appData;
  
  // 检查AppDetailPanel是否已存在
  if (appDetailWin && !appDetailWin.isDestroyed() && appDetailWin.isVisible()) {
    console.log('AppDetailPanel已存在，直接更新数据');
    // 通知渲染进程数据已更新
    if (appDetailWin.webContents) {
      appDetailWin.webContents.send('app-detail-updated', appData);
    }
    return;
  }
  
  // 记录窗口切换历史
  windowHistory.push({ type: 'app-detail', appData });
  console.log('窗口切换历史:', windowHistory);
  
  // 检查窗口是否存在
  if (!controlWin || controlWin.isDestroyed() || !appListWin || appListWin.isDestroyed()) {
    console.error('窗口不存在，无法执行位置互换动画');
    createAppDetailWindow(appData);
    return;
  }
  
  // 执行位置互换动画
  performPanelSwapAnimation(appData);
});

// 执行面板位置互换动画
function performPanelSwapAnimation(appData) {
  console.log('开始执行面板位置互换动画');
  
  // 禁用交互，显示提示
  notifyAllWindowsInteractionLocked(true, '正在调整窗口位置，请稍候...');
  
  const controlBounds = controlWin.getBounds();
  const appListBounds = appListWin.getBounds();
  const windowWidth = 400; // 固定窗口宽度
  
  // 计算目标位置，确保精确控制
  const controlTargetX = controlBounds.x - windowWidth;
  const appListTargetX = appListBounds.x + windowWidth;
  
  // 验证位置是否在合理范围内
  const maxDistance = windowWidth + 50; // 最大允许距离
  const controlDistance = Math.abs(controlTargetX - controlBounds.x);
  const appListDistance = Math.abs(appListTargetX - appListBounds.x);
  
  if (controlDistance > maxDistance || appListDistance > maxDistance) {
    console.warn('面板位置距离超过预设阈值，调整位置');
  }
  
  // 动画配置
  const duration = 400; // 400ms动画
  const frameDuration = 16; // ~60fps
  const totalFrames = duration / frameDuration;
  let currentFrame = 0;
  
  // 初始位置
  const controlStartX = controlBounds.x;
  const appListStartX = appListBounds.x;
  
  // 执行动画
  const animate = () => {
    if (currentFrame >= totalFrames || !controlWin || controlWin.isDestroyed() || !appListWin || appListWin.isDestroyed()) {
      // 动画结束，确保最终位置正确
      if (controlWin && !controlWin.isDestroyed()) {
        controlWin.setPosition(controlTargetX, controlBounds.y);
      }
      if (appListWin && !appListWin.isDestroyed()) {
        appListWin.setPosition(appListTargetX, appListBounds.y);
      }
      
      console.log('面板位置互换动画完成');
      
      // 恢复交互
      notifyAllWindowsInteractionLocked(false, '');
      
      // 延迟50ms后显示AppDetailPanel
      setTimeout(() => {
        createAppDetailWindow(appData);
      }, 50);
      
      return;
    }
    
    // 计算当前帧的位置（使用ease-in-out缓动）
    const progress = currentFrame / totalFrames;
    const easedProgress = easeInOutQuad(progress);
    
    const controlCurrentX = controlStartX - (controlStartX - controlTargetX) * easedProgress;
    const appListCurrentX = appListStartX + (appListTargetX - appListStartX) * easedProgress;
    
    // 更新位置
    if (controlWin && !controlWin.isDestroyed()) {
      controlWin.setPosition(Math.round(controlCurrentX), controlBounds.y);
    }
    if (appListWin && !appListWin.isDestroyed()) {
      appListWin.setPosition(Math.round(appListCurrentX), appListBounds.y);
    }
    
    currentFrame++;
    setTimeout(animate, frameDuration);
  };
  
  // 开始动画
  animate();
}

// 恢复面板位置函数
function restorePanelPositions() {
  console.log('恢复面板位置');
  if (controlWin && !controlWin.isDestroyed() && appListWin && !appListWin.isDestroyed()) {
    const controlBounds = controlWin.getBounds();
    const windowWidth = 400; // 固定窗口宽度
    
    // 计算恢复位置
    const controlTargetX = controlBounds.x + windowWidth;
    const appListTargetX = appListWin.getBounds().x - windowWidth;
    
    // 动画配置
    const duration = 300; // 300ms动画
    const frameDuration = 16; // ~60fps
    const totalFrames = duration / frameDuration;
    let currentFrame = 0;
    
    // 初始位置
    const controlStartX = controlBounds.x;
    const appListStartX = appListWin.getBounds().x;
    
    // 执行动画
    const animate = () => {
      if (currentFrame >= totalFrames || !controlWin || controlWin.isDestroyed() || !appListWin || appListWin.isDestroyed()) {
        // 动画结束，确保最终位置正确
        if (controlWin && !controlWin.isDestroyed()) {
          controlWin.setPosition(controlTargetX, controlBounds.y);
        }
        if (appListWin && !appListWin.isDestroyed()) {
          appListWin.setPosition(appListTargetX, appListWin.getBounds().y);
        }
        
        console.log('面板位置恢复完成');
        return;
      }
      
      // 计算当前帧的位置（使用ease-in-out缓动）
      const progress = currentFrame / totalFrames;
      const easedProgress = easeInOutQuad(progress);
      
      const controlCurrentX = controlStartX + (controlTargetX - controlStartX) * easedProgress;
      const appListCurrentX = appListStartX - (appListStartX - appListTargetX) * easedProgress;
      
      // 更新位置
      if (controlWin && !controlWin.isDestroyed()) {
        controlWin.setPosition(Math.round(controlCurrentX), controlBounds.y);
      }
      if (appListWin && !appListWin.isDestroyed()) {
        appListWin.setPosition(Math.round(appListCurrentX), appListWin.getBounds().y);
      }
      
      currentFrame++;
      setTimeout(animate, frameDuration);
    };
    
    // 开始动画
    animate();
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