Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll", SetLastError=true)]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

  [DllImport("user32.dll", CharSet=CharSet.Auto, SetLastError=true)]
  public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);
}
"@

$hwnd = [Win32]::GetForegroundWindow()
Write-Host "hwnd: $hwnd"
if ($hwnd -eq [IntPtr]::Zero) {
  Write-Output "{}"
  exit
}

# 获取进程ID
$processId = 0
[Win32]::GetWindowThreadProcessId($hwnd, [ref]$processId)
Write-Host "processId: $processId"

# 获取窗口标题
$titleBuilder = New-Object System.Text.StringBuilder(256)
$titleLength = [Win32]::GetWindowText($hwnd, $titleBuilder, $titleBuilder.Capacity)
$windowTitle = if ($titleLength -gt 0) { $titleBuilder.ToString() } else { "" }
Write-Host "windowTitle: $windowTitle"

# 获取进程名
try {
  $process = Get-Process -Id $processId -ErrorAction Stop
  $processName = $process.ProcessName
} catch {
  $processName = ""
}
Write-Host "processName: $processName"

$result = @{
  processId = $processId
  processName = $processName
  windowTitle = $windowTitle
  timestamp = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fff")
}

ConvertTo-Json $result -Compress