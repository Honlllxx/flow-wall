let currentTab = null;
let startTime = 0;
let websiteData = {};

browser.tabs.onActivated.addListener((activeInfo) => {
  handleTabChange(activeInfo.tabId);
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    handleTabChange(tabId);
  }
});

browser.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === browser.windows.WINDOW_ID_NONE) {
    saveCurrentSession();
  } else {
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0]) {
        handleTabChange(tabs[0].id);
      }
    });
  }
});

async function handleTabChange(tabId) {
  saveCurrentSession();

  try {
    const tab = await browser.tabs.get(tabId);
    
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

function isExcludedUrl(url) {
  const excludedPatterns = [
    'about:',
    'data:',
    'file:',
    'moz-extension:'
  ];
  
  return excludedPatterns.some(pattern => url.startsWith(pattern));
}

function sendToMainApp(data) {
  try {
    browser.runtime.sendNativeMessage(
      'com.flowwall.app',
      {
        type: 'website_data',
        data: data,
        timestamp: Date.now()
      }
    ).catch(() => {
      console.log('[FlowWall] Native Messaging 不可用，使用备用方案');
      fallbackSend(data);
    });
  } catch (error) {
    console.log('[FlowWall] 发送数据失败:', error);
    fallbackSend(data);
  }
}

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

setInterval(() => {
  if (currentTab && startTime > 0) {
    const duration = Date.now() - startTime;
    if (duration > 5 * 60 * 1000) {
      saveCurrentSession();
    }
  }
  
  browser.storage.local.set({ websiteData: websiteData });
}, 60000);