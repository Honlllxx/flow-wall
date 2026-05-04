// 配置
const CONFIG = {
  websocketUrl: 'ws://localhost:3000/ws',
  reconnectDelay: 1000,
  maxReconnectDelay: 30000,
  heartbeatInterval: 10000,
  reportInterval: 60000,
  updateInterval: 1000
};

let webSocketClient = null;
let tabTracker = null;
let isInitialized = false;

class WebSocketClient {
  constructor(config = {}) {
    this.url = config.url || 'ws://localhost:3000/ws';
    this.reconnectDelay = config.reconnectDelay || 1000;
    this.maxReconnectDelay = config.maxReconnectDelay || 30000;
    this.heartbeatInterval = config.heartbeatInterval || 10000;
    this.heartbeatTimeout = config.heartbeatTimeout || 5000;
    this.maxRetries = config.maxRetries || 5;
    
    this.socket = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.heartbeatTimer = null;
    this.heartbeatTimeoutTimer = null;
    this.pendingMessages = [];
    this.isSleeping = false;
    this.sleepStartTime = null;
    
    this.onOpen = config.onOpen || (() => {});
    this.onClose = config.onClose || (() => {});
    this.onMessage = config.onMessage || (() => {});
    this.onError = config.onError || (() => {});
    this.onReconnect = config.onReconnect || (() => {});
    
    this.setupSleepDetection();
  }
  
