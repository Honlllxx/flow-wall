const CONFIG = {
  websocketUrl: 'ws://localhost:3000/ws',
  reconnectDelay: 1000,
  maxReconnectDelay: 30000,
  heartbeatInterval: 10000,
  heartbeatTimeout: 5000,
  maxRetries: 5,
  updateInterval: 1000,
  reportInterval: 60000
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
    if (this.connected) {
      this.log('warning', 'Already connected');
      return;
    }
    
    try {
      this.socket = new WebSocket(this.url);
      
      this.socket.onopen = (event) => {
        this.connected = true;
        this.reconnectAttempts = 0;
        this.log('success', 'Connected to server');
        this.onOpen(event);
        this.startHeartbeat();
        this.sendPendingMessages();
      };
      
      this.socket.onclose = (event) => {
        this.connected = false;
        this.stopHeartbeat();
        this.log('warning', `Connection closed: ${event.code} - ${event.reason}`);
        this.onClose(event);
        
        if (!this.isSleeping) {
          this.scheduleReconnect();
        }
      };
      
      this.socket.onmessage = (event) => {
        this.resetHeartbeatTimeout();
        
        if (event.data === 'pong') {
          this.log('debug', 'Received heartbeat response');
        } else {
          this.log('debug', `Received message: ${event.data.substring(0, 100)}${event.data.length > 100 ? '...' : ''}`);
          this.onMessage(event);
        }
      };
      
      this.socket.onerror = (error) => {
        this.log('error', `WebSocket error: ${error.message}`);
        this.onError(error);
      };
      
    } catch (error) {
      this.log('error', `Failed to connect: ${error.message}`);
      this.scheduleReconnect();
    }
  }
  
  disconnect() {
    if (this.socket) {
      this.socket.close(1000, 'Client initiated disconnect');
      this.socket = null;
    }
  }
  
  send(message, retryCount = 0) {
    if (!this.connected) {
      if (retryCount === 0) {
        this.pendingMessages.push({ message, retryCount: 0, timestamp: Date.now() });
      }
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
        this.socket.close(1011, 'Heartbeat timeout');
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
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.onSleep();
      } else {
        this.onWake();
      }
    });
    
    if ('onfreeze' in document) {
      document.addEventListener('freeze', () => this.onSleep());
      document.addEventListener('resume', () => this.onWake());
    }
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
    
    this.onReport = config.onReport || (() => {});
    this.onUpdate = config.onUpdate || (() => {});
    
    this.loadFromStorage();
  }
  
  setupListeners() {
    browser.tabs.onActivated.addListener((activeInfo) => {
      this.handleTabChange(activeInfo.tabId);
    });
    
    browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete') {
        this.updateTabInfo(tabId, tab);
      }
    });
    
    browser.tabs.onRemoved.addListener((tabId) => {
      this.removeTab(tabId);
    });
    
    browser.windows.onFocusChanged.addListener((windowId) => {
      if (windowId === browser.windows.WINDOW_ID_NONE) {
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
    
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0]) {
        this.handleTabChange(tabs[0].id);
      }
    });
    
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
    
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0]) {
        this.handleTabChange(tabs[0].id);
      }
    });
  }
  
  handleTabChange(tabId) {
    if (this.currentTabId && this.tabs.has(this.currentTabId)) {
      const prevTab = this.tabs.get(this.currentTabId);
      prevTab.active = false;
    }
    
    browser.tabs.get(tabId).then((tab) => {
      this.currentTabId = tabId;
      this.updateTabInfo(tabId, tab);
      
      const tabData = this.tabs.get(tabId);
      if (tabData) {
        tabData.startTime = Date.now();
        tabData.active = true;
      }
      
      this.log('info', `Switched to tab: ${tabData?.domain || 'unknown'}`);
    }).catch((error) => {
      this.log('error', `Failed to get tab info: ${error.message}`);
    });
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
  
  generateReport() {
    const report = this.getReport();
    
    if (report.totalDuration > 0) {
      this.onReport(report);
      this.saveToStorage();
      this.log('info', `Generated report: ${report.totalDomains} domains`);
    }
  }
  
  getReport() {
    const now = Date.now();
    
    if (this.currentTabId) {
      const currentTab = this.tabs.get(this.currentTabId);
      if (currentTab && currentTab.active && currentTab.startTime) {
        currentTab.duration += now - currentTab.startTime;
        currentTab.startTime = now;
      }
    }
    
    const domainStats = new Map();
    
    this.tabs.forEach((tab) => {
      if (!domainStats.has(tab.domain)) {
        domainStats.set(tab.domain, {
          domain: tab.domain,
          title: tab.title,
          totalDuration: 0,
          visitCount: 0,
          lastVisit: null
        });
      }
      
      const stats = domainStats.get(tab.domain);
      stats.totalDuration += tab.duration;
      stats.visitCount += tab.visits;
      stats.lastVisit = now;
    });
    
    const sortedStats = Array.from(domainStats.values())
      .sort((a, b) => b.totalDuration - a.totalDuration);
    
    return {
      reportId: `report-${Date.now()}`,
      generatedAt: now,
      totalDomains: sortedStats.length,
      totalDuration: sortedStats.reduce((sum, s) => sum + s.totalDuration, 0),
      domains: sortedStats.map(s => ({
        ...s,
        totalDurationFormatted: this.formatDuration(s.totalDuration)
      })),
      trackingStartTime: this.startTime
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
      'about:',
      'data:',
      'file:',
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
        startTime: this.startTime
      };
      
      browser.storage.local.set({ tabTrackerData: data });
      this.log('debug', 'Saved data to storage');
    } catch (error) {
      this.log('error', `Failed to save to storage: ${error.message}`);
    }
  }
  
  loadFromStorage() {
    browser.storage.local.get('tabTrackerData').then((result) => {
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

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'get_status') {
    const response = {
      connected: webSocketClient ? webSocketClient.connected : false,
      summary: tabTracker ? tabTracker.getSummary() : null
    };
    sendResponse(response);
  }
});

browser.runtime.onStartup.addListener(() => {
  console.log('[FlowWall] Extension started on browser startup');
  initialize();
});

browser.runtime.onInstalled.addListener((details) => {
  console.log('[FlowWall] Extension installed/updated:', details.reason);
  initialize();
});

initialize();