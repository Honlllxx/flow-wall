# FlowWall

---

**语言切换 / Language Switch:**
- [English](#features)
- [简体中文](#功能特性)

---

A minimalist desktop application for tracking application and website usage time, with visual insights and productivity analytics.

![FlowWall](public/icon.png)

## Features

### Core Functionality

- **Application Usage Tracking** - Automatically tracks time spent on desktop applications
- **Website Browsing Monitoring** - Browser extensions track website browsing time via WebSocket
- **Real-time Statistics** - View current session data with second-level precision
- **Visual Insights** - Charts and graphs showing usage patterns and trends

### Desktop Application

- **Usage Dashboard** - Overview of daily application usage
- **Hourly Distribution** - Track usage patterns by hour of day
- **Session Tracking** - Record individual application sessions
- **Focus Score** - Measure concentration levels based on usage patterns

### Browser Extension

- **Chrome/Edge Extension** - Track browsing in Chromium-based browsers
- **Firefox Extension** - Track browsing in Firefox
- **WebSocket Sync** - Real-time data synchronization with desktop app
- **Offline Support** - Local caching when disconnected

### Technical Highlights

- **Heartbeat Mechanism** - 10-second interval keeps connection alive
- **Auto-Reconnect** - Exponential backoff (1s → 30s max) on disconnect
- **Failed Message Retry** - Up to 5 retries with 30-minute cache window
- **Sleep/Wake Detection** - Pauses tracking during system sleep
- **Data Persistence** - Local storage prevents data loss

## Installation

### Prerequisites

- Node.js 18+
- npm 9+
- Windows 10/11 (current platform support)

### Desktop App Setup

```bash
# Install dependencies
npm install

# Start development mode (React + Electron)
npm run dev

# Build for production
npm run build
```

### Browser Extension Setup

#### Chrome / Edge

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `extensions/chrome` folder

#### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select `extensions/firefox/manifest.json`

## Architecture

```
flow-wall/
├── electron/              # Electron main process
│   ├── main.js           # Main entry point
│   ├── preload.js        # Preload scripts for IPC
│   └── modules/
│       └── appUsageTracker.js  # Application usage tracking
├── extensions/           # Browser extensions
│   ├── chrome/           # Chrome/Edge extension
│   └── firefox/          # Firefox extension
├── src/                   # React frontend
│   ├── components/       # React components
│   │   ├── AppDetailPanel/
│   │   ├── AppListPanel/
│   │   ├── ControlPanel/
│   │   └── WallpaperOverlay/
│   ├── hooks/            # Custom React hooks
│   └── App.jsx          # Main App component
└── public/               # Static assets
```

## Configuration

### WebSocket Connection

The browser extension connects to the desktop app via WebSocket:

```javascript
// Default configuration
{
  url: 'ws://localhost:3000/ws',
  reconnectDelay: 1000,        // Initial reconnect delay (ms)
  maxReconnectDelay: 30000,    // Maximum reconnect delay (ms)
  heartbeatInterval: 10000,   // Heartbeat interval (ms)
  heartbeatTimeout: 5000,     // Heartbeat timeout (ms)
  maxRetries: 5               // Maximum retry attempts
}
```

### Native Messaging

Browser extensions communicate with the desktop app via Native Messaging. Configure `com.flowwall.app.json` with your browser extension ID.

## Usage Guide

### Dashboard View

The main dashboard displays:
- Today's total usage time
- Most used applications
- Usage trends over the past week
- Focus score indicator

### Application Details

Click on any application to view:
- Hourly usage distribution chart
- Session history
- Peak usage times
- Daily/weekly/monthly comparisons

### Browser Extension

1. Click the extension icon to see current browsing status
2. View real-time stats for the active tab
3. Connection status indicator shows sync state

### Data Reports

The system generates reports every 60 seconds containing:
- Domain statistics (browsing time, visit count)
- Session data with timestamps
- Total tracking duration

## API Reference

### Electron IPC Channels

```javascript
// Application usage
appUsage:get-summary      // Get overall usage summary
appUsage:get-apps          // Get all tracked applications
appUsage:get-app-detail    // Get specific app details
appUsage:get-websites       // Get website statistics
appUsage:get-website-detail // Get specific website details

// Native messaging
native:send                // Send message to native app
```

### WebSocket Message Format

```javascript
// Website data report
{
  type: 'website_data',
  data: {
    reportId: 'report-1234567890',
    generatedAt: 1234567890000,
    totalDomains: 5,
    totalDuration: 3600000,
    domains: [
      {
        domain: 'github.com',
        title: 'GitHub',
        totalDuration: 1800000,
        visitCount: 12,
        lastVisit: 1234567890000
      }
    ],
    trackingStartTime: 1234567800000
  },
  timestamp: 1234567890000
}

// Heartbeat
ping / pong

// Sleep/Wake events
{ type: 'sleep', timestamp: 1234567890000 }
{ type: 'wake', timestamp: 1234567890000, sleepDuration: 3600000 }
```

## Development

### Project Structure

- `electron/` - Desktop app main process
- `src/` - React frontend source
- `extensions/` - Browser extension source
- `public/` - Static assets and icons

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development (React + Electron) |
| `npm run dev:react` | Start React dev server only |
| `npm run dev:electron` | Start Electron only |
| `npm run build` | Build production app |

### Adding New Features

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Troubleshooting

### Extension Not Connecting

1. Ensure the desktop app is running
2. Check the WebSocket URL in extension config matches `ws://localhost:3000/ws`
3. Verify firewall allows localhost connections

### Missing Usage Data

1. Check if native messaging host is properly configured
2. Ensure extension has required permissions
3. Review browser console for error logs

### Build Failures

1. Delete `node_modules` and reinstall dependencies
2. Run `npm run install:native` for native modules
3. Check Electron version compatibility

## License

This project is licensed under the MIT License.

## Acknowledgments

- [Vite](https://vitejs.dev/) - Next generation frontend tooling
- [React](https://react.dev/) - The library for web and native user interfaces
- [Electron](https://electronjs.org/) - Build cross-platform desktop apps
- [Recharts](https://recharts.org/) - Redefined chart library built with React
- [Tailwind CSS](https://tailwindcss.com/) - A utility-first CSS framework

---

## 功能特性

### 核心功能

- **应用使用追踪** - 自动追踪桌面应用的使用时间
- **网站浏览监控** - 浏览器扩展通过WebSocket追踪网站浏览时间
- **实时统计** - 以秒级精度查看当前会话数据
- **可视化洞察** - 图表展示使用模式和趋势

### 桌面应用

- **使用仪表板** - 每日应用使用概览
- **时段分布** - 按小时追踪使用模式
- **会话记录** - 记录单个应用会话
- **专注度评分** - 根据使用模式衡量专注程度

### 浏览器扩展

- **Chrome/Edge 扩展** - 在 Chromium 系浏览器中追踪浏览
- **Firefox 扩展** - 在 Firefox 中追踪浏览
- **WebSocket 同步** - 与桌面应用实时数据同步
- **离线支持** - 断开连接时本地缓存

### 技术亮点

- **心跳机制** - 10秒间隔保持连接活跃
- **自动重连** - 断开时采用指数退避策略（1秒→最大30秒）
- **失败重发** - 最多重试5次，30分钟缓存窗口
- **睡眠/唤醒检测** - 系统休眠时暂停追踪
- **数据持久化** - 本地存储防止数据丢失

## 安装

### 前置要求

- Node.js 18+
- npm 9+
- Windows 10/11（当前平台支持）

### 桌面应用安装

```bash
# 安装依赖
npm install

# 启动开发模式（React + Electron）
npm run dev

# 构建生产版本
npm run build
```

### 浏览器扩展安装

#### Chrome / Edge

1. 打开 `chrome://extensions`
2. 启用"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `extensions/chrome` 文件夹

#### Firefox

1. 打开 `about:debugging#/runtime/this-firefox`
2. 点击"加载临时附加组件"
3. 选择 `extensions/firefox/manifest.json`

## 架构

```
flow-wall/
├── electron/              # Electron 主进程
│   ├── main.js           # 主入口文件
│   ├── preload.js        # IPC 预加载脚本
│   └── modules/
│       └── appUsageTracker.js  # 应用使用追踪模块
├── extensions/           # 浏览器扩展
│   ├── chrome/           # Chrome/Edge 扩展
│   └── firefox/          # Firefox 扩展
├── src/                   # React 前端
│   ├── components/       # React 组件
│   │   ├── AppDetailPanel/
│   │   ├── AppListPanel/
│   │   ├── ControlPanel/
│   │   └── WallpaperOverlay/
│   ├── hooks/            # 自定义 React Hooks
│   └── App.jsx          # 主应用组件
└── public/               # 静态资源
```

## 配置

### WebSocket 连接

浏览器扩展通过 WebSocket 连接到桌面应用：

```javascript
// 默认配置
{
  url: 'ws://localhost:3000/ws',
  reconnectDelay: 1000,        // 初始重连延迟（毫秒）
  maxReconnectDelay: 30000,    // 最大重连延迟（毫秒）
  heartbeatInterval: 10000,   // 心跳间隔（毫秒）
  heartbeatTimeout: 5000,     // 心跳超时（毫秒）
  maxRetries: 5               // 最大重试次数
}
```

### Native Messaging

浏览器扩展通过 Native Messaging 与桌面应用通信。在 `com.flowwall.app.json` 中配置浏览器扩展 ID。

## 使用指南

### 仪表板视图

主仪表板显示：
- 今日总使用时间
- 使用最多的应用
- 过去一周的使用趋势
- 专注度评分指示器

### 应用详情

点击任意应用查看：
- 小时使用分布图
- 会话历史记录
- 峰值使用时间
- 每日/每周/每月对比

### 浏览器扩展

1. 点击扩展图标查看当前浏览状态
2. 查看活动标签页的实时统计
3. 连接状态指示器显示同步状态

### 数据报告

系统每60秒生成报告，包含：
- 域名统计（浏览时间、访问次数）
- 带时间戳的会话数据
- 总追踪时长

## API 参考

### Electron IPC 通道

```javascript
// 应用使用
appUsage:get-summary      // 获取总体使用摘要
appUsage:get-apps          // 获取所有追踪的应用
appUsage:get-app-detail    // 获取特定应用详情
appUsage:get-websites       // 获取网站统计
appUsage:get-website-detail // 获取特定网站详情

// Native messaging
native:send                // 发送消息到原生应用
```

### WebSocket 消息格式

```javascript
// 网站数据报告
{
  type: 'website_data',
  data: {
    reportId: 'report-1234567890',
    generatedAt: 1234567890000,
    totalDomains: 5,
    totalDuration: 3600000,
    domains: [
      {
        domain: 'github.com',
        title: 'GitHub',
        totalDuration: 1800000,
        visitCount: 12,
        lastVisit: 1234567890000
      }
    ],
    trackingStartTime: 1234567800000
  },
  timestamp: 1234567890000
}

// 心跳
ping / pong

// 睡眠/唤醒事件
{ type: 'sleep', timestamp: 1234567890000 }
{ type: 'wake', timestamp: 1234567890000, sleepDuration: 3600000 }
```

## 开发

### 项目结构

- `electron/` - 桌面应用主进程
- `src/` - React 前端源码
- `extensions/` - 浏览器扩展源码
- `public/` - 静态资源和图标

### 脚本

| 命令 | 描述 |
|------|------|
| `npm run dev` | 启动开发模式（React + Electron） |
| `npm run dev:react` | 仅启动 React 开发服务器 |
| `npm run dev:electron` | 仅启动 Electron |
| `npm run build` | 构建生产应用 |

### 贡献新功能

1. Fork 仓库
2. 创建功能分支（`git checkout -b feature/amazing-feature`）
3. 提交更改（`git commit -m 'Add amazing feature'`）
4. 推送到分支（`git push origin feature/amazing-feature`）
5. 打开 Pull Request

## 故障排除

### 扩展无法连接

1. 确保桌面应用正在运行
2. 检查扩展配置中的 WebSocket URL 是否为 `ws://localhost:3000/ws`
3. 验证防火墙允许本地连接

### 使用数据缺失

1. 检查 Native Messaging 主机配置是否正确
2. 确保扩展具有所需权限
3. 查看浏览器控制台的错误日志

### 构建失败

1. 删除 `node_modules` 并重新安装依赖
2. 运行 `npm run install:native` 安装原生模块
3. 检查 Electron 版本兼容性

## 许可证

本项目采用 MIT 许可证。

## 致谢

- [Vite](https://vitejs.dev/) - 下一代前端构建工具
- [React](https://react.dev/) - Web 和原生用户界面库
- [Electron](https://electronjs.org/) - 构建跨平台桌面应用
- [Recharts](https://recharts.org/) - React 图表库
- [Tailwind CSS](https://tailwindcss.com/) - 实用优先的 CSS 框架