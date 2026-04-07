import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip
} from 'recharts';
import {
  Clock, Monitor, Filter, Play, Pause, RefreshCw,
  Activity, X, LayoutGrid, Search, ChevronRight,
  MoreHorizontal, TrendingUp, Calendar, Lock
} from 'lucide-react';
import { useWindowInteraction } from '../../hooks/useWindowInteraction';

const COLORS = ['#60A5FA', '#34D399', '#FBBF24', '#F87171', '#A78BFA', '#EC4899', '#9CA3AF', '#8B5CF6'];
const CATEGORIES = ['全部', '开发工具', '浏览器', '通讯工具', '娱乐', '办公', '设计', '系统工具', '媒体播放', '未分类'];

// 应用图标组件
const AppIcon = ({ name, size = 40, isSelected }) => {
  const initial = name.charAt(0).toUpperCase();
  const hue = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;

  return (
    <div
      className={`flex items-center justify-center rounded-xl font-bold text-white shadow-lg transition-transform ${isSelected ? 'scale-110' : ''}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, hsl(${hue}, 70%, 60%), hsl(${hue}, 70%, 40%))`,
        fontSize: size * 0.4
      }}
    >
      {initial}
    </div>
  );
};

// 格式化时长
const formatDuration = (milliseconds) => {
  if (!milliseconds || milliseconds < 0) return '0分钟';
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) {
    return `${hours}小时${minutes % 60}分钟`;
  }
  return `${minutes}分钟`;
};

// 格式化时长（简短）
const formatDurationShort = (milliseconds) => {
  if (!milliseconds || milliseconds < 0) return '0m';
  const minutes = Math.floor(milliseconds / 60000);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  return `${minutes}m`;
};

