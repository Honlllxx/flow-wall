import React, { useEffect, useState, useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer, YAxis, XAxis, Label } from 'recharts';

const WallpaperOverlay = () => {
  const [allData, setAllData] = useState([]);
  const [viewMode, setViewMode] = useState('raw');
  const [weights, setWeights] = useState({});

  useEffect(() => {
    window.api.getData().then(setAllData);
    window.api.onDataUpdate(setAllData);
    window.api.getWeights().then(setWeights);
    window.api.onWeightsUpdate(setWeights);
  }, []);

  const { chartData, currentMetric, stats } = useMemo(() => {
    if (allData.length === 0) return { chartData: [], currentMetric: null, stats: {} };

    const lastEntry = allData[allData.length - 1];
    const targetType = lastEntry.type;
    const currentWeight = weights[targetType] || 1;
    const typeData = allData.filter(item => item.type === targetType);

    let processedData = [];
    const calcScore = (val) => Number((val * currentWeight).toFixed(1));

    if (viewMode === 'raw') {
      processedData = typeData.slice(-20).map(item => ({
        ...item,
        score: calcScore(item.value),
        label: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }));
    } else if (viewMode === 'hour') {
      const todayStr = new Date().toDateString();
      const todayData = typeData.filter(item => new Date(item.timestamp).toDateString() === todayStr);
      const hoursMap = new Array(24).fill(0);
      todayData.forEach(item => hoursMap[new Date(item.timestamp).getHours()] += item.value);
      const currentHour = new Date().getHours();
      processedData = hoursMap.slice(0, currentHour + 1).map((val, idx) => ({
        value: val,
        score: calcScore(val), 
        label: `${idx}:00`,
        type: targetType
      }));
    } else if (viewMode === 'day') {
      const daysMap = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const dateKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        daysMap[dateKey] = 0;
      }
      typeData.forEach(item => { if (daysMap[item.date] !== undefined) daysMap[item.date] += item.value; });
      processedData = Object.entries(daysMap).map(([date, val]) => ({
        value: val,
        score: calcScore(val),
        label: date.slice(5),
        type: targetType
      }));
    }

    const totalRaw = processedData.reduce((acc, cur) => acc + cur.value, 0);
    const totalScore = calcScore(totalRaw);

    return { 
      chartData: processedData, 
      currentMetric: lastEntry,
      stats: { totalRaw, totalScore, currentWeight }
    };
  }, [allData, viewMode, weights]);

  if (!currentMetric) return null;

  return (
    <div className="w-screen h-screen overflow-hidden relative pointer-events-none">
      
      {/* 交互按钮 */}
      <div 
        className="absolute bottom-[42vh] right-16 flex gap-2 z-10 pointer-events-auto"
        onMouseEnter={() => window.api.setIgnoreMouseEvents(false)}
        onMouseLeave={() => window.api.setIgnoreMouseEvents(true, { forward: true })}
      >
        {['raw', 'hour', 'day'].map(mode => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`
              px-3 py-1 text-xs uppercase tracking-widest rounded-full border transition-all cursor-pointer
              ${viewMode === mode 
                ? 'bg-white text-black border-white font-bold' 
                : 'bg-black/20 text-white/40 border-white/10 hover:bg-white/10 hover:text-white'}
            `}
          >
            {mode === 'raw' ? 'Latest' : mode}
          </button>
        ))}
      </div>

      {/* 图表层 */}
      <div className="absolute bottom-0 left-0 w-full h-[40vh] opacity-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#cbd5e1" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#cbd5e1" stopOpacity={0}/>
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            <XAxis 
              dataKey="label" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} 
              dy={10}
            />
            
            {/* ✅ 这里是新增的纵轴显示配置 */}
            <YAxis 
              domain={['auto', 'auto']} 
              orientation="right"
              tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10, fontFamily: 'monospace' }} 
              axisLine={false}
              tickLine={false}
              tickFormatter={(val) => Math.round(val)}
              width={40}
            >
              <Label 
                value="PTS" 
                offset={10} 
                position="insideTopRight" 
                style={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 'bold' }} 
              />
            </YAxis>
            
            <Area 
              type="monotone" 
              dataKey="score" 
              stroke="#f1f5f9" 
              strokeWidth={3}
              fill="url(#colorValue)" 
              filter="url(#glow)" 
              animationDuration={1000}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 数据看板 */}
      <div className="absolute top-16 right-16 text-slate-200 text-right select-none transition-all">
        <p className="text-xs font-bold tracking-[0.3em] opacity-40 uppercase mb-[-5px]">
          {currentMetric.type} · {viewMode.toUpperCase()}
        </p>

        <h1 className="text-7xl font-thin tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
          {viewMode === 'raw' ? (stats.currentWeight * currentMetric.value).toFixed(0) : stats.totalScore.toFixed(0)}
          <span className="text-xl ml-3 font-normal opacity-80 text-yellow-400/80">PTS</span>
        </h1>
        
        <div className="text-sm opacity-50 mt-2 font-mono flex flex-col items-end">
          <span>
             Raw: {viewMode === 'raw' ? currentMetric.value : stats.totalRaw} {currentMetric.unit}
          </span>
          <span className="text-xs opacity-60">
             (Weight: x{stats.currentWeight})
          </span>
        </div>
      </div>
    </div>
  );
};

export default WallpaperOverlay;