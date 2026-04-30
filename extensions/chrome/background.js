// 当前活动标签页信息
let currentTab = null;
let startTime = 0;
let websiteData = {};

// 监听标签页切换
chrome.tabs.onActivated.addListener((activeInfo) => {
  handleTabChange(activeInfo.tabId);
});

// 监听标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    handleTabChange(tabId);
  }
});

// 监听窗口激活
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    saveCurrentSession();
  } else {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        handleTabChange(tabs[0].id);
      }
    });
  }
});

// 处理标签页切换
async function handleTabChange(tabId) {
  saveCurrentSession();

  try {
    const tab = await chrome.tabs.get(tabId);
    
    if (tab && tab.url && !isExcludedUrl(tab.url)) {
      const domain = extractDomain(tab.url);
      
      currentTab = {
        id: tab.id,
        url: tab.url,
        domain: domain,
        title: tab.title,
        faviconUrl: tab.favIconUrl
      };
      startTime = Date.now();
      
      console.log(`[FlowWall] 开始追踪: ${domain}`);
    } else {
      currentTab = null;
      startTime = 0;
    }
  } catch (error) {
    console.error('[FlowWall] 获取标签页信息失败:', error);
    currentTab = null;
    startTime = 0;
  }
}

// 保存当前会话
function saveCurrentSession() {
  if (!currentTab || startTime === 0) return;

  const duration = Date.now() - startTime;
  
  if (duration < 5000) {
    return;
  }

  const domain = currentTab.domain;
  
  if (!websiteData[domain]) {
    websiteData[domain] = {
      name: currentTab.title || domain,
      domain: domain,
      totalDuration: 0,
      visitCount: 0,
      lastVisit: null
    };
  }

  websiteData[domain].totalDuration += duration;
  websiteData[domain].visitCount += 1;
  websiteData[domain].lastVisit = new Date().toISOString();

  console.log(`[FlowWall] 记录: ${domain} - ${Math.round(duration / 1000)}秒`);

  sendToMainApp(websiteData[domain]);

  currentTab = null;
  startTime = 0;
}

// 提取域名
function extractDomain(url) {
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

// 判断是否排除的URL
function isExcludedUrl(url) {
  const excludedPatterns = [
    'chrome://',
    'edge://',
    'about:',
    'data:',
    'file://',
    'extension://'
  ];
  
  return excludedPatterns.some(pattern => url.startsWith(pattern));
}

// 发送数据到主应用
function sendToMainApp(data) {
  try {
    chrome.runtime.sendNativeMessage(
      'com.flowwall.app',
      {
        type: 'website_data',
        data: data,
        timestamp: Date.now()
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.log('[FlowWall] Native Messaging 不可用，使用备用方案');
          fallbackSend(data);
        }
      }
    );
  } catch (error) {
    console.log('[FlowWall] 发送数据失败:', error);
    fallbackSend(data);
  }
}

// 备用发送方案（通过 HTTP 请求）
function fallbackSend(data) {
  try {
    fetch('http://localhost:3000/api/website', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'website_data',
        data: data,
        timestamp: Date.now()
      })
    });
  } catch (error) {
    console.log('[FlowWall] 备用方案也失败:', error);
  }
}

// 定期保存数据
setInterval(() => {
  if (currentTab && startTime > 0) {
    const duration = Date.now() - startTime;
    if (duration > 5 * 60 * 1000) {
      saveCurrentSession();
    }
  }
  
  chrome.storage.local.set({ websiteData: websiteData });
}, 60000);