const AppListPanel = () => {
  const { isLocked, lockMessage, getInteractionStyle } = useWindowInteraction();
  const [isLight, setIsLight] = useState(false);
  const [opacity, setOpacity] = useState(0.6);
  const [todayStats, setTodayStats] = useState([]);
  const [filter, setFilter] = useState('全部');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedApp, setSelectedApp] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'
  const [isOpeningDetail, setIsOpeningDetail] = useState(false); // 添加详情面板打开状态
  const [hasFirstOpenedDetail, setHasFirstOpenedDetail] = useState(false); // 是否首次打开详情面板
  const categoryScrollRef = useRef(null);
  const selectAppTimeoutRef = useRef(null); // 防抖定时器引用

  // 获取配置和数据
  useEffect(() => {
    const loadConfig = async () => {
      try {
        if (window.api?.getDisplayConfig) {
          const config = await window.api.getDisplayConfig();
          setIsLight(config.theme === 'light');
          setOpacity(config.panelOpacity || 0.6);
        }
      } catch (e) {
        console.error('Failed to load config:', e);
      }
    };
    loadConfig();
  }, []);

  // 加载应用使用数据
  useEffect(() => {
    const loadData = async () => {
      try {
        if (window.api?.appUsage?.getToday) {
          const stats = await window.api.appUsage.getToday();
          setTodayStats(stats || []);
        }
        if (window.api?.appUsage?.isRunning) {
          const running = await window.api.appUsage.isRunning();
          setIsRunning(running);
        }
      } catch (e) {
        console.error('Failed to load app usage data:', e);
      } finally {
        setLoading(false);
      }
    };
    loadData();

    if (window.api?.appUsage?.onUpdate) {
      const unsubscribe = window.api.appUsage.onUpdate((newStats) => {
        setTodayStats(newStats || []);
      });
      return unsubscribe;
    }
  }, []);

  // 过滤和搜索应用列表
  const filteredApps = useMemo(() => {
    let apps = todayStats;
    
    // 分类过滤
    if (filter !== '全部') {
      apps = apps.filter(app => app.category === filter);
    }
    
    // 搜索过滤
    if (searchQuery.trim()) {
      apps = apps.filter(app => 
        app.appName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return apps;
  }, [todayStats, filter, searchQuery]);

  // 计算统计数据
  const stats = useMemo(() => ({
    totalApps: todayStats.length,
    totalTime: todayStats.reduce((sum, app) => sum + (app.totalDuration || 0), 0),
    totalSessions: todayStats.reduce((sum, app) => sum + (app.sessionCount || 0), 0),
    byCategory: todayStats.reduce((acc, app) => {
      const cat = app.category || '未分类';
      if (!acc[cat]) {
        acc[cat] = { totalDuration: 0, apps: [], color: COLORS[Object.keys(acc).length % COLORS.length] };
      }
      acc[cat].totalDuration += app.totalDuration || 0;
      acc[cat].apps.push(app);
      return acc;
    }, {})
  }), [todayStats]);

  // 准备图表数据
  const pieData = Object.entries(stats.byCategory).map(([name, data]) => ({
    name,
    value: data.totalDuration,
    color: data.color
  }));

  const barData = todayStats.slice(0, 5).map(app => ({
    name: app.appName.length > 6 ? app.appName.substring(0, 6) + '...' : app.appName,
    fullName: app.appName,
    time: Math.round((app.totalDuration || 0) / 60000),
    color: stats.byCategory[app.category]?.color || COLORS[0]
  }));

  // 选择应用
  const handleSelectApp = (app) => {
    setSelectedApp(app);
    
    // 清除之前的防抖定时器
    if (selectAppTimeoutRef.current) {
      clearTimeout(selectAppTimeoutRef.current);
    }
    
    // 设置防抖延迟（250ms）
    selectAppTimeoutRef.current = setTimeout(() => {
      // 仅在首次打开时显示加载状态
      const isFirstOpen = !hasFirstOpenedDetail;
      if (isFirstOpen) {
        setIsOpeningDetail(true);
        setHasFirstOpenedDetail(true);
      }
      
      if (window.api?.appListSelect) {
        window.api.appListSelect({
          ...app,
          rank: todayStats.findIndex(a => a.appName === app.appName) + 1,
          totalApps: todayStats.length
        });
      }
      
      // 如果是首次打开，设置超时重置加载状态
      if (isFirstOpen) {
        // 设置超时保护，最长750ms后自动隐藏加载状态
        setTimeout(() => {
          setIsOpeningDetail(false);
        }, 750);
        
        // 正常情况下，250ms后隐藏加载状态
        setTimeout(() => {
          setIsOpeningDetail(false);
        }, 250);
      }
    }, 250);
  };

  // 处理分类标签横向滚轮事件
  const handleCategoryWheel = (e) => {
    if (categoryScrollRef.current) {
      e.preventDefault();
      categoryScrollRef.current.scrollLeft += e.deltaY;
    }
  };

  // 关闭窗口
  const handleClose = () => {
    if (window.api?.closeAppList) {
      window.api.closeAppList();
    }
  };

  // 切换追踪状态
  const handleToggleTracking = () => {
    if (window.api?.appUsage) {
      if (isRunning) {
        window.api.appUsage.stop();
      } else {
        window.api.appUsage.start();
      }
      setIsRunning(!isRunning);
    }
  };

  // 刷新数据
  const handleRefresh = async () => {
    setLoading(true);
    try {
      if (window.api?.appUsage?.getToday) {
        const stats = await window.api.appUsage.getToday();
        setTodayStats(stats || []);
      }
    } catch (e) {
      console.error('Failed to refresh:', e);
    } finally {
      setLoading(false);
    }
  };

  // 背景样式
  const bgStyle = {
    backgroundColor: isLight
      ? `rgba(255, 255, 255, ${opacity})`
      : `rgba(17, 24, 39, ${opacity})`
  };

  if (loading) {
    return (
      <div
        className={`h-full flex items-center justify-center backdrop-blur-xl ${isLight ? 'text-gray-900' : 'text-white'}`}
        style={bgStyle}
      >
        <RefreshCw className="animate-spin text-blue-400 mr-2" size={24} />
        <span className={isLight ? 'text-gray-600' : 'text-gray-400'}>加载中...</span>
      </div>
    );
  }

  return (
    <div
      className={`pointer-events-auto h-full w-full backdrop-blur-xl border rounded-2xl p-4 pb-6 flex flex-col relative transition-colors duration-300 ${isLight ? 'border-black/10 text-gray-800' : 'border-white/10 text-white'}`}
      style={{ ...bgStyle, ...getInteractionStyle() }}
    >
      {/* 交互锁定提示 */}
      {isLocked && (
        <div className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/20 rounded-2xl">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-xl ${isLight ? 'bg-white shadow-xl' : 'bg-gray-800 shadow-xl'}`}>
            <Lock size={20} className={isLight ? 'text-blue-600' : 'text-blue-400'} />
            <span className={`text-sm font-medium ${isLight ? 'text-gray-800' : 'text-white'}`}>
              {lockMessage || '正在调整窗口位置，请稍候...'}
            </span>
          </div>
        </div>
      )}
      {/* 面板头部 - 更现代的设计 */}
      <div className={`flex items-center justify-between p-4 border-b ${isLight ? 'border-gray-200' : 'border-white/10'}`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${isLight ? 'bg-blue-100' : 'bg-blue-500/20'}`}>
            <LayoutGrid size={20} className="text-blue-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold">应用使用</h2>
            <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
              {filteredApps.length} 个应用
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleTracking}
            className={`p-2 rounded-lg transition-all ${
              isRunning
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
            }`}
            title={isRunning ? '暂停追踪' : '开始追踪'}
          >
            {isRunning ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button
            onClick={handleRefresh}
            className={`p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-gray-200' : 'hover:bg-white/10'}`}
            title="刷新数据"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={handleClose}
            className={`p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-gray-200' : 'hover:bg-white/10'}`}
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* 统计概览卡片 */}
      <div className="grid grid-cols-3 gap-2 p-3">
        <div className={`p-3 rounded-xl ${isLight ? 'bg-blue-50' : 'bg-blue-500/10'}`}>
          <div className="flex items-center gap-1 mb-1">
            <Monitor size={12} className="text-blue-500" />
            <span className={`text-xs ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>应用</span>
          </div>
          <div className="text-lg font-bold">{stats.totalApps}</div>
        </div>
        <div className={`p-3 rounded-xl ${isLight ? 'bg-green-50' : 'bg-green-500/10'}`}>
          <div className="flex items-center gap-1 mb-1">
            <Clock size={12} className="text-green-500" />
            <span className={`text-xs ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>时长</span>
          </div>
          <div className="text-lg font-bold">{formatDurationShort(stats.totalTime)}</div>
        </div>
        <div className={`p-3 rounded-xl ${isLight ? 'bg-purple-50' : 'bg-purple-500/10'}`}>
          <div className="flex items-center gap-1 mb-1">
            <Activity size={12} className="text-purple-500" />
            <span className={`text-xs ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>会话</span>
          </div>
          <div className="text-lg font-bold">{stats.totalSessions}</div>
        </div>
      </div>

      {/* 图表区域 - 可折叠 */}
      <div className="px-3 pb-3">
        <div className={`rounded-xl p-3 ${isLight ? 'bg-gray-50' : 'bg-white/5'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-medium ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>使用分布</span>
            <TrendingUp size={14} className={isLight ? 'text-gray-400' : 'text-gray-500'} />
          </div>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={barData}>
                <XAxis dataKey="name" hide />
                <Tooltip
                  formatter={(value, name, props) => [`${value} 分钟`, props.payload.fullName]}
                  contentStyle={{
                    backgroundColor: isLight ? '#fff' : '#1F2937',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '11px'
                  }}
                />
                <Bar dataKey="time" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className={`flex items-center justify-center h-20 text-xs ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
              暂无数据
            </div>
          )}
        </div>
      </div>

      {/* 搜索和过滤 */}
      <div className="px-3 pb-2 space-y-2">
        {/* 搜索框 */}
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${isLight ? 'bg-gray-100' : 'bg-white/10'}`}>
          <Search size={16} className={isLight ? 'text-gray-400' : 'text-gray-500'} />
          <input
            type="text"
            placeholder="搜索应用..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`flex-1 bg-transparent text-sm outline-none ${isLight ? 'text-gray-900 placeholder-gray-400' : 'text-white placeholder-gray-500'}`}
          />
        </div>

        {/* 分类标签 */}
        <div 
          ref={categoryScrollRef}
          onWheel={handleCategoryWheel}
          className="flex gap-1 overflow-x-auto pb-1 custom-scrollbar-x"
        >
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all ${
                filter === cat
                  ? 'bg-blue-500 text-white'
                  : isLight ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-white/10 text-gray-400 hover:bg-white/20'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 应用列表 */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 custom-scrollbar">
        {isOpeningDetail && (
          <div className={`absolute inset-0 z-10 flex items-center justify-center backdrop-blur-sm ${isLight ? 'bg-white/50' : 'bg-gray-900/50'}`}>
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="animate-spin text-blue-500" size={24} />
              <span className={`text-sm ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>加载中...</span>
            </div>
          </div>
        )}
        {filteredApps.length > 0 ? (
          <div className="space-y-2">
            {filteredApps.map((app, index) => (
              <div
                key={app.appName}
                onClick={() => handleSelectApp(app)}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer group ${
                  isOpeningDetail ? 'opacity-50 cursor-not-allowed' : '',
                  selectedApp?.appName === app.appName
                    ? isLight ? 'bg-blue-50 border-blue-200' : 'bg-blue-500/20 border-blue-500/30'
                    : isLight ? 'bg-white border-transparent hover:border-gray-200' : 'bg-white/5 border-transparent hover:bg-white/10'
                } border shadow-sm`}
              >
                <AppIcon name={app.appName} size={44} isSelected={selectedApp?.appName === app.appName} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium truncate ${isLight ? 'text-gray-900' : 'text-white'}`}>
                      {app.appName}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${isLight ? 'bg-gray-100 text-gray-500' : 'bg-white/10 text-gray-400'}`}>
                      {app.category}
                    </span>
                  </div>
                  <div className={`text-xs mt-1 ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                    {formatDuration(app.totalDuration)} · {app.sessionCount} 次会话
                  </div>
                </div>
                <ChevronRight size={16} className={`transition-transform ${selectedApp?.appName === app.appName ? 'translate-x-1' : ''} ${isLight ? 'text-gray-400' : 'text-gray-500'}`} />
              </div>
            ))}
          </div>
        ) : (
          <div className={`flex flex-col items-center justify-center h-32 ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
            <Monitor size={32} className="mb-2 opacity-50" />
            <span className="text-sm">{searchQuery ? '未找到匹配的应用' : '暂无数据'}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AppListPanel;