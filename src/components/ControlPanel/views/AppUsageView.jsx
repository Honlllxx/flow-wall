import React, { useState, useEffect } from 'react';
import { 
  Clock, Monitor, Activity, ChevronRight, LayoutGrid,
  BarChart3, PieChart, TrendingUp, Zap
} from 'lucide-react';
import { useAppUsage } from '../../../hooks/useAppUsage';

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

// 统计卡片
const StatCard = ({ icon: Icon, label, value, color, isLight }) => {
  const colorClasses = {
    blue: isLight ? 'bg-blue-50 text-blue-600' : 'bg-blue-500/20 text-blue-400',
    green: isLight ? 'bg-green-50 text-green-600' : 'bg-green-500/20 text-green-400',
    purple: isLight ? 'bg-purple-50 text-purple-600' : 'bg-purple-500/20 text-purple-400',
    orange: isLight ? 'bg-orange-50 text-orange-600' : 'bg-orange-500/20 text-orange-400',
  };

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl ${colorClasses[color]}`}>
      <Icon size={20} />
      <div>
        <div className="text-lg font-bold">{value}</div>
        <div className={`text-xs ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>{label}</div>
      </div>
    </div>
  );
};

const AppUsageView = ({ isLight, opacity }) => {
  const { todayStats, isRunning } = useAppUsage();
  const [hovered, setHovered] = useState(false);

  // 计算统计数据
  const stats = {
    totalApps: todayStats.length,
    totalTime: todayStats.reduce((sum, app) => sum + (app.totalDuration || 0), 0),
    totalSessions: todayStats.reduce((sum, app) => sum + (app.sessionCount || 0), 0),
    topApp: todayStats.length > 0 ? todayStats[0] : null,
  };

  // 打开应用列表窗口
  const handleOpenAppList = () => {
    if (window.api?.showAppList) {
      window.api.showAppList();
    }
  };

  const bgColor = isLight ? 'bg-white' : 'bg-gray-800/50';
  const borderColor = isLight ? 'border-gray-200' : 'border-white/10';

  return (
    <div className="h-full flex flex-col p-4">
      {/* 主入口卡片 */}
      <div
        onClick={handleOpenAppList}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`flex-1 rounded-2xl ${bgColor} border ${borderColor} 
          cursor-pointer transition-all duration-300 overflow-hidden
          ${hovered ? 'shadow-xl scale-[1.02]' : 'shadow-md'}`}
      >
        {/* 顶部渐变区域 */}
        <div className={`h-32 relative overflow-hidden ${isLight ? 'bg-gradient-to-br from-blue-500 to-purple-600' : 'bg-gradient-to-br from-blue-600 to-purple-700'}`}>
          {/* 装饰圆 */}
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
          <div className="absolute top-10 -left-10 w-24 h-24 rounded-full bg-white/5" />
          
          {/* 标题区域 */}
          <div className="relative z-10 p-5 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-white/80 text-sm mb-1">
                <LayoutGrid size={14} />
                <span>应用使用追踪</span>
              </div>
              <h2 className="text-2xl font-bold text-white">
                {isRunning ? '正在追踪' : '已暂停'}
              </h2>
              <p className="text-white/60 text-xs mt-1">
                点击查看详细报告
              </p>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-300 ${hovered ? 'scale-110' : ''} ${isRunning ? 'bg-green-400/30' : 'bg-white/20'}`}>
              {isRunning ? (
                <Activity size={24} className="text-white animate-pulse" />
              ) : (
                <Clock size={24} className="text-white/80" />
              )}
            </div>
          </div>
        </div>

        {/* 统计区域 */}
        <div className="p-4 space-y-3">
          {/* 主要统计 */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard 
              icon={Monitor} 
              label="今日应用" 
              value={stats.totalApps} 
              color="blue"
              isLight={isLight}
            />
            <StatCard 
              icon={Zap} 
              label="总会话" 
              value={stats.totalSessions} 
              color="purple"
              isLight={isLight}
            />
          </div>

          {/* 时长统计 */}
          <div className={`p-4 rounded-xl ${isLight ? 'bg-gray-50' : 'bg-white/5'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={16} className={isLight ? 'text-gray-400' : 'text-gray-500'} />
                <span className={`text-sm ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>今日总时长</span>
              </div>
              <span className={`text-xl font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                {formatDuration(stats.totalTime)}
              </span>
            </div>
            
            {/* 进度条 */}
            <div className="mt-3 h-2 rounded-full bg-gray-200/20 overflow-hidden">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-1000"
                style={{ width: `${Math.min((stats.totalTime / 28800000) * 100, 100)}%` }} // 8小时为100%
              />
            </div>
            <div className={`text-xs mt-1 ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
              目标: 8小时
            </div>
          </div>

          {/* TOP应用 */}
          {stats.topApp && (
            <div className={`p-3 rounded-xl border ${isLight ? 'bg-orange-50 border-orange-100' : 'bg-orange-500/10 border-orange-500/20'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} className="text-orange-500" />
                  <span className={`text-xs ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>使用最多</span>
                </div>
                <span className={`text-sm font-medium ${isLight ? 'text-gray-900' : 'text-white'}`}>
                  {stats.topApp.appName}
                </span>
              </div>
            </div>
          )}

          {/* 进入按钮 */}
          <button className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
            isLight 
              ? 'bg-gray-900 text-white hover:bg-gray-800' 
              : 'bg-white text-gray-900 hover:bg-gray-100'
          }`}>
            <span className="text-sm font-medium">查看详细报告</span>
            <ChevronRight size={16} className={`transition-transform ${hovered ? 'translate-x-1' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AppUsageView;
