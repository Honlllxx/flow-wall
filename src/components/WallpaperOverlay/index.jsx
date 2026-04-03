import React from 'react';
import { AreaChart, Area, ResponsiveContainer, YAxis, XAxis, Label, ReferenceLine } from 'recharts';
import { useWallpaperData } from './useWallpaperData';
import { useChartProcessor } from './useChartProcessor';

const WallpaperOverlay = () => {
  const { 
    allData, viewMode, setViewMode, weights, displayConfig, metrics 
  } = useWallpaperData();

  const { 
    chartData, displayInfo, areas, referenceLines, maxY, activeButtons 
  } = useChartProcessor({ 
    allData, viewMode, weights, displayConfig, metrics 
  });

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

      {/* Dashboard */}
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
                  {areas
                    .filter(a => !a.isTotal)
                    .map(a => (
                      <span key={a.key} style={{color: a.color}} className="text-[10px] font-bold">
                          ● {a.key}
                      </span>
                  ))}
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WallpaperOverlay;