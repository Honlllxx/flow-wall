// 1. 颜色常量
export const COLORS = [
  '#60A5FA', '#F87171', '#34D399', '#FBBF24', 
  '#A78BFA', '#F472B6', '#2DD4BF', '#FB923C',
];

export const FALLBACK_COLORS = ['#60A5FA', '#F87171', '#34D399', '#FBBF24', '#A78BFA', '#F472B6'];

// 2. 标准时间范围定义
export const STANDARD_RANGES = [
  { id: 'raw', label: 'Latest', grouping: 'raw' },
  { id: 'hour', label: 'Today', grouping: 'hour' },
  { id: 'day', label: 'Days', grouping: 'day' },
  { id: 'week', label: '12 Weeks', grouping: 'week' },
  { id: 'month', label: '12 Months', grouping: 'month' },
  { id: 'year', label: 'Year', grouping: 'month' },
];

// 3. 辅助函数
export const getMetricColor = (metrics, label, index) => {
  if (!metrics) return FALLBACK_COLORS[0];
  const m = metrics.find(item => item.label === label);
  return m?.color || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
};

export const getScore = (weights, val, type) => {
  const w = (weights && weights[type] !== undefined) ? weights[type] : 1;
  return Number((val * w).toFixed(1));
};

export const getLocalDayKey = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getLocalMonthKey = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};