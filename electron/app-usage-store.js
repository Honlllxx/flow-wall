const Store = require('electron-store');

class AppUsageStore {
  constructor() {
    this.store = new Store();
    this.initializeDefaults();
  }

  initializeDefaults() {
    // 初始化应用使用数据存储结构
    if (!this.store.has('appUsage')) {
      this.store.set('appUsage', {
        records: [],        // 应用使用记录
        categories: ['工作', '娱乐', '社交', '学习', '工具', '其他'], // 默认分类
        appMapping: {},     // 应用名称到分类的映射
        settings: {
          trackingEnabled: true,
          pollingInterval: 3000, // 轮询间隔（毫秒）
          ignoreApps: [],        // 忽略的应用列表
          maxRecords: 10000,     // 最大记录数
          autoCategorize: true   // 自动分类
        }
      });
    }

    if (!this.store.has('browserUsage')) {
      this.store.set('browserUsage', {
        records: [],        // 浏览器使用记录
        domains: {},        // 域名到分类的映射
        settings: {
          trackingEnabled: false, // 默认禁用，需要浏览器扩展
          importInterval: 60000   // 导入间隔（毫秒）
        }
      });
    }
  }

  // ==================== 应用使用记录 ====================

  /**
   * 添加应用使用记录
   * @param {Object} record 应用使用记录
   */
  addAppUsageRecord(record) {
    const appUsage = this.store.get('appUsage');
    const records = appUsage.records || [];

    // 生成唯一ID
    const recordWithId = {
      ...record,
      id: `app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now()
    };

    records.push(recordWithId);

    // 限制记录数量
    if (records.length > appUsage.settings.maxRecords) {
      records.splice(0, records.length - appUsage.settings.maxRecords);
    }

    appUsage.records = records;
    this.store.set('appUsage', appUsage);

    return recordWithId;
  }

  /**
   * 获取应用使用记录
   * @param {Object} options 查询选项
   * @returns {Array} 应用使用记录
   */
  getAppUsageRecords(options = {}) {
    const appUsage = this.store.get('appUsage');
    let records = appUsage.records || [];

    // 应用过滤器
    if (options.startDate) {
      const startTime = new Date(options.startDate).getTime();
      records = records.filter(record => record.startTime >= startTime);
    }

    if (options.endDate) {
      const endTime = new Date(options.endDate).getTime();
      records = records.filter(record => record.endTime <= endTime);
    }

    if (options.appName) {
      records = records.filter(record => record.appName === options.appName);
    }

    if (options.category) {
      records = records.filter(record => record.category === options.category);
    }

    // 排序
    const sortField = options.sortBy || 'startTime';
    const sortOrder = options.sortOrder || 'desc';
    records.sort((a, b) => {
      if (sortOrder === 'asc') {
        return a[sortField] - b[sortField];
      } else {
        return b[sortField] - a[sortField];
      }
    });

    // 分页
    if (options.limit) {
      const offset = options.offset || 0;
      records = records.slice(offset, offset + options.limit);
    }

    return records;
  }

  /**
   * 获取应用使用摘要
   * @param {string} dateRange 日期范围（today, week, month, year）
   * @returns {Object} 使用摘要
   */
  getAppUsageSummary(dateRange = 'today') {
    const records = this.getAppUsageRecords();
    const now = Date.now();
    let startTime;

    switch (dateRange) {
      case 'today':
        startTime = new Date().setHours(0, 0, 0, 0);
        break;
      case 'week':
        startTime = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case 'month':
        startTime = now - 30 * 24 * 60 * 60 * 1000;
        break;
      case 'year':
        startTime = now - 365 * 24 * 60 * 60 * 1000;
        break;
      default:
        startTime = 0;
    }

    const filteredRecords = records.filter(record => record.endTime >= startTime);

    // 按应用统计
    const appStats = {};
    let totalDuration = 0;

    filteredRecords.forEach(record => {
      totalDuration += record.duration || 0;

      if (!appStats[record.appName]) {
        appStats[record.appName] = {
          duration: 0,
          count: 0,
          category: record.category
        };
      }

      appStats[record.appName].duration += record.duration || 0;
      appStats[record.appName].count++;
    });

    // 按分类统计
    const categoryStats = {};
    Object.values(appStats).forEach(stat => {
      const category = stat.category || '其他';
      if (!categoryStats[category]) {
        categoryStats[category] = {
          duration: 0,
          appCount: 0
        };
      }
      categoryStats[category].duration += stat.duration;
      categoryStats[category].appCount++;
    });

    // 获取最常用应用（前10）
    const topApps = Object.entries(appStats)
      .map(([appName, stats]) => ({
        appName,
        duration: stats.duration,
        count: stats.count,
        category: stats.category
      }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    return {
      totalDuration,
      totalRecords: filteredRecords.length,
      appStats,
      categoryStats,
      topApps,
      dateRange
    };
  }

  /**
   * 更新应用分类映射
   * @param {string} appName 应用名称
   * @param {string} category 分类
   */
  updateAppCategory(appName, category) {
    const appUsage = this.store.get('appUsage');
    appUsage.appMapping = appUsage.appMapping || {};
    appUsage.appMapping[appName] = category;
    this.store.set('appUsage', appUsage);
  }

  /**
   * 获取应用分类
   * @param {string} appName 应用名称
   * @returns {string} 分类
   */
  getAppCategory(appName) {
    const appUsage = this.store.get('appUsage');
    const mapping = appUsage.appMapping || {};

    // 如果已有映射，直接返回
    if (mapping[appName]) {
      return mapping[appName];
    }

    // 自动分类逻辑（简单实现）
    const workKeywords = ['vscode', 'visual studio', 'intellij', 'pycharm', 'webstorm', 'android studio', 'eclipse', 'office', 'excel', 'word', 'powerpoint', 'outlook'];
    const entertainmentKeywords = ['steam', 'game', 'spotify', 'music', 'video', 'movie', 'youtube', 'bilibili', 'netflix'];
    const socialKeywords = ['wechat', '微信', 'qq', 'discord', 'telegram', 'whatsapp', 'slack', 'teams'];
    const studyKeywords = ['pdf', 'book', 'read', 'course', '学习', 'study', 'academic'];

    const lowerAppName = appName.toLowerCase();

    if (workKeywords.some(keyword => lowerAppName.includes(keyword))) {
      return '工作';
    } else if (entertainmentKeywords.some(keyword => lowerAppName.includes(keyword))) {
      return '娱乐';
    } else if (socialKeywords.some(keyword => lowerAppName.includes(keyword))) {
      return '社交';
    } else if (studyKeywords.some(keyword => lowerAppName.includes(keyword))) {
      return '学习';
    } else {
      return '其他';
    }
  }

  /**
   * 删除应用使用记录
   * @param {string} id 记录ID
   */
  deleteAppUsageRecord(id) {
    const appUsage = this.store.get('appUsage');
    const records = appUsage.records || [];
    const newRecords = records.filter(record => record.id !== id);
    appUsage.records = newRecords;
    this.store.set('appUsage', appUsage);
    return newRecords.length !== records.length;
  }

  /**
   * 清理旧记录
   * @param {number} maxAgeDays 最大保留天数
   */
  cleanupOldRecords(maxAgeDays = 90) {
    const appUsage = this.store.get('appUsage');
    const records = appUsage.records || [];
    const cutoffTime = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

    const newRecords = records.filter(record => record.endTime >= cutoffTime);
    appUsage.records = newRecords;
    this.store.set('appUsage', appUsage);

    return records.length - newRecords.length;
  }

  // ==================== 浏览器使用记录 ====================

  /**
   * 添加浏览器使用记录
   * @param {Object} record 浏览器使用记录
   */
  addBrowserUsageRecord(record) {
    const browserUsage = this.store.get('browserUsage');
    const records = browserUsage.records || [];

    const recordWithId = {
      ...record,
      id: `browser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now()
    };

    records.push(recordWithId);
    browserUsage.records = records;
    this.store.set('browserUsage', browserUsage);

    return recordWithId;
  }

