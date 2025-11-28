import React, { useEffect, useState, useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer, YAxis, XAxis, Label, ReferenceLine } from 'recharts';

const COLORS = [
  '#60A5FA', '#F87171', '#34D399', '#FBBF24', 
  '#A78BFA', '#F472B6', '#2DD4BF', '#FB923C',
];

const FALLBACK_COLORS = ['#60A5FA', '#F87171', '#34D399', '#FBBF24', '#A78BFA', '#F472B6'];

const STANDARD_RANGES = [
  { id: 'raw', label: 'Latest', grouping: 'raw' },
  { id: 'hour', label: 'Today', grouping: 'hour' },
  { id: 'day', label: 'Days', grouping: 'day' },
  { id: 'week', label: '12 Weeks', grouping: 'week' },
  { id: 'month', label: '12 Months', grouping: 'month' },
  { id: 'year', label: 'Year', grouping: 'month' },
];

// 辅助：获取本地日期字符串 YYYY-MM-DD
const getLocalDayKey = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 辅助：获取本地月份字符串 YYYY-MM
const getLocalMonthKey = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

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

    // --- 1. 时间窗口计算 ---
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let startDate = new Date(todayStart);
    let grouping = 'day'; 
    let rangeLabel = 'CUSTOM';

    const stdRange = STANDARD_RANGES.find(r => r.id === viewMode);
    const customRange = (displayConfig.customRanges || []).find(r => r.id === viewMode);

    if (stdRange) {
        rangeLabel = stdRange.label;
        grouping = stdRange.grouping;
        if (viewMode === 'day') startDate.setDate(startDate.getDate() - 6);
        else if (viewMode === 'week') startDate.setDate(startDate.getDate() - (7 * 11)); 
        else if (viewMode === 'month' || viewMode === 'year') {
            startDate.setMonth(startDate.getMonth() - 11); 
            startDate.setDate(1); 
        }
    } else if (customRange) {
        rangeLabel = customRange.label;
        grouping = customRange.grouping || 'day';
        // 计算起始日期：今天 - (总天数 - 1)
        startDate.setDate(startDate.getDate() - (customRange.days - 1));
    }

    const isHourly = grouping === 'hour';
    const isRaw = grouping === 'raw';
    const isYear = viewMode === 'year';
    
    // --- 2. 确定激活指标 ---
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

    // --- 3. 生成图表区域 ---
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

    // --- 4. 数据处理 ---
    let processedData = [];
    let mainNumber = 0;
    
    if (isRaw) { 
        // ... (Raw 逻辑保持不变)
        let rawSourceData = allData;
        if (displayConfig.mode === 'single') {
             const targetType = activeMetrics[0];
             rawSourceData = allData.filter(i => i.type === targetType);
        } else {
             rawSourceData = allData.filter(i => activeMetrics.includes(i.type));
        }
        
        const filtered = rawSourceData.slice(-30);
        processedData = filtered.map(item => {
            const point = { 
                label: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
            };
            if (displayConfig.mode === 'single') {
                point.score = getScore(item.value, item.type);
            } else {
                if (multiSelected.includes(item.type)) point[item.type] = getScore(item.value, item.type);
                multiSelected.forEach(m => { if (m !== item.type) point[m] = 0; }); 
                if (combinedSelected.includes(item.type)) point.totalScore = getScore(item.value, item.type);
                else if (displayConfig.mode === 'overlay' || displayConfig.mode === 'combined') point.totalScore = 0;
            }
            return point;
        });

        const last = processedData[processedData.length-1];
        if (displayConfig.mode === 'single') mainNumber = last ? last.score : 0;
        else if (displayConfig.mode === 'combined') mainNumber = last ? (last.totalScore || 0) : 0;
        else mainNumber = last ? (last.totalScore || 0) : 0;
        
        if (displayConfig.mode === 'multi' && filtered.length > 0) {
             const lastEntry = filtered[filtered.length-1];
             mainNumber = getScore(lastEntry.value, lastEntry.type);
        }
    } 
    else { 
        // 聚合模式
        const bucketMap = {};
        
        // --- Key Generation ---
        const getKey = (d) => {
            if (grouping === 'hour') return (getLocalDayKey(d) === getLocalDayKey(now)) ? d.getHours() : null;
            if (grouping === 'day') return getLocalDayKey(d);
            if (grouping === 'week') {
                const onejan = new Date(d.getFullYear(), 0, 1);
                const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
                return `${d.getFullYear()}-W${week}`;
            }
            if (grouping === 'month') return getLocalMonthKey(d);
            if (typeof grouping === 'number') {
                // 计算当前日期距离起始日期的天数差
                // 为了避免时区问题，我们只比较日期部分
                const startMidnight = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
                const currentMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                const diffTime = currentMidnight.getTime() - startMidnight.getTime();
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
                
                if (diffDays < 0) return null;
                return Math.floor(diffDays / grouping); // 返回 0, 1, 2... 作为块索引
            }
            return null;
        };

        // --- Init Buckets ---
        if (grouping === 'hour') {
            new Array(24).fill(0).forEach((_, i) => bucketMap[i] = {});
        } else {
            let loopDate = new Date(startDate);
            let safety = 0;
            // 循环生成每一天，直到今天
            while (loopDate <= now && safety < 1000) {
                const key = getKey(loopDate);
                if (key !== null) bucketMap[key] = {}; // 确保键存在
                loopDate.setDate(loopDate.getDate() + 1);
                safety++;
            }
        }

        // --- Fill Data ---
        allData.filter(i => activeMetrics.includes(i.type) && new Date(i.timestamp) >= startDate).forEach(i => {
             const d = new Date(i.timestamp);
             const key = getKey(d);
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

        // --- Flatten & Label Generation ---
        const currentHour = now.getHours();
        processedData = Object.entries(bucketMap).map(([k, vals]) => {
            if (grouping === 'hour' && parseInt(k) > currentHour) return null;
            
            // 补 0
            if (displayConfig.mode === 'single') {
                if (vals.score === undefined) vals.score = 0;
            } else {
                if (displayConfig.mode === 'multi' || displayConfig.mode === 'overlay') 
                    multiSelected.forEach(metric => { if (vals[metric] === undefined) vals[metric] = 0; });
                if (displayConfig.mode === 'combined' || displayConfig.mode === 'overlay') 
                    if (vals.totalScore === undefined) vals.totalScore = 0;
            }

            // ✅ 【核心修复】Label Generation
            let label = k;
            if (grouping === 'hour') label = `${k}:00`;
            else if (grouping === 'day') label = k.slice(5); // MM-DD
            else if (grouping === 'month') {
                const m = parseInt(k.split('-')[1]);
                label = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m-1] || k;
            } 
            else if (typeof grouping === 'number') {
                // 自定义分组：根据块索引 k (0, 1, 2...) 反推日期
                const blockIndex = parseInt(k);
                // 计算该块的起始日期 = startDate + (blockIndex * grouping) days
                const blockDate = new Date(startDate);
                blockDate.setDate(blockDate.getDate() + (blockIndex * grouping));
                
                // 格式化为 MM-DD
                const mStr = String(blockDate.getMonth() + 1).padStart(2, '0');
                const dStr = String(blockDate.getDate()).padStart(2, '0');
                label = `${mStr}-${dStr}`;
            }

            return { label, ...vals };
        }).filter(Boolean);

        let totalSum = 0;
        processedData.forEach(p => { 
            if (displayConfig.mode === 'single') totalSum += p.score;
            else if (displayConfig.mode === 'combined' || displayConfig.mode === 'overlay') totalSum += (p.totalScore || 0);
            else if (displayConfig.mode === 'multi') multiSelected.forEach(m => totalSum += (p[m] || 0));
        });
        mainNumber = Math.round(totalSum);
    }

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

    // --- Goal Lines (Calculate with Multiplier) ---
    // ✅ 目标值根据分组倍率自动调整
    let goalMultiplier = 1;
    if (grouping === 'week') goalMultiplier = 7;
    else if (grouping === 'month') goalMultiplier = 30; 
    else if (typeof grouping === 'number') goalMultiplier = grouping; // 自定义天数倍率

    let refLines = [];
    
    // 只要有数据且不是 Raw 模式，就显示聚合后的目标线
    // 或者在 Raw / Hour 模式下显示日目标
    const shouldShowGoal = true; // 既然已经做了倍率计算，任何模式都可以显示目标线

    if (shouldShowGoal) {
        // Total Goal
        const showTotal = (displayConfig.mode === 'combined' || displayConfig.mode === 'overlay') && displayConfig.showCombinedGoal !== false && displayConfig.combinedGoal > 0;
        if (showTotal) {
          refLines.push({ value: displayConfig.combinedGoal * goalMultiplier, color: '#FFFFFF', label: 'GOAL', opacity: 0.9, width: 2 });
        }

        // Individual Goals
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
                    const baseScore = getScore(Number(mDef.target), mName);
                    const finalTarget = baseScore * goalMultiplier;
                    if (finalTarget > 0) {
                        refLines.push({ value: finalTarget, color: mDef.color || '#FFF', label: mName.toUpperCase(), opacity: 0.6, width: 1 });
                    }
                }
            });
        }
    }

    const currentMaxData = Math.max(
        ...processedData.map(d => {
            const vals = Object.values(d).filter(v => typeof v === 'number');
            return Math.max(...vals, 0);
        }), 0
    );
    const maxGoal = refLines.length > 0 ? Math.max(...refLines.map(l => l.value)) : 0;
    const finalMaxY = Math.max(currentMaxData, maxGoal) * 1.15;

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
      
      <div className="absolute bottom-[42vh] right-16 flex gap-2 z-10 pointer-events-auto flex-wrap justify-end max-w-[600px]" onMouseEnter={() => window.api.setIgnoreMouseEvents(false)} onMouseLeave={() => window.api.setIgnoreMouseEvents(true, { forward: true })}>
        {activeButtons.map(btn => (
          <button key={btn.id} onClick={() => setViewMode(btn.id)} className={`px-3 py-1 text-xs uppercase tracking-widest rounded-full border transition-all cursor-pointer mb-1 ml-1 ${viewMode === btn.id ? 'bg-white text-black border-white font-bold' : 'bg-black/20 text-white/40 border-white/10 hover:bg-white/10 hover:text-white'}`}>{btn.label}</button>
        ))}
      </div>

      <div className="absolute bottom-0 left-0 w-full h-[40vh] opacity-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="gradFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#fff" stopOpacity={0.15}/><stop offset="95%" stopColor="#fff" stopOpacity={0}/></linearGradient>
              <linearGradient id="totalFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={areas.combinedColor || '#3B82F6'} stopOpacity={0.3}/><stop offset="95%" stopColor={areas.combinedColor || '#3B82F6'} stopOpacity={0.05}/></linearGradient>
              <linearGradient id="combinedLineFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={areas.combinedColor || '#60A5FA'} stopOpacity={0.2}/><stop offset="95%" stopColor={areas.combinedColor || '#60A5FA'} stopOpacity={0}/></linearGradient>
              <filter id="glow"><feGaussianBlur stdDeviation="2" result="coloredBlur" /><feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} dy={10} />
            <YAxis domain={[0, maxY || 100]} orientation="right" tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} tickFormatter={(val) => Math.round(val)} width={40}>
              <Label value="PTS" offset={10} position="insideTopRight" style={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 'bold' }} />
            </YAxis>
            {areas.map((area) => (
                <Area key={area.key} connectNulls={true} type="monotone" dataKey={area.key} stroke={area.strokeWidth === 0 ? "transparent" : area.color} strokeWidth={area.strokeWidth} fill={area.fill ? `url(#${area.gradientId})` : "none"} filter={area.fill ? "" : "url(#glow)"} animationDuration={1000} />
            ))}
            {referenceLines.map((line, index) => (
              <ReferenceLine key={index} y={line.value} stroke={line.color} strokeOpacity={line.opacity || 0.8} strokeDasharray="4 4" strokeWidth={line.width || 1.5} label={{ value: line.label, position: 'insideBottomRight', fill: line.color, fontSize: 9, fontWeight: 'bold', dy: -5 }} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="absolute top-16 right-16 text-slate-200 text-right select-none transition-all">
        <p className="text-xs font-bold tracking-[0.3em] opacity-40 uppercase mb-[-5px] text-blue-200">{displayInfo.title}</p>
        <h1 className="text-7xl font-thin tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">{displayInfo.mainNumber}<span className="text-xl ml-3 font-normal opacity-80 text-yellow-400/80">PTS</span></h1>
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