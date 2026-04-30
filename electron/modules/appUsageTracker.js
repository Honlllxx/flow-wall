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
            
            // 更新每小时使用数据（支持跨越任意小时数）
            const startDate = new Date(this.currentApp.startTime);
            const endDate = new Date(endTime);
            const startTimeHour = startDate.getHours();
            const endTimeHour = endDate.getHours();
            
            if (startTimeHour === endTimeHour) {
                // 同小时内的会话
                data.hourlyData[startTimeHour] += duration;
            } else {
                // 跨小时的会话，需要拆分到每个小时
                let currentTime = this.currentApp.startTime;
                let currentHour = startTimeHour;
                
                while (currentHour <= endTimeHour && currentTime < endTime) {
                    // 获取当前小时结束时间
                    const hourEnd = new Date(currentTime);
                    hourEnd.setHours(currentHour + 1, 0, 0, 0);
                    
                    // 计算当前小时内的使用时间
                    const segmentEnd = Math.min(hourEnd.getTime(), endTime);
                    const segmentDuration = segmentEnd - currentTime;
                    
                    // 累加到对应小时
                    data.hourlyData[currentHour] += segmentDuration;
                    
                    // 移动到下一小时
                    currentTime = segmentEnd;
                    currentHour++;
                }
            }
            
            // 添加会话记录（以小时为单位，包含详细时间信息）
            const startHour = startDate.getHours();
            const endHour = endDate.getHours();
            data.sessions.push({
                // 精确时间戳（毫秒）
                startTimeStamp: this.currentApp.startTime,
                endTimeStamp: endTime,
                // 小时信息
                startHour: startHour,
                endHour: endHour,
                // 时间区间显示
                timeRange: this.formatTimeRange(startHour, endHour),
                // 格式化时间显示
                startTime: startDate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                endTime: endDate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                // 持续时间
                duration: this.formatDuration(duration),
                durationMs: duration, // 保留原始毫秒值
                // 使用百分比（基于小时）
                percentage: Math.min(Math.round((duration / 3600000) * 100), 100),
                // 窗口标题
                windowTitle: this.currentApp.windowTitle
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
            
            console.log(`[AppUsageTracker] Session saved: ${appName}, duration: ${this.formatDuration(duration)}`);
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
                        
                        // 确保sessions是有效的数组，并修复durationMs字段
                        let sessions = record.sessions;
                        if (!Array.isArray(sessions)) {
                            sessions = [];
                        } else {
                            // 确保每个会话都有durationMs字段
                            sessions = sessions.map(session => {
                                if (session && session.durationMs === undefined && session.duration) {
                                    session.durationMs = this.parseDuration(session.duration);
                                }
                                return session;
                            });
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
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            const remainingMinutes = minutes % 60;
            return remainingMinutes > 0 ? `${hours}小时${remainingMinutes}分钟` : `${hours}小时`;
        }
        return `${minutes}分钟`;
    }
    
    formatTimeRange(startHour, endHour) {
        if (startHour === endHour) {
            return `${startHour}:00 - ${startHour + 1}:00`;
        }
        return `${startHour}:00 - ${endHour + 1}:00`;
    }

    // 分析方法：获取峰值使用时段
    getPeakUsagePeriod() {
        const todayData = this.getTodayStatistics();
        
        // 汇总所有应用的每小时数据
        const totalHourlyData = new Array(24).fill(0);
        let totalDuration = 0;
        
        todayData.forEach(app => {
            if (app.hourlyData && app.hourlyData.length === 24) {
                app.hourlyData.forEach((duration, hour) => {
                    totalHourlyData[hour] += duration;
                    totalDuration += duration;
                });
            }
        });
        
        // 找到峰值时段
        let peakHour = 0;
        let peakDuration = 0;
        
        totalHourlyData.forEach((duration, hour) => {
            if (duration > peakDuration) {
                peakDuration = duration;
                peakHour = hour;
            }
        });
        
        // 计算各时段占比
        const hourlyPercentages = totalHourlyData.map(duration => 
            totalDuration > 0 ? Math.round((duration / totalDuration) * 100) : 0
        );
        
        // 数据验证：检查是否有数据
        const hasValidData = totalDuration > 0;
        
        return {
            peakHour,
            peakHourFormatted: `${peakHour.toString().padStart(2, '0')}:00 - ${(peakHour + 1).toString().padStart(2, '0')}:00`,
            peakDuration: peakDuration,
            peakDurationFormatted: this.formatDuration(peakDuration),
            peakPercentage: totalDuration > 0 ? Math.round((peakDuration / totalDuration) * 100) : 0,
            hourlyData: totalHourlyData,
            hourlyPercentages,
            totalDuration,
            totalDurationFormatted: this.formatDuration(totalDuration),
            date: this.getTodayDate(),
            analysisTime: Date.now(),
            hasValidData, // 数据验证标志
            debugInfo: {
                appCount: todayData.length,
                hourlyDataSamples: totalHourlyData.filter(d => d > 0).length,
                rawData: hasValidData ? null : totalHourlyData // 无数据时返回原始数据供调试
            }
        };
    }
    
    // 分析方法：获取最长会话
    // appName: 可选参数，指定应用名称时只查找该应用的最长会话
    getLongestSession(appName = null) {
        const todayData = this.getTodayStatistics();
        let longestSession = null;
        let maxDuration = 0;
        
        // 如果指定了应用名称，只查找该应用的会话
        const filteredApps = appName 
            ? todayData.filter(app => app.appName === appName)
            : todayData;
        
        filteredApps.forEach(app => {
            if (app.sessions && Array.isArray(app.sessions)) {
                app.sessions.forEach(session => {
                    // 使用更健壮的方式获取会话时长
                    const duration = session.durationMs !== undefined 
                        ? session.durationMs 
                        : (session.duration ? this.parseDuration(session.duration) : 0);
                    
                    // 排除无效数据（时长必须大于0）
                    if (duration > maxDuration && duration > 0) {
                        maxDuration = duration;
                        longestSession = {
                            appName: app.appName,
                            category: app.category,
                            ...session,
                            durationMs: duration
                        };
                    }
                });
            }
        });
        
        if (!longestSession) {
            return {
                found: false,
                message: '暂无会话数据'
            };
        }
        
        return {
            found: true,
            appName: longestSession.appName,
            category: longestSession.category,
            startTime: longestSession.startTime,
            endTime: longestSession.endTime,
            startTimeStamp: longestSession.startTimeStamp,
            endTimeStamp: longestSession.endTimeStamp,
            durationMs: longestSession.durationMs,
            durationFormatted: this.formatDuration(longestSession.durationMs),
            date: this.getTodayDate(),
            analysisTime: Date.now()
        };
    }
    
    // 辅助方法：解析时长字符串
    parseDuration(durationStr) {
        if (!durationStr) return 0;
        
        const hoursMatch = durationStr.match(/(\d+)小时/);
        const minutesMatch = durationStr.match(/(\d+)分钟/);
        
        let hours = 0;
        let minutes = 0;
        
        if (hoursMatch) {
            hours = parseInt(hoursMatch[1], 10);
        }
        if (minutesMatch) {
            minutes = parseInt(minutesMatch[1], 10);
        }
        
        return (hours * 60 + minutes) * 60 * 1000; // 转换为毫秒
    }
    
    // 分析方法：获取历史趋势数据
    getHistoricalTrend(days = 7) {
        const trendData = [];
        const today = new Date();
        
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const filePath = path.join(this.storagePath, `${dateStr}.json`);
            
            let dayData = {
                date: dateStr,
                totalDuration: 0,
                sessionCount: 0,
                appCount: 0,
                peakHour: -1,
                hasData: false
            };
            
            if (fs.existsSync(filePath)) {
                try {
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    if (data.records) {
                        dayData.hasData = true;
                        let maxHourly = 0;
                        let peakHour = 0;
                        
                        data.records.forEach(record => {
                            dayData.totalDuration += record.totalDuration || 0;
                            dayData.sessionCount += record.sessionCount || 0;
                            dayData.appCount++;
                            
                            // 找到当天的峰值小时
                            if (record.hourlyData && record.hourlyData.length === 24) {
                                record.hourlyData.forEach((duration, hour) => {
                                    if (duration > maxHourly) {
                                        maxHourly = duration;
                                        peakHour = hour;
                                    }
                                });
                            }
                        });
                        
                        dayData.peakHour = peakHour;
                    }
                } catch (error) {
                    console.error(`[AppUsageTracker] Error reading historical data for ${dateStr}:`, error.message);
                }
            }
            
            trendData.push({
                ...dayData,
                totalDurationFormatted: this.formatDuration(dayData.totalDuration),
                peakHourFormatted: dayData.peakHour >= 0 ? `${dayData.peakHour}:00` : 'N/A'
            });
        }
        
        return {
            trendData,
            days,
            analysisTime: Date.now()
        };
    }
    
    // 数据验证方法：验证峰值计算的准确性
    validatePeakCalculation() {
        const todayData = this.getTodayStatistics();
        const validation = {
            isValid: true,
            issues: [],
            totalApps: todayData.length,
            totalSessions: 0,
            hourlyDistribution: new Array(24).fill(0)
        };
        
        todayData.forEach(app => {
            validation.totalSessions += app.sessionCount || 0;
            
            if (app.hourlyData && app.hourlyData.length === 24) {
                app.hourlyData.forEach((duration, hour) => {
                    validation.hourlyDistribution[hour] += duration;
                });
            }
        });
        
        // 检查是否有数据
        if (validation.totalSessions === 0) {
            validation.isValid = false;
            validation.issues.push('没有会话记录');
        }
        
        // 检查小时数据是否有异常值
        const sum = validation.hourlyDistribution.reduce((a, b) => a + b, 0);
        if (sum === 0) {
            validation.isValid = false;
            validation.issues.push('小时数据全为0，可能数据未正确记录');
        }
        
        return validation;
    }
    
    setupIPC() {
        ipcMain.handle('app-usage:get-today', () => this.getTodayStatistics());
        ipcMain.handle('app-usage:get-categories', () => this.getCategorySummary());
        ipcMain.on('app-usage:set-category', (event, appName, category) => this.setCategory(appName, category));
        ipcMain.handle('app-usage:get-category', (event, appName) => this.getCategory(appName));
        ipcMain.on('app-usage:start', () => this.start());
        ipcMain.on('app-usage:stop', () => this.stop());
        // 数据分析API
        ipcMain.handle('app-usage:get-peak-period', () => this.getPeakUsagePeriod());
        ipcMain.handle('app-usage:get-longest-session', (event, appName = null) => this.getLongestSession(appName));
        ipcMain.handle('app-usage:get-historical-trend', (event, days) => this.getHistoricalTrend(days));
        ipcMain.handle('app-usage:is-running', () => this.isRunning);
        ipcMain.on('app-usage:set-config', (event, config) => {
            if (config.updateInterval) this.updateInterval = config.updateInterval;
            if (config.saveInterval) this.saveInterval = config.saveInterval;
            if (config.trackSystemApps !== undefined) this.trackSystemApps = config.trackSystemApps;
        });
        ipcMain.handle('app-usage:get-validation', () => this.validatePeakCalculation());
        ipcMain.handle('app-usage:analyze-peak-periods', (event, days) => this.analyzePeakUsagePeriods(days));
        ipcMain.handle('app-usage:export-report', (event, days) => this.exportAnalysisReport(days));
    }
    
    /**
     * 分析历史数据中的峰值使用时段
     * @param {number} days - 分析的天数
     * @returns {Object} - 包含统计验证和置信区间的分析结果
     */
    analyzePeakUsagePeriods(days = 14) {
        const historicalData = this.getHistoricalData(days);
        if (!historicalData || historicalData.length === 0) {
            return this.getEmptyAnalysisResult();
        }
        
        // 汇总所有天的每小时数据
        const hourlyAggregates = this.aggregateHourlyData(historicalData);
        
        // 计算统计指标
        const statistics = this.calculateStatistics(hourlyAggregates);
        
        // 识别峰值时段（可能是连续的多个小时）
        const peakPeriods = this.identifyPeakPeriods(hourlyAggregates, statistics);
        
        // 计算置信区间
        const confidenceIntervals = this.calculateConfidenceIntervals(hourlyAggregates, statistics);
        
        // 分析相关性（工作日/周末差异）
        const correlationAnalysis = this.analyzeCorrelations(historicalData, hourlyAggregates);
        
        // 趋势分析
        const trendAnalysis = this.analyzeTrends(historicalData);
        
        return {
            summary: {
                analyzedDays: days,
                validDays: historicalData.filter(d => d.hasData).length,
                totalUsageMinutes: Math.round(statistics.overallTotal / 60000),
                analysisTime: Date.now()
            },
            hourlyAggregates,
            statistics,
            peakPeriods,
            confidenceIntervals,
            correlationAnalysis,
            trendAnalysis,
            rawData: historicalData.slice(0, 5) // 示例原始数据
        };
    }
    
    /**
     * 获取历史数据
     */
    getHistoricalData(days = 14) {
        const data = [];
        const today = new Date();
        
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const filePath = path.join(this.storagePath, `${dateStr}.json`);
            
            let dayData = {
                date: dateStr,
                dayOfWeek: date.getDay(),
                isWeekend: date.getDay() === 0 || date.getDay() === 6,
                hourlyData: new Array(24).fill(0),
                totalDuration: 0,
                sessionCount: 0,
                appCount: 0,
                hasData: false
            };
            
            if (fs.existsSync(filePath)) {
                try {
                    const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    if (fileData.records) {
                        dayData.hasData = true;
                        fileData.records.forEach(record => {
                            dayData.totalDuration += record.totalDuration || 0;
                            dayData.sessionCount += record.sessionCount || 0;
                            dayData.appCount++;
                            
                            if (record.hourlyData && record.hourlyData.length === 24) {
                                record.hourlyData.forEach((duration, hour) => {
                                    dayData.hourlyData[hour] += duration;
                                });
                            }
                        });
                    }
                } catch (error) {
                    console.error(`[AppUsageTracker] Error reading ${dateStr}:`, error.message);
                }
            }
            
            data.push(dayData);
        }
        
        return data;
    }
    
    /**
     * 聚合每小时数据
     */
    aggregateHourlyData(historicalData) {
        const validDays = historicalData.filter(d => d.hasData);
        const hourlyData = new Array(24).fill(0);
        const hourlySamples = new Array(24).fill(0);
        
        validDays.forEach(day => {
            day.hourlyData.forEach((duration, hour) => {
                hourlyData[hour] += duration;
                if (duration > 0) hourlySamples[hour]++;
            });
        });
        
        // 计算均值和样本数
        return {
            total: hourlyData,
            mean: hourlyData.map((total, hour) => 
                hourlySamples[hour] > 0 ? total / hourlySamples[hour] : 0
            ),
            sampleCount: hourlySamples,
            dayCount: validDays.length
        };
    }
    
    /**
     * 计算统计指标
     */
    calculateStatistics(hourlyAggregates) {
        const { mean } = hourlyAggregates;
        const validMeans = mean.filter(m => m > 0);
        
        if (validMeans.length === 0) {
            return {
                mean: 0,
                median: 0,
                stdDev: 0,
                variance: 0,
                min: 0,
                max: 0,
                overallTotal: 0,
                peakHour: -1,
                troughHour: -1
            };
        }
        
        const sortedMeans = [...validMeans].sort((a, b) => a - b);
        const n = sortedMeans.length;
        
        // 计算均值
        const overallMean = sortedMeans.reduce((sum, val) => sum + val, 0) / n;
        
        // 计算中位数
        const median = n % 2 === 0 
            ? (sortedMeans[n/2 - 1] + sortedMeans[n/2]) / 2 
            : sortedMeans[Math.floor(n/2)];
        
        // 计算方差和标准差
        const variance = sortedMeans.reduce((sum, val) => sum + Math.pow(val - overallMean, 2), 0) / (n - 1);
        const stdDev = Math.sqrt(variance);
        
        // 找到峰值和谷值小时
        let peakHour = 0, troughHour = 0;
        let maxMean = mean[0], minMean = mean[0];
        
        mean.forEach((m, hour) => {
            if (m > maxMean) { maxMean = m; peakHour = hour; }
            if (m < minMean && m > 0) { minMean = m; troughHour = hour; }
        });
        
        // 计算总体使用时长
        const overallTotal = hourlyAggregates.total.reduce((sum, val) => sum + val, 0);
        
        return {
            mean: overallMean,
            median,
            stdDev,
            variance,
            min: sortedMeans[0],
            max: sortedMeans[sortedMeans.length - 1],
            overallTotal,
            peakHour,
            troughHour,
            coefficientOfVariation: overallMean > 0 ? stdDev / overallMean : 0
        };
    }
    
    /**
     * 识别峰值时段（连续的高峰小时）
     */
    identifyPeakPeriods(hourlyAggregates, statistics) {
        const { mean } = hourlyAggregates;
        const { mean: overallMean, stdDev } = statistics;
        
        // 定义峰值阈值：高于均值 + 标准差
        const peakThreshold = overallMean + stdDev;
        
        // 找到所有高于阈值的小时
        const peakHours = mean
            .map((m, hour) => ({ hour, value: m, isPeak: m >= peakThreshold && m > 0 }))
            .filter(h => h.isPeak);
        
        // 将连续的峰值小时分组
        const peakPeriods = [];
        if (peakHours.length > 0) {
            let currentPeriod = {
                startHour: peakHours[0].hour,
                endHour: peakHours[0].hour,
                totalValue: peakHours[0].value,
                hours: [peakHours[0]]
            };
            
            for (let i = 1; i < peakHours.length; i++) {
                if (peakHours[i].hour === currentPeriod.endHour + 1) {
                    currentPeriod.endHour = peakHours[i].hour;
                    currentPeriod.totalValue += peakHours[i].value;
                    currentPeriod.hours.push(peakHours[i]);
                } else {
                    peakPeriods.push(currentPeriod);
                    currentPeriod = {
                        startHour: peakHours[i].hour,
                        endHour: peakHours[i].hour,
                        totalValue: peakHours[i].value,
                        hours: [peakHours[i]]
                    };
                }
            }
            peakPeriods.push(currentPeriod);
        }
        
        // 按总价值排序
        peakPeriods.sort((a, b) => b.totalValue - a.totalValue);
        
        // 格式化输出
        return peakPeriods.map(period => ({
            startHour: period.startHour,
            endHour: period.endHour,
            durationHours: period.endHour - period.startHour + 1,
            startHourFormatted: `${period.startHour.toString().padStart(2, '0')}:00`,
            endHourFormatted: `${(period.endHour + 1).toString().padStart(2, '0')}:00`,
            timeRange: `${period.startHour.toString().padStart(2, '0')}:00 - ${(period.endHour + 1).toString().padStart(2, '0')}:00`,
            averageValue: Math.round(period.totalValue / period.hours.length),
            averageFormatted: this.formatDuration(Math.round(period.totalValue / period.hours.length)),
            totalValue: Math.round(period.totalValue),
            totalFormatted: this.formatDuration(Math.round(period.totalValue)),
            percentageOfTotal: statistics.overallTotal > 0 
                ? Math.round((period.totalValue / statistics.overallTotal) * 100) 
                : 0
        }));
    }
    
    /**
     * 计算置信区间
     */
    calculateConfidenceIntervals(hourlyAggregates, statistics) {
        const { mean, sampleCount } = hourlyAggregates;
        const { stdDev } = statistics;
        const confidenceLevel = 0.95;
        const zScore = 1.96; // 95% 置信度对应的Z值
        
        return mean.map((m, hour) => {
            const n = sampleCount[hour];
            if (n < 2 || stdDev === 0) {
                return {
                    hour,
                    mean: Math.round(m),
                    lowerBound: 0,
                    upperBound: Math.round(m * 2),
                    marginOfError: 0,
                    confidenceLevel: 0,
                    reliable: false
                };
            }
            
            const standardError = stdDev / Math.sqrt(n);
            const marginOfError = zScore * standardError;
            
            return {
                hour,
                hourFormatted: `${hour.toString().padStart(2, '0')}:00`,
                mean: Math.round(m),
                meanFormatted: this.formatDuration(Math.round(m)),
                lowerBound: Math.max(0, Math.round(m - marginOfError)),
                upperBound: Math.round(m + marginOfError),
                marginOfError: Math.round(marginOfError),
                confidenceLevel,
                reliable: n >= 3 // 至少3个样本才认为可靠
            };
        });
    }
    
    /**
     * 分析相关性（工作日/周末差异等）
     */
    analyzeCorrelations(historicalData, hourlyAggregates) {
        // 分离工作日和周末数据
        const weekdays = historicalData.filter(d => d.hasData && !d.isWeekend);
        const weekends = historicalData.filter(d => d.hasData && d.isWeekend);
        
        // 计算工作日和周末的每小时均值
        const calculateMeanProfile = (data) => {
            if (data.length === 0) return new Array(24).fill(0);
            const totals = new Array(24).fill(0);
            data.forEach(day => {
                day.hourlyData.forEach((d, h) => { totals[h] += d; });
            });
            return totals.map(t => t / data.length);
        };
        
        const weekdayProfile = calculateMeanProfile(weekdays);
        const weekendProfile = calculateMeanProfile(weekends);
        
        // 计算差异
        const differences = weekdayProfile.map((w, h) => w - weekendProfile[h]);
        
        // 计算皮尔逊相关系数（工作日和周末模式的相关性）
        const correlation = this.calculateCorrelation(weekdayProfile, weekendProfile);
        
        // 计算平均每日使用时长差异
        const weekdayAvg = weekdays.length > 0 
            ? weekdays.reduce((sum, d) => sum + d.totalDuration, 0) / weekdays.length 
            : 0;
        const weekendAvg = weekends.length > 0 
            ? weekends.reduce((sum, d) => sum + d.totalDuration, 0) / weekends.length 
            : 0;
        
        return {
            weekdayCount: weekdays.length,
            weekendCount: weekends.length,
            weekdayAvgDuration: Math.round(weekdayAvg),
            weekdayAvgFormatted: this.formatDuration(Math.round(weekdayAvg)),
            weekendAvgDuration: Math.round(weekendAvg),
            weekendAvgFormatted: this.formatDuration(Math.round(weekendAvg)),
            durationDifference: Math.round(weekdayAvg - weekendAvg),
            durationDifferenceFormatted: this.formatDuration(Math.round(Math.abs(weekdayAvg - weekendAvg))),
            differencePercentage: weekdayAvg > 0 
                ? Math.round(((weekdayAvg - weekendAvg) / weekdayAvg) * 100) 
                : 0,
            weekdayProfile,
            weekendProfile,
            differences,
            patternCorrelation: correlation,
            patternSimilarity: correlation >= 0.7 ? 'high' : correlation >= 0.4 ? 'medium' : 'low'
        };
    }
    
    /**
     * 计算皮尔逊相关系数
     */
    calculateCorrelation(x, y) {
        const n = x.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
        
        for (let i = 0; i < n; i++) {
            sumX += x[i];
            sumY += y[i];
            sumXY += x[i] * y[i];
            sumX2 += x[i] * x[i];
            sumY2 += y[i] * y[i];
        }
        
        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        
        if (denominator === 0) return 0;
        return numerator / denominator;
    }
    
    /**
     * 趋势分析
     */
    analyzeTrends(historicalData) {
        const validData = historicalData.filter(d => d.hasData);
        if (validData.length < 2) {
            return {
                hasTrend: false,
                trendDirection: 'stable',
                slope: 0,
                rSquared: 0,
                predictions: []
            };
        }
        
        // 简单线性回归
        const n = validData.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        
        validData.forEach((d, i) => {
            sumX += i;
            sumY += d.totalDuration;
            sumXY += i * d.totalDuration;
            sumX2 += i * i;
        });
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        // 计算R平方
        let ssTot = 0, ssRes = 0;
        const meanY = sumY / n;
        validData.forEach((d, i) => {
            const predicted = slope * i + intercept;
            ssTot += Math.pow(d.totalDuration - meanY, 2);
            ssRes += Math.pow(d.totalDuration - predicted, 2);
        });
        
        const rSquared = ssTot > 0 ? 1 - (ssRes / ssTot) : 0;
        
        // 预测未来3天
        const predictions = [];
        for (let i = 0; i < 3; i++) {
            const predictedDay = n + i;
            const predictedValue = Math.max(0, slope * predictedDay + intercept);
            predictions.push({
                dayOffset: predictedDay,
                predictedDuration: Math.round(predictedValue),
                predictedFormatted: this.formatDuration(Math.round(predictedValue))
            });
        }
        
        return {
            hasTrend: Math.abs(slope) > 100, // 阈值：每天变化超过100ms
            trendDirection: slope > 100 ? 'increasing' : slope < -100 ? 'decreasing' : 'stable',
            slope: Math.round(slope),
            intercept: Math.round(intercept),
            rSquared: Math.round(rSquared * 100) / 100,
            confidence: rSquared >= 0.7 ? 'high' : rSquared >= 0.4 ? 'medium' : 'low',
            predictions
        };
    }
    
    /**
     * 获取空分析结果
     */
    getEmptyAnalysisResult() {
        return {
            summary: {
                analyzedDays: 0,
                validDays: 0,
                totalUsageMinutes: 0,
                analysisTime: Date.now()
            },
            hourlyAggregates: {
                total: new Array(24).fill(0),
                mean: new Array(24).fill(0),
                sampleCount: new Array(24).fill(0),
                dayCount: 0
            },
            statistics: {
                mean: 0,
                median: 0,
                stdDev: 0,
                variance: 0,
                min: 0,
                max: 0,
                overallTotal: 0,
                peakHour: -1,
                troughHour: -1,
                coefficientOfVariation: 0
            },
            peakPeriods: [],
            confidenceIntervals: [],
            correlationAnalysis: {},
            trendAnalysis: {},
            rawData: []
        };
    }
    
    /**
     * 导出分析报告
     */
    exportAnalysisReport(days = 14) {
        const analysis = this.analyzePeakUsagePeriods(days);
        
        const report = {
            reportId: `analysis-${Date.now()}`,
            generatedAt: new Date().toISOString(),
            analyzedDays: days,
            summary: analysis.summary,
            keyFindings: this.generateKeyFindings(analysis),
            detailedAnalysis: analysis
        };
        
        return report;
    }
    
    /**
     * 生成关键发现摘要
     */
    generateKeyFindings(analysis) {
        const findings = [];
        
        // 峰值时段发现
        if (analysis.peakPeriods.length > 0) {
            const topPeak = analysis.peakPeriods[0];
            findings.push({
                category: 'peak_period',
                title: '主要峰值时段',
                description: `系统使用高峰出现在 ${topPeak.timeRange}，平均每小时使用时长为 ${topPeak.averageFormatted}`,
                value: topPeak.timeRange,
                confidence: 'high'
            });
        }
        
        // 统计显著性
        if (analysis.statistics.coefficientOfVariation > 0.5) {
            findings.push({
                category: 'variability',
                title: '使用模式波动',
                description: '不同时段的使用时长存在显著差异（变异系数 > 50%）',
                value: `${Math.round(analysis.statistics.coefficientOfVariation * 100)}%`,
                confidence: 'medium'
            });
        }
        
        // 工作日/周末差异
        if (analysis.correlationAnalysis.differencePercentage !== 0) {
            const direction = analysis.correlationAnalysis.differencePercentage > 0 ? '高于' : '低于';
            findings.push({
                category: 'weekday_weekend',
                title: '工作日与周末差异',
                description: `工作日平均使用时长${direction}周末 ${Math.abs(analysis.correlationAnalysis.differencePercentage)}%`,
                value: `${analysis.correlationAnalysis.differencePercentage > 0 ? '+' : ''}${analysis.correlationAnalysis.differencePercentage}%`,
                confidence: analysis.correlationAnalysis.weekdayCount >= 5 && analysis.correlationAnalysis.weekendCount >= 2 ? 'high' : 'medium'
            });
        }
        
        // 趋势发现
        if (analysis.trendAnalysis.hasTrend) {
            const direction = analysis.trendAnalysis.trendDirection;
            findings.push({
                category: 'trend',
                title: '使用趋势',
                description: `近期使用时长呈${direction === 'increasing' ? '上升' : direction === 'decreasing' ? '下降' : '稳定'}趋势`,
                value: direction,
                confidence: analysis.trendAnalysis.confidence
            });
        }
        
        return findings;
    }
}

module.exports = AppUsageTracker;