const { ipcMain } = require('electron');
const os = require('os');
const fs = require('fs');
const path = require('path');

// 仅在 Windows 系统下工作
const isWindows = os.platform() === 'win32';

class AppUsageTracker {
    constructor() {
        this.isRunning = false;
        this.updateInterval = 500; // 500毫秒，提高精度
        this.saveInterval = 5000;  // 5秒
        this.trackSystemApps = false;
        this.updateCallbacks = new Set();
        this.windowCallbacks = new Set();
        this.usageData = new Map(); // appName -> { totalDuration, sessionCount, category, lastUsed, hourlyData, sessions }
        this.sessionHistory = [];
        this.currentApp = null;
        this.startTime = null;
        this.lastHwnd = null;
        this.lastProcessId = 0;
        this.saveTimer = null;
        this.trackingTimer = null;
        this.storagePath = path.join(os.homedir(), 'AppData', 'Local', 'FlowWall', 'app_usage');
        this.categories = this.getDefaultCategories();
        this.appToCategory = new Map();
        this.hourlyData = new Map(); // 每小时使用数据
        this.systemProcesses = [
            'registry.exe', 'smss.exe', 'csrss.exe', 'wininit.exe', 'services.exe',
            'lsass.exe', 'svchost.exe', 'fontdrvhost.exe', 'dwm.exe', 'system'
        ];
        this.initialize();
    }

    initialize() {
        // 创建存储目录
        if (!fs.existsSync(this.storagePath)) {
            fs.mkdirSync(this.storagePath, { recursive: true });
        }
        // 加载分类映射
        this.buildCategoryIndex();
        // 加载今日数据
        this.loadTodayData();
    }

    getDefaultCategories() {
        return {
            '开发工具': { color: '#60A5FA', patterns: ['code.exe', 'cursor.exe', 'devenv.exe', 'webstorm.exe', 'pycharm.exe'] },
            '浏览器': { color: '#FBBF24', patterns: ['chrome.exe', 'msedge.exe', 'firefox.exe', 'opera.exe', 'brave.exe'] },
            '通讯工具': { color: '#34D399', patterns: ['wechat.exe', 'dingtalk.exe', 'slack.exe', 'discord.exe', 'telegram.exe'] },
            '娱乐': { color: '#F87171', patterns: ['cloudmusic.exe', 'qqmusic.exe', 'spotify.exe', 'steam.exe'] },
            '办公': { color: '#A78BFA', patterns: ['winword.exe', 'excel.exe', 'powerpnt.exe', 'wps.exe', 'notion.exe'] },
            '系统工具': { color: '#9CA3AF', patterns: ['explorer.exe', 'taskmgr.exe', 'cmd.exe', 'powershell.exe'] }
        };
    }

    buildCategoryIndex() {
        this.appToCategory.clear();
        for (const [category, config] of Object.entries(this.categories)) {
            for (const pattern of config.patterns) {
                this.appToCategory.set(pattern.toLowerCase(), category);
            }
        }
    }

    start() {
        if (this.isRunning) return true;
        if (!isWindows) return false;

        this.isRunning = true;
        
        // 启动追踪定时器
        this.trackingTimer = setInterval(() => this.trackActiveWindow(), this.updateInterval);
        
        // 启动保存定时器
        this.saveTimer = setInterval(() => this.saveData(), this.saveInterval);
        
        console.log('[AppUsageTracker] Started tracking');
        return true;
    }

    stop() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        
        if (this.trackingTimer) {
            clearInterval(this.trackingTimer);
            this.trackingTimer = null;
        }
        
        if (this.saveTimer) {
            clearInterval(this.saveTimer);
            this.saveTimer = null;
        }
        
        // 保存最后的数据
        this.saveCurrentSession();
        this.saveData();
        