  connect() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return;
    }
    
    this.log('info', `Connecting to ${this.url}...`);
    
    try {
      this.socket = new WebSocket(this.url);
      
      this.socket.onopen = (event) => {
        this.log('success', 'WebSocket connection established');
        this.connected = true;
        this.reconnectAttempts = 0;
        
        this.sendPendingMessages();
        this.startHeartbeat();
        this.onOpen(event);
      };
      
      this.socket.onclose = (event) => {
        this.log('warning', `WebSocket connection closed: ${event.code} - ${event.reason}`);
        this.connected = false;
        
        this.stopHeartbeat();
        this.onClose(event);
        
        if (!this.isSleeping) {
          this.scheduleReconnect();
        }
      };
      
      this.socket.onmessage = (event) => {
        if (event.data === 'pong') {
          this.resetHeartbeatTimeout();
          return;
        }
        
        this.onMessage(event);
      };
      
      this.socket.onerror = (event) => {
        const errorMsg = event.type || 'WebSocket error';
        this.log('error', `WebSocket error: ${errorMsg}`);
        this.onError(event);
      };
    } catch (error) {
      this.log('error', `Failed to create WebSocket: ${error.message}`);
      this.scheduleReconnect();
    }
  }
  
  disconnect() {
    if (this.socket) {
      this.socket.close(1000, 'Client requested disconnect');
      this.socket = null;
      this.connected = false;
      this.stopHeartbeat();
    }
  }
  
  send(message, retryCount = 0) {
    if (!this.connected || this.isSleeping) {
      this.log('warning', 'Not connected, queuing message');
      this.pendingMessages.push({ message, retryCount, timestamp: Date.now() });
      return;
    }
    
    try {
      const data = typeof message === 'string' ? message : JSON.stringify(message);
      this.socket.send(data);
      this.log('debug', `Sent message: ${data.substring(0, 100)}${data.length > 100 ? '...' : ''}`);
    } catch (error) {
      this.log('error', `Failed to send message: ${error.message}`);
      
      if (retryCount < this.maxRetries) {
        setTimeout(() => this.send(message, retryCount + 1), this.getRetryDelay(retryCount));
      } else {
        this.pendingMessages.push({ message, retryCount, timestamp: Date.now() });
      }
    }
  }
  
  sendPendingMessages() {
    if (!this.connected) return;
    
    const now = Date.now();
    this.pendingMessages = this.pendingMessages.filter(item => {
      if (now - item.timestamp > 30 * 60 * 1000) {
        this.log('warning', 'Discarding stale pending message');
        return false;
      }
      
      this.send(item.message, item.retryCount);
      return false;
    });
  }
  
  scheduleReconnect() {
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );
    
    setTimeout(() => {
      if (!this.connected && !this.isSleeping) {
        this.reconnectAttempts++;
        this.onReconnect(this.reconnectAttempts, delay);
        this.connect();
      }
    }, delay);
  }
  
  getRetryDelay(retryCount) {
    return this.reconnectDelay * Math.pow(2, retryCount);
  }
  
  startHeartbeat() {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.connected && !this.isSleeping) {
        this.send('ping');
        this.startHeartbeatTimeout();
      }
    }, this.heartbeatInterval);
  }
  
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.stopHeartbeatTimeout();
  }
  
  startHeartbeatTimeout() {
    this.stopHeartbeatTimeout();
    
    this.heartbeatTimeoutTimer = setTimeout(() => {
      this.log('warning', 'Heartbeat timeout detected');
      if (this.socket) {
        this.socket.close(1000, 'Heartbeat timeout');
      }
    }, this.heartbeatTimeout);
  }
  
  stopHeartbeatTimeout() {
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }
  
  resetHeartbeatTimeout() {
    this.stopHeartbeatTimeout();
  }
  
  setupSleepDetection() {
    chrome.idle.onStateChanged.addListener((state) => {
      if (state === 'idle' || state === 'locked') {
        this.onSleep();
      } else if (state === 'active') {
        this.onWake();
      }
    });
    
    chrome.idle.setDetectionInterval(60);
  }
  
  onSleep() {
    this.log('info', 'System entering sleep state');
    this.isSleeping = true;
    this.sleepStartTime = Date.now();
    this.stopHeartbeat();
    
    if (this.connected) {
      this.send({
        type: 'sleep',
        timestamp: this.sleepStartTime
      });
    }
  }
  
  onWake() {
    const sleepDuration = Date.now() - this.sleepStartTime;
    this.log('info', `System waking up after ${this.formatDuration(sleepDuration)}`);
    
    this.isSleeping = false;
    this.sleepStartTime = null;
    
    if (!this.connected) {
      this.connect();
    } else {
      this.startHeartbeat();
    }
    
    this.send({
      type: 'wake',
      timestamp: Date.now(),
      sleepDuration
    });
  }
  
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }
  
  log(level, message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[WebSocketClient] [${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    switch (level) {
      case 'error':
        console.error(logMessage);
        break;
      case 'warning':
        console.warn(logMessage);
        break;
      case 'success':
        console.log(`%c${logMessage}`, 'color: green');
        break;
      default:
        console.log(logMessage);
    }
  }
}

class TabTracker {
  constructor(config = {}) {
    this.updateInterval = config.updateInterval || 1000;
    this.reportInterval = config.reportInterval || 60000;
    
    this.tabs = new Map();
    this.currentTabId = null;
    this.startTime = null;
    this.timer = null;
    this.reportTimer = null;
    
    // 新增：每小时数据（24小时数组）
    this.hourlyData = new Array(24).fill(0);
    // 新增：会话记录
    this.sessions = [];
    // 新增：上次报告的数据（用于增量计算）
    this.lastReportedData = {
      domains: new Map(),
      hourlyData: new Array(24).fill(0),
      totalDuration: 0,
      visitCount: 0
    };
    
    this.onReport = config.onReport || (() => {});
    this.onUpdate = config.onUpdate || (() => {});
    
    this.loadFromStorage();
  }
  
  setupListeners() {
    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.handleTabChange(activeInfo.tabId);
    });
    
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete') {
        this.updateTabInfo(tabId, tab);
      }
    });
    
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.removeTab(tabId);
    });
    
    chrome.windows.onFocusChanged.addListener((windowId) => {
      if (windowId === chrome.windows.WINDOW_ID_NONE) {
        this.pauseTracking();
      } else {
        this.resumeTracking();
      }
    });
  }
  
  start() {
    this.startTime = Date.now();
    this.timer = setInterval(() => this.updateDurations(), this.updateInterval);
    this.reportTimer = setInterval(() => this.generateReport(), this.reportInterval);
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        this.handleTabChange(tabs[0].id);
      }
    });
    
    // 启动时立即发送初始化报告
    setTimeout(() => {
      this.generateReport(true);
    }, 1000);
    
    this.log('info', 'TabTracker started');
  }
  
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
      this.reportTimer = null;
    }
    
    this.generateReport();
    this.saveToStorage();
    
    this.log('info', 'TabTracker stopped');
  }
  
  pauseTracking() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.log('info', 'Tracking paused');
  }
  
  resumeTracking() {
    if (!this.timer) {
      this.timer = setInterval(() => this.updateDurations(), this.updateInterval);
    }
    this.log('info', 'Tracking resumed');
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        this.handleTabChange(tabs[0].id);
      }
    });
  }
  
  handleTabChange(tabId) {
    // 记录上一个标签页的结束会话
    if (this.currentTabId && this.tabs.has(this.currentTabId)) {
      const prevTab = this.tabs.get(this.currentTabId);
      prevTab.active = false;
      
      // 记录会话
      if (prevTab.startTime && prevTab.duration > 0) {
        this.recordSession(prevTab);
      }
    }
    
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        this.log('error', `Failed to get tab info: ${chrome.runtime.lastError.message}`);
        return;
      }
      
      this.currentTabId = tabId;
      this.updateTabInfo(tabId, tab);
      
      const tabData = this.tabs.get(tabId);
      if (tabData) {
        tabData.startTime = Date.now();
        tabData.active = true;
      }
      
      this.log('info', `Switched to tab: ${tabData?.domain || 'unknown'}`);
    });
  }
  
  recordSession(tab) {
    if (!tab.domain || tab.duration < 1000) return; // 忽略小于1秒的会话
    
    const session = {
      startTimeStamp: tab.startTime,
      endTimeStamp: tab.startTime + tab.duration,
      durationMs: tab.duration,
      domain: tab.domain,
      title: tab.title,
      url: tab.url
    };
    
    this.sessions.push(session);
    
    // 限制会话数量
    if (this.sessions.length > 100) {
      this.sessions = this.sessions.slice(-100);
    }
    
    this.log('debug', `Recorded session: ${tab.domain}, ${this.formatDuration(tab.duration)}`);
  }
  
  updateTabInfo(tabId, tab) {
    if (!tab.url || this.isExcludedUrl(tab.url)) {
      return;
    }
    
    const domain = this.extractDomain(tab.url);
    
    if (!this.tabs.has(tabId)) {
      this.tabs.set(tabId, {
        url: tab.url,
        domain,
        title: tab.title || domain,
        startTime: Date.now(),
        duration: 0,
        active: false,
        visits: 1
      });
    } else {
      const existing = this.tabs.get(tabId);
      existing.url = tab.url;
      existing.domain = domain;
      existing.title = tab.title || domain;
    }
  }
  
  removeTab(tabId) {
    const tab = this.tabs.get(tabId);
    if (tab) {
      if (tab.active && tab.startTime) {
        tab.duration += Date.now() - tab.startTime;
      }
      
      this.tabs.delete(tabId);
      
      if (this.currentTabId === tabId) {
        this.currentTabId = null;
      }
      
      this.log('info', `Tab closed: ${tab.domain}, total duration: ${this.formatDuration(tab.duration)}`);
    }
  }
  
  updateDurations() {
    if (!this.currentTabId) return;
    
    const currentTab = this.tabs.get(this.currentTabId);
    if (currentTab && currentTab.active && currentTab.startTime) {
      const now = Date.now();
      currentTab.duration += now - currentTab.startTime;
      currentTab.startTime = now;
      
      this.onUpdate(this.getSummary());
    }
  }
  
  generateReport(isInitial = false) {
    const report = this.getReport();
    
    if (report.totalDuration > 0) {
      report.isInitial = isInitial;  // 添加初始化标记
      this.onReport(report);
      this.saveToStorage();
      this.log('info', `Generated report: ${report.totalDomains} domains, initial: ${isInitial}`);
    }
  }
  
  getReport() {
    const now = Date.now();
    const currentHour = new Date().getHours();
    
    // 更新当前标签页的时长
    if (this.currentTabId) {
      const currentTab = this.tabs.get(this.currentTabId);
      if (currentTab && currentTab.active && currentTab.startTime) {
        currentTab.duration += now - currentTab.startTime;
        currentTab.startTime = now;
        
        // 更新当前小时的使用数据
        this.hourlyData[currentHour] += currentTab.duration;
      }
    }
    
    // 累加所有标签页的时长到对应的小时
    this.tabs.forEach((tab) => {
      if (tab.duration > 0 && tab.startTime) {
        const hour = new Date(tab.startTime).getHours();
        this.hourlyData[hour] += tab.duration;
      }
    });
    
    const domainStats = new Map();
    
    this.tabs.forEach((tab) => {
      if (!domainStats.has(tab.domain)) {
        domainStats.set(tab.domain, {
          domain: tab.domain,
          name: tab.title,  // 新增：name字段
          title: tab.title,
          totalDuration: 0,
          visitCount: 0,
          lastVisit: now,
          hourlyData: new Array(24).fill(0),  // 新增：每个域名的hourlyData
          sessions: []  // 新增：每个域名的会话
        });
      }
      
      const stats = domainStats.get(tab.domain);
      stats.totalDuration += tab.duration;
      stats.visitCount += tab.visits;
      stats.lastVisit = now;
      
      // 分配时长到对应的小时
      if (tab.startTime) {
        const hour = new Date(tab.startTime).getHours();
        stats.hourlyData[hour] += tab.duration;
      }
      
      // 添加会话
      if (tab.duration > 0 && tab.startTime) {
        stats.sessions.push({
          startTimeStamp: tab.startTime,
          endTimeStamp: tab.startTime + tab.duration,
          durationMs: tab.duration,
          url: tab.url
        });
      }
    });
    
    const sortedStats = Array.from(domainStats.values())
      .sort((a, b) => b.totalDuration - a.totalDuration);
    
    // 计算增量数据（用于去重）
    const incrementalDomains = sortedStats.map(s => {
      const lastReported = this.lastReportedData.domains.get(s.domain) || { totalDuration: 0, visitCount: 0, hourlyData: new Array(24).fill(0) };
      return {
        ...s,
        totalDuration: s.totalDuration,
        visitCount: s.visitCount,
        durationDelta: Math.max(0, s.totalDuration - lastReported.totalDuration),
        visitDelta: Math.max(0, s.visitCount - lastReported.visitCount),
        totalDurationFormatted: this.formatDuration(s.totalDuration),
        reportTimestamp: now,
        // 确保hourlyData是24小时数组
        hourlyData: s.hourlyData.map((val, idx) => {
          const delta = Math.max(0, (val || 0) - (lastReported.hourlyData[idx] || 0));
          return delta;
        })
      };
    });
    
    // 更新上次报告数据
    sortedStats.forEach(s => {
      this.lastReportedData.domains.set(s.domain, {
        totalDuration: s.totalDuration,
        visitCount: s.visitCount,
        hourlyData: [...s.hourlyData]
      });
    });
    this.lastReportedData.hourlyData = [...this.hourlyData];
    this.lastReportedData.totalDuration = sortedStats.reduce((sum, s) => sum + s.totalDuration, 0);
    this.lastReportedData.visitCount = sortedStats.reduce((sum, s) => sum + s.visitCount, 0);
    
    return {
      reportId: `report-${Date.now()}`,
      generatedAt: now,
      totalDomains: sortedStats.length,
      totalDuration: sortedStats.reduce((sum, s) => sum + s.totalDuration, 0),
      domains: incrementalDomains,
      trackingStartTime: this.startTime,
      reportTimestamp: now,
      // 新增：全局hourlyData
      hourlyData: [...this.hourlyData],
      // 新增：会话记录
      sessions: [...this.sessions]
    };
  }
  
  getSummary() {
    const now = Date.now();
    
    if (this.currentTabId) {
      const currentTab = this.tabs.get(this.currentTabId);
      if (currentTab) {
        let currentDuration = currentTab.duration;
        if (currentTab.active && currentTab.startTime) {
          currentDuration += now - currentTab.startTime;
        }
        
        return {
          currentDomain: currentTab.domain,
          currentDuration: currentDuration,
          currentDurationFormatted: this.formatDuration(currentDuration),
          totalTabs: this.tabs.size,
          activeTabId: this.currentTabId
        };
      }
    }
    
    return null;
  }
  
  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      let domain = urlObj.hostname;
      
      if (domain.startsWith('www.')) {
        domain = domain.substring(4);
      }
      
      return domain;
    } catch (error) {
      return url;
    }
  }
  
  isExcludedUrl(url) {
    const excludedPatterns = [
      'chrome://',
      'edge://',
      'about:',
      'data:',
      'file:',
      'extension:',
      'moz-extension:'
    ];
    
    return excludedPatterns.some(pattern => url.startsWith(pattern));
  }
  
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    }
    if (minutes > 0) {
      return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
    }
    return `${seconds}s`;
  }
  
  saveToStorage() {
    try {
      const data = {
        tabs: Array.from(this.tabs.entries()).map(([id, tab]) => ({
          id,
          ...tab
        })),
        currentTabId: this.currentTabId,
        startTime: this.startTime,
        hourlyData: [...this.hourlyData],
        sessions: [...this.sessions],
        lastReportedData: {
          domains: Array.from(this.lastReportedData.domains.entries()).map(([domain, stats]) => ({
            domain,
            ...stats
          })),
          hourlyData: [...this.lastReportedData.hourlyData],
          totalDuration: this.lastReportedData.totalDuration,
          visitCount: this.lastReportedData.visitCount
        }
      };
      
      chrome.storage.local.set({ tabTrackerData: data });
      this.log('debug', 'Saved data to storage');
    } catch (error) {
      this.log('error', `Failed to save to storage: ${error.message}`);
    }
  }
  
  loadFromStorage() {
    chrome.storage.local.get('tabTrackerData', (result) => {
      if (result.tabTrackerData) {
        const data = result.tabTrackerData;
        
        data.tabs.forEach((tab) => {
          this.tabs.set(tab.id, {
            url: tab.url,
            domain: tab.domain,
            title: tab.title,
            startTime: tab.startTime,
            duration: tab.duration,
            active: false,
            visits: tab.visits || 1
          });
        });
        
        this.currentTabId = data.currentTabId;
        this.startTime = data.startTime || Date.now();
        
        // 恢复hourlyData
        if (data.hourlyData && Array.isArray(data.hourlyData)) {
          this.hourlyData = data.hourlyData.slice(0, 24).map(v => v || 0);
        }
        
        // 恢复sessions
        if (data.sessions && Array.isArray(data.sessions)) {
          this.sessions = [...data.sessions];
        }
        
        // 恢复lastReportedData
        if (data.lastReportedData) {
          const reported = data.lastReportedData;
          if (reported.domains && Array.isArray(reported.domains)) {
            reported.domains.forEach(item => {
              this.lastReportedData.domains.set(item.domain, {
                totalDuration: item.totalDuration || 0,
                visitCount: item.visitCount || 0,
                hourlyData: item.hourlyData || new Array(24).fill(0)
              });
            });
          }
          if (reported.hourlyData && Array.isArray(reported.hourlyData)) {
            this.lastReportedData.hourlyData = reported.hourlyData.slice(0, 24).map(v => v || 0);
          }
          this.lastReportedData.totalDuration = reported.totalDuration || 0;
          this.lastReportedData.visitCount = reported.visitCount || 0;
        }
        
        this.log('info', 'Loaded data from storage');
      }
    });
  }
  
  log(level, message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[TabTracker] [${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    switch (level) {
      case 'error':
        console.error(logMessage);
        break;
      case 'warning':
        console.warn(logMessage);
        break;
      default:
        console.log(logMessage);
    }
  }
}

// 消息监听器（移到 initialize 外面，确保 service worker 重启后仍能响应）
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!isInitialized) {
    initialize();
  }
  
  if (request.type === 'get_status') {
    const response = {
      connected: webSocketClient ? webSocketClient.connected : false,
      summary: tabTracker ? tabTracker.getSummary() : null
    };
    sendResponse(response);
  }
});

