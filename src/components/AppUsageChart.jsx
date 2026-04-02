import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Monitor, BarChart2, PieChart as PieChartIcon, TrendingUp, Calendar } from 'lucide-react';

const AppUsageChart = ({ dateRange = 'week' }) => {
  const [chartData, setChartData] = useState([]);
  const [pieData, setPieData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState('bar'); // 'bar', 'line', 'pie'

  // 饼图颜色
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  useEffect(() => {
    loadChartData();
  }, [dateRange]);

  const loadChartData = async () => {
    setLoading(true);
    try {
      // 这里应该调用API获取按时间聚合的数据
      // 暂时使用模拟数据
      const summary = await window.api.getAppUsageSummary(dateRange);

      // 生成柱状图/折线图数据（按应用）
      const topAppsData = summary.topApps.slice(0, 8).map(app => ({
        name: app.appName.length > 10 ? app.appName.substring(0, 10) + '...' : app.appName,
        fullName: app.appName,
        duration: Math.round(app.duration / (60 * 1000)), // 转换为分钟
        category: app.category
      }));

      setChartData(topAppsData);

      // 生成饼图数据（按分类）
      const categoryData = Object.entries(summary.categoryStats).map(([category, stats]) => ({
        name: category,
        value: Math.round(stats.duration / (60 * 1000)), // 转换为分钟
        duration: stats.duration
      }));

      setPieData(categoryData);
    } catch (error) {
      console.error('加载图表数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDurationTooltip = (value) => {
    const hours = Math.floor(value / 60);
    const minutes = value % 60;
    if (hours > 0) {
      return `${hours} 小时 ${minutes} 分钟`;
    }
    return `${minutes} 分钟`;
  };

  const formatPieTooltip = (value, name, props) => {
    const duration = props.payload.duration;
    const hours = Math.floor(duration / (60 * 60 * 1000));
    const minutes = Math.floor((duration % (60 * 60 * 1000)) / (60 * 1000));

    if (hours > 0) {
      return `${name}: ${hours} 小时 ${minutes} 分钟`;
    }
    return `${name}: ${minutes} 分钟`;
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-2"></div>
          <p className="text-gray-500">加载图表数据中...</p>
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="text-center">
          <Monitor className="w-12 h-12 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">暂无数据</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <TrendingUp className="w-5 h-5 text-blue-500" />
          <h3 className="font-medium">应用使用时间分析</h3>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={() => setChartType('bar')}
            className={`px-3 py-1 rounded-md flex items-center space-x-1 ${
              chartType === 'bar'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span>柱状图</span>
          </button>

          <button
            onClick={() => setChartType('line')}
            className={`px-3 py-1 rounded-md flex items-center space-x-1 ${
              chartType === 'line'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>折线图</span>
          </button>

          <button
            onClick={() => setChartType('pie')}
            className={`px-3 py-1 rounded-md flex items-center space-x-1 ${
              chartType === 'pie'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <PieChartIcon className="w-4 h-4" />
            <span>饼图</span>
          </button>
        </div>
      </div>

      {chartType === 'bar' && (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={60}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                label={{
                  value: '使用时间 (分钟)',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 10
                }}
                tickFormatter={(value) => value}
              />
              <Tooltip
                formatter={(value) => [formatDurationTooltip(value), '使用时间']}
                labelFormatter={(label, payload) => {
                  const data = payload[0]?.payload;
                  return data?.fullName || label;
                }}
              />
              <Legend />
              <Bar
                dataKey="duration"
                name="使用时间"
                fill="#8884d8"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {chartType === 'line' && (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={60}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                label={{
                  value: '使用时间 (分钟)',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 10
                }}
                tickFormatter={(value) => value}
              />
              <Tooltip
                formatter={(value) => [formatDurationTooltip(value), '使用时间']}
                labelFormatter={(label, payload) => {
                  const data = payload[0]?.payload;
                  return data?.fullName || label;
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="duration"
                name="使用时间"
                stroke="#8884d8"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {chartType === 'pie' && pieData.length > 0 && (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name, props) => formatPieTooltip(value, name, props)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {chartType === 'pie' && pieData.length === 0 && (
        <div className="h-64 flex items-center justify-center">
          <p className="text-gray-500">暂无分类数据</p>
        </div>
      )}

      <div className="mt-4 text-xs text-gray-500 text-center">
        数据范围: {dateRange === 'today' ? '今日' :
                  dateRange === 'week' ? '本周' :
                  dateRange === 'month' ? '本月' :
                  dateRange === 'year' ? '今年' : '全部'}
        ，显示前 {chartData.length} 个应用
      </div>
    </div>
  );
};

export default AppUsageChart;