        console.log('[AppUsageTracker] Stopped tracking');
    }

    trackActiveWindow() {
        try {
            const { User32 } = require('win32-api');
            
            // 加载需要的API函数
            const user32 = User32.load(['GetForegroundWindow', 'GetWindowTextW', 'GetWindowThreadProcessId']);
            
            // 获取活动窗口
            const hwnd = user32.GetForegroundWindow();
            
            if (hwnd && hwnd !== this.lastHwnd) {
                // 获取窗口标题
                const title = this.getWindowTitle(hwnd, user32);
                
                // 获取进程ID
                const processId = this.getWindowProcessId(hwnd, user32);
                
                if (processId && processId !== this.lastProcessId) {
                    // 保存上一个会话
                    this.saveCurrentSession();
                    
                    // 获取进程名
                    const processName = this.getProcessName(processId);
                    
                    if (processName && this.shouldTrackApp(processName)) {
                        const appName = this.getAppNameFromProcess(processName);
                        const category = this.getCategory(appName);
                        
                        this.currentApp = {
                            appName,
                            processName,
                            windowTitle: title,
                            category,
                            processId,
                            startTime: Date.now()
                        };
                    } else {
                        this.currentApp = null;
                    }
                    
                    this.lastProcessId = processId;
                }
                
                this.lastHwnd = hwnd;
            }
            
            // 通知更新
            this.notifyUpdate();
        } catch (error) {
            console.error('[AppUsageTracker] Error tracking window:', error.message);
        }
    }

    saveCurrentSession() {
        if (!this.currentApp) return;
        
        const endTime = Date.now();
        const duration = endTime - this.currentApp.startTime;
        
        if (duration > 1000) { // 忽略小于1秒的切换
            // 更新使用数据
            const appName = this.currentApp.appName;
            const category = this.currentApp.category;
            
            if (!this.usageData.has(appName)) {
                this.usageData.set(appName, {
                    totalDuration: 0,
                    sessionCount: 0,
                    category,
                    lastUsed: this.formatTime(),
                    hourlyData: new Array(24).fill(0), // 24小时使用数据
                    sessions: [] // 会话记录
                });
            }
            
            const data = this.usageData.get(appName);
            data.totalDuration += duration;
            data.sessionCount += 1;
            data.lastUsed = this.formatTime();
            data.category = category;
            
            // 更新每小时使用数据
            const startTimeHour = new Date(this.currentApp.startTime).getHours();
            const endTimeHour = new Date(endTime).getHours();
            
            if (startTimeHour === endTimeHour) {
                // 同小时内的会话
                data.hourlyData[startTimeHour] += duration;
            } else {
                // 跨小时的会话，需要拆分
                const startOfNextHour = new Date(this.currentApp.startTime);
                startOfNextHour.setHours(startTimeHour + 1, 0, 0, 0);
                const firstPartDuration = startOfNextHour.getTime() - this.currentApp.startTime;
                const secondPartDuration = endTime - startOfNextHour.getTime();
                
                data.hourlyData[startTimeHour] += firstPartDuration;
                data.hourlyData[endTimeHour] += secondPartDuration;
            }
            
            // 添加会话记录（以小时为单位）
            const startHour = new Date(this.currentApp.startTime).getHours();
            const endHour = new Date(endTime).getHours();
            data.sessions.push({
                startHour: startHour,
                endHour: endHour,
                timeRange: `${startHour}:00 - ${endHour + 1}:00`, // 显示为小时区间
                startTime: new Date(this.currentApp.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                endTime: new Date(endTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                duration: this.formatDuration(duration),
                percentage: Math.min(Math.round((duration / 3600000) * 100), 100) // 以小时为单位的百分比
            });
            
            // 限制会话记录数量，只保留最近的100条
            if (data.sessions.length > 100) {
                data.sessions = data.sessions.slice(-100);
            }
            
            // 添加到历史记录
            this.sessionHistory.push({
                ...this.currentApp,
                endTime,
                duration
            });
            
            // 触发窗口变化回调
            this.windowCallbacks.forEach(callback => {
                try {
                    callback({
                        ...this.currentApp,
                        endTime,
                        duration
                    });
                } catch (error) {
                    console.error('Callback error:', error);
                }
            });
        }
        
        this.currentApp = null;
    }

    saveData() {
        if (this.usageData.size === 0) return;
        
        const date = this.getTodayDate();
        const filePath = path.join(this.storagePath, `${date}.json`);
        
        const data = {
            date,
            lastUpdated: Date.now(),
            records: Array.from(this.usageData.entries()).map(([appName, stats]) => ({
                appName,
                category: stats.category,
                totalDuration: stats.totalDuration,
                sessionCount: stats.sessionCount,
                lastUsed: stats.lastUsed,
                hourlyData: stats.hourlyData || new Array(24).fill(0),
                sessions: stats.sessions || []
            }))
        };
        
        try {
            // 先使用缩进格式生成JSON
            let jsonString = JSON.stringify(data, null, 2);
            
            // 替换hourlyData数组为单行格式
            jsonString = jsonString.replace(/"hourlyData":\s*\[([\s\d,]+)\]/g, (match, arrayContent) => {
                const compactArray = arrayContent.replace(/\s+/g, '').replace(/,$/, '');
                return `"hourlyData": [${compactArray}]`;
            });
            
            fs.writeFileSync(filePath, jsonString);
            console.log(`[AppUsageTracker] Saved data to ${filePath}`);
        } catch (error) {
            console.error('[AppUsageTracker] Error saving data:', error.message);
        }
    }

    loadTodayData() {
        const date = this.getTodayDate();
        const filePath = path.join(this.storagePath, `${date}.json`);
        
        if (fs.existsSync(filePath)) {
            try {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                if (data.records) {
                    data.records.forEach(record => {
                        // 确保hourlyData是有效的24小时数组
                        let hourlyData = record.hourlyData;
                        if (!Array.isArray(hourlyData) || hourlyData.length !== 24) {
                            hourlyData = new Array(24).fill(0);
                        }
                        
                        // 确保sessions是有效的数组
                        let sessions = record.sessions;
                        if (!Array.isArray(sessions)) {
                            sessions = [];
                        }
                        
                        this.usageData.set(record.appName, {
                            totalDuration: record.totalDuration || 0,
                            sessionCount: record.sessionCount || 0,
                            category: record.category || '未分类',
                            lastUsed: record.lastUsed || this.formatTime(),
                            hourlyData,
                            sessions
                        });
                    });
                }
            } catch (error) {
                console.error('[AppUsageTracker] Error loading data:', error.message);
                // 错误时创建空数据结构
                this.usageData.clear();
            }
        } else {
            console.log('[AppUsageTracker] No data file found, starting fresh');
        }
    }

    getWindowTitle(hwnd, User32) {
        try {
            const title = Buffer.alloc(256);
            User32.GetWindowTextW(hwnd, title, 256);
            return title.toString('utf16le').replace(/\0/g, '');
        } catch (error) {
            return '';
        }
    }

    getWindowProcessId(hwnd, User32) {
        try {
            const processId = Buffer.alloc(4);
            User32.GetWindowThreadProcessId(hwnd, processId);
            return processId.readUInt32LE(0);
        } catch (error) {
            return 0;
        }
    }

    getProcessName(processId) {
        try {
            // 确保 processId 是数字
            if (typeof processId !== 'number' || processId === 0) {
                return '';
            }
            
            // 使用更可靠的方法获取进程名称
            const { execSync } = require('child_process');
            
            // 使用 tasklist 命令获取进程信息
            const output = execSync(`tasklist /FI "PID eq ${processId}" /FO CSV`, { encoding: 'utf8' });
            
            // 解析 CSV 输出
            const lines = output.trim().split('\n');
            if (lines.length > 1) {
                const fields = lines[1].split(',');
                if (fields.length > 0) {
                    // 提取进程名称（去掉引号）
                    return fields[0].replace(/"/g, '');
                }
            }
        } catch (error) {
            console.error('Error getting process name:', error.message);
        }
        return '';
    }

    getAppNameFromProcess(processName) {
        if (!processName) return 'Unknown';
        
        // 移除.exe后缀
        let appName = processName;
        const pos = appName.lastIndexOf('.exe');
        if (pos !== -1) {
            appName = appName.substring(0, pos);
        }
        
        // 首字母大写
        return appName.charAt(0).toUpperCase() + appName.slice(1);
    }

    shouldTrackApp(processName) {
        if (!processName) return false;
        
        const lowerName = processName.toLowerCase();
        
        // 检查系统进程
        if (!this.trackSystemApps) {
            for (const sys of this.systemProcesses) {
                if (lowerName === sys) {
                    return false;
                }
            }
        }
        
        return true;
    }

    getCategory(appName) {
        const lowerName = appName.toLowerCase();
        
        // 精确匹配
        if (this.appToCategory.has(lowerName)) {
            return this.appToCategory.get(lowerName);
        }
        
        // 模糊匹配
        for (const [pattern, category] of this.appToCategory.entries()) {
            if (lowerName.includes(pattern) || pattern.includes(lowerName)) {
                return category;
            }
        }
        
        return '未分类';
    }

    setCategory(appName, category) {
        this.appToCategory.set(appName.toLowerCase(), category);
        
        // 更新使用数据中的分类
        if (this.usageData.has(appName)) {
            this.usageData.get(appName).category = category;
        }
    }

    getTodayStatistics() {
        return Array.from(this.usageData.entries())
            .map(([appName, data]) => ({
                appName,
                category: data.category,
                totalDuration: data.totalDuration,
                sessionCount: data.sessionCount,
                lastUsed: data.lastUsed,
                hourlyData: data.hourlyData || new Array(24).fill(0),
                sessions: data.sessions || []
            }))
            .sort((a, b) => b.totalDuration - a.totalDuration);
    }

    getCategorySummary() {
        const summary = {};
        
        for (const [appName, data] of this.usageData.entries()) {
            const category = data.category;
            if (!summary[category]) {
                summary[category] = 0;
            }
            summary[category] += data.totalDuration;
        }
        
        return summary;
    }

    notifyUpdate() {
        const stats = this.getTodayStatistics();
        this.updateCallbacks.forEach(callback => {
            try {
                callback(stats);
            } catch (error) {
                console.error('Update callback error:', error);
            }
        });
    }

    onUpdate(callback) {
        this.updateCallbacks.add(callback);
        return () => this.updateCallbacks.delete(callback);
    }

    onWindowChange(callback) {
        this.windowCallbacks.add(callback);
        return () => this.windowCallbacks.delete(callback);
    }

    getTodayDate() {
        const now = new Date();
        return now.toISOString().split('T')[0];
    }

    formatTime() {
        const now = new Date();
        return now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    
    formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        return `${minutes}分钟`;
    }
    
    formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        return `${minutes}分钟`;
    }

    setupIPC() {
        ipcMain.handle('app-usage:get-today', () => this.getTodayStatistics());
        ipcMain.handle('app-usage:get-categories', () => this.getCategorySummary());
        ipcMain.on('app-usage:set-category', (event, appName, category) => this.setCategory(appName, category));
        ipcMain.handle('app-usage:get-category', (event, appName) => this.getCategory(appName));
        ipcMain.on('app-usage:start', () => this.start());
        ipcMain.on('app-usage:stop', () => this.stop());
        ipcMain.handle('app-usage:is-running', () => this.isRunning);
        ipcMain.on('app-usage:set-config', (event, config) => {
            if (config.updateInterval) this.updateInterval = config.updateInterval;
            if (config.saveInterval) this.saveInterval = config.saveInterval;
            if (config.trackSystemApps !== undefined) this.trackSystemApps = config.trackSystemApps;
        });
    }
}

// 单例实例
let instance = null;

function getAppUsageTracker() {
    if (!instance) {
        instance = new AppUsageTracker();
    }
    return instance;
}

module.exports = {
    AppUsageTracker,
    getAppUsageTracker
};
