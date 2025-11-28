import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, BookOpen, Coffee, Zap, Check, Trash2, List, RotateCcw, 
  Settings, Save, Plus, Star, Hash, Smile, Heart, Code, Music, 
  Layers, Eye, GitGraph, Link2, Link2Off, Palette, Download, Upload, Target, EyeOff,
  Clock, Calendar 
} from 'lucide-react';

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
  { id: 'hour', label: 'Today (Hr)' },
  { id: 'day', label: '7 Days' },
  { id: 'week', label: '12 Weeks' },
  { id: 'month', label: '12 Months' },
  { id: 'year', label: 'Year' },
];

const ControlPanel = () => {
  const [view, setView] = useState('record'); 
  const [step, setStep] = useState(1);
  const [type, setType] = useState('');
  const [unit, setUnit] = useState('');
  const [val, setVal] = useState('');
  const [history, setHistory] = useState([]); 
  const [weights, setWeights] = useState({});
  const [metrics, setMetrics] = useState([]);
  
  const [displayConfig, setDisplayConfig] = useState({ 
    mode: 'single', combinedMetrics: [], multiMetrics: [], combinedColor: '#60A5FA',
    combinedGoal: 0, showCombinedGoal: true, showIndividualGoals: true, individualGoalModes: ['single', 'multi', 'overlay'],
    visibleButtons: ['raw', 'hour', 'day'], customRanges: []
  });

  const [newMetricName, setNewMetricName] = useState('');
  const [newMetricUnit, setNewMetricUnit] = useState('');
  const [newMetricIcon, setNewMetricIcon] = useState('star');
  const [isAdding, setIsAdding] = useState(false);

  const [newRangeLabel, setNewRangeLabel] = useState('');
  const [newRangeDays, setNewRangeDays] = useState('');
  const [newRangeGrouping, setNewRangeGrouping] = useState('day'); 
  const [newRangeCustomGroup, setNewRangeCustomGroup] = useState(''); 
  const [isAddingRange, setIsAddingRange] = useState(false);

  const inputRef = useRef(null);

  useEffect(() => {
    loadData();
    window.api.getWeights().then(setWeights);
    window.api.getMetrics().then(setMetrics);
    window.api.onDataUpdate(setHistory);
    if(window.api.onMetricsUpdate) window.api.onMetricsUpdate(setMetrics);
    window.api.getDisplayConfig().then(setDisplayConfig);
  }, []);

  const loadData = () => {
    window.api.getData().then(data => setHistory([...data].reverse()));
  };

  useEffect(() => {
    if(view === 'record' && step === 2 && inputRef.current) inputRef.current.focus();
  }, [step, view]);

  const handleSelect = (m) => {
    setType(m.label);
    setUnit(m.unit);
    setStep(2);
  };

  const handleSubmit = (e) => {
    if (e.key === 'Enter' && val) {
      window.api.addEntry({ type, unit, value: Number(val) });
      
      let newConfig = { ...displayConfig };
      let configChanged = false;
      if ((newConfig.mode === 'multi' || newConfig.mode === 'overlay') && !newConfig.multiMetrics.includes(type)) {
        newConfig.multiMetrics = [...newConfig.multiMetrics, type];
        configChanged = true;
      }
      else if (newConfig.mode === 'combined' && !newConfig.combinedMetrics.includes(type)) {
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

  const handleDeleteHistory = (id) => {
    window.api.deleteEntry(id);
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const handleSaveWeights = () => {
    window.api.saveWeights(weights);
    window.api.saveDisplayConfig(displayConfig);
    window.api.saveMetrics(metrics);
    setView('record');
  };

  const handleAddMetric = () => {
    if (!newMetricName || !newMetricUnit) return;
    const randomColor = DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)];
    const newMetric = { 
      id: Date.now().toString(), label: newMetricName, unit: newMetricUnit, iconKey: newMetricIcon, color: randomColor, target: 0, showGoal: true 
    };
    
    const updatedMetrics = [...metrics, newMetric];
    setMetrics(updatedMetrics);
    window.api.saveMetrics(updatedMetrics);
    
    if (weights[newMetricName] === undefined) {
        const newWeights = { ...weights, [newMetricName]: 1 };
        setWeights(newWeights);
        window.api.saveWeights(newWeights);
    }
    setNewMetricName(''); setNewMetricUnit(''); setIsAdding(false);
  };

  const handleDeleteMetric = (metricId) => {
    const updated = metrics.filter(m => m.id !== metricId);
    setMetrics(updated);
    window.api.saveMetrics(updated);
  };

  const toggleMetricSelection = (label) => {
    if (displayConfig.mode === 'overlay') return;
    const isMultiMode = displayConfig.mode === 'multi';
    const targetKey = isMultiMode ? 'multiMetrics' : 'combinedMetrics';
    const currentList = displayConfig[targetKey] || [];
    let newList;
    if (currentList.includes(label)) {
      newList = currentList.filter(l => l !== label);
    } else {
      newList = [...currentList, label];
    }
    setDisplayConfig({ ...displayConfig, [targetKey]: newList });
    // 勾选也建议实时保存
    window.api.saveDisplayConfig({ ...displayConfig, [targetKey]: newList });
  };

  const handleMetricUpdate = (metricId, changes) => {
    const updatedMetrics = metrics.map(m => m.id === metricId ? { ...m, ...changes } : m);
    setMetrics(updatedMetrics);
    if (changes.showGoal !== undefined) window.api.saveMetrics(updatedMetrics);
  };

  // ✅ 核心功能：快速切换模式并自动保存
  const changeMode = (newMode) => {
    const newConfig = { ...displayConfig, mode: newMode };
    setDisplayConfig(newConfig);
    window.api.saveDisplayConfig(newConfig); // 立即保存
  };

  // ✅ Overlay 切换逻辑
  const toggleOverlay = () => {
    const targetMode = displayConfig.mode === 'overlay' ? 'multi' : 'overlay';
    changeMode(targetMode);
  };

  const toggleGoalVisibility = (key) => {
    const newConfig = { ...displayConfig, [key]: !displayConfig[key] };
    setDisplayConfig(newConfig);
    window.api.saveDisplayConfig(newConfig);
  };

  const toggleGoalMode = (modeName) => {
    const currentModes = displayConfig.individualGoalModes || [];
    let newModes;
    if (currentModes.includes(modeName)) {
      newModes = currentModes.filter(m => m !== modeName);
    } else {
      newModes = [...currentModes, modeName];
    }
    const newConfig = { ...displayConfig, individualGoalModes: newModes };
    setDisplayConfig(newConfig);
    window.api.saveDisplayConfig(newConfig);
  };

  const toggleTimeButton = (btnId) => {
    const current = displayConfig.visibleButtons || [];
    let next;
    if (current.includes(btnId)) next = current.filter(b => b !== btnId);
    else next = [...current, btnId];
    
    const newConfig = { ...displayConfig, visibleButtons: next };
    setDisplayConfig(newConfig);
    window.api.saveDisplayConfig(newConfig);
  };

  const handleAddCustomRange = () => {
    if (!newRangeLabel || !newRangeDays) return;
    
    let finalGrouping = newRangeGrouping;
    if (newRangeGrouping === 'custom_num') {
        const num = parseInt(newRangeCustomGroup);
        if (!num || num < 1) return;
        finalGrouping = num;
    }

    const newRange = {
      id: `custom_${Date.now()}`,
      label: newRangeLabel,
      days: Number(newRangeDays),
      grouping: finalGrouping
    };
    
    const nextCustom = [...(displayConfig.customRanges || []), newRange];
    const newConfig = { ...displayConfig, customRanges: nextCustom };
    setDisplayConfig(newConfig);
    window.api.saveDisplayConfig(newConfig);
    
    setNewRangeLabel(''); setNewRangeDays(''); setGroupingType('day'); setNewRangeCustomGroup(''); setIsAddingRange(false);
  };

  const handleDeleteCustomRange = (id) => {
    const nextCustom = (displayConfig.customRanges || []).filter(r => r.id !== id);
    const newConfig = { ...displayConfig, customRanges: nextCustom };
    setDisplayConfig(newConfig);
    window.api.saveDisplayConfig(newConfig);
  };

  const handleExport = async () => {
    const result = await window.api.exportData();
    if (result.success) alert("Backup saved successfully!");
    else if (!result.cancelled) alert("Export failed: " + result.error);
  };

  const handleImport = async () => {
    if (!confirm("⚠️ Restore will overwrite current data. Continue?")) return;
    const result = await window.api.importData();
    if (result.success) {
      loadData();
      window.api.getWeights().then(setWeights);
      window.api.getMetrics().then(setMetrics);
      window.api.getDisplayConfig().then(setDisplayConfig);
      alert("Data restored successfully!");
    } else if (!result.cancelled) alert("Import failed: " + result.error);
  };

  return (
    <div className="pointer-events-auto h-full w-full bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-white flex flex-col relative overflow-hidden">
      
      <div className="absolute top-4 left-4 z-20">
        {(view === 'settings' || view === 'goals' || view === 'ranges') && (
          <button onClick={handleSaveWeights} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-full text-white transition-all shadow-lg border border-white/10 group">
            <Save size={14} className="group-hover:scale-110 transition-transform"/>
            <span className="text-xs font-medium tracking-wide">SAVE</span>
          </button>
        )}
      </div>

      <div className="absolute top-4 right-4 flex gap-2 z-10">
        {view !== 'ranges' && <button onClick={() => setView('ranges')} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors" title="Time Ranges"><Clock size={18} /></button>}
        {view !== 'goals' && <button onClick={() => setView('goals')} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors" title="Set Goals"><Target size={18} /></button>}
        {view !== 'settings' && <button onClick={() => setView('settings')} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors" title="Configuration"><Settings size={18} /></button>}
        {(view !== 'settings' && view !== 'goals' && view !== 'ranges') && <button onClick={() => { setView(view === 'record' ? 'history' : 'record'); if (view !== 'record') loadData(); }} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors"><List size={18} /></button>}
        {(view === 'settings' || view === 'goals' || view === 'ranges') && <button onClick={() => { window.api.getWeights().then(setWeights); window.api.getDisplayConfig().then(setDisplayConfig); window.api.getMetrics().then(setMetrics); setView('record'); }} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors"><RotateCcw size={18} /></button>}
      </div>

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

      {view === 'history' && (
        <div className="flex-1 flex flex-col w-full animate-fade-in overflow-hidden pt-8 min-h-0">
          <h2 className="text-center text-white/50 text-xs mb-4 tracking-widest uppercase">History (Last 30)</h2>
          <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
            {history.map((item) => (
              <div key={item.id} className="group flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 hover:border-white/10 shrink-0">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-medium text-white">{item.value}</span>
                    <span className="text-xs text-white/50">{item.unit}</span>
                  </div>
                  <div className="text-xs text-white/30">{item.type} · {item.date}</div>
                </div>
                <button onClick={() => handleDeleteHistory(item.id)} className="p-2 text-red-400/50 hover:text-red-400 opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'ranges' && (
        <div className="flex-1 flex flex-col w-full animate-fade-in pt-8 min-h-0">
          <h2 className="text-center text-white/50 text-xs mb-6 tracking-widest uppercase">Time Ranges</h2>
          <div className="flex-1 space-y-6 overflow-y-auto px-2 custom-scrollbar pb-2">
            {/* ... Ranges Content (Same as before) ... */}
            {/* 为了节省篇幅，此处省略了 Ranges 视图内部渲染代码，请保持原样 */}
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
                      <div key={range.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5"><div className="flex flex-col"><span className="text-sm font-medium">{range.label}</span><div className="flex gap-2 text-[10px] text-white/30"><span>{range.days} Days</span><span className="opacity-50">•</span><span className="text-blue-300/70">{groupInfo}</span></div></div><button onClick={() => handleDeleteCustomRange(range.id)} className="p-1.5 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"><Trash2 size={14} /></button></div>
                    )
                })}
                {!isAddingRange ? (<button onClick={() => setIsAddingRange(true)} className="w-full py-2 border border-dashed border-white/20 rounded-lg text-white/40 text-xs hover:text-white hover:border-white/40 transition-colors flex items-center justify-center gap-2"><Plus size={14} /> Add Range</button>) : (<div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg space-y-3 animate-fade-in"><div className="flex flex-col gap-2"><div className="flex gap-2"><input placeholder="Label" value={newRangeLabel} onChange={e => setNewRangeLabel(e.target.value)} className="flex-1 bg-black/20 border border-white/10 rounded p-1.5 text-xs focus:outline-none focus:border-blue-400"/><input placeholder="Days" type="number" value={newRangeDays} onChange={e => setNewRangeDays(e.target.value)} className="w-16 bg-black/20 border border-white/10 rounded p-1.5 text-xs focus:outline-none focus:border-blue-400"/></div><div className="flex items-center gap-2 mt-1"><span className="text-[10px] text-white/40">Group By:</span><select value={newRangeGrouping} onChange={e => setNewRangeGrouping(e.target.value)} className="bg-black/40 border border-white/10 rounded p-1 text-xs text-white/70 outline-none flex-1"><option value="day">Day (Daily)</option><option value="week">Week (Weekly)</option><option value="month">Month (Monthly)</option><option value="custom_num">Custom Days...</option></select>{newRangeGrouping === 'custom_num' && (<input placeholder="N" type="number" value={newRangeCustomGroup} onChange={e => setNewRangeCustomGroup(e.target.value)} className="w-10 bg-black/20 border border-white/10 rounded p-1 text-center text-xs focus:outline-none focus:border-blue-400"/>)}</div></div><div className="flex gap-2 pt-2"><button onClick={handleAddCustomRange} className="flex-1 py-1.5 bg-blue-600 rounded text-xs hover:bg-blue-500">Add</button><button onClick={() => setIsAddingRange(false)} className="px-3 py-1.5 bg-white/5 rounded text-xs hover:bg-white/10">Cancel</button></div></div>)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Goals 视图 --- */}
      {view === 'goals' && (
        <div className="flex-1 flex flex-col w-full animate-fade-in pt-8 min-h-0">
          <h2 className="text-center text-white/50 text-xs mb-6 tracking-widest uppercase">Target Settings</h2>
          {/* ... Goals Code (保持不变) ... */}
          {/* 这里复用之前的 Goals 视图代码，未变动 */}
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

      {/* --- Settings 视图 (✅ 核心修改) --- */}
      {view === 'settings' && (
        <div className="flex-1 flex flex-col w-full animate-fade-in pt-8 min-h-0">
          <h2 className="text-center text-white/50 text-xs mb-4 tracking-widest uppercase">Display Mode</h2>
          
          <div className="flex gap-2 mx-2 mb-4">
            {/* ✅ 改为调用 changeMode 实现快速切换 */}
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
                <div className="flex items-center gap-2">
                  <div className="relative group/color">
                    <div className="w-5 h-5 rounded border border-white/20 overflow-hidden cursor-pointer shadow-sm" style={{ backgroundColor: displayConfig.combinedColor || '#60A5FA' }}></div>
                    <input type="color" value={displayConfig.combinedColor || '#60A5FA'} onChange={(e) => setDisplayConfig({...displayConfig, combinedColor: e.target.value})} onBlur={() => window.api.saveDisplayConfig(displayConfig)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"/>
                  </div>
                </div>
              </div>
            )}

            {displayConfig.mode === 'overlay' && (
              <div className="p-2 mb-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-[10px] text-blue-200 text-center animate-fade-in">Overlay Mode Active. Switch to <b>Combined</b> or <b>Multi</b> tabs to change selection.</div>
            )}

            {metrics.map(m => {
              const isMultiMode = displayConfig.mode === 'multi';
              const currentList = isMultiMode ? (displayConfig.multiMetrics || []) : (displayConfig.combinedMetrics || []);
              const isSelected = currentList.includes(m.label);
              const isModeEditable = displayConfig.mode === 'multi' || displayConfig.mode === 'combined';
              
              return (
                <div key={m.id} className={`flex items-center justify-between p-2 rounded-lg border shrink-0 transition-colors ${isSelected && isModeEditable ? 'bg-blue-500/10 border-blue-500/50' : 'bg-white/5 border-white/5'} ${!isModeEditable ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-3 overflow-hidden flex-1">
                    {isModeEditable && (
                      <button onClick={() => toggleMetricSelection(m.label)} className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-white/20 hover:border-white/50'}`}>
                        {isSelected && <Check size={10} />}
                      </button>
                    )}
                    <div className="opacity-70 text-blue-400 shrink-0" style={{ color: m.color || '#60A5FA' }}>{ICON_MAP[m.iconKey] || <Hash size={18}/>}</div>
                    <div className="flex flex-col"><span className="text-sm font-medium truncate">{m.label}</span><span className="text-[10px] text-white/30">{m.unit}</span></div>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    {/* ✅ Combined 模式下不显示颜色选择器 */}
                    {displayConfig.mode !== 'combined' && (
                      <div className="relative group/color">
                        <div className="w-3.5 h-3.5 rounded-full border border-white/20 overflow-hidden cursor-pointer" style={{ backgroundColor: m.color || '#60A5FA' }}></div>
                        <input type="color" value={m.color || '#60A5FA'} onChange={(e) => handleMetricUpdate(m.id, { color: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"/>
                      </div>
                    )}
                    
                    <div className="flex flex-col items-center">
                        <span className="text-[8px] text-white/30 uppercase leading-none">Wt</span>
                        <input type="number" step="0.1" value={weights[m.label] !== undefined ? weights[m.label] : 1} onChange={(e) => setWeights({ ...weights, [m.label]: parseFloat(e.target.value) })} onBlur={() => window.api.saveWeights(weights)} className="w-8 bg-black/20 border border-white/10 rounded p-0.5 text-center text-[10px] focus:outline-none focus:border-blue-500"/>
                    </div>

                    <button onClick={() => handleDeleteMetric(m.id)} className="p-1 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"><Trash2 size={12} /></button>
                  </div>
                </div>
              );
            })}

            {!isAdding ? (
               <button onClick={() => setIsAdding(true)} className="w-full py-2 border border-dashed border-white/20 rounded-lg text-white/40 text-xs hover:text-white hover:border-white/40 transition-colors flex items-center justify-center gap-2 shrink-0"><Plus size={14} /> Add New Metric</button>
            ) : (
               <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg space-y-3 animate-fade-in shrink-0">
                  <div className="flex gap-2">
                     <input placeholder="Name" value={newMetricName} onChange={e => setNewMetricName(e.target.value)} className="flex-1 bg-black/20 border border-white/10 rounded p-1.5 text-xs focus:outline-none focus:border-blue-400"/>
                     <input placeholder="Unit" value={newMetricUnit} onChange={e => setNewMetricUnit(e.target.value)} className="w-20 bg-black/20 border border-white/10 rounded p-1.5 text-xs focus:outline-none focus:border-blue-400"/>
                  </div>
                  <div className="flex flex-wrap gap-2">
                      {AVAILABLE_ICONS.map(iconKey => (
                        <button key={iconKey} onClick={() => setNewMetricIcon(iconKey)} className={`p-1.5 rounded transition-all ${newMetricIcon === iconKey ? 'bg-blue-500 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>{React.cloneElement(ICON_MAP[iconKey], { size: 14 })}</button>
                      ))}
                  </div>
                  <div className="flex gap-2 pt-1"><button onClick={handleAddMetric} className="flex-1 py-1.5 bg-blue-600 rounded text-xs hover:bg-blue-500">Confirm</button><button onClick={() => setIsAdding(false)} className="px-3 py-1.5 bg-white/5 rounded text-xs hover:bg-white/10">Cancel</button></div>
               </div>
            )}

            <div className="mt-8 pt-4 border-t border-white/10 pb-4">
              <div className="flex items-center gap-2 mb-3"><Save size={12} className="text-white/30"/><span className="text-[10px] uppercase text-white/30 tracking-widest">Data Backup</span></div>
              <div className="flex gap-2">
                <button onClick={handleExport} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-black/20 hover:bg-blue-600/20 border border-white/5 hover:border-blue-500/50 rounded-lg text-xs transition-all group"><Download size={14} className="text-blue-400 group-hover:text-blue-300" /> <span className="text-blue-100/80 group-hover:text-white">Export JSON</span></button>
                <button onClick={handleImport} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-black/20 hover:bg-red-600/20 border border-white/5 hover:border-red-500/50 rounded-lg text-xs transition-all group"><Upload size={14} className="text-red-400 group-hover:text-red-300" /> <span className="text-red-100/80 group-hover:text-white">Import JSON</span></button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ControlPanel;