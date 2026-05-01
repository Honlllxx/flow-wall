# FlowWall

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