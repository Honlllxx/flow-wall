const Win32Monitor = require('./win32-monitor');
const AppUsageStore = require('./app-usage-store');

class AppUsageTracker {
  constructor() {
    this.win32Monitor = new Win32Monitor();
    this.appUsageStore = new AppUsageStore();
    this.isTracking = false;
    this.currentSession = null;
  }

  /**
   * 开始追踪应用使用时间
   * @param {Object} options 追踪选项
   */
  startTracking(options = {}) {
    if (this.isTracking) {
      console.log('应用使用时间追踪已经在运行中');
      return;
    }

    console.log('开始应用使用时间追踪');

    // 更新监控器设置
    const settings = this.appUsageStore.getAppUsageSettings();
    this.win32Monitor.updateSettings(settings);

    // 开始监控
    this.win32Monitor.startMonitoring((usageRecord, newWindowInfo) => {
      this.handleWindowChange(usageRecord, newWindowInfo);
    });

    this.isTracking = true;
    this.currentSession = {
      startTime: Date.now(),
      options: options
    };

    // 保存追踪状态
    this.appUsageStore.updateAppUsageSettings({ trackingEnabled: true });

    return true;
  }

  /**
   * 停止追踪
   */
  stopTracking() {
    if (!this.isTracking) {
      console.log('应用使用时间追踪未在运行');
      return;
    }

    console.log('停止应用使用时间追踪');

    // 停止监控
    this.win32Monitor.stopMonitoring();

    this.isTracking = false;

    // 更新当前会话
    if (this.currentSession) {
      this.currentSession.endTime = Date.now();
      this.currentSession.duration = Date.now() - this.currentSession.startTime;
      this.currentSession = null;
    }

    // 保存追踪状态
    this.appUsageStore.updateAppUsageSettings({ trackingEnabled: false });

    return true;
  }

  /**
   * 处理窗口变化
   * @param {Object} usageRecord 上一个窗口的使用记录
   * @param {Object} newWindowInfo 新窗口信息
   */
  handleWindowChange(usageRecord, newWindowInfo) {
    if (!usageRecord) {
      return;
    }

    // 忽略过短的记录（小于1秒）
    if (usageRecord.duration < 1000) {
      console.log(`忽略过短记录: ${usageRecord.appName} (${usageRecord.duration}ms)`);
      return;
    }

    // 获取应用分类
    const category = this.appUsageStore.getAppCategory(usageRecord.appName);

    // 准备完整记录
    const fullRecord = {
      ...usageRecord,
      appPath: '', // PowerShell版本无法获取路径
      category: category,
      date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
      isActive: true
    };

    // 保存记录
    const savedRecord = this.appUsageStore.addAppUsageRecord(fullRecord);

    console.log(`记录应用使用: ${usageRecord.appName} (${Math.round(usageRecord.duration / 1000)}秒)`);

    // 如果有新窗口，可以在这里进行额外处理
    if (newWindowInfo) {
      console.log(`切换到新窗口: ${newWindowInfo.processName || '未知应用'}`);
    }

    // 返回保存的记录
    return savedRecord;
  }

  /**
   * 手动添加应用使用记录
   * @param {Object} record 应用使用记录
   */
  addManualRecord(record) {
    const fullRecord = {
      ...record,
      id: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      date: new Date().toISOString().split('T')[0]
    };

    return this.appUsageStore.addAppUsageRecord(fullRecord);
  }

  /**
   * 获取追踪状态
   * @returns {Object} 追踪状态
   */
  getTrackingStatus() {
    const monitorStatus = this.win32Monitor.getStatus();
    const settings = this.appUsageStore.getAppUsageSettings();

    return {
      isTracking: this.isTracking,
      monitorStatus: monitorStatus,
      settings: settings,
      currentSession: this.currentSession,
      summary: this.appUsageStore.getAppUsageSummary('today')
    };
  }

  /**
   * 更新追踪设置
   * @param {Object} newSettings 新的设置
   */
  updateSettings(newSettings) {
    // 更新存储设置
    this.appUsageStore.updateAppUsageSettings(newSettings);

    // 更新监控器设置
    this.win32Monitor.updateSettings(newSettings);

    // 如果追踪正在运行，可能需要重启监控器
    if (this.isTracking && newSettings.pollingInterval) {
      // 重启监控器以应用新的轮询间隔
      this.stopTracking();
      setTimeout(() => this.startTracking(), 100);
    }

    return true;
  }

  /**
   * 获取应用使用数据
   * @param {Object} options 查询选项
   * @returns {Array} 应用使用记录
   */
  getAppUsageRecords(options = {}) {
    return this.appUsageStore.getAppUsageRecords(options);
  }

  /**
   * 获取应用使用摘要
   * @param {string} dateRange 日期范围
   * @returns {Object} 摘要数据
   */
  getAppUsageSummary(dateRange = 'today') {
    return this.appUsageStore.getAppUsageSummary(dateRange);
  }

  /**
   * 获取最常用应用
   * @param {number} limit 限制数量
   * @returns {Array} 最常用应用列表
   */
  getTopApps(limit = 10) {
    const summary = this.appUsageStore.getAppUsageSummary('month');
    return summary.topApps.slice(0, limit);
  }

  /**
   * 删除应用使用记录
   * @param {string} id 记录ID
   */
  deleteAppUsageRecord(id) {
    return this.appUsageStore.deleteAppUsageRecord(id);
  }

  /**
   * 清理旧记录
   * @param {number} maxAgeDays 最大保留天数
   */
  cleanupOldRecords(maxAgeDays = 90) {
    return this.appUsageStore.cleanupOldRecords(maxAgeDays);
  }

  /**
   * 更新应用分类
   * @param {string} appName 应用名称
   * @param {string} category 分类
   */
  updateAppCategory(appName, category) {
    return this.appUsageStore.updateAppCategory(appName, category);
  }

  /**
   * 获取应用分类
   * @param {string} appName 应用名称
   * @returns {string} 分类
   */
  getAppCategory(appName) {
    return this.appUsageStore.getAppCategory(appName);
  }

  /**
   * 导出数据
   * @param {string} format 导出格式
   * @returns {string|Object} 导出的数据
   */
  exportData(format = 'json') {
    return this.appUsageStore.exportAppUsageData(format);
  }

  /**
   * 导入浏览器使用数据
   * @param {Array} records 浏览器使用记录
   */
  importBrowserUsageData(records) {
    return this.appUsageStore.importBrowserUsageRecords(records);
  }
}

module.exports = AppUsageTracker;