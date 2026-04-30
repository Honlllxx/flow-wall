const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // 基础数据
  getData: () => ipcRenderer.invoke('get-data'),
  addEntry: (data) => ipcRenderer.send('add-entry', data),
  deleteEntry: (id) => ipcRenderer.send('delete-entry', id),
  onDataUpdate: (callback) => ipcRenderer.on('data-updated', (event, data) => callback(data)),

  // 窗口交互
  setIgnoreMouseEvents: (ignore, options) => ipcRenderer.send('set-ignore-mouse-events', ignore, options),
  resizeControlWindow: (width) => ipcRenderer.send('resize-control-window', width),
  // 窗口拖动交互锁定
  startWindowDrag: () => ipcRenderer.send('start-window-drag'),
  endWindowDrag: () => ipcRenderer.send('end-window-drag'),
  onWindowDragStateChange: (callback) => {
    const listener = (event, isDragging) => callback(isDragging);
    ipcRenderer.on('window-drag-state-change', listener);
    return () => ipcRenderer.removeListener('window-drag-state-change', listener);
  },
  // 窗口交互锁定
  onWindowInteractionLocked: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('window-interaction-locked', listener);
    return () => ipcRenderer.removeListener('window-interaction-locked', listener);
  },
  // 应用列表窗口
  showAppList: () => ipcRenderer.send('show-app-list'),
  closeAppList: () => ipcRenderer.send('close-app-list'),
  // 应用详情窗口
  showAppDetail: (appData) => ipcRenderer.send('show-app-detail', appData),
  closeAppDetail: () => ipcRenderer.send('close-app-detail'),
  getAppDetailData: () => ipcRenderer.invoke('get-app-detail-data'),
  onAppDetailClosed: (callback) => ipcRenderer.on('app-detail-closed', () => callback()),
  onAppDetailUpdated: (callback) => {
    const listener = (event, appData) => callback(appData);
    ipcRenderer.on('app-detail-updated', listener);
    return () => ipcRenderer.removeListener('app-detail-updated', listener);
  },
  // 应用列表选择应用
  appListSelect: (appData) => ipcRenderer.send('app-list-select', appData),
  // 窗口返回功能
  windowBack: () => ipcRenderer.send('window-back'),

  // 权重与配置
  getWeights: () => ipcRenderer.invoke('get-weights'),
  saveWeights: (weights) => ipcRenderer.send('save-weights', weights),
  onWeightsUpdate: (callback) => ipcRenderer.on('weights-updated', (event, weights) => callback(weights)),

  // 指标管理
  getMetrics: () => ipcRenderer.invoke('get-metrics'),
  saveMetrics: (metrics) => ipcRenderer.send('save-metrics', metrics),
  onMetricsUpdate: (callback) => ipcRenderer.on('metrics-updated', (event, metrics) => callback(metrics)),

  // 显示配置
  getDisplayConfig: () => ipcRenderer.invoke('get-display-config'),
  saveDisplayConfig: (config) => ipcRenderer.send('save-display-config', config),
  onDisplayConfigUpdate: (callback) => ipcRenderer.on('display-config-updated', (event, config) => callback(config)),

  // 备份恢复
  exportData: () => ipcRenderer.invoke('export-data'),
  importData: () => ipcRenderer.invoke('import-data'),

  // ✅【新增】开机自启接口
  getAutoLaunch: () => ipcRenderer.invoke('get-auto-launch'),
  toggleAutoLaunch: (flag) => ipcRenderer.send('toggle-auto-launch', flag),

  // ✅【新增】应用使用追踪接口
  appUsage: {
    // 获取今日统计
    getToday: () => ipcRenderer.invoke('app-usage:get-today'),
    // 获取分类汇总
    getCategories: () => ipcRenderer.invoke('app-usage:get-categories'),
    // 设置应用分类
    setCategory: (appName, category) => ipcRenderer.send('app-usage:set-category', appName, category),
    // 获取应用分类
    getCategory: (appName) => ipcRenderer.invoke('app-usage:get-category', appName),
    // 开始追踪
    start: () => ipcRenderer.send('app-usage:start'),
    // 停止追踪
    stop: () => ipcRenderer.send('app-usage:stop'),
    // 检查运行状态
    isRunning: () => ipcRenderer.invoke('app-usage:is-running'),
    // 设置配置
    setConfig: (config) => ipcRenderer.send('app-usage:set-config', config),
    // 获取峰值使用时段
    getPeakPeriod: () => ipcRenderer.invoke('app-usage:get-peak-period'),
    // 获取最长会话（可选参数：appName，指定应用名称）
    getLongestSession: (appName) => ipcRenderer.invoke('app-usage:get-longest-session', appName),
    // 获取历史趋势
    getHistoricalTrend: (days) => ipcRenderer.invoke('app-usage:get-historical-trend', days),
    // 获取数据验证
    getValidation: () => ipcRenderer.invoke('app-usage:get-validation'),
    // 获取峰值分析
    analyzePeakPeriods: (days) => ipcRenderer.invoke('app-usage:analyze-peak-periods', days),
    // 导出分析报告
    exportReport: (days) => ipcRenderer.invoke('app-usage:export-report', days),
    // 监听实时更新
    onUpdate: (callback) => {
      const listener = (event, data) => callback(data);
      ipcRenderer.on('app-usage:update', listener);
      return () => ipcRenderer.removeListener('app-usage:update', listener);
    }
  }
});