import React, { useEffect, useState, useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer, YAxis, XAxis, Label, ReferenceLine } from 'recharts';

const COLORS = [
  '#60A5FA', '#F87171', '#34D399', '#FBBF24', 
  '#A78BFA', '#F472B6', '#2DD4BF', '#FB923C',
];

const FALLBACK_COLORS = ['#60A5FA', '#F87171', '#34D399', '#FBBF24', '#A78BFA', '#F472B6'];

const WallpaperOverlay = () => {
  const [allData, setAllData] = useState([]);
  const [viewMode, setViewMode] = useState('raw');
  const [weights, setWeights] = useState({});
  const [displayConfig, setDisplayConfig] = useState({ 
    mode: 'single', combinedMetrics: [], multiMetrics: [], combinedColor: '#60A5FA',
    combinedGoal: 0, showCombinedGoal: true, showIndividualGoals: true, individualGoalModes: ['single', 'multi', 'overlay']
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

  const { chartData, displayInfo, areas, referenceLines, maxY } = useMemo(() => {
    if (allData.length === 0) return { chartData: [], displayInfo: null, areas: [], referenceLines: [], maxY: 0 };

    const getMetricColor = (label, index) => {
      const m = metrics.find(item => item.label === label);
      return m?.color || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
    };

    const getScore = (val, type) => {
      const w = weights[type] !== undefined ? weights[type] : 1;
      return Number((val * w).toFixed(1));
    };

    const combinedColor = displayConfig.combinedColor || '#60A5FA';

    let processedData = [];
    let title = "";
    let subTitle = "";
    let mainNumber = 0;
    let chartAreas = [];
    let currentMaxData = 0;
    let refLines = [];

    // ==========================================
    // 1. 统一处理目标线 (Goal Lines)
    // ==========================================
    
    // A. Total Goal Line
    const showTotal = (displayConfig.mode === 'combined' || displayConfig.mode === 'overlay') && displayConfig.showCombinedGoal !== false && displayConfig.combinedGoal > 0;
    if (showTotal) {
      refLines.push({ value: displayConfig.combinedGoal, color: '#FFFFFF', label: 'TOTAL GOAL', opacity: 0.9, width: 2 });
    }

    // B. Individual Goal Lines
    // 检查全局开关 和 模式过滤
    const showIndivGlobal = displayConfig.showIndividualGoals !== false;
    const allowedModes = displayConfig.individualGoalModes || ['single', 'multi', 'overlay'];
    const isModeAllowed = allowedModes.includes(displayConfig.mode);

    if (showIndivGlobal && isModeAllowed) {
        // 确定哪些指标是“当前可见”的
        let visibleMetrics = [];
        if (displayConfig.mode === 'single') {
            const lastEntry = allData[allData.length - 1];
            if (lastEntry) visibleMetrics = [lastEntry.type];
        } else if (displayConfig.mode === 'multi') {
            visibleMetrics = displayConfig.multiMetrics || [];
        } else if (displayConfig.mode === 'overlay') {
            // 在 Overlay 模式下，通常只显示 Multi 列表里的独立线，或者全部
            visibleMetrics = [...new Set([...(displayConfig.multiMetrics || []), ...(displayConfig.combinedMetrics || [])])];
        } else if (displayConfig.mode === 'combined') {
            // Combined 模式下通常只看总分，但用户如果在配置里开启了 'combined' 模式显示独立线，则显示
            visibleMetrics = displayConfig.combinedMetrics || [];
        }

        // 遍历可见指标，添加目标线
        visibleMetrics.forEach(mName => {
            const mDef = metrics.find(m => m.label === mName);
            if (mDef && mDef.target > 0 && mDef.showGoal !== false) {
                const goalVal = getScore(Number(mDef.target), mName);
                if (goalVal > 0) {
                    refLines.push({ 
                        value: goalVal, 
                        color: mDef.color || '#FFF', 
                        label: `${mName.toUpperCase()}`, 
                        opacity: 0.6, 
                        width: 1 
                    });
                }
            }
        });
    }


    // ==========================================
    // 2. 模式处理逻辑
    // ==========================================

    if (displayConfig.mode === 'single') {
      const lastEntry = allData[allData.length - 1];
      const targetType = lastEntry.type;
      title = `${targetType} · ${viewMode.toUpperCase()}`;
      
      const singleColor = getMetricColor(targetType, 0);
      chartAreas.push({ key: 'score', color: singleColor, fill: true, gradientId: 'gradFill', strokeWidth: 3 });

      if (viewMode === 'raw') {
        const typeData = allData.filter(i => i.type === targetType).slice(-20);
        processedData = typeData.map(item => ({
          score: getScore(item.value, item.type),
          label: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));
        mainNumber = getScore(lastEntry.value, targetType);
        subTitle = `Raw: ${lastEntry.value} ${lastEntry.unit}`;
      } 
      else { 
        const bucketMap = {};
        const isHour = viewMode === 'hour';
        if (isHour) new Array(24).fill(0).forEach((_, i) => bucketMap[i] = 0);
        else for(let i=6; i>=0; i--) { const d = new Date(); d.setDate(d.getDate()-i); bucketMap[d.toISOString().split('T')[0]] = 0; }
        
        allData.filter(i => i.type === targetType).forEach(i => {
             const key = isHour ? new Date(i.timestamp).getHours() : i.date;
             const isToday = new Date(i.timestamp).toDateString() === new Date().toDateString();
             if (bucketMap[key] !== undefined && (viewMode === 'day' || isToday)) bucketMap[key] += i.value;
        });
        const currentHour = new Date().getHours();
        processedData = Object.entries(bucketMap).map(([k, v]) => {
            if (isHour && parseInt(k) > currentHour) return null;
            return { score: getScore(v, targetType), label: isHour ? `${k}:00` : k.slice(5) };
        }).filter(Boolean);
        const totalRaw = processedData.reduce((acc, c) => acc + (c.score / (weights[targetType] || 1)), 0);
        mainNumber = getScore(totalRaw, targetType);
        subTitle = `Total: ${Math.round(totalRaw)} ${lastEntry.unit}`;
      }

      currentMaxData = Math.max(...processedData.map(d => d.score), 0);
    } 
    else {
      const isMulti = displayConfig.mode === 'multi';
      const isOverlay = displayConfig.mode === 'overlay';
      const isCombined = displayConfig.mode === 'combined';

      title = isOverlay ? "COMBINED + MULTI" : (isMulti ? "MULTI VIEW" : "COMBINED SUM");
      
      const combinedSelected = displayConfig.combinedMetrics || [];
      const multiSelected = displayConfig.multiMetrics || [];
      let activeMetrics = [];
      if (isOverlay) activeMetrics = [...new Set([...combinedSelected, ...multiSelected])];
      else if (isMulti) activeMetrics = multiSelected;
      else activeMetrics = combinedSelected;

      if (isOverlay || isCombined) {
          if (combinedSelected.length > 0) {
            chartAreas.push({ key: 'totalScore', color: combinedColor, fill: true, gradientId: isOverlay ? 'totalFill' : 'combinedLineFill', strokeWidth: isOverlay ? 0 : 3 });
          }
      }
      if (isOverlay || isMulti) {
          multiSelected.forEach((metric, idx) => {
              chartAreas.push({ key: metric, color: getMetricColor(metric, idx), fill: false, gradientId: null, strokeWidth: 3 });
          });
      }

      const bucketMap = {};
      const isHour = viewMode === 'hour';
      const isRaw = viewMode === 'raw';
      
      if (isRaw) {
          const filtered = allData.filter(i => activeMetrics.includes(i.type)).slice(-30);
          processedData = filtered.map((item) => {
              const point = { label: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
              if (multiSelected.includes(item.type)) point[item.type] = getScore(item.value, item.type);
              multiSelected.forEach(m => { if (m !== item.type) point[m] = 0; });
              if (combinedSelected.includes(item.type)) point.totalScore = getScore(item.value, item.type);
              else if (isOverlay || isCombined) point.totalScore = 0;
              return point;
          });
          const last = processedData[processedData.length-1];
          mainNumber = last ? (last.totalScore || 0) : 0;
          if (isMulti && !isOverlay) {
             const lastEntry = filtered[filtered.length-1];
             mainNumber = lastEntry ? getScore(lastEntry.value, lastEntry.type) : 0;
          }
          subTitle = "Recent Flow";
      } 
      else {
          if (isHour) new Array(24).fill(0).forEach((_, i) => bucketMap[i] = {});
          else for(let i=6; i>=0; i--) { const d = new Date(); d.setDate(d.getDate()-i); bucketMap[d.toISOString().split('T')[0]] = {}; }
          allData.filter(i => activeMetrics.includes(i.type)).forEach(i => {
               const key = isHour ? new Date(i.timestamp).getHours() : i.date;
               const isToday = new Date(i.timestamp).toDateString() === new Date().toDateString();
               if (bucketMap[key] && (viewMode === 'day' || isToday)) {
                   const s = getScore(i.value, i.type);
                   if (multiSelected.includes(i.type)) bucketMap[key][i.type] = (bucketMap[key][i.type] || 0) + s;
                   if (combinedSelected.includes(i.type)) bucketMap[key].totalScore = (bucketMap[key].totalScore || 0) + s;
               }
          });
          const currentHour = new Date().getHours();
          processedData = Object.entries(bucketMap).map(([k, vals]) => {
              if (isHour && parseInt(k) > currentHour) return null;
              if (isMulti || isOverlay) multiSelected.forEach(metric => { if (vals[metric] === undefined) vals[metric] = 0; });
              if (isCombined || isOverlay) if (vals.totalScore === undefined) vals.totalScore = 0;
              return { label: isHour ? `${k}:00` : k.slice(5), ...vals };
          }).filter(Boolean);
          let totalSum = 0;
          processedData.forEach(p => { totalSum += (p.totalScore || 0); });
          if (isMulti && !isOverlay) {
              totalSum = 0;
              processedData.forEach(p => { multiSelected.forEach(m => totalSum += (p[m] || 0)); });
          }
          mainNumber = Math.round(totalSum);
          subTitle = `Total: ${viewMode === 'hour' ? 'Today' : '7 Days'}`;
      }
      
      const maxVal = Math.max(
          ...processedData.map(d => d.totalScore || 0),
          ...processedData.map(d => {
              const vals = Object.values(d).filter(v => typeof v === 'number');
              return Math.max(...vals, 0);
          })
      );
      currentMaxData = maxVal;
    }

    // ✅ 动态计算 Y 轴最大值：考虑所有参考线的高度
    const maxGoal = refLines.length > 0 ? Math.max(...refLines.map(l => l.value)) : 0;
    const finalMaxY = Math.max(currentMaxData, maxGoal) * 1.15;

    return { 
      chartData: processedData, 
      displayInfo: { title, subTitle, mainNumber }, 
      areas: chartAreas, 
      metricDefs: metrics,
      combinedColor: displayConfig.combinedColor,
      referenceLines: refLines,
      maxY: finalMaxY 
    };
  }, [allData, viewMode, weights, displayConfig, metrics]);

  if (!displayInfo) return null;

  return (
    <div className="w-screen h-screen overflow-hidden relative pointer-events-none">
      <div className="absolute bottom-[42vh] right-16 flex gap-2 z-10 pointer-events-auto" onMouseEnter={() => window.api.setIgnoreMouseEvents(false)} onMouseLeave={() => window.api.setIgnoreMouseEvents(true, { forward: true })}>
        {['raw', 'hour', 'day'].map(mode => (
          <button key={mode} onClick={() => setViewMode(mode)} className={`px-3 py-1 text-xs uppercase tracking-widest rounded-full border transition-all cursor-pointer ${viewMode === mode ? 'bg-white text-black border-white font-bold' : 'bg-black/20 text-white/40 border-white/10 hover:bg-white/10 hover:text-white'}`}>
            {mode === 'raw' ? 'Latest' : mode}
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

            {/* ✅ 渲染所有目标线 */}
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