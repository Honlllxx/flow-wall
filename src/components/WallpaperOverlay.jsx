import React, { useEffect, useState, useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer, YAxis, XAxis, Label, ReferenceLine } from 'recharts';

const COLORS = [
  '#60A5FA', '#F87171', '#34D399', '#FBBF24', 
  '#A78BFA', '#F472B6', '#2DD4BF', '#FB923C',
];

const FALLBACK_COLORS = ['#60A5FA', '#F87171', '#34D399', '#FBBF24', '#A78BFA', '#F472B6'];

// ✅【修改 1】名称修改：'7 Days' -> 'Days'
const STANDARD_RANGES = [
  { id: 'raw', label: 'Latest' },
  { id: 'hour', label: 'Today' },
  { id: 'day', label: 'Days' }, // 原 7 Days
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
];

const WallpaperOverlay = () => {
  const [allData, setAllData] = useState([]);
  const [viewMode, setViewMode] = useState('raw'); 
  const [weights, setWeights] = useState({});
  const [displayConfig, setDisplayConfig] = useState({ 
    mode: 'single', combinedMetrics: [], multiMetrics: [], combinedColor: '#60A5FA',
    combinedGoal: 0, showCombinedGoal: true, showIndividualGoals: true, individualGoalModes: [],
    visibleButtons: ['raw', 'hour', 'day'], customRanges: []
  });
  const [metrics, setMetrics] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      setAllData(await window.api.getData());
      setWeights(await window.api.getWeights());
      setDisplayConfig(await window.api.getDisplayConfig());
      setMetrics(await window.api.getMetrics());
    };
    fetchData();

    window.api.onDataUpdate(setAllData);
    window.api.onWeightsUpdate(setWeights);
    window.api.onDisplayConfigUpdate(setDisplayConfig);
    window.api.onMetricsUpdate(setMetrics);
  }, []);

  const { chartData, displayInfo, areas, referenceLines, maxY, activeButtons } = useMemo(() => {
    if (allData.length === 0) return { chartData: [], displayInfo: null, areas: [], referenceLines: [], maxY: 0, activeButtons: [] };

    const getMetricColor = (label, index) => {
      const m = metrics.find(item => item.label === label);
      return m?.color || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
    };

    const getScore = (val, type) => {
      const w = weights[type] !== undefined ? weights[type] : 1;
      return Number((val * w).toFixed(1));
    };

    const combinedColor = displayConfig.combinedColor || '#60A5FA';

    // --- 1. 时间窗口计算 (Fix for Week/Month/Year) ---
    const getStartDate = (mode) => {
      const now = new Date();
      now.setHours(0, 0, 0, 0); 
      
      if (mode === 'hour') return now; 
      
      const d = new Date(now);
      if (mode === 'day') {
          d.setDate(d.getDate() - 6); // Last 7 days
      }
      else if (mode === 'week') {
          // This Week (Start Monday)
          const day = d.getDay() || 7; 
          d.setHours(-24 * (day - 1)); 
      }
      else if (mode === 'month') {
          // This Month (1st)
          d.setDate(1); 
      }
      else if (mode === 'year') {
          // This Year (Jan 1st)
          d.setMonth(0, 1); 
      }
      else if (mode.startsWith('custom_')) {
          const custom = (displayConfig.customRanges || []).find(r => r.id === mode);
          if (custom) d.setDate(d.getDate() - (custom.days - 1));
      }
      return d;
    };

    const startDate = getStartDate(viewMode);
    const isHourly = viewMode === 'hour';
    const isRaw = viewMode === 'raw';
    const isYear = viewMode === 'year';
    
    // --- 2. 确定当前显示的指标 ---
    let activeMetrics = [];
    let combinedSelected = displayConfig.combinedMetrics || [];
    let multiSelected = displayConfig.multiMetrics || [];
    
    if (displayConfig.mode === 'single') {
        const lastEntry = allData[allData.length - 1];
        if (lastEntry) activeMetrics = [lastEntry.type];
    } else if (displayConfig.mode === 'overlay') {
        activeMetrics = [...new Set([...combinedSelected, ...multiSelected])];
    } else if (displayConfig.mode === 'multi') {
        activeMetrics = multiSelected;
    } else {
        activeMetrics = combinedSelected;
    }

    // --- 3. 生成图表区域配置 ---
    let chartAreas = [];
    if (displayConfig.mode === 'single') {
        if (activeMetrics.length > 0) {
            chartAreas.push({ key: 'score', color: getMetricColor(activeMetrics[0], 0), fill: true, gradientId: 'gradFill', strokeWidth: 3 });
        }
    } else {
        if ((displayConfig.mode === 'overlay' || displayConfig.mode === 'combined') && combinedSelected.length > 0) {
            chartAreas.push({ key: 'totalScore', color: combinedColor, fill: true, gradientId: displayConfig.mode === 'overlay' ? 'totalFill' : 'combinedLineFill', strokeWidth: displayConfig.mode === 'overlay' ? 0 : 3 });
        }
        if (displayConfig.mode === 'overlay' || displayConfig.mode === 'multi') {
            multiSelected.forEach((metric, idx) => {
                chartAreas.push({ key: metric, color: getMetricColor(metric, idx), fill: false, gradientId: null, strokeWidth: 3 });
            });
        }
    }

    // --- 4. 数据聚合处理 (Data Engine) ---
    let processedData = [];
    let mainNumber = 0;
    
    // >>> 分支 A: Raw 模式 (流水账)
    if (isRaw) { 
        let rawSourceData = allData;
        if (displayConfig.mode === 'single') {
             const targetType = activeMetrics[0];
             rawSourceData = allData.filter(i => i.type === targetType);
        } else {
             rawSourceData = allData.filter(i => activeMetrics.includes(i.type));
        }
        
        // 取最近 30 条
        const filtered = rawSourceData.slice(-30);
        
        processedData = filtered.map(item => {
            const point = { 
                label: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
            };
            
            // Single Mode
            if (displayConfig.mode === 'single') {
                point.score = getScore(item.value, item.type);
            } 
            // Multi/Combined Mode
            else {
                if (multiSelected.includes(item.type)) point[item.type] = getScore(item.value, item.type);
                
                // ✅ Raw模式下：如果想“流畅显示”，这里不应该强制补0
                // 让 connectNulls 负责连接。
                // 除非你希望看到“掉到底部”，这里可以把未发生的事件设为 0。
                // 根据“逻辑0流畅显示”的要求，这里我们保留补0，以便看到起伏。
                multiSelected.forEach(m => { if (m !== item.type) point[m] = 0; }); 

                if (combinedSelected.includes(item.type)) point.totalScore = getScore(item.value, item.type);
                else if (displayConfig.mode === 'overlay' || displayConfig.mode === 'combined') point.totalScore = 0;
            }
            return point;
        });

        // 计算看板主数字 (Latest Value)
        const last = processedData[processedData.length-1];
        if (displayConfig.mode === 'single') mainNumber = last ? last.score : 0;
        else if (displayConfig.mode === 'combined') mainNumber = last ? (last.totalScore || 0) : 0;
        else mainNumber = last ? (last.totalScore || 0) : 0; // multi default fallback
        
        // Special case for Multi-only mode main number
        if (displayConfig.mode === 'multi') {
             const lastEntry = filtered[filtered.length-1];
             mainNumber = lastEntry ? getScore(lastEntry.value, lastEntry.type) : 0;
        }
    } 
    // >>> 分支 B: 聚合模式 (Hour, Day, Week, Month, Year)
    else { 
        const bucketMap = {};
        const now = new Date();
        
        // ✅ [修复] 初始化时间桶 (确保有X轴刻度)
        if (isHourly) {
            new Array(24).fill(0).forEach((_, i) => bucketMap[i] = {});
        } 
        else if (isYear) {
            // Year view: group by Month (YYYY-MM)
            for(let i=0; i<12; i++) {
                const d = new Date(startDate);
                d.setMonth(i);
                // 只显示到当前月份，或者显示全年
                // 这里显示全年 12 个月
                const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
                bucketMap[key] = {};
            }
        } 
        else {
            // Daily granularity (Day, Week, Month, Custom)
            // 循环每一天，直到今天
            let loopDate = new Date(startDate);
            // 安全限制：防止死循环 (最多366天)
            let safeGuard = 0;
            while (loopDate <= now && safeGuard < 366) {
                const key = loopDate.toISOString().split('T')[0];
                bucketMap[key] = {};
                loopDate.setDate(loopDate.getDate() + 1);
                safeGuard++;
            }
        }

        // ✅ [修复] 填充数据
        allData.filter(i => activeMetrics.includes(i.type) && new Date(i.timestamp) >= startDate).forEach(i => {
             const d = new Date(i.timestamp);
             let key;
             
             if (isHourly) {
                 if (d.toDateString() === now.toDateString()) key = d.getHours(); // 只看今天的小时
                 else return; // 不是今天的数据丢弃
             }
             else if (isYear) {
                 key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
             }
             else {
                 key = i.date; // YYYY-MM-DD
             }

             // 只有当这个 key 在我们初始化的范围内才处理
             if (bucketMap[key]) {
                 const s = getScore(i.value, i.type);
                 
                 if (displayConfig.mode === 'single') {
                     bucketMap[key].score = (bucketMap[key].score || 0) + s;
                 } else {
                     if (multiSelected.includes(i.type)) bucketMap[key][i.type] = (bucketMap[key][i.type] || 0) + s;
                     if (combinedSelected.includes(i.type)) bucketMap[key].totalScore = (bucketMap[key].totalScore || 0) + s;
                 }
             }
        });

        // ✅ [修复] 扁平化与补 0
        const currentHour = now.getHours();
        processedData = Object.entries(bucketMap).map(([k, vals]) => {
            if (isHourly && parseInt(k) > currentHour) return null; // 未来的小时不显示
            
            // 补 0 逻辑：确保聚合模式下，没有数据的点是 0
            if (displayConfig.mode === 'single') {
                if (vals.score === undefined) vals.score = 0;
            } else {
                if (displayConfig.mode === 'multi' || displayConfig.mode === 'overlay') 
                    multiSelected.forEach(metric => { if (vals[metric] === undefined) vals[metric] = 0; });
                if (displayConfig.mode === 'combined' || displayConfig.mode === 'overlay') 
                    if (vals.totalScore === undefined) vals.totalScore = 0;
            }

            // 生成 Label
            let label = k;
            if (isHourly) label = `${k}:00`;
            else if (isYear) {
                const [y, m] = k.split('-');
                const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                label = monthNames[parseInt(m)-1];
            } else {
                // Day/Week/Month: Show MM-DD
                label = k.slice(5); 
            }

            return { label, ...vals };
        }).filter(Boolean);

        // 计算区间总和
        let totalSum = 0;
        processedData.forEach(p => { 
            if (displayConfig.mode === 'single') totalSum += p.score;
            else if (displayConfig.mode === 'combined' || displayConfig.mode === 'overlay') totalSum += (p.totalScore || 0);
            else if (displayConfig.mode === 'multi') multiSelected.forEach(m => totalSum += (p[m] || 0));
        });
        mainNumber = Math.round(totalSum);
    }

    // --- Titles ---
    let title = "";
    let subTitle = "";
    let rangeText = viewMode.toUpperCase().replace('CUSTOM_', '');
    if(viewMode === 'day') rangeText = '7 DAYS';
    
    if (displayConfig.mode === 'single') {
        const targetType = activeMetrics[0] || 'NONE';
        title = `${targetType} · ${rangeText}`;
        subTitle = `Total: ${mainNumber}`;
    } else {
        title = displayConfig.mode === 'overlay' ? `COMBINED · ${rangeText}` : (displayConfig.mode === 'multi' ? `MULTI · ${rangeText}` : `SUM · ${rangeText}`);
        subTitle = `Period Total: ${mainNumber}`;
    }

    // --- Goal Lines Logic ---
    let refLines = [];
    // 目标线只在 'raw' 或 'hour' (Daily view) 下显示才有意义
    if (isHourly || isRaw) {
        const showTotal = (displayConfig.mode === 'combined' || displayConfig.mode === 'overlay') && displayConfig.showCombinedGoal !== false && displayConfig.combinedGoal > 0;
        if (showTotal) {
          refLines.push({ value: displayConfig.combinedGoal, color: '#FFFFFF', label: 'GOAL', opacity: 0.9, width: 2 });
        }

        const showIndivGlobal = displayConfig.showIndividualGoals !== false;
        const allowedModes = displayConfig.individualGoalModes || ['single', 'multi', 'overlay'];
        const isModeAllowed = allowedModes.includes(displayConfig.mode);

        if (showIndivGlobal && isModeAllowed) {
            let goalMetrics = [];
            if (displayConfig.mode === 'single') goalMetrics = activeMetrics;
            else if (displayConfig.mode === 'multi' || displayConfig.mode === 'overlay') goalMetrics = multiSelected;
            
            goalMetrics.forEach(mName => {
                const mDef = metrics.find(m => m.label === mName);
                if (mDef && mDef.target > 0 && mDef.showGoal !== false) {
                    const goalVal = getScore(Number(mDef.target), mName);
                    if (goalVal > 0) refLines.push({ value: goalVal, color: mDef.color || '#FFF', label: mName.toUpperCase(), opacity: 0.6, width: 1 });
                }
            });
        }
    }

    // Max Y
    const currentMaxData = Math.max(
        ...processedData.map(d => {
            const vals = Object.values(d).filter(v => typeof v === 'number');
            return Math.max(...vals, 0);
        }), 0
    );
    const maxGoal = refLines.length > 0 ? Math.max(...refLines.map(l => l.value)) : 0;
    const finalMaxY = Math.max(currentMaxData, maxGoal) * 1.15;

    // ✅ Generate Buttons
    const buttons = (displayConfig.visibleButtons || ['raw', 'hour', 'day']).map(id => {
        return STANDARD_RANGES.find(r => r.id === id);
    }).filter(Boolean);
    (displayConfig.customRanges || []).forEach(r => {
        buttons.push({ id: r.id, label: r.label });
    });

    return { 
        chartData: processedData, 
        displayInfo: { title, subTitle, mainNumber }, 
        areas: chartAreas, 
        referenceLines: refLines, 
        maxY: finalMaxY,
        activeButtons: buttons 
    };
  }, [allData, viewMode, weights, displayConfig, metrics]);

  if (!displayInfo) return null;

  return (
    <div className="w-screen h-screen overflow-hidden relative pointer-events-none">
      
      <div 
        className="absolute bottom-[42vh] right-16 flex gap-2 z-10 pointer-events-auto flex-wrap justify-end max-w-[600px]"
        onMouseEnter={() => window.api.setIgnoreMouseEvents(false)}
        onMouseLeave={() => window.api.setIgnoreMouseEvents(true, { forward: true })}
      >
        {activeButtons.map(btn => (
          <button
            key={btn.id}
            onClick={() => setViewMode(btn.id)}
            className={`
              px-3 py-1 text-xs uppercase tracking-widest rounded-full border transition-all cursor-pointer mb-1 ml-1
              ${viewMode === btn.id 
                ? 'bg-white text-black border-white font-bold' 
                : 'bg-black/20 text-white/40 border-white/10 hover:bg-white/10 hover:text-white'}
            `}
          >
            {btn.label}
          </button>
        ))}
      </div>

      <div className="absolute bottom-0 left-0 w-full h-[40vh] opacity-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="gradFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#fff" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="#fff" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="totalFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={areas.combinedColor || '#3B82F6'} stopOpacity={0.3}/> 
                <stop offset="95%" stopColor={areas.combinedColor || '#3B82F6'} stopOpacity={0.05}/>
              </linearGradient>
              <linearGradient id="combinedLineFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={areas.combinedColor || '#60A5FA'} stopOpacity={0.2}/> 
                <stop offset="95%" stopColor={areas.combinedColor || '#60A5FA'} stopOpacity={0}/>
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} dy={10} />
            <YAxis domain={[0, maxY || 100]} orientation="right" tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} tickFormatter={(val) => Math.round(val)} width={40}>
              <Label value="PTS" offset={10} position="insideTopRight" style={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 'bold' }} />
            </YAxis>
            
            {areas.map((area) => (
                <Area 
                  key={area.key}
                  // ✅【核心】确保所有模式下线条连贯，空值为0会自动连到0
                  connectNulls={true}
                  type="monotone" 
                  dataKey={area.key} 
                  stroke={area.strokeWidth === 0 ? "transparent" : area.color}
                  strokeWidth={area.strokeWidth}
                  fill={area.fill ? `url(#${area.gradientId})` : "none"} 
                  filter={area.fill ? "" : "url(#glow)"} 
                  animationDuration={1000}
                />
            ))}

            {referenceLines.map((line, index) => (
              <ReferenceLine 
                key={index}
                y={line.value} 
                stroke={line.color} 
                strokeOpacity={line.opacity || 0.8}
                strokeDasharray="4 4" 
                strokeWidth={line.width || 1.5}
                label={{ 
                  value: line.label, 
                  position: 'insideBottomRight', 
                  fill: line.color, 
                  fontSize: 9,
                  fontWeight: 'bold',
                  dy: -5
                }} 
              />
            ))}

          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 看板 (保持原样) */}
      <div className="absolute top-16 right-16 text-slate-200 text-right select-none transition-all">
        <p className="text-xs font-bold tracking-[0.3em] opacity-40 uppercase mb-[-5px] text-blue-200">
          {displayInfo.title}
        </p>
        <h1 className="text-7xl font-thin tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
          {displayInfo.mainNumber}
          <span className="text-xl ml-3 font-normal opacity-80 text-yellow-400/80">PTS</span>
        </h1>
        <div className="text-sm opacity-50 mt-2 font-mono flex flex-col items-end">
          <span>{displayInfo.subTitle}</span>
          {(displayConfig.mode === 'multi' || displayConfig.mode === 'overlay') && (
              <div className="flex gap-2 mt-2">
                  {(displayConfig.multiMetrics || []).map((mName) => {
                      const mDef = metrics ? metrics.find(i => i.label === mName) : null;
                      const color = mDef?.color || FALLBACK_COLORS[0];
                      return <span key={mName} style={{color: color}} className="text-[10px] font-bold">● {mName}</span>;
                  })}
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WallpaperOverlay;