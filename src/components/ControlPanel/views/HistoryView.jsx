import React, { useState, useMemo } from 'react';
import { Search, Filter, X, Trash2, Hash, BarChart2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const HistoryView = ({ data, actions }) => {
  const { allData, metrics } = data;
  const [mode, setMode] = useState('list'); // list, calendar, analysis
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [searchType, setSearchType] = useState('all');
  const [searchStartDate, setSearchStartDate] = useState('');
  const [searchEndDate, setSearchEndDate] = useState('');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);

  // --- 筛选逻辑 ---
  const filteredHistory = useMemo(() => {
    let res = allData;
    if (mode === 'calendar' && selectedCalendarDate) {
        res = res.filter(item => item.date === selectedCalendarDate);
    } else {
        if (searchKeyword) res = res.filter(item => item.type.toLowerCase().includes(searchKeyword.toLowerCase()));
        if (searchType !== 'all') res = res.filter(item => item.type === searchType);
        if (searchStartDate) res = res.filter(item => item.date >= searchStartDate);
        if (searchEndDate) res = res.filter(item => item.date <= searchEndDate);
    }
    return res;
  }, [allData, searchKeyword, searchType, searchStartDate, searchEndDate, mode, selectedCalendarDate]);

  // --- 分析数据 ---
  const analyticsData = useMemo(() => {
    const typeCounts = {};
    const typeSums = {};
    // 分析基于当前筛选结果，如果没筛选则分析全部
    const source = filteredHistory.length > 0 ? filteredHistory : allData;

    source.forEach(item => {
        typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
        typeSums[item.type] = (typeSums[item.type] || 0) + item.value;
    });

    const chartData = Object.keys(typeSums).map(key => ({
        name: key, total: typeSums[key], count: typeCounts[key]
    })).sort((a, b) => b.total - a.total);

    const maxCount = Math.max(...Object.values(typeCounts), 1);
    const tagCloud = Object.keys(typeCounts).map(key => ({
        name: key, count: typeCounts[key], weight: 1 + (typeCounts[key] / maxCount) * 1.5 
    }));

    return { chartData, tagCloud };
  }, [filteredHistory, allData]);

  // --- 日历组件 ---
  const CalendarWidget = () => {
    const now = new Date();
    const [currentMonth, setCurrentMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const startDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay(); 
    const days = [];
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    const changeMonth = (delta) => {
        const newDate = new Date(currentMonth); newDate.setMonth(newDate.getMonth() + delta); setCurrentMonth(newDate);
    };

    return (
        <div className="p-2">
            <div className="flex justify-between items-center mb-4 px-2">
                <button onClick={() => changeMonth(-1)} className="text-white/50 hover:text-white">&lt;</button>
                <span className="text-sm font-bold tracking-widest">{currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                <button onClick={() => changeMonth(1)} className="text-white/50 hover:text-white">&gt;</button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center mb-2 text-[10px] text-white/30 uppercase">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-2">
                {days.map((day, idx) => {
                    if (!day) return <div key={idx} />;
                    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const hasData = allData.some(d => d.date === dateStr);
                    const isSelected = selectedCalendarDate === dateStr;
                    const isToday = dateStr === new Date().toISOString().split('T')[0];
                    return (
                        <button key={idx} onClick={() => { setSelectedCalendarDate(isSelected ? null : dateStr); setSearchStartDate(''); setSearchEndDate(''); }} className={`h-8 rounded-lg flex items-center justify-center text-xs relative transition-all ${isSelected ? 'bg-blue-600 text-white scale-110 shadow-lg' : 'hover:bg-white/10 text-white/70'} ${isToday && !isSelected ? 'border border-blue-500/50' : ''}`}>
                            {day}
                            {hasData && <div className={`absolute bottom-1 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-500'}`}></div>}
                        </button>
                    )
                })}
            </div>
        </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col w-full animate-fade-in pt-8 min-h-0">
      <div className="flex justify-center gap-4 mb-4">
         <button onClick={() => setMode('list')} className={`text-xs uppercase tracking-widest pb-1 border-b-2 transition-colors ${mode === 'list' ? 'border-blue-500 text-white' : 'border-transparent text-white/40 hover:text-white'}`}>Timeline</button>
         <button onClick={() => setMode('calendar')} className={`text-xs uppercase tracking-widest pb-1 border-b-2 transition-colors ${mode === 'calendar' ? 'border-blue-500 text-white' : 'border-transparent text-white/40 hover:text-white'}`}>Calendar</button>
         <button onClick={() => setMode('analysis')} className={`text-xs uppercase tracking-widest pb-1 border-b-2 transition-colors ${mode === 'analysis' ? 'border-blue-500 text-white' : 'border-transparent text-white/40 hover:text-white'}`}>Analysis</button>
      </div>

      {mode === 'list' && (
        <>
          <div className="px-2 mb-2">
             <div className="flex items-center gap-2 mb-2">
                 <div className="flex-1 bg-white/5 rounded-lg flex items-center px-2 border border-white/10 focus-within:border-blue-500/50 transition-colors">
                     <Search size={14} className="text-white/30" /><input value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} placeholder="Search keywords..." className="w-full bg-transparent border-none text-xs p-2 focus:outline-none text-white"/>{searchKeyword && <button onClick={() => setSearchKeyword('')}><X size={12} className="text-white/40 hover:text-white"/></button>}
                 </div>
                 <button onClick={() => setShowFilter(!showFilter)} className={`p-2 rounded-lg border transition-all ${showFilter || searchType !== 'all' || searchStartDate ? 'bg-blue-500/20 border-blue-500/50 text-blue-200' : 'bg-white/5 border-white/10 text-white/50'}`}><Filter size={14} /></button>
             </div>
             {showFilter && (
                 <div className="bg-white/5 rounded-lg p-3 mb-2 border border-white/5 animate-fade-in text-xs">
                     <div className="flex gap-2 mb-2">
                         <select value={searchType} onChange={e => setSearchType(e.target.value)} className="flex-1 bg-black/40 border border-white/10 rounded p-1.5 outline-none"><option value="all">All Types</option>{metrics.map(m => <option key={m.id} value={m.label}>{m.label}</option>)}</select>
                     </div>
                     <div className="flex gap-2 items-center">
                         <input type="date" value={searchStartDate} onChange={e => setSearchStartDate(e.target.value)} className="flex-1 bg-black/40 border border-white/10 rounded p-1.5 outline-none text-white/70"/><span className="text-white/20">-</span><input type="date" value={searchEndDate} onChange={e => setSearchEndDate(e.target.value)} className="flex-1 bg-black/40 border border-white/10 rounded p-1.5 outline-none text-white/70"/>
                     </div>
                 </div>
             )}
          </div>
          <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
             {filteredHistory.length === 0 ? (<div className="text-center text-white/20 mt-10 text-xs">No records found</div>) : (filteredHistory.map((item) => (
                 <div key={item.id} className="group flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 hover:border-white/10 shrink-0 transition-all">
                     <div>
                         <div className="flex items-baseline gap-2"><span className="text-lg font-medium text-white">{item.value}</span><span className="text-xs text-white/50">{item.unit}</span><span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-blue-200 border border-white/5 ml-1">{item.type}</span></div>
                         <div className="text-[10px] text-white/30 flex gap-2 mt-0.5"><span>{item.date}</span><span>{new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></div>
                     </div>
                     <button onClick={() => actions.deleteEntry(item.id)} className="p-2 text-red-400/50 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                 </div>
             )))}
          </div>
        </>
      )}

      {mode === 'calendar' && (
         <div className="flex-1 overflow-y-auto px-2 custom-scrollbar"><CalendarWidget /><div className="mt-4 pt-4 border-t border-white/10"><h3 className="text-[10px] uppercase text-white/40 tracking-widest mb-2">{selectedCalendarDate ? `Records for ${selectedCalendarDate}` : 'Select a date above'}</h3><div className="space-y-2">{filteredHistory.length > 0 ? filteredHistory.map(item => (<div key={item.id} className="flex items-center justify-between p-2 bg-white/5 rounded-lg border border-white/5 text-xs"><div className="flex gap-2 items-center"><div className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: metrics.find(m => m.label === item.type)?.color || '#666'}}></div><span>{item.type}</span></div><div className="font-mono text-white/80">{item.value} {item.unit}</div></div>)) : (selectedCalendarDate && <div className="text-white/20 text-center py-2">No records</div>)}</div></div></div>
      )}

      {mode === 'analysis' && (
          <div className="flex-1 overflow-y-auto px-2 custom-scrollbar">
              <div className="mb-6"><h3 className="text-[10px] uppercase text-white/40 tracking-widest mb-3 flex items-center gap-2"><Hash size={12}/> Activity Frequency Cloud</h3><div className="flex flex-wrap gap-3 items-center justify-center p-4 bg-white/5 rounded-xl border border-white/5">{analyticsData.tagCloud.map(tag => { const mDef = metrics.find(m => m.label === tag.name); return (<span key={tag.name} className="transition-all hover:scale-110 cursor-default" style={{fontSize: `${tag.weight}rem`, color: mDef?.color || '#fff', opacity: 0.8 + (tag.weight * 0.1)}} title={`${tag.name}: ${tag.count} records`}>{tag.name}</span>) })} {analyticsData.tagCloud.length === 0 && <span className="text-white/20 text-xs">No data available</span>}</div></div>
              <div className="mb-4"><h3 className="text-[10px] uppercase text-white/40 tracking-widest mb-3 flex items-center gap-2"><BarChart2 size={12}/> Total Value by Metric</h3><div className="h-40 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={analyticsData.chartData} layout="vertical" margin={{left: 0, right: 30}}><XAxis type="number" hide /><YAxis dataKey="name" type="category" width={60} tick={{fontSize: 10, fill: '#fff', opacity: 0.5}} axisLine={false} tickLine={false} /><Tooltip contentStyle={{backgroundColor: '#000', border: '1px solid #333', borderRadius: '8px', fontSize: '12px'}} itemStyle={{color: '#fff'}} cursor={{fill: 'rgba(255,255,255,0.1)'}} /><Bar dataKey="total" radius={[0, 4, 4, 0]} barSize={12}>{analyticsData.chartData.map((entry, index) => { const mDef = metrics.find(m => m.label === entry.name); return <Cell key={`cell-${index}`} fill={mDef?.color || '#60A5FA'} />; })}</Bar></BarChart></ResponsiveContainer></div></div>
          </div>
      )}
    </div>
  );
};

export default HistoryView;