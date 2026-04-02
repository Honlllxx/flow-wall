const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class Win32Monitor {
  constructor() {
    this.isMonitoring = false;
    this.monitorInterval = null;
    this.lastWindowInfo = null;
    this.currentWindowStartTime = null;
    this.ignoreApps = ['FlowWall', 'Windows Shell Experience Host', 'Application Frame Host'];
    this.pollingInterval = 3000; // 3秒轮询间隔
    this.onWindowChangeCallback = null;
  }

  /**
   * 使用PowerShell获取活动窗口信息
   * @returns {Promise<Object|null>} 窗口信息对象
   */
  async getActiveWindowInfo() {
    try {
      // PowerShell命令：获取活动窗口的标题和进程名
      const psCommand = `
Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  public class Win32 {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetClassName(IntPtr hWnd, System.Text.StringBuilder lpClassName, int nMaxCount);
  }
"@

$hwnd = [Win32]::GetForegroundWindow()
if ($hwnd -eq [IntPtr]::Zero) {
  Write-Output "{}"
  exit
}

# 获取进程ID
$processId = 0
[Win32]::GetWindowThreadProcessId($hwnd, [ref]$processId)

# 获取窗口标题
$titleBuilder = New-Object System.Text.StringBuilder(256)
$titleLength = [Win32]::GetWindowText($hwnd, $titleBuilder, $titleBuilder.Capacity)
$windowTitle = if ($titleLength -gt 0) { $titleBuilder.ToString() } else { "" }

# 获取窗口类名
$classBuilder = New-Object System.Text.StringBuilder(256)
$classLength = [Win32]::GetClassName($hwnd, $classBuilder, $classBuilder.Capacity)
$className = if ($classLength -gt 0) { $classBuilder.ToString() } else { "" }

# 获取进程信息
$process = Get-Process -Id $processId -ErrorAction SilentlyContinue
$processName = if ($process) { $process.ProcessName } else { "" }
$processPath = if ($process -and $process.Path) { $process.Path } else { "" }
$mainWindowTitle = if ($process -and $process.MainWindowTitle) { $process.MainWindowTitle } else { "" }

# 返回JSON对象
$result = @{
  hwnd = $hwnd.ToInt64()
  processId = $processId
  processName = $processName
  processPath = $processPath
  windowTitle = $windowTitle
  className = $className
  mainWindowTitle = $mainWindowTitle
  timestamp = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fff")
}

ConvertTo-Json $result -Compress
      `;

      const { stdout, stderr } = await execAsync(`powershell -Command "${psCommand.replace(/"/g, '\\"')}"`);

      if (stderr && stderr.trim()) {
        console.error('PowerShell错误:', stderr);
        return null;
      }

      const output = stdout.trim();
      if (!output || output === '{}') {
        return null;
      }

      const windowInfo = JSON.parse(output);

      // 过滤掉不需要追踪的应用
      if (this.ignoreApps.some(app =>
        windowInfo.processName.includes(app) ||
        windowInfo.windowTitle.includes(app)
      )) {
        return null;
      }

      return {
        ...windowInfo,
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('获取活动窗口信息失败:', error);
      return null;
    }
  }

  /**
   * 简化版本：使用tasklist和taskkill命令获取活动窗口（兼容性更好）
   * @returns {Promise<Object|null>} 简化的窗口信息
   */
  async getActiveWindowInfoSimple() {
    try {
      // 使用PowerShell获取活动窗口标题（简化版）
      const psCommand = `
Add-Type @"
  using System;
  using System.Runtime.InteropServices;
  public class Win32 {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);
  }
"@

$hwnd = [Win32]::GetForegroundWindow()
if ($hwnd -eq [IntPtr]::Zero) {
  Write-Output "{}"
  exit
}

# 获取进程ID
$processId = 0
[Win32]::GetWindowThreadProcessId($hwnd, [ref]$processId)

# 获取窗口标题
$titleBuilder = New-Object System.Text.StringBuilder(256)
$titleLength = [Win32]::GetWindowText($hwnd, $titleBuilder, $titleBuilder.Capacity)
$windowTitle = if ($titleLength -gt 0) { $titleBuilder.ToString() } else { "" }

# 获取进程名
try {
  $process = Get-Process -Id $processId -ErrorAction Stop
  $processName = $process.ProcessName
} catch {
  $processName = ""
}

$result = @{
  processId = $processId
  processName = $processName
  windowTitle = $windowTitle
  timestamp = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fff")
}

ConvertTo-Json $result -Compress
      `;

      const { stdout, stderr } = await execAsync(`powershell -Command "${psCommand.replace(/"/g, '\\"')}"`);

      if (stderr && stderr.trim()) {
        console.error('PowerShell简化版错误:', stderr);
        return null;
      }

      const output = stdout.trim();
      if (!output || output === '{}') {
        return null;
      }

      const windowInfo = JSON.parse(output);

      // 过滤掉不需要追踪的应用
      if (this.ignoreApps.some(app =>
        (windowInfo.processName && windowInfo.processName.includes(app)) ||
        (windowInfo.windowTitle && windowInfo.windowTitle.includes(app))
      )) {
        return null;
      }

      return {
        ...windowInfo,
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('获取简化版窗口信息失败:', error);
      return null;
    }
  }

  /**
   * 开始监控活动窗口
   * @param {Function} onWindowChange 窗口变化回调函数
   */
  startMonitoring(onWindowChange) {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.onWindowChangeCallback = onWindowChange;
    this.lastWindowInfo = null;
    this.currentWindowStartTime = Date.now();

    console.log('开始监控活动窗口...');

    this.monitorInterval = setInterval(async () => {
      try {
        // 使用简化版获取窗口信息
        const windowInfo = await this.getActiveWindowInfoSimple();

        if (!windowInfo) {
          return;
        }

        // 检查窗口是否变化
        const isSameWindow = this.lastWindowInfo &&
          this.lastWindowInfo.processId === windowInfo.processId &&
          this.lastWindowInfo.windowTitle === windowInfo.windowTitle;

        if (!isSameWindow) {
          // 记录上一个窗口的使用时间
          if (this.lastWindowInfo && this.currentWindowStartTime) {
            const duration = Date.now() - this.currentWindowStartTime;

            const usageRecord = {
              appName: this.lastWindowInfo.processName || '未知应用',
              windowTitle: this.lastWindowInfo.windowTitle || '',
              startTime: this.currentWindowStartTime,
              endTime: Date.now(),
              duration: duration,
              processId: this.lastWindowInfo.processId,
              timestamp: Date.now()
            };

            if (this.onWindowChangeCallback) {
              this.onWindowChangeCallback(usageRecord, windowInfo);
            }
          }

          // 更新当前窗口信息
          this.lastWindowInfo = windowInfo;
          this.currentWindowStartTime = Date.now();
        }

      } catch (error) {
        console.error('监控活动窗口时出错:', error);
      }
    }, this.pollingInterval);
  }

  /**
   * 停止监控
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    console.log('停止监控活动窗口...');

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }

    // 记录最后一个窗口的使用时间
    if (this.lastWindowInfo && this.currentWindowStartTime) {
      const duration = Date.now() - this.currentWindowStartTime;

      const usageRecord = {
        appName: this.lastWindowInfo.processName || '未知应用',
        windowTitle: this.lastWindowInfo.windowTitle || '',
        startTime: this.currentWindowStartTime,
        endTime: Date.now(),
        duration: duration,
        processId: this.lastWindowInfo.processId,
        timestamp: Date.now()
      };

      if (this.onWindowChangeCallback) {
        this.onWindowChangeCallback(usageRecord, null);
      }
    }

    this.isMonitoring = false;
    this.lastWindowInfo = null;
    this.currentWindowStartTime = null;
    this.onWindowChangeCallback = null;
  }

  /**
   * 更新设置
   * @param {Object} settings 新的设置
   */
  updateSettings(settings) {
    if (settings.pollingInterval && settings.pollingInterval >= 1000) {
      this.pollingInterval = settings.pollingInterval;

      // 如果正在监控，重启监控以应用新的轮询间隔
      if (this.isMonitoring && this.monitorInterval) {
        clearInterval(this.monitorInterval);
        this.monitorInterval = setInterval(async () => {
          // 重新实现监控逻辑（这里需要提取为单独的方法）
          // 简化处理：重启监控
        }, this.pollingInterval);
      }
    }

    if (settings.ignoreApps) {
      this.ignoreApps = settings.ignoreApps;
    }
  }

  /**
   * 获取当前监控状态
   * @returns {Object} 监控状态
   */
  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      pollingInterval: this.pollingInterval,
      currentWindow: this.lastWindowInfo,
      currentWindowStartTime: this.currentWindowStartTime,
      ignoreApps: this.ignoreApps
    };
  }
}

module.exports = Win32Monitor;