import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Activity, BookOpen, Coffee, Zap, Check, Trash2, List, RotateCcw,
  Settings, Save, Plus, Star, Hash, Smile, Heart, Code, Music,
  Layers, Eye, GitGraph, Link2, Link2Off, Palette, Download, Upload, Target, EyeOff,
  Clock, Calendar as CalendarIcon, Grid, Search, BarChart2, Filter, X, AlertTriangle,
  Monitor, Globe
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import AppUsagePanel from './AppUsagePanel';
import BrowserUsagePanel from './BrowserUsagePanel';

// --- 常量定义 ---
const ICON_MAP = {
  'book': <BookOpen size={20} />,
  'activity': <Activity size={20} />,
  'zap': <Zap size={20} />,
  'coffee': <Coffee size={20} />,
  'star': <Star size={20} />,
  'code': <Code size={20} />,
  'music': <Music size={20} />,
  'heart': <Heart size={20} />,
  'hash': <Hash size={20} />,
  'smile': <Smile size={20} />,
};

const AVAILABLE_ICONS = ['star', 'code', 'music', 'heart', 'hash', 'smile', 'book', 'activity', 'zap', 'coffee'];
const DEFAULT_COLORS = ['#60A5FA', '#F87171', '#34D399', '#FBBF24', '#A78BFA', '#F472B6'];

const STANDARD_RANGES = [
  { id: 'raw', label: 'Latest' },
  { id: 'hour', label: 'Today' },
  { id: 'day', label: '7 Days' },
  { id: 'week', label: '12 Weeks' },
  { id: 'month', label: '12 Months' },
  { id: 'year', label: 'Year' },
];

