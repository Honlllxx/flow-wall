import { useState, useEffect, useCallback, useRef } from 'react';

export const useAppUsage = () => {
  const [todayStats, setTodayStats] = useState([]);
  const [categorySummary, setCategorySummary] = useState({});
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const unsubscribeRef = useRef(null);

  // 检查追踪器是否运行
  const checkRunningStatus = useCallback(async () => {
    try {
      if (window.api?.appUsage?.isRunning) {
        const running = await window.api.appUsage.isRunning();
        setIsRunning(running);
        return running;
      }
      return false;
    } catch (err) {
      console.error('Failed to check running status:', err);
      return false;
    }
  }, []);

  // 加载今日统计
  const loadTodayStats = useCallback(async () => {
    try {
      if (window.api?.appUsage?.getToday) {
        const stats = await window.api.appUsage.getToday();
        setTodayStats(stats || []);
        return stats;
      }
      return [];
    } catch (err) {
      console.error('Failed to load today stats:', err);
      setError(err.message);
      return [];
    }
  }, []);

  // 加载分类汇总
  const loadCategorySummary = useCallback(async () => {
    try {
      if (window.api?.appUsage?.getCategories) {
        const summary = await window.api.appUsage.getCategories();
        setCategorySummary(summary || {});
        return summary;
      }
      return {};
    } catch (err) {
      console.error('Failed to load category summary:', err);
      return {};
    }
  }, []);

  // 刷新所有数据
  const refreshData = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      loadTodayStats(),
      loadCategorySummary(),
      checkRunningStatus()
    ]);
    setLoading(false);
  }, [loadTodayStats, loadCategorySummary, checkRunningStatus]);

  // 开始追踪
  const startTracking = useCallback(() => {
    try {
      if (window.api?.appUsage?.start) {
        window.api.appUsage.start();
        setIsRunning(true);
      }
    } catch (err) {
      console.error('Failed to start tracking:', err);
      setError(err.message);
    }
  }, []);

  // 停止追踪
  const stopTracking = useCallback(() => {
    try {
      if (window.api?.appUsage?.stop) {
        window.api.appUsage.stop();
        setIsRunning(false);
      }
    } catch (err) {
      console.error('Failed to stop tracking:', err);
      setError(err.message);
    }
  }, []);

  // 切换追踪状态
  const toggleTracking = useCallback(() => {
    if (isRunning) {
      stopTracking();
    } else {
      startTracking();
    }
  }, [isRunning, startTracking, stopTracking]);

  // 设置应用分类
  const setCategory = useCallback((appName, category) => {
    try {
      if (window.api?.appUsage?.setCategory) {
        window.api.appUsage.setCategory(appName, category);
        // 刷新数据以更新UI
        loadTodayStats();
      }
    } catch (err) {
      console.error('Failed to set category:', err);
    }
  }, [loadTodayStats]);

  // 获取应用分类
  const getCategory = useCallback(async (appName) => {
    try {
      if (window.api?.appUsage?.getCategory) {
        return await window.api.appUsage.getCategory(appName);
      }
      return '未分类';
    } catch (err) {
      console.error('Failed to get category:', err);
      return '未分类';
    }
  }, []);

  // 设置配置
  const setConfig = useCallback((config) => {
    try {
      if (window.api?.appUsage?.setConfig) {
        window.api.appUsage.setConfig(config);
      }
    } catch (err) {
      console.error('Failed to set config:', err);
    }
  }, []);

  // 初始化
  useEffect(() => {
    const init = async () => {
      await refreshData();
      
      // 设置实时更新监听
      if (window.api?.appUsage?.onUpdate) {
        unsubscribeRef.current = window.api.appUsage.onUpdate((newStats) => {
          setTodayStats(newStats || []);
        });
      }
    };
    
    init();
    
    // 清理函数
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [refreshData]);

  // 计算统计数据
  const stats = {
    totalApps: todayStats.length,
    totalTime: todayStats.reduce((sum, app) => sum + (app.totalDuration || 0), 0),
    totalSessions: todayStats.reduce((sum, app) => sum + (app.sessionCount || 0), 0),
    topApp: todayStats[0] || null,
    byCategory: todayStats.reduce((acc, app) => {
      const cat = app.category || '未分类';
      if (!acc[cat]) {
        acc[cat] = {
          totalDuration: 0,
          apps: [],
          color: getCategoryColor(cat)
        };
      }
      acc[cat].totalDuration += app.totalDuration || 0;
      acc[cat].apps.push(app);
      return acc;
    }, {})
  };

  // 格式化时长
  const formatDuration = useCallback((milliseconds) => {
    if (!milliseconds || milliseconds < 0) return '0分钟';
    
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}小时${minutes % 60}分钟`;
    }
    return `${minutes}分钟`;
  }, []);

  return {
    todayStats,
    categorySummary,
    isRunning,
    loading,
    error,
    stats,
    actions: {
      startTracking,
      stopTracking,
      toggleTracking,
      refreshData,
      setCategory,
      getCategory,
      setConfig
    },
    formatDuration
  };
};

// 获取分类颜色
function getCategoryColor(category) {
  const colorMap = {
    '开发工具': '#60A5FA',
    '浏览器': '#FBBF24',
    '通讯工具': '#34D399',
    '娱乐': '#F87171',
    '办公': '#A78BFA',
    '设计': '#EC4899',
    '系统工具': '#9CA3AF',
    '媒体播放': '#8B5CF6',
    '未分类': '#6B7280'
  };
  
  return colorMap[category] || '#6B7280';
}
