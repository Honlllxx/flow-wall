import React, { useState } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend
} from 'recharts';
import {
  Clock, Monitor, Filter, Play, Pause, RefreshCw,
  MoreVertical, Tag, Activity
} from 'lucide-react';
import { useAppUsage } from '../../../hooks/useAppUsage';

const COLORS = ['#60A5FA', '#34D399', '#FBBF24', '#F87171', '#A78BFA', '#EC4899', '#9CA3AF', '#8B5CF6'];

const CATEGORIES = ['开发工具', '浏览器', '通讯工具', '娱乐', '办公', '设计', '系统工具', '媒体播放', '未分类'];

const AppUsageView = ({ isLight }) => {
  const {
    todayStats,
    categorySummary,
    isRunning,
    loading,
    stats,
    actions,
    formatDuration
  } = useAppUsage();

  const [filter, setFilter] = useState('all');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="animate-spin text-blue-400" size={24} />
      </div>
    );
  }

  // 准备图表数据
  const pieData = Object.entries(stats.byCategory).map(([name, data]) => ({
    name,
    value: data.totalDuration,
    color: data.color
  }));

  const barData = todayStats.slice(0, 10).map(app => ({
    name: app.appName,
    time: Math.round((app.totalDuration || 0) / 60000), // 转换为分钟
    category: app.category
  }));

  const textColor = isLight ? '#374151' : '#F3F4F6';
  const subTextColor = isLight ? '#6B7280' : '#9CA3AF';
  const bgColor = isLight ? 'bg-white/50' : 'bg-white/5';

  // 过滤应用列表
  const filteredApps = filter === 'all'
    ? todayStats
    : todayStats.filter(app => app.category === filter);

  // 打开分类设置弹窗
  const openCategoryModal = (app) => {
    setSelectedApp(app);
    setShowCategoryModal(true);
  };

  // 设置分类
  const handleSetCategory = (category) => {
    if (selectedApp) {
      actions.setCategory(selectedApp.appName, category);
      setShowCategoryModal(false);
      setSelectedApp(null);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto space-y-4">
      {/* 控制栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={actions.toggleTracking}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
              isRunning
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
            }`}
          >
            {isRunning ? <Pause size={16} /> : <Play size={16} />}
            <span className="text-sm">{isRunning ? '暂停追踪' : '开始追踪'}</span>
          </button>

          <button
            onClick={actions.refreshData}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {/* 统计概览 */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <Monitor size={14} className="text-blue-400" />
            <span style={{ color: subTextColor }}>{stats.totalApps} 个应用</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={14} className="text-green-400" />
            <span style={{ color: subTextColor }}>
              总时长 {formatDuration(stats.totalTime)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Activity size={14} className="text-yellow-400" />
            <span style={{ color: subTextColor }}>
              {stats.totalSessions} 次会话
            </span>
          </div>
        </div>
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
        {/* 分类饼图 */}
        <div className={`rounded-xl p-4 ${bgColor}`}>
          <h3 className="text-sm font-medium mb-3" style={{ color: textColor }}>
            应用分类占比
          </h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatDuration(value)}
                  contentStyle={{
                    backgroundColor: isLight ? '#fff' : '#1F2937',
                    border: 'none',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px]" style={{ color: subTextColor }}>
              暂无数据
            </div>
          )}
        </div>

        {/* TOP应用柱状图 */}
        <div className={`rounded-xl p-4 ${bgColor}`}>
          <h3 className="text-sm font-medium mb-3" style={{ color: textColor }}>
            使用时长 TOP10
          </h3>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={80}
                  tick={{ fill: subTextColor, fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value) => `${value} 分钟`}
                  contentStyle={{
                    backgroundColor: isLight ? '#fff' : '#1F2937',
                    border: 'none',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="time" fill="#60A5FA" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px]" style={{ color: subTextColor }}>
              暂无数据
            </div>
          )}
        </div>
      </div>

      {/* 应用列表 */}
      <div className={`rounded-xl p-4 flex-1 overflow-hidden flex flex-col ${bgColor}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium" style={{ color: textColor }}>
            应用详情
          </h3>
          <div className="flex items-center gap-2">
            <Filter size={14} style={{ color: subTextColor }} />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className={`text-xs rounded-lg px-2 py-1 border ${
                isLight
                  ? 'bg-white border-gray-200'
                  : 'bg-gray-800 border-gray-700 text-white'
              }`}
            >
              <option value="all">全部</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 space-y-2">
          {filteredApps.length > 0 ? (
            filteredApps.map((app, index) => (
              <div
                key={app.appName}
                className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                  isLight ? 'hover:bg-white' : 'hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs w-5 text-center" style={{ color: subTextColor }}>
                    {index + 1}
                  </span>
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: stats.byCategory[app.category]?.color || COLORS[0] }}
                  />
                  <span className="text-sm font-medium" style={{ color: textColor }}>
                    {app.appName}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/10"
                    style={{ color: subTextColor }}>
                    {app.category}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs" style={{ color: subTextColor }}>
                    {app.sessionCount} 次
                  </span>
                  <span className="text-sm font-medium" style={{ color: textColor }}>
                    {formatDuration(app.totalDuration)}
                  </span>
                  <button
                    onClick={() => openCategoryModal(app)}
                    className="p-1 rounded hover:bg-white/10 transition-colors"
                  >
                    <Tag size={14} style={{ color: subTextColor }} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="flex items-center justify-center h-32" style={{ color: subTextColor }}>
              暂无数据，开始追踪后将显示应用使用情况
            </div>
          )}
        </div>
      </div>

      {/* 分类设置弹窗 */}
      {showCategoryModal && selectedApp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`rounded-xl p-6 w-80 ${isLight ? 'bg-white' : 'bg-gray-800'}`}>
            <h3 className="text-lg font-medium mb-4" style={{ color: textColor }}>
              设置分类: {selectedApp.appName}
            </h3>
            <div className="space-y-2">
              {CATEGORIES.map(category => (
                <button
                  key={category}
                  onClick={() => handleSetCategory(category)}
                  className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                    selectedApp.category === category
                      ? 'bg-blue-500 text-white'
                      : isLight
                        ? 'hover:bg-gray-100'
                        : 'hover:bg-gray-700'
                  }`}
                  style={{ color: selectedApp.category === category ? '#fff' : textColor }}
                >
                  {category}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowCategoryModal(false)}
              className="mt-4 w-full py-2 rounded-lg bg-gray-500/20 hover:bg-gray-500/30 transition-colors"
              style={{ color: textColor }}
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppUsageView;