  /**
   * 批量导入浏览器使用记录
   * @param {Array} records 浏览器使用记录数组
   */
  importBrowserUsageRecords(records) {
    const browserUsage = this.store.get('browserUsage');
    const existingRecords = browserUsage.records || [];

    const newRecords = records.map(record => ({
      ...record,
      id: `browser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now()
    }));

    browserUsage.records = [...existingRecords, ...newRecords];
    this.store.set('browserUsage', browserUsage);

    return newRecords.length;
  }

  /**
   * 获取浏览器使用记录
   * @param {Object} options 查询选项
   * @returns {Array} 浏览器使用记录
   */
  getBrowserUsageRecords(options = {}) {
    const browserUsage = this.store.get('browserUsage');
    let records = browserUsage.records || [];

    // 应用过滤器（类似应用使用记录）
    if (options.startDate) {
      const startTime = new Date(options.startDate).getTime();
      records = records.filter(record => record.startTime >= startTime);
    }

    if (options.endDate) {
      const endTime = new Date(options.endDate).getTime();
      records = records.filter(record => record.endTime <= endTime);
    }

    if (options.domain) {
      records = records.filter(record => record.domain === options.domain);
    }

    // 排序
    const sortField = options.sortBy || 'startTime';
    const sortOrder = options.sortOrder || 'desc';
    records.sort((a, b) => {
      if (sortOrder === 'asc') {
        return a[sortField] - b[sortField];
      } else {
        return b[sortField] - a[sortField];
      }
    });

    // 分页
    if (options.limit) {
      const offset = options.offset || 0;
      records = records.slice(offset, offset + options.limit);
    }

    return records;
  }

  // ==================== 设置管理 ====================

  /**
   * 更新应用使用设置
   * @param {Object} settings 新的设置
   */
  updateAppUsageSettings(settings) {
    const appUsage = this.store.get('appUsage');
    appUsage.settings = { ...appUsage.settings, ...settings };
    this.store.set('appUsage', appUsage);
  }

  /**
   * 获取应用使用设置
   * @returns {Object} 应用使用设置
   */
  getAppUsageSettings() {
    const appUsage = this.store.get('appUsage');
    return appUsage.settings;
  }

  /**
   * 更新浏览器使用设置
   * @param {Object} settings 新的设置
   */
  updateBrowserUsageSettings(settings) {
    const browserUsage = this.store.get('browserUsage');
    browserUsage.settings = { ...browserUsage.settings, ...settings };
    this.store.set('browserUsage', browserUsage);
  }

  /**
   * 获取浏览器使用设置
   * @returns {Object} 浏览器使用设置
   */
  getBrowserUsageSettings() {
    const browserUsage = this.store.get('browserUsage');
    return browserUsage.settings;
  }

  // ==================== 数据导出 ====================

  /**
   * 导出应用使用数据
   * @param {string} format 导出格式（json, csv）
   * @returns {Object} 导出数据
   */
  exportAppUsageData(format = 'json') {
    const appUsage = this.store.get('appUsage');

    if (format === 'json') {
      return appUsage;
    } else if (format === 'csv') {
      // 简单CSV转换（实际实现可能需要更复杂的处理）
      const records = appUsage.records || [];
      if (records.length === 0) {
        return '';
      }

      const headers = ['appName', 'windowTitle', 'category', 'startTime', 'endTime', 'duration', 'date'];
      const csvRows = [
        headers.join(','),
        ...records.map(record => headers.map(header => `"${record[header] || ''}"`).join(','))
      ];

      return csvRows.join('\n');
    }

    return null;
  }

  /**
   * 导出浏览器使用数据
   * @param {string} format 导出格式（json, csv）
   * @returns {Object} 导出数据
   */
  exportBrowserUsageData(format = 'json') {
    const browserUsage = this.store.get('browserUsage');

    if (format === 'json') {
      return browserUsage;
    } else if (format === 'csv') {
      const records = browserUsage.records || [];
      if (records.length === 0) {
        return '';
      }

      const headers = ['url', 'domain', 'title', 'category', 'startTime', 'endTime', 'duration', 'date', 'browser'];
      const csvRows = [
        headers.join(','),
        ...records.map(record => headers.map(header => `"${record[header] || ''}"`).join(','))
      ];

      return csvRows.join('\n');
    }

    return null;
  }
}

module.exports = AppUsageStore;