const ControlPanel = () => {
  // --- 视图状态 ---
  const [view, setView] = useState('record'); 
  const [historyViewMode, setHistoryViewMode] = useState('list'); // 'list', 'calendar', 'analysis'

  // --- 录入状态 ---
  const [step, setStep] = useState(1);
  const [type, setType] = useState('');
  const [unit, setUnit] = useState('');
  const [val, setVal] = useState('');
  
  // --- 数据状态 ---
  const [allData, setAllData] = useState([]); // 完整历史
  const [history, setHistory] = useState([]); // 最近历史(用于record视图下方显示)
  const [weights, setWeights] = useState({});
  const [metrics, setMetrics] = useState([]);
  
  const [displayConfig, setDisplayConfig] = useState({ 
    mode: 'single', combinedMetrics: [], multiMetrics: [], combinedColor: '#60A5FA',
    combinedGoal: 0, showCombinedGoal: true, showIndividualGoals: true, individualGoalModes: ['single', 'multi', 'overlay'],
    visibleButtons: ['raw', 'hour', 'day'], customRanges: []
  });

  // --- 搜索/筛选状态 ---
  const [showFilter, setShowFilter] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchType, setSearchType] = useState('all');
  const [searchStartDate, setSearchStartDate] = useState('');
  const [searchEndDate, setSearchEndDate] = useState('');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);

  // --- 新建/编辑状态 ---
  const [newMetricName, setNewMetricName] = useState('');
  const [newMetricUnit, setNewMetricUnit] = useState('');
  const [newMetricIcon, setNewMetricIcon] = useState('star');
  const [isAdding, setIsAdding] = useState(false);

  const [newRangeLabel, setNewRangeLabel] = useState('');
  const [newRangeDays, setNewRangeDays] = useState('');
  const [newRangeGrouping, setNewRangeGrouping] = useState('day'); 
  const [newRangeCustomGroup, setNewRangeCustomGroup] = useState(''); 
  const [isAddingRange, setIsAddingRange] = useState(false);

  const [deleteCandidate, setDeleteCandidate] = useState(null); 
  const [deleteType, setDeleteType] = useState(null); // 'metric' or 'range'

  const inputRef = useRef(null);

  // --- 初始化 ---
  useEffect(() => {
    loadData();
    window.api.getWeights().then(setWeights);
    window.api.getMetrics().then(setMetrics);
    window.api.onDataUpdate((newData) => {
        const sorted = [...newData].reverse();
        setHistory(sorted);
        setAllData(sorted);
    });
    if(window.api.onMetricsUpdate) window.api.onMetricsUpdate(setMetrics);
    window.api.getDisplayConfig().then(setDisplayConfig);
  }, []);

  const loadData = () => {
    window.api.getData().then(data => {
        const sorted = [...data].reverse();
        setHistory(sorted);
        setAllData(sorted);
    });
  };

  useEffect(() => {
    if(view === 'record' && step === 2 && inputRef.current) inputRef.current.focus();
  }, [step, view]);

  // --- 数据筛选与分析 (Memo) ---
  const filteredHistory = useMemo(() => {
    let res = allData;
    if (historyViewMode === 'calendar' && selectedCalendarDate) {
        res = res.filter(item => item.date === selectedCalendarDate);
    } else {
        if (searchKeyword) res = res.filter(item => item.type.toLowerCase().includes(searchKeyword.toLowerCase()));
        if (searchType !== 'all') res = res.filter(item => item.type === searchType);
        if (searchStartDate) res = res.filter(item => item.date >= searchStartDate);
        if (searchEndDate) res = res.filter(item => item.date <= searchEndDate);
    }
    return res;
  }, [allData, searchKeyword, searchType, searchStartDate, searchEndDate, historyViewMode, selectedCalendarDate]);

  const analyticsData = useMemo(() => {
    const typeCounts = {};
    const typeSums = {};
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

  // --- Handlers ---
  const handleSelect = (m) => { setType(m.label); setUnit(m.unit); setStep(2); };
  
  const handleSubmit = (e) => {
    if (e.key === 'Enter' && val) {
      window.api.addEntry({ type, unit, value: Number(val) });
      let newConfig = { ...displayConfig };
      let configChanged = false;
      if ((newConfig.mode === 'multi' || newConfig.mode === 'overlay') && !newConfig.multiMetrics.includes(type)) {
        newConfig.multiMetrics = [...newConfig.multiMetrics, type];
        configChanged = true;
      } else if (newConfig.mode === 'combined' && !newConfig.combinedMetrics.includes(type)) {
        newConfig.combinedMetrics = [...newConfig.combinedMetrics, type];
        configChanged = true;
      }
      if (configChanged) {
        setDisplayConfig(newConfig);
        window.api.saveDisplayConfig(newConfig);
      }
      setStep(3);
      setTimeout(() => { setStep(1); setVal(''); }, 1000);
    }
  };

  const handleDeleteHistory = (id) => { window.api.deleteEntry(id); setAllData(prev => prev.filter(item => item.id !== id)); };
  
  const handleSaveWeights = () => {
    window.api.saveWeights(weights);
    window.api.saveDisplayConfig(displayConfig);
    window.api.saveMetrics(metrics);
    setView('record');
  };

  const handleAddMetric = () => {
    if (!newMetricName || !newMetricUnit) return;
    const randomColor = DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)];
    const newMetric = { id: Date.now().toString(), label: newMetricName, unit: newMetricUnit, iconKey: newMetricIcon, color: randomColor, target: 0, showGoal: true };
    const updatedMetrics = [...metrics, newMetric];
    setMetrics(updatedMetrics); window.api.saveMetrics(updatedMetrics);
    if (weights[newMetricName] === undefined) { const newWeights = { ...weights, [newMetricName]: 1 }; setWeights(newWeights); window.api.saveWeights(newWeights); }
    setNewMetricName(''); setNewMetricUnit(''); setIsAdding(false);
  };

  const requestDeleteMetric = (metricId) => { setDeleteCandidate(metricId); setDeleteType('metric'); };
  const requestDeleteRange = (id) => { setDeleteCandidate(id); setDeleteType('range'); };
  
  const confirmDelete = () => {
    if (deleteType === 'metric') { const updated = metrics.filter(m => m.id !== deleteCandidate); setMetrics(updated); window.api.saveMetrics(updated); }
    else if (deleteType === 'range') { const nextCustom = (displayConfig.customRanges || []).filter(r => r.id !== deleteCandidate); const newConfig = { ...displayConfig, customRanges: nextCustom }; setDisplayConfig(newConfig); window.api.saveDisplayConfig(newConfig); }
    setDeleteCandidate(null); setDeleteType(null);
  };

  const toggleMetricSelection = (label) => {
    if (displayConfig.mode === 'overlay') return;
    const targetKey = displayConfig.mode === 'multi' ? 'multiMetrics' : 'combinedMetrics';
    const currentList = displayConfig[targetKey] || [];
    let newList = currentList.includes(label) ? currentList.filter(l => l !== label) : [...currentList, label];
    setDisplayConfig({ ...displayConfig, [targetKey]: newList });
    window.api.saveDisplayConfig({ ...displayConfig, [targetKey]: newList });
  };

  const handleMetricUpdate = (metricId, changes) => { 
    const updatedMetrics = metrics.map(m => m.id === metricId ? { ...m, ...changes } : m);
    setMetrics(updatedMetrics); if (changes.showGoal !== undefined) window.api.saveMetrics(updatedMetrics);
  };

  const changeMode = (newMode) => { const newConfig = { ...displayConfig, mode: newMode }; setDisplayConfig(newConfig); window.api.saveDisplayConfig(newConfig); };
  const toggleOverlay = () => { changeMode(displayConfig.mode === 'overlay' ? 'multi' : 'overlay'); };
  const toggleGoalVisibility = (key) => { const newConfig = { ...displayConfig, [key]: !displayConfig[key] }; setDisplayConfig(newConfig); window.api.saveDisplayConfig(newConfig); };
  
  const toggleGoalMode = (m) => { 
    const cur = displayConfig.individualGoalModes || []; const next = cur.includes(m) ? cur.filter(x => x !== m) : [...cur, m];
    const newConfig = { ...displayConfig, individualGoalModes: next }; setDisplayConfig(newConfig); window.api.saveDisplayConfig(newConfig);
  };
  
  const toggleTimeButton = (btnId) => { 
    const cur = displayConfig.visibleButtons || []; const next = cur.includes(btnId) ? cur.filter(b => b !== btnId) : [...cur, btnId];
    const newConfig = { ...displayConfig, visibleButtons: next }; setDisplayConfig(newConfig); window.api.saveDisplayConfig(newConfig);
  };
  
  const handleAddCustomRange = () => { 
    if (!newRangeLabel || !newRangeDays) return;
    const grp = (newRangeGrouping === 'custom_num') ? (parseInt(newRangeCustomGroup)||1) : newRangeGrouping;
    const newRange = { id: `custom_${Date.now()}`, label: newRangeLabel, days: Number(newRangeDays), grouping: grp };
    const nextCustom = [...(displayConfig.customRanges || []), newRange];
    const newConfig = { ...displayConfig, customRanges: nextCustom }; setDisplayConfig(newConfig); window.api.saveDisplayConfig(newConfig);
    setNewRangeLabel(''); setNewRangeDays(''); setGroupingType('day'); setNewRangeCustomGroup(''); setIsAddingRange(false);
  };

  const handleDeleteMetric = (id) => requestDeleteMetric(id);
  const handleDeleteCustomRange = (id) => requestDeleteRange(id);

  const handleExport = async () => { const result = await window.api.exportData(); if (result.success) alert("Saved!"); };
  const handleImport = async () => { if(!confirm("Overwrite?")) return; const res = await window.api.importData(); if(res.success) { loadData(); window.api.getWeights().then(setWeights); window.api.getMetrics().then(setMetrics); window.api.getDisplayConfig().then(setDisplayConfig); } };

  // --- Calendar Widget ---
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
    <div className="pointer-events-auto h-full w-full bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-white flex flex-col relative overflow-hidden">
      
      {/* 左上角 SAVE */}
      <div className="absolute top-4 left-4 z-20">
        {(view === 'settings' || view === 'goals' || view === 'ranges') && (
          <button onClick={handleSaveWeights} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-full text-white transition-all shadow-lg border border-white/10 group">
            <Save size={14} className="group-hover:scale-110 transition-transform"/>
            <span className="text-xs font-medium tracking-wide">SAVE</span>
          </button>
        )}
      </div>

      {/* 右上角导航 */}
      <div className="absolute top-4 right-4 flex gap-2 z-10">
        {view !== 'ranges' && <button onClick={() => setView('ranges')} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors" title="Time Ranges"><Clock size={18} /></button>}
        {view !== 'goals' && <button onClick={() => setView('goals')} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors" title="Set Goals"><Target size={18} /></button>}
        {view !== 'settings' && <button onClick={() => setView('settings')} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors" title="Configuration"><Settings size={18} /></button>}
        {view !== 'app-usage' && <button onClick={() => setView('app-usage')} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors" title="应用使用时间"><Monitor size={18} /></button>}
        {view !== 'browser-usage' && <button onClick={() => setView('browser-usage')} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors" title="网站使用时间"><Globe size={18} /></button>}
        {(view !== 'settings' && view !== 'goals' && view !== 'ranges' && view !== 'app-usage' && view !== 'browser-usage') && <button onClick={() => { setView(view === 'record' ? 'history' : 'record'); if (view !== 'record') loadData(); }} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors"><List size={18} /></button>}
        {(view === 'settings' || view === 'goals' || view === 'ranges' || view === 'app-usage' || view === 'browser-usage') && <button onClick={() => { window.api.getWeights().then(setWeights); window.api.getDisplayConfig().then(setDisplayConfig); window.api.getMetrics().then(setMetrics); setView('record'); }} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors"><RotateCcw size={18} /></button>}
      </div>

      {/* --- 1. Record Mode --- */}
      {view === 'record' && (
        <div className="flex-1 flex flex-col items-center justify-center">
          {step === 1 && (
            <div className={`w-full animate-fade-in px-1 ${metrics.length > 12 ? 'max-h-[340px] overflow-y-auto custom-scrollbar' : ''}`}>
              <h2 className="text-center text-white/50 text-xs mb-4 tracking-widest uppercase">Select Metric</h2>
              <div className="grid grid-cols-2 gap-3">
                {metrics.map(m => (
                  <button key={m.id} onClick={() => handleSelect(m)} className="flex flex-col items-center justify-center p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all hover:scale-105 border border-transparent hover:border-white/20 shrink-0">
                    <div className="mb-1 opacity-80" style={{ color: m.color || '#60A5FA' }}>{ICON_MAP[m.iconKey] || <Hash size={20}/>}</div>
                    <span className="text-sm truncate max-w-full">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="w-full text-center animate-fade-in">
              <h2 className="text-white/50 text-sm mb-6 tracking-widest">{type} ({unit})</h2>
              <input ref={inputRef} type="number" value={val} onChange={e => setVal(e.target.value)} onKeyDown={handleSubmit} placeholder="0" className="w-full bg-transparent text-6xl text-center font-thin focus:outline-none border-b border-white/20 focus:border-white/80 transition-colors pb-2"/>
              <p className="text-xs text-white/30 mt-4">Press Enter</p>
            </div>
          )}
          {step === 3 && <div className="flex flex-col items-center animate-fade-in text-green-400"><Check size={48} /><span className="mt-2 text-sm tracking-widest uppercase">Saved</span></div>}
        </div>
      )}

      {/* --- 2. History View --- */}
      {view === 'history' && (
        <div className="flex-1 flex flex-col w-full animate-fade-in overflow-hidden pt-8 min-h-0">
          <div className="flex justify-center gap-4 mb-4">
             <button onClick={() => setHistoryViewMode('list')} className={`text-xs uppercase tracking-widest pb-1 border-b-2 transition-colors ${historyViewMode === 'list' ? 'border-blue-500 text-white' : 'border-transparent text-white/40 hover:text-white'}`}>Timeline</button>
             <button onClick={() => setHistoryViewMode('calendar')} className={`text-xs uppercase tracking-widest pb-1 border-b-2 transition-colors ${historyViewMode === 'calendar' ? 'border-blue-500 text-white' : 'border-transparent text-white/40 hover:text-white'}`}>Calendar</button>
             <button onClick={() => setHistoryViewMode('analysis')} className={`text-xs uppercase tracking-widest pb-1 border-b-2 transition-colors ${historyViewMode === 'analysis' ? 'border-blue-500 text-white' : 'border-transparent text-white/40 hover:text-white'}`}>Analysis</button>
          </div>

          {/* A. Timeline */}
          {historyViewMode === 'list' && (
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
                    {filteredHistory.length === 0 ? (<div className="text-center text-white/20 mt-10 text-xs">No records found</div>) : (filteredHistory.map((item) => (<div key={item.id} className="group flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 hover:border-white/10 shrink-0 transition-all"><div><div className="flex items-baseline gap-2"><span className="text-lg font-medium text-white">{item.value}</span><span className="text-xs text-white/50">{item.unit}</span><span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-blue-200 border border-white/5 ml-1">{item.type}</span></div><div className="text-[10px] text-white/30 flex gap-2 mt-0.5"><span>{item.date}</span><span>{new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></div></div><button onClick={() => handleDeleteHistory(item.id)} className="p-2 text-red-400/50 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button></div>)))}
                </div>
            </>
          )}
          {/* B. Calendar */}
          {historyViewMode === 'calendar' && (
             <div className="flex-1 overflow-y-auto px-2 custom-scrollbar"><CalendarWidget /><div className="mt-4 pt-4 border-t border-white/10"><h3 className="text-[10px] uppercase text-white/40 tracking-widest mb-2">{selectedCalendarDate ? `Records for ${selectedCalendarDate}` : 'Select a date above'}</h3><div className="space-y-2">{filteredHistory.length > 0 ? filteredHistory.map(item => (<div key={item.id} className="flex items-center justify-between p-2 bg-white/5 rounded-lg border border-white/5 text-xs"><div className="flex gap-2 items-center"><div className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: metrics.find(m => m.label === item.type)?.color || '#666'}}></div><span>{item.type}</span></div><div className="font-mono text-white/80">{item.value} {item.unit}</div></div>)) : (selectedCalendarDate && <div className="text-white/20 text-center py-2">No records</div>)}</div></div></div>
          )}
          {/* C. Analysis */}
          {historyViewMode === 'analysis' && (
              <div className="flex-1 overflow-y-auto px-2 custom-scrollbar">
                  <div className="mb-6"><h3 className="text-[10px] uppercase text-white/40 tracking-widest mb-3 flex items-center gap-2"><Hash size={12}/> Activity Frequency Cloud</h3><div className="flex flex-wrap gap-3 items-center justify-center p-4 bg-white/5 rounded-xl border border-white/5">{analyticsData.tagCloud.map(tag => { const mDef = metrics.find(m => m.label === tag.name); return (<span key={tag.name} className="transition-all hover:scale-110 cursor-default" style={{fontSize: `${tag.weight}rem`, color: mDef?.color || '#fff', opacity: 0.8 + (tag.weight * 0.1)}} title={`${tag.name}: ${tag.count} records`}>{tag.name}</span>) })} {analyticsData.tagCloud.length === 0 && <span className="text-white/20 text-xs">No data available</span>}</div></div>
                  <div className="mb-4"><h3 className="text-[10px] uppercase text-white/40 tracking-widest mb-3 flex items-center gap-2"><BarChart2 size={12}/> Total Value by Metric</h3><div className="h-40 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={analyticsData.chartData} layout="vertical" margin={{left: 0, right: 30}}><XAxis type="number" hide /><YAxis dataKey="name" type="category" width={60} tick={{fontSize: 10, fill: '#fff', opacity: 0.5}} axisLine={false} tickLine={false} /><Tooltip contentStyle={{backgroundColor: '#000', border: '1px solid #333', borderRadius: '8px', fontSize: '12px'}} itemStyle={{color: '#fff'}} cursor={{fill: 'rgba(255,255,255,0.1)'}} /><Bar dataKey="total" radius={[0, 4, 4, 0]} barSize={12}>{analyticsData.chartData.map((entry, index) => { const mDef = metrics.find(m => m.label === entry.name); return <Cell key={`cell-${index}`} fill={mDef?.color || '#60A5FA'} />; })}</Bar></BarChart></ResponsiveContainer></div></div>
              </div>
          )}
        </div>
      )}

      {/* --- 3. Settings View --- */}
      {view === 'settings' && (
        <div className="flex-1 flex flex-col w-full animate-fade-in pt-8 min-h-0">
          <h2 className="text-center text-white/50 text-xs mb-4 tracking-widest uppercase">Display Mode</h2>
          <div className="flex gap-2 mx-2 mb-4">
            <button onClick={() => changeMode('single')} className={`w-20 flex flex-col items-center justify-center py-2 rounded-lg transition-all border ${displayConfig.mode === 'single' ? 'bg-blue-600 text-white border-blue-500' : 'bg-white/5 border-white/10 text-white/40 hover:text-white'}`}><Eye size={14} className="mb-1"/> <span className="text-[10px]">Auto</span></button>
            <div className="flex-1 flex items-center bg-white/5 border border-white/10 rounded-lg p-1 relative">
                <button onClick={() => changeMode('combined')} className={`flex-1 flex flex-col items-center justify-center py-2 rounded-md transition-all ${displayConfig.mode === 'combined' || displayConfig.mode === 'overlay' ? 'bg-blue-600/80 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}><Layers size={14} className="mb-1"/> <span className="text-[10px]">Combined</span></button>
                <button onClick={toggleOverlay} className={`mx-1 p-1 rounded-full transition-all z-10 ${displayConfig.mode === 'overlay' ? 'bg-white text-blue-600 shadow-[0_0_10px_rgba(255,255,255,0.5)] scale-110' : 'bg-black/20 text-white/20 hover:text-white hover:bg-white/10'}`} title={displayConfig.mode === 'overlay' ? "Disconnect Overlay" : "Connect Overlay"}>{displayConfig.mode === 'overlay' ? <Link2 size={12} strokeWidth={3} /> : <Link2Off size={12} />}</button>
                <button onClick={() => changeMode('multi')} className={`flex-1 flex flex-col items-center justify-center py-2 rounded-md transition-all ${displayConfig.mode === 'multi' || displayConfig.mode === 'overlay' ? 'bg-blue-600/80 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}><GitGraph size={14} className="mb-1"/> <span className="text-[10px]">Multi</span></button>
                {displayConfig.mode === 'overlay' && <div className="absolute inset-x-2 top-1/2 h-0.5 bg-white/20 -z-0 blur-[1px]"></div>}
            </div>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto px-2 custom-scrollbar pb-2">
            {(displayConfig.mode === 'combined' || displayConfig.mode === 'overlay') && (
              <div className="flex items-center justify-between p-2 mb-2 bg-white/5 rounded-lg border border-white/10">
                <div className="flex items-center gap-2"><Palette size={16} className="text-white/60"/><span className="text-xs font-medium">Total Sum Color</span></div>
                <div className="flex items-center gap-2"><div className="relative group/color"><div className="w-5 h-5 rounded border border-white/20 overflow-hidden cursor-pointer shadow-sm" style={{ backgroundColor: displayConfig.combinedColor || '#60A5FA' }}></div><input type="color" value={displayConfig.combinedColor || '#60A5FA'} onChange={(e) => setDisplayConfig({...displayConfig, combinedColor: e.target.value})} onBlur={() => window.api.saveDisplayConfig(displayConfig)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"/></div></div>
              </div>
            )}
            {displayConfig.mode === 'overlay' && <div className="p-2 mb-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-[10px] text-blue-200 text-center animate-fade-in">Overlay Mode Active. Switch to <b>Combined</b> or <b>Multi</b> tabs to change selection.</div>}
            {metrics.map(m => {
              const isMultiMode = displayConfig.mode === 'multi';
              const currentList = isMultiMode ? (displayConfig.multiMetrics || []) : (displayConfig.combinedMetrics || []);
              const isSelected = currentList.includes(m.label);
              const isModeEditable = displayConfig.mode === 'multi' || displayConfig.mode === 'combined';
              return (
                <div key={m.id} className={`flex items-center justify-between p-2 rounded-lg border shrink-0 transition-colors ${isSelected && isModeEditable ? 'bg-blue-500/10 border-blue-500/50' : 'bg-white/5 border-white/5'} ${!isModeEditable ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-3 overflow-hidden flex-1">
                    {isModeEditable && (<button onClick={() => toggleMetricSelection(m.label)} className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-white/20 hover:border-white/50'}`}>{isSelected && <Check size={10} />}</button>)}
                    <div className="opacity-70 text-blue-400 shrink-0" style={{ color: m.color || '#60A5FA' }}>{ICON_MAP[m.iconKey] || <Hash size={18}/>}</div>
                    <div className="flex flex-col"><span className="text-sm font-medium truncate">{m.label}</span><span className="text-[10px] text-white/30">{m.unit}</span></div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {/* Combined 模式下隐藏颜色选择器 */}
                    {displayConfig.mode !== 'combined' && (
                      <div className="relative group/color"><div className="w-3.5 h-3.5 rounded-full border border-white/20 overflow-hidden cursor-pointer" style={{ backgroundColor: m.color || '#60A5FA' }}></div><input type="color" value={m.color || '#60A5FA'} onChange={(e) => handleMetricUpdate(m.id, { color: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"/></div>
                    )}
                    <div className="flex flex-col items-center"><span className="text-[8px] text-white/30 uppercase leading-none">Wt</span><input type="number" step="0.1" value={weights[m.label] !== undefined ? weights[m.label] : 1} onChange={(e) => setWeights({ ...weights, [m.label]: parseFloat(e.target.value) })} onBlur={() => window.api.saveWeights(weights)} className="w-12 bg-black/20 border border-white/10 rounded p-0.5 text-center text-[10px] focus:outline-none focus:border-blue-500"/></div>
                    <button onClick={() => handleDeleteMetric(m.id)} className="p-1 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"><Trash2 size={12} /></button>
                  </div>
                </div>
              );
            })}
            {!isAdding ? (<button onClick={() => setIsAdding(true)} className="w-full py-2 border border-dashed border-white/20 rounded-lg text-white/40 text-xs hover:text-white hover:border-white/40 transition-colors flex items-center justify-center gap-2 shrink-0"><Plus size={14} /> Add New Metric</button>) : (<div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg space-y-3 animate-fade-in shrink-0"><div className="flex gap-2"><input placeholder="Name" value={newMetricName} onChange={e => setNewMetricName(e.target.value)} className="flex-1 bg-black/20 border border-white/10 rounded p-1.5 text-xs focus:outline-none focus:border-blue-400"/><input placeholder="Unit" value={newMetricUnit} onChange={e => setNewMetricUnit(e.target.value)} className="w-20 bg-black/20 border border-white/10 rounded p-1.5 text-xs focus:outline-none focus:border-blue-400"/></div><div className="flex flex-wrap gap-2">{AVAILABLE_ICONS.map(iconKey => (<button key={iconKey} onClick={() => setNewMetricIcon(iconKey)} className={`p-1.5 rounded transition-all ${newMetricIcon === iconKey ? 'bg-blue-500 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>{React.cloneElement(ICON_MAP[iconKey], { size: 14 })}</button>))}</div><div className="flex gap-2 pt-1"><button onClick={handleAddMetric} className="flex-1 py-1.5 bg-blue-600 rounded text-xs hover:bg-blue-500">Confirm</button><button onClick={() => setIsAdding(false)} className="px-3 py-1.5 bg-white/5 rounded text-xs hover:bg-white/10">Cancel</button></div></div>)}
            <div className="mt-8 pt-4 border-t border-white/10 pb-4"><div className="flex items-center gap-2 mb-3"><Save size={12} className="text-white/30"/><span className="text-[10px] uppercase text-white/30 tracking-widest">Data Backup</span></div><div className="flex gap-2"><button onClick={handleExport} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-black/20 hover:bg-blue-600/20 border border-white/5 hover:border-blue-500/50 rounded-lg text-xs transition-all group"><Download size={14} className="text-blue-400 group-hover:text-blue-300" /> <span className="text-blue-100/80 group-hover:text-white">Export JSON</span></button><button onClick={handleImport} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-black/20 hover:bg-red-600/20 border border-white/5 hover:border-red-500/50 rounded-lg text-xs transition-all group"><Upload size={14} className="text-red-400 group-hover:text-red-300" /> <span className="text-red-100/80 group-hover:text-white">Import JSON</span></button></div></div>
          </div>
        </div>
      )}

      {/* 4. Goals View */}
      {view === 'goals' && (
        <div className="flex-1 flex flex-col w-full animate-fade-in pt-8 min-h-0">
          <h2 className="text-center text-white/50 text-xs mb-6 tracking-widest uppercase">Target Settings</h2>
          <div className="flex-1 space-y-6 overflow-y-auto px-2 custom-scrollbar pb-2">
            <div className={`p-4 border rounded-xl transition-colors ${displayConfig.showCombinedGoal ? 'bg-gradient-to-br from-blue-900/30 to-purple-900/30 border-white/10' : 'bg-white/5 border-white/5 opacity-60'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-blue-200"><Target size={16} /><span className="text-xs font-bold uppercase tracking-wider">Total Daily Energy</span></div>
                <button onClick={() => toggleGoalVisibility('showCombinedGoal')} className={`p-1.5 rounded-full transition-colors ${displayConfig.showCombinedGoal ? 'bg-blue-500 text-white' : 'bg-white/10 text-white/30 hover:text-white'}`}>{displayConfig.showCombinedGoal ? <Eye size={14} /> : <EyeOff size={14} />}</button>
              </div>
              <div className="flex items-end gap-2">
                <input type="number" value={displayConfig.combinedGoal || ''} onChange={(e) => setDisplayConfig({...displayConfig, combinedGoal: Number(e.target.value)})} onBlur={() => window.api.saveDisplayConfig(displayConfig)} placeholder="0" className="w-full bg-transparent text-4xl font-thin text-white border-b border-white/20 focus:border-blue-500 outline-none pb-1"/>
                <span className="text-xs text-white/40 mb-2 font-mono">PTS</span>
              </div>
              <p className="text-[10px] text-white/30 mt-2">Target for Combined & Overlay modes.</p>
            </div>
            <div>
              <div className="flex flex-col gap-2 mb-3 pl-1">
                <div className="flex items-center justify-between">
                    <h3 className="text-[10px] uppercase text-white/30 tracking-widest">Individual Metrics</h3>
                    <button onClick={() => toggleGoalVisibility('showIndividualGoals')} className={`p-1.5 rounded flex gap-2 items-center text-[10px] transition-colors ${displayConfig.showIndividualGoals !== false ? 'bg-blue-600/20 text-blue-200' : 'bg-white/5 text-white/30'}`}><span>Global {displayConfig.showIndividualGoals !== false ? 'On' : 'Off'}</span>{displayConfig.showIndividualGoals !== false ? <Eye size={12} /> : <EyeOff size={12} />}</button>
                </div>
                <div className="flex gap-1.5 opacity-90">
                    {['single', 'combined', 'multi', 'overlay'].map(m => {
                        const isActive = (displayConfig.individualGoalModes || ['single', 'multi', 'overlay']).includes(m);
                        const labelMap = { single: 'Auto', combined: 'Sum', multi: 'Multi', overlay: 'Over' };
                        return <button key={m} onClick={() => toggleGoalMode(m)} className={`px-2 py-1 rounded text-[9px] border transition-all ${isActive ? 'bg-blue-500 text-white border-blue-500' : 'bg-transparent text-white/30 border-white/10 hover:border-white/30'}`}>{labelMap[m]}</button>
                    })}
                </div>
              </div>
              <div className={`space-y-2 transition-opacity ${displayConfig.showIndividualGoals !== false ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                {metrics.map(m => (
                  <div key={m.id} className={`flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 transition-opacity ${m.showGoal !== false ? 'opacity-100' : 'opacity-60'}`}>
                    <div className="flex items-center gap-3">
                      <div className="opacity-70" style={{ color: m.color || '#60A5FA' }}>{ICON_MAP[m.iconKey] || <Hash size={18}/>}</div>
                      <div className="flex flex-col"><span className="text-sm font-medium">{m.label}</span><span className="text-[10px] text-white/30">{m.unit}</span></div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1"><input type="number" placeholder="-" value={m.target ?? ''} onChange={(e) => handleMetricUpdate(m.id, { target: e.target.value === '' ? 0 : Number(e.target.value) })} onBlur={() => window.api.saveMetrics(metrics)} className="w-14 bg-black/20 border border-white/10 rounded p-1.5 text-center text-sm font-mono focus:outline-none focus:border-blue-500 text-yellow-200/90"/></div>
                      <button onClick={() => handleMetricUpdate(m.id, { showGoal: m.showGoal === undefined ? false : !m.showGoal })} className={`p-1.5 rounded transition-colors ${m.showGoal !== false ? 'bg-white/10 text-white' : 'text-white/20 hover:text-white'}`}>{m.showGoal !== false ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Ranges View */}
      {view === 'ranges' && (
        <div className="flex-1 flex flex-col w-full animate-fade-in pt-8 min-h-0">
          <h2 className="text-center text-white/50 text-xs mb-6 tracking-widest uppercase">Time Ranges</h2>
          <div className="flex-1 space-y-6 overflow-y-auto px-2 custom-scrollbar pb-2">
            <div>
              <h3 className="text-[10px] uppercase text-white/30 tracking-widest mb-3 pl-1">Standard Buttons</h3>
              <div className="space-y-2">
                {STANDARD_RANGES.map(range => (
                  <div key={range.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                    <span className="text-sm font-medium">{range.label}</span>
                    <button onClick={() => toggleTimeButton(range.id)} className={`p-1.5 rounded transition-colors ${(displayConfig.visibleButtons || []).includes(range.id) ? 'bg-white/10 text-white' : 'text-white/20 hover:text-white'}`}>{ (displayConfig.visibleButtons || []).includes(range.id) ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-[10px] uppercase text-white/30 tracking-widest mb-3 pl-1">Custom Ranges</h3>
              <div className="space-y-2">
                {(displayConfig.customRanges || []).map(range => {
                    let groupInfo = 'Daily';
                    if (range.grouping === 'week') groupInfo = 'Weekly'; else if (range.grouping === 'month') groupInfo = 'Monthly'; else if (typeof range.grouping === 'number') groupInfo = `Every ${range.grouping} Days`;
                    return (
                      <div key={range.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5"><div className="flex flex-col"><span className="text-sm font-medium">{range.label}</span><div className="flex gap-2 text-[10px] text-white/30"><span>{range.days} Days</span><span className="opacity-50">•</span><span className="text-blue-300/70">{groupInfo}</span></div></div><button onClick={() => requestDeleteRange(range.id)} className="p-1.5 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"><Trash2 size={14} /></button></div>
                    )
                })}
                {!isAddingRange ? (<button onClick={() => setIsAddingRange(true)} className="w-full py-2 border border-dashed border-white/20 rounded-lg text-white/40 text-xs hover:text-white hover:border-white/40 transition-colors flex items-center justify-center gap-2"><Plus size={14} /> Add Range</button>) : (<div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg space-y-3 animate-fade-in"><div className="flex flex-col gap-2"><div className="flex gap-2"><input placeholder="Label" value={newRangeLabel} onChange={e => setNewRangeLabel(e.target.value)} className="flex-1 bg-black/20 border border-white/10 rounded p-1.5 text-xs focus:outline-none focus:border-blue-400"/><input placeholder="Days" type="number" value={newRangeDays} onChange={e => setNewRangeDays(e.target.value)} className="w-16 bg-black/20 border border-white/10 rounded p-1.5 text-xs focus:outline-none focus:border-blue-400"/></div><div className="flex items-center gap-2 mt-1"><span className="text-[10px] text-white/40">Group By:</span><select value={newRangeGrouping} onChange={e => setNewRangeGrouping(e.target.value)} className="bg-black/40 border border-white/10 rounded p-1 text-xs text-white/70 outline-none flex-1"><option value="day">Day (Daily)</option><option value="week">Week (Weekly)</option><option value="month">Month (Monthly)</option><option value="custom_num">Custom Days...</option></select>{newRangeGrouping === 'custom_num' && (<input placeholder="N" type="number" value={newRangeCustomGroup} onChange={e => setNewRangeCustomGroup(e.target.value)} className="w-10 bg-black/20 border border-white/10 rounded p-1 text-center text-xs focus:outline-none focus:border-blue-400"/>)}</div></div><div className="flex gap-2 pt-2"><button onClick={handleAddCustomRange} className="flex-1 py-1.5 bg-blue-600 rounded text-xs hover:bg-blue-500">Add</button><button onClick={() => setIsAddingRange(false)} className="px-3 py-1.5 bg-white/5 rounded text-xs hover:bg-white/10">Cancel</button></div></div>)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. App Usage View */}
      {view === 'app-usage' && (
        <div className="flex-1 flex flex-col w-full animate-fade-in overflow-hidden">
          <AppUsagePanel />
        </div>
      )}

      {/* 7. Browser Usage View */}
      {view === 'browser-usage' && (
        <div className="flex-1 flex flex-col w-full animate-fade-in overflow-hidden">
          <BrowserUsagePanel />
        </div>
      )}

      {/* Delete Modal */}
      {deleteCandidate && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
          <div className="bg-gray-900 border border-white/10 p-4 rounded-xl w-3/4 shadow-2xl text-center transform scale-105 transition-transform">
            <div className="flex justify-center mb-2 text-yellow-500"><AlertTriangle size={24} /></div>
            <h3 className="text-white font-medium text-sm mb-1">Delete Item?</h3>
            <p className="text-white/50 text-[10px] mb-4">This action cannot be undone.</p>
            <div className="flex gap-2"><button onClick={() => setDeleteCandidate(null)} className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-white/70 transition-colors">Cancel</button><button onClick={confirmDelete} className="flex-1 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-xs text-white font-medium transition-colors shadow-lg shadow-red-900/20">Delete</button></div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ControlPanel;