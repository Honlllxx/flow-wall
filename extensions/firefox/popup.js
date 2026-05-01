document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('status');
  const currentDomainEl = document.getElementById('currentDomain');
  const currentDurationEl = document.getElementById('currentDuration');
  const totalTabsEl = document.getElementById('totalTabs');
  const refreshBtn = document.getElementById('refreshBtn');

  function updateStatus(isConnected) {
    if (isConnected) {
      statusEl.textContent = '已连接';
      statusEl.className = 'status connected';
    } else {
      statusEl.textContent = '未连接';
      statusEl.className = 'status disconnected';
    }
  }

  function updateStats(stats) {
    if (stats) {
      currentDomainEl.textContent = stats.currentDomain || '-';
      currentDurationEl.textContent = stats.currentDurationFormatted || '-';
      totalTabsEl.textContent = stats.totalTabs || '-';
    }
  }

  function refreshData() {
    browser.runtime.sendMessage({ type: 'get_status' }).then((response) => {
      if (response) {
        updateStatus(response.connected);
        updateStats(response.summary);
      }
    }).catch(() => {
      updateStatus(false);
    });
  }

  refreshBtn.addEventListener('click', refreshData);

  refreshData();
});