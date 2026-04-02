const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getData: () => ipcRenderer.invoke('get-data'),
  addEntry: (data) => ipcRenderer.send('add-entry', data),
  
  // 【新增】暴露删除方法
  deleteEntry: (id) => ipcRenderer.send('delete-entry', id),
  
  // 监听数据更新（复用现有的逻辑即可）
  onDataUpdate: (callback) => ipcRenderer.on('data-updated', (event, data) => callback(data)),

  //切换曲线时间显示按钮
  setIgnoreMouseEvents: (ignore, options) => ipcRenderer.send('set-ignore-mouse-events', ignore, options),

  // 【新增】权重相关
  getWeights: () => ipcRenderer.invoke('get-weights'),
  saveWeights: (weights) => ipcRenderer.send('save-weights', weights),
  onWeightsUpdate: (callback) => ipcRenderer.on('weights-updated', (event, weights) => callback(weights)),

   // ✅【新增】指标管理接口
  getMetrics: () => ipcRenderer.invoke('get-metrics'),
  saveMetrics: (metrics) => ipcRenderer.send('save-metrics', metrics),
  onMetricsUpdate: (callback) => ipcRenderer.on('metrics-updated', (event, metrics) => callback(metrics)),

  // ✅【新增】显示配置接口
  getDisplayConfig: () => ipcRenderer.invoke('get-display-config'),
  saveDisplayConfig: (config) => ipcRenderer.send('save-display-config', config),
  onDisplayConfigUpdate: (callback) => ipcRenderer.on('display-config-updated', (event, config) => callback(config)),

  
  //数据导入导出
    exportData: () => ipcRenderer.invoke('export-data'),
    importData: () => ipcRenderer.invoke('import-data'),

  // ==================== 应用使用时间追踪 ====================

  // --- 应用使用记录管理 ---
  getAppUsageRecords: (options) => ipcRenderer.invoke('get-app-usage-records', options),
  getAppUsageSummary: (dateRange) => ipcRenderer.invoke('get-app-usage-summary', dateRange),
  getTopApps: (limit) => ipcRenderer.invoke('get-top-apps', limit),
  addAppUsageRecord: (record) => ipcRenderer.send('add-app-usage-record', record),
  deleteAppUsageRecord: (id) => ipcRenderer.send('delete-app-usage-record', id),
  updateAppCategory: (appName, category) => ipcRenderer.invoke('update-app-category', appName, category),
  getAppCategory: (appName) => ipcRenderer.invoke('get-app-category', appName),
  cleanupAppUsageRecords: (maxAgeDays) => ipcRenderer.invoke('cleanup-app-usage-records', maxAgeDays),

  // --- 浏览器使用记录管理 ---
  getBrowserUsageRecords: (options) => ipcRenderer.invoke('get-browser-usage-records', options),
  importBrowserUsageRecords: (records) => ipcRenderer.invoke('import-browser-usage-records', records),

  // --- 设置管理 ---
  getAppUsageSettings: () => ipcRenderer.invoke('get-app-usage-settings'),
  updateAppUsageSettings: (settings) => ipcRenderer.send('update-app-usage-settings', settings),
  getBrowserUsageSettings: () => ipcRenderer.invoke('get-browser-usage-settings'),
  updateBrowserUsageSettings: (settings) => ipcRenderer.send('update-browser-usage-settings', settings),

  // --- 数据导出 ---
  exportAppUsageData: (format) => ipcRenderer.invoke('export-app-usage-data', format),
  exportBrowserUsageData: (format) => ipcRenderer.invoke('export-browser-usage-data', format),

  // --- 追踪控制 ---
  startAppTracking: (options) => ipcRenderer.send('start-app-tracking', options),
  stopAppTracking: () => ipcRenderer.send('stop-app-tracking'),
  getAppTrackingStatus: () => ipcRenderer.invoke('get-app-tracking-status'),
  onAppTrackingStarted: (callback) => ipcRenderer.on('app-tracking-started', (event, status) => callback(status)),
  onAppTrackingStopped: (callback) => ipcRenderer.on('app-tracking-stopped', (event, status) => callback(status)),

  // --- 事件监听 ---
  onAppUsageUpdate: (callback) => ipcRenderer.on('app-usage-updated', (event, data) => callback(data)),
  onAppUsageRecordDeleted: (callback) => ipcRenderer.on('app-usage-record-deleted', (event, id) => callback(id)),
  onBrowserUsageImported: (callback) => ipcRenderer.on('browser-usage-imported', (event, count) => callback(count)),

});