import React, { useState, useEffect } from 'react';
import { Monitor, Clock, BarChart2, Filter, Download, Trash2, Settings, Play, Pause, RefreshCw } from 'lucide-react';

const AppUsagePanel = () => {
  const [summary, setSummary] = useState(null);
  const [records, setRecords] = useState([]);
  const [dateRange, setDateRange] = useState('today');
  const [loading, setLoading] = useState(true);
  const [trackingEnabled, setTrackingEnabled] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedApp, setSelectedApp] = useState('all');

  // 日期范围选项
  const dateRangeOptions = [
    { id: 'today', label: '今日' },
    { id: 'week', label: '本周' },
    { id: 'month', label: '本月' },
    { id: 'year', label: '今年' },
    { id: 'all', label: '全部' }
  ];

  // 初始化加载数据
  useEffect(() => {
    loadData();
    loadSettings();

    // 监听应用使用更新
    window.api.onAppUsageUpdate(() => {
      loadData();
    });

    window.api.onAppUsageRecordDeleted(() => {
      loadData();
    });

    // 监听追踪状态变化
    window.api.onAppTrackingStarted((status) => {
      setTrackingEnabled(true);
      loadData();
    });

    window.api.onAppTrackingStopped((status) => {
      setTrackingEnabled(false);
      loadData();
    });

    return () => {
      // 清理监听器
      const ipcRenderer = window.api;
      // 注意：这里需要实际的清理逻辑，但简化处理
    };
  }, []);

  // 当日期范围改变时重新加载数据
  useEffect(() => {
    loadData();
  }, [dateRange, selectedCategory, selectedApp]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 加载摘要
      const summaryData = await window.api.getAppUsageSummary(dateRange);
      setSummary(summaryData);

      // 加载记录
      const options = {};
      if (selectedCategory !== 'all') {
        options.category = selectedCategory;
      }
      if (selectedApp !== 'all') {
        options.appName = selectedApp;
      }
      const recordsData = await window.api.getAppUsageRecords(options);
      setRecords(recordsData.slice(0, 50)); // 只显示最近50条
    } catch (error) {
      console.error('加载应用使用数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const status = await window.api.getAppTrackingStatus();
      setTrackingEnabled(status.isTracking);
    } catch (error) {
      console.error('加载追踪状态失败:', error);
    }
  };

  const toggleTracking = async () => {
    const newTrackingEnabled = !trackingEnabled;
    setTrackingEnabled(newTrackingEnabled);
    if (newTrackingEnabled) {
      await window.api.startAppTracking({});
    } else {
      await window.api.stopAppTracking();
    }
  };

  const formatDuration = (milliseconds) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours} 小时 ${minutes % 60} 分钟`;
    } else if (minutes > 0) {
      return `${minutes} 分钟 ${seconds % 60} 秒`;
    } else {
      return `${seconds} 秒`;
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const exportData = async () => {
    try {
      const result = await window.api.exportAppUsageData('csv');
      if (result.success) {
        alert(`数据已导出到: ${result.filePath}`);
      } else if (!result.cancelled) {
        alert(`导出失败: ${result.error}`);
      }
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出失败，请重试');
    }
  };

  const cleanupOldRecords = async () => {
    if (confirm('确定要清理90天前的旧记录吗？此操作不可恢复。')) {
      try {
        const result = await window.api.cleanupAppUsageRecords(90);
        if (result.success) {
          alert(`已清理 ${result.removedCount} 条旧记录`);
          loadData();
        }
      } catch (error) {
        console.error('清理失败:', error);
        alert('清理失败，请重试');
      }
    }
  };

  const deleteRecord = async (id) => {
    if (confirm('确定要删除这条记录吗？')) {
      window.api.deleteAppUsageRecord(id);
    }
  };

  if (loading && !summary) {
    return (
      <div className="p-6 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-600">加载中...</span>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* 头部控制栏 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Monitor className="w-6 h-6 text-purple-600" />
          <h2 className="text-xl font-semibold">应用使用时间</h2>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={toggleTracking}
            className={`px-3 py-1 rounded-md flex items-center space-x-1 ${
              trackingEnabled
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-red-100 text-red-700 hover:bg-red-200'
            }`}
          >
            {trackingEnabled ? (
              <>
                <Pause className="w-4 h-4" />
                <span>暂停追踪</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>开始追踪</span>
              </>
            )}
          </button>

          <button
            onClick={exportData}
            className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 flex items-center space-x-1"
          >
            <Download className="w-4 h-4" />
            <span>导出数据</span>
          </button>

          <button
            onClick={cleanupOldRecords}
            className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-md hover:bg-yellow-200 flex items-center space-x-1"
          >
            <Trash2 className="w-4 h-4" />
            <span>清理旧数据</span>
          </button>
        </div>
      </div>

      {/* 摘要卡片 */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">总使用时间</p>
                <p className="text-2xl font-bold text-gray-800">
                  {formatDuration(summary.totalDuration)}
                </p>
              </div>
              <Clock className="w-8 h-8 text-blue-500" />
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {summary.totalRecords} 条记录
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">最常用应用</p>
                <p className="text-2xl font-bold text-gray-800">
                  {summary.topApps[0]?.appName || '无数据'}
                </p>
              </div>
              <Monitor className="w-8 h-8 text-green-500" />
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {summary.topApps[0] ? formatDuration(summary.topApps[0].duration) : ''}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">应用分类</p>
                <p className="text-2xl font-bold text-gray-800">
                  {Object.keys(summary.categoryStats).length} 类
                </p>
              </div>
              <BarChart2 className="w-8 h-8 text-purple-500" />
            </div>
            <p className="text-sm text-gray-500 mt-2">
              最多: {Object.keys(summary.categoryStats).sort((a, b) =>
                summary.categoryStats[b].duration - summary.categoryStats[a].duration
              )[0] || '无'}
            </p>
          </div>
        </div>
      )}

      {/* 过滤控制 */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-gray-500" />
            <h3 className="font-medium">筛选条件</h3>
          </div>

          <div className="flex space-x-2">
            {dateRangeOptions.map(option => (
              <button
                key={option.id}
                onClick={() => setDateRange(option.id)}
                className={`px-3 py-1 rounded-md ${
                  dateRange === option.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex space-x-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">应用分类</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">全部分类</option>
              {summary && Object.keys(summary.categoryStats).map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">应用名称</label>
            <select
              value={selectedApp}
              onChange={(e) => setSelectedApp(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">全部应用</option>
              {summary && summary.topApps.map(app => (
                <option key={app.appName} value={app.appName}>{app.appName}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 记录列表 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="font-medium">最近使用记录</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">应用</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">窗口标题</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">分类</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">开始时间</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">结束时间</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">使用时长</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {records.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                    暂无使用记录
                  </td>
                </tr>
              ) : (
                records.map(record => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{record.appName}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-700 truncate max-w-xs" title={record.windowTitle}>
                        {record.windowTitle || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        record.category === '工作' ? 'bg-blue-100 text-blue-800' :
                        record.category === '娱乐' ? 'bg-green-100 text-green-800' :
                        record.category === '社交' ? 'bg-purple-100 text-purple-800' :
                        record.category === '学习' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {record.category || '其他'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {formatTime(record.startTime)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {formatTime(record.endTime)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatDuration(record.duration)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <button
                        onClick={() => deleteRecord(record.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 分类统计 */}
      {summary && Object.keys(summary.categoryStats).length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-medium mb-4">分类统计</h3>
          <div className="space-y-3">
            {Object.entries(summary.categoryStats)
              .sort((a, b) => b[1].duration - a[1].duration)
              .map(([category, stats]) => (
                <div key={category} className="flex items-center">
                  <div className="w-24 text-sm text-gray-600">{category}</div>
                  <div className="flex-1 ml-4">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{
                          width: `${(stats.duration / summary.totalDuration) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                  <div className="w-24 text-right text-sm font-medium">
                    {formatDuration(stats.duration)}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AppUsagePanel;