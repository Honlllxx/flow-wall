import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, AreaChart, Area
} from 'recharts';
import {
  Clock, Zap, Timer, Eye, X, LayoutGrid, Clock3,
  TrendingUp, BarChart3, Activity, Download, ChevronLeft,
  Calendar, Target, Award, Lock, Edit, Save, X as XIcon
} from 'lucide-react';
import { useWindowInteraction } from '../../hooks/useWindowInteraction';

const COLORS = ['#60A5FA', '#34D399', '#FBBF24', '#F87171', '#A78BFA', '#EC4899', '#9CA3AF', '#8B5CF6'];

// 应用图标组件
const AppIcon = ({ name, size = 48 }) => {
  const initial = name.charAt(0).toUpperCase();
  const hue = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;

  return (
    <div
      className="flex items-center justify-center rounded-2xl font-bold text-white shadow-lg"
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

// 统计卡片组件
const StatCard = ({ icon: Icon, title, value, subValue, color, isLight }) => {
  const bgColors = {
    blue: isLight ? 'bg-blue-50 border-blue-200' : 'bg-blue-500/10 border-blue-500/20',
    green: isLight ? 'bg-green-50 border-green-200' : 'bg-green-500/10 border-green-500/20',
    purple: isLight ? 'bg-purple-50 border-purple-200' : 'bg-purple-500/10 border-purple-500/20',
    yellow: isLight ? 'bg-yellow-50 border-yellow-200' : 'bg-yellow-500/10 border-yellow-500/20',
    orange: isLight ? 'bg-orange-50 border-orange-200' : 'bg-orange-500/10 border-orange-500/20',
  };

  const iconColors = {
    blue: isLight ? 'text-blue-600' : 'text-blue-400',
    green: isLight ? 'text-green-600' : 'text-green-400',
    purple: isLight ? 'text-purple-600' : 'text-purple-400',
    yellow: isLight ? 'text-yellow-600' : 'text-yellow-400',
    orange: isLight ? 'text-orange-600' : 'text-orange-400',
  };

  return (
    <div className={`rounded-xl p-4 border ${bgColors[color]} transition-all hover:scale-[1.02]`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={18} className={iconColors[color]} />
        <span className={`text-xs ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>{title}</span>
      </div>
      <div className={`text-xl font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
        {value}
      </div>
      {subValue && (
        <div className={`text-xs mt-1 ${isLight ? 'text-gray-500' : 'text-gray-500'}`}>
          {subValue}
        </div>
      )}
    </div>
  );
};

// 时间线组件
const Timeline = ({ sessions, isLight }) => {
  return (
    <div className="space-y-3">
      {sessions?.map((session, index) => (
        <div key={index} className="flex items-center gap-4">
          <div className={`w-16 text-xs ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
            {session.startTime}
          </div>
          <div className="flex-1 relative">
            <div className={`h-2 rounded-full ${isLight ? 'bg-gray-200' : 'bg-gray-700'}`}>
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                style={{ width: `${session.percentage}%` }}
              />
            </div>
          </div>
          <div className={`w-20 text-xs text-right ${isLight ? 'text-gray-600' : 'text-gray-300'}`}>
            {session.duration}
          </div>
        </div>
      ))}
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

// 应用分类选项
const CATEGORIES = [
  '工作', '娱乐', '学习', '工具', '社交', '游戏', '其他'
];

const AppDetailPanel = () => {
  const { isLocked, lockMessage, getInteractionStyle } = useWindowInteraction();
  const [panelViewMode, setPanelViewMode] = useState('overview');
  const [isLight, setIsLight] = useState(false);
  const [opacity, setOpacity] = useState(0.6);
  const [appData, setAppData] = useState(null);
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 从主进程获取应用数据
  useEffect(() => {
    let isMounted = true;
    
    const processHourlyData = (hourlyData) => {
      // 处理每小时使用数据，转换为图表所需格式
      if (!hourlyData || hourlyData.length !== 24) {
        return [];
      }
      return hourlyData.map((duration, hour) => ({
        time: `${hour}:00`,
        duration: Math.round(duration / 60000) // 转换为分钟
      }));
    };
    
    const processSessionData = (sessions) => {
      // 处理会话数据，确保格式正确
      if (!sessions || !Array.isArray(sessions)) {
        return [];
      }
      return sessions.map(session => ({
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.duration,
        percentage: session.percentage || 0
      }));
    };
    
    const loadData = async () => {
      try {
        if (window.api?.getAppDetailData) {
          const data = await window.api.getAppDetailData();
          if (isMounted) {
            // 确保数据结构完整并处理数据格式
            const completeData = {
              ...data,
              hourlyData: processHourlyData(data?.hourlyData),
              sessions: processSessionData(data?.sessions)
            };
            setAppData(completeData);
            setNewCategory(data?.category || '');
            console.log('AppDetailPanel数据加载成功:', completeData);
          }
        } else {
          console.warn('getAppDetailData API不可用');
        }
      } catch (e) {
        console.error('Failed to load app data:', e);
      }
    };
    
    loadData();

    // 监听数据更新事件
    const unsubscribe = window.api?.onAppDetailUpdated && window.api.onAppDetailUpdated((appData) => {
      if (isMounted) {
        // 确保数据结构完整并处理数据格式
        const completeData = {
          ...appData,
          hourlyData: processHourlyData(appData?.hourlyData),
          sessions: processSessionData(appData?.sessions)
        };
        setAppData(completeData);
        setNewCategory(appData?.category || '');
        console.log('AppDetailPanel数据更新:', completeData);
      }
    });

    // 清理函数
    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // 检测系统主题和获取配置
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

  const handleClose = () => {
    if (window.api?.closeAppDetail) {
      window.api.closeAppDetail();
    }
  };

  const handleSaveCategory = async () => {
    if (!appData || !newCategory) return;
    
    try {
      setIsLoading(true);
      if (window.api?.appUsage?.setCategory) {
        await window.api.appUsage.setCategory(appData.appName, newCategory);
        // 更新本地数据
        setAppData({ ...appData, category: newCategory });
        setIsEditingCategory(false);
        console.log('应用分类更新成功:', newCategory);
      }
    } catch (e) {
      console.error('更新应用分类失败:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportData = async () => {
    try {
      setIsLoading(true);
      if (window.api?.exportData) {
        const result = await window.api.exportData();
        console.log('数据导出成功:', result);
        // 可以添加导出成功提示
      }
    } catch (e) {
      console.error('数据导出失败:', e);
    } finally {
      setIsLoading(false);
    }
  };

  if (!appData) {
    return (
      <div 
        className={`h-full flex items-center justify-center backdrop-blur-xl ${isLight ? 'text-gray-900' : 'text-white'}`}
        style={{
          backgroundColor: isLight 
            ? `rgba(255, 255, 255, ${opacity})` 
            : `rgba(17, 24, 39, ${opacity})`
        }}
      >
        <div className="flex flex-col items-center gap-2">
          <div className={`p-3 rounded-full ${isLight ? 'bg-gray-100' : 'bg-white/10'}`}>
            <X size={24} className={isLight ? 'text-gray-400' : 'text-gray-500'} />
          </div>
          <span className={isLight ? 'text-gray-600' : 'text-gray-400'}>
            无数据
          </span>
          <button
            onClick={handleClose}
            className={`mt-2 px-4 py-2 rounded-lg text-sm ${isLight ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' : 'bg-white/10 hover:bg-white/20 text-white'}`}
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  const subTextColor = isLight ? '#6B7280' : '#9CA3AF';

  // 背景样式
  const bgStyle = {
    backgroundColor: isLight 
      ? `rgba(255, 255, 255, ${opacity})` 
      : `rgba(17, 24, 39, ${opacity})`
  };

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
      <div className={`relative overflow-hidden rounded-xl ${isLight ? 'bg-gradient-to-br from-blue-500 to-purple-600' : 'bg-gradient-to-br from-blue-600 to-purple-700'}`}>
        {/* 装饰元素 */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10 p-5">
          <div className="flex items-start justify-between">
            <button
              onClick={handleClose}
              className="p-2 rounded-xl bg-white/20 hover:bg-white/30 transition-colors text-white"
            >
              <ChevronLeft size={20} />
            </button>
            
            <div className="flex gap-1">
              {[
                { key: 'overview', icon: LayoutGrid },
                { key: 'timeline', icon: Clock },
                { key: 'insights', icon: TrendingUp },
              ].map(({ key, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setPanelViewMode(key)}
                  className={`p-2 rounded-xl transition-all ${
                    panelViewMode === key
                      ? 'bg-white text-blue-600'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  <Icon size={18} />
                </button>
              ))}
            </div>
          </div>

          {/* 应用信息 */}
          <div className="flex items-center gap-4 mt-4">
            <AppIcon name={appData.appName} size={56} />
            <div>
              <h2 className="text-2xl font-bold text-white">{appData.appName}</h2>
              <div className="flex items-center gap-2 mt-1">
                {isEditingCategory ? (
                  <div className="flex items-center gap-1">
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="px-2 py-1 rounded-full bg-white/90 text-blue-600 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-white"
                    >
                      {CATEGORIES.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleSaveCategory}
                      disabled={isLoading}
                      className="p-1 rounded-full bg-white/80 hover:bg-white text-blue-600 transition-colors"
                    >
                      <Save size={14} />
                    </button>
                    <button
                      onClick={() => setIsEditingCategory(false)}
                      className="p-1 rounded-full bg-white/80 hover:bg-white text-blue-600 transition-colors"
                    >
                      <XIcon size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-white/20 text-white text-xs">
                      {appData.category}
                    </span>
                    <button
                      onClick={() => setIsEditingCategory(true)}
                      className="p-1 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                    >
                      <Edit size={14} />
                    </button>
                  </div>
                )}
                <span className="text-white/60 text-xs">
                  排名 #{appData.rank || 1} / {appData.totalApps || 1}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 面板内容 */}
      <div className="flex-1 overflow-y-auto pt-4 custom-scrollbar">
        {panelViewMode === 'overview' && (
          <div className="space-y-4">
            {/* 统计卡片 */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={Clock}
                title="总使用时长"
                value={formatDuration(appData.totalDuration)}
                color="blue"
                isLight={isLight}
              />
              <StatCard
                icon={Zap}
                title="会话次数"
                value={appData.sessionCount}
                subValue="今日活跃"
                color="green"
                isLight={isLight}
              />
              <StatCard
                icon={Timer}
                title="平均会话"
                value={appData.sessionCount > 0
                  ? formatDuration(appData.totalDuration / appData.sessionCount)
                  : '0分钟'}
                color="purple"
                isLight={isLight}
              />
              <StatCard
                icon={Target}
                title="专注度"
                value="85%"
                subValue="高于平均水平"
                color="orange"
                isLight={isLight}
              />
            </div>

            {/* 使用时段分布 */}
            <div className={`rounded-2xl p-4 border ${isLight ? 'bg-white border-gray-200' : 'bg-white/5 border-white/10'}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-sm font-medium flex items-center gap-2 ${isLight ? 'text-gray-800' : 'text-white'}`}>
                  <BarChart3 size={16} />
                  使用时段分布
                </h3>
                <span className={`text-xs ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>今日</span>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={appData.hourlyData || []}>
                    <defs>
                      <linearGradient id="colorDuration" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#60A5FA" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#60A5FA" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={isLight ? '#e5e7eb' : 'rgba(255,255,255,0.1)'} />
                    <XAxis dataKey="time" stroke={subTextColor} tick={{ fontSize: 10 }} />
                    <YAxis stroke={subTextColor} tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isLight ? '#fff' : '#1F2937',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
                      }}
                      formatter={(value) => [`${value} 分钟`, '使用时长']}
                    />
                    <Area
                      type="monotone"
                      dataKey="duration"
                      stroke="#60A5FA"
                      fillOpacity={1}
                      fill="url(#colorDuration)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 今日会话 */}
            <div className={`rounded-2xl p-4 border ${isLight ? 'bg-white border-gray-200' : 'bg-white/5 border-white/10'}`}>
              <h3 className={`text-sm font-medium mb-4 flex items-center gap-2 ${isLight ? 'text-gray-800' : 'text-white'}`}>
                <Clock3 size={16} />
                今日会话
              </h3>
              {appData.sessions && appData.sessions.length > 0 ? (
                <Timeline sessions={appData.sessions} isLight={isLight} />
              ) : (
                <div className={`flex items-center justify-center h-20 text-xs ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
                  今日暂无会话数据
                </div>
              )}
            </div>
          </div>
        )}

        {panelViewMode === 'timeline' && (
          <div className="space-y-4">
            {/* 时间线图表 */}
            <div className={`rounded-2xl p-4 border ${isLight ? 'bg-white border-gray-200' : 'bg-white/5 border-white/10'}`}>
              <h3 className={`text-sm font-medium mb-4 ${isLight ? 'text-gray-800' : 'text-white'}`}>
                24小时使用趋势
              </h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={appData.hourlyData || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isLight ? '#e5e7eb' : 'rgba(255,255,255,0.1)'} />
                    <XAxis dataKey="time" stroke={subTextColor} tick={{ fontSize: 10 }} />
                    <YAxis stroke={subTextColor} tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isLight ? '#fff' : '#1F2937',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
                      }}
                      formatter={(value) => [`${value} 分钟`, '使用时长']}
                    />
                    <Line
                      type="monotone"
                      dataKey="duration"
                      stroke={COLORS[0]}
                      strokeWidth={3}
                      dot={{ r: 4, strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 使用统计 */}
            <div className="grid grid-cols-2 gap-3">
              <div className={`rounded-2xl p-4 border ${isLight ? 'bg-blue-50 border-blue-200' : 'bg-blue-500/10 border-blue-500/20'}`}>
                <h4 className={`text-xs font-medium mb-2 ${isLight ? 'text-blue-600' : 'text-blue-400'}`}>
                  峰值使用时段
                </h4>
                <div className={`text-xl font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                  {appData.peakHour ? `${appData.peakHour}:00 - ${appData.peakHour + 1}:00` : '14:00 - 16:00'}
                </div>
                <p className={`text-xs mt-1 ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                  这段时间使用最为频繁
                </p>
              </div>

              <div className={`rounded-2xl p-4 border ${isLight ? 'bg-green-50 border-green-200' : 'bg-green-500/10 border-green-500/20'}`}>
                <h4 className={`text-xs font-medium mb-2 ${isLight ? 'text-green-600' : 'text-green-400'}`}>
                  最长连续使用
                </h4>
                <div className={`text-xl font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                  {appData.longestSession ? formatDuration(appData.longestSession) : '2小时15分'}
                </div>
                <p className={`text-xs mt-1 ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                  {appData.longestSessionStart ? `从 ${appData.longestSessionStart} 开始` : '上午10:00开始'}
                </p>
              </div>
            </div>
          </div>
        )}

        {panelViewMode === 'insights' && (
          <div className="space-y-4">
            {/* 洞察卡片 */}
            <div className={`rounded-2xl p-5 border ${isLight ? 'bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200' : 'bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-purple-500/20'}`}>
              <h3 className={`text-sm font-medium mb-4 flex items-center gap-2 ${isLight ? 'text-gray-800' : 'text-white'}`}>
                <Award size={18} />
                使用洞察
              </h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl ${isLight ? 'bg-white' : 'bg-white/10'}`}>
                    <TrendingUp size={16} className={isLight ? 'text-purple-600' : 'text-purple-400'} />
                  </div>
                  <div>
                    <h4 className={`text-sm font-medium ${isLight ? 'text-gray-800' : 'text-white'}`}>
                      使用趋势
                    </h4>
                    <p className={`text-xs mt-1 leading-relaxed ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                      相比昨天，使用时长增加了 <span className="font-semibold text-green-500">15%</span>，
                      会话次数增加了 <span className="font-semibold text-green-500">22%</span>。
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl ${isLight ? 'bg-white' : 'bg-white/10'}`}>
                    <Clock size={16} className={isLight ? 'text-blue-600' : 'text-blue-400'} />
                  </div>
                  <div>
                    <h4 className={`text-sm font-medium ${isLight ? 'text-gray-800' : 'text-white'}`}>
                      专注度分析
                    </h4>
                    <p className={`text-xs mt-1 leading-relaxed ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                      平均会话时长 <span className="font-semibold text-blue-500">{appData.sessionCount > 0 ? formatDuration(appData.totalDuration / appData.sessionCount) : '45分钟'}</span>，
                      表明您在使用此应用时较为专注。
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl ${isLight ? 'bg-white' : 'bg-white/10'}`}>
                    <Activity size={16} className={isLight ? 'text-green-600' : 'text-green-400'} />
                  </div>
                  <div>
                    <h4 className={`text-sm font-medium ${isLight ? 'text-gray-800' : 'text-white'}`}>
                      效率建议
                    </h4>
                    <p className={`text-xs mt-1 leading-relaxed ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                      建议在 <span className="font-semibold text-yellow-500">{appData.peakHour ? `${appData.peakHour}:00-${appData.peakHour + 1}:00` : '14:00-16:00'}</span> 期间
                      集中处理相关任务，这是您使用此应用效率最高的时段。
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 导出按钮 */}
            <button 
              onClick={handleExportData}
              disabled={isLoading}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl transition-all ${isLight ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' : 'bg-white/10 hover:bg-white/20 text-white'}`}
            >
              <Download size={16} />
              <span className="text-sm font-medium">{isLoading ? '导出中...' : '导出详细数据'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AppDetailPanel;