function initialize() {
  if (isInitialized) return;
  isInitialized = true;
  
  console.log('[FlowWall] Initializing WebSocket client...');
  
  webSocketClient = new WebSocketClient({
    url: CONFIG.websocketUrl,
    reconnectDelay: CONFIG.reconnectDelay,
    maxReconnectDelay: CONFIG.maxReconnectDelay,
    heartbeatInterval: CONFIG.heartbeatInterval,
    
    onOpen: () => {
      console.log('[FlowWall] Connected to FlowWall server');
    },
    
    onClose: () => {
      console.log('[FlowWall] Disconnected from FlowWall server');
    },
    
    onMessage: (event) => {
      console.log('[FlowWall] Received message:', event.data);
      
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'sleep') {
          console.log('[FlowWall] Received sleep command - pausing tracking');
          tabTracker.pauseTracking();
          webSocketClient.isSleeping = true;
        } else if (data.type === 'wake') {
          console.log('[FlowWall] Received wake command - resuming tracking');
          webSocketClient.isSleeping = false;
          tabTracker.resumeTracking();
        }
      } catch (error) {
        console.error('[FlowWall] Error parsing message:', error);
      }
    },
    
    onError: (error) => {
      console.error('[FlowWall] WebSocket error:', error);
    },
    
    onReconnect: (attempts, delay) => {
      console.log(`[FlowWall] Reconnect attempt ${attempts} in ${delay}ms`);
    }
  });
  
  tabTracker = new TabTracker({
    updateInterval: CONFIG.updateInterval,
    reportInterval: CONFIG.reportInterval,
    
    onReport: (report) => {
      console.log('[FlowWall] Sending report:', report);
      webSocketClient.send({
        type: 'website_data',
        data: report,
        timestamp: Date.now()
      });
    },
    
    onUpdate: (summary) => {
      console.log('[FlowWall] Update:', summary);
    }
  });
  
  tabTracker.setupListeners();
  tabTracker.start();
  webSocketClient.connect();
  
  console.log('[FlowWall] WebSocket client initialized');
}



chrome.runtime.onStartup.addListener(() => {
  console.log('[FlowWall] Extension started on browser startup');
  initialize();
});

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[FlowWall] Extension installed/updated:', details.reason);
  initialize();
});

initialize();