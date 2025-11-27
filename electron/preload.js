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
  
});