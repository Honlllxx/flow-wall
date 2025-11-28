import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, BookOpen, Coffee, Zap, Check, Trash2, List, RotateCcw, 
  Settings, Save, Plus, Star, Hash, Smile, Heart, Code, Music, 
  Layers, Eye, GitGraph, Link2, Link2Off, Palette, Download, Upload, Target, EyeOff
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
    combinedGoal: 0, showCombinedGoal: true
  });

  const [newMetricName, setNewMetricName] = useState('');
  const [newMetricUnit, setNewMetricUnit] = useState('');
  const [newMetricIcon, setNewMetricIcon] = useState('star');
  const [isAdding, setIsAdding] = useState(false);

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
  };

  const handleMetricUpdate = (metricId, changes) => {
    const updatedMetrics = metrics.map(m => m.id === metricId ? { ...m, ...changes } : m);
    setMetrics(updatedMetrics);
    // 如果是 toggle 操作，立即保存，优化体验
    if (changes.showGoal !== undefined) {
        window.api.saveMetrics(updatedMetrics);
    }
  };

  const toggleOverlay = () => {
    if (displayConfig.mode === 'overlay') {
      setDisplayConfig({ ...displayConfig, mode: 'multi' });
    } else {
      setDisplayConfig({ ...displayConfig, mode: 'overlay' });
    }
  };

  const toggleGoalVisibility = (key) => {
    const newConfig = { ...displayConfig, [key]: !displayConfig[key] };
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
        {(view === 'settings' || view === 'goals') && (
          <button onClick={handleSaveWeights} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-full text-white transition-all shadow-lg border border-white/10 group">
            <Save size={14} className="group-hover:scale-110 transition-transform"/>
            <span className="text-xs font-medium tracking-wide">SAVE</span>
          </button>
        )}
      </div>

      <div className="absolute top-4 right-4 flex gap-2 z-10">
        {view !== 'goals' && (
          <button onClick={() => setView('goals')} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors" title="Set Goals"><Target size={18} /></button>
        )}
        {view !== 'settings' && (
          <button onClick={() => setView('settings')} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors" title="Configuration"><Settings size={18} /></button>
        )}
        {(view !== 'settings' && view !== 'goals') && (
          <button onClick={() => { setView(view === 'record' ? 'history' : 'record'); if (view !== 'record') loadData(); }} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors"><List size={18} /></button>
        )}
        {(view === 'settings' || view === 'goals') && (
           <button onClick={() => { window.api.getWeights().then(setWeights); window.api.getDisplayConfig().then(setDisplayConfig); window.api.getMetrics().then(setMetrics); setView('record'); }} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors"><RotateCcw size={18} /></button>
        )}
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

      {/* --- Goals 视图 --- */}
      {view === 'goals' && (
        <div className="flex-1 flex flex-col w-full animate-fade-in pt-8 min-h-0">
          <h2 className="text-center text-white/50 text-xs mb-6 tracking-widest uppercase">Target Settings</h2>
          
          <div className="flex-1 space-y-6 overflow-y-auto px-2 custom-scrollbar pb-2">
            
            {/* Total Goal */}
            <div className={`p-4 border rounded-xl transition-colors ${displayConfig.showCombinedGoal ? 'bg-gradient-to-br from-blue-900/30 to-purple-900/30 border-white/10' : 'bg-white/5 border-white/5 opacity-60'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-blue-200">
                  <Target size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider">Total Daily Energy</span>
                </div>
                <button onClick={() => toggleGoalVisibility('showCombinedGoal')} className={`p-1.5 rounded-full transition-colors ${displayConfig.showCombinedGoal ? 'bg-blue-500 text-white' : 'bg-white/10 text-white/30 hover:text-white'}`}>
                  {displayConfig.showCombinedGoal ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
              </div>
              <div className="flex items-end gap-2">
                <input type="number" value={displayConfig.combinedGoal || ''} onChange={(e) => setDisplayConfig({...displayConfig, combinedGoal: Number(e.target.value)})} onBlur={() => window.api.saveDisplayConfig(displayConfig)} placeholder="0" className="w-full bg-transparent text-4xl font-thin text-white border-b border-white/20 focus:border-blue-500 outline-none pb-1"/>
                <span className="text-xs text-white/40 mb-2 font-mono">PTS</span>
              </div>
              <p className="text-[10px] text-white/30 mt-2">Visible in Combined & Overlay modes.</p>
            </div>

            {/* Individual Goals */}
            <div>
              <div className="flex items-center justify-between mb-3 pl-1">
                <h3 className="text-[10px] uppercase text-white/30 tracking-widest">Individual Metrics</h3>
              </div>

              <div className="space-y-2">
                {metrics.map(m => (
                  <div key={m.id} className={`flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 transition-opacity ${m.showGoal !== false ? 'opacity-100' : 'opacity-60'}`}>
                    <div className="flex items-center gap-3">
                      <div className="opacity-70" style={{ color: m.color || '#60A5FA' }}>{ICON_MAP[m.iconKey] || <Hash size={18}/>}</div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{m.label}</span>
                        <span className="text-[10px] text-white/30">{m.unit}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {/* 目标值输入 */}
                      <div className="flex items-center gap-1">
                        <input 
                          type="number" placeholder="-" 
                          value={m.target ?? ''} 
                          onChange={(e) => handleMetricUpdate(m.id, { target: e.target.value === '' ? 0 : Number(e.target.value) })}
                          onBlur={() => window.api.saveMetrics(metrics)}
                          className="w-14 bg-black/20 border border-white/10 rounded p-1.5 text-center text-sm font-mono focus:outline-none focus:border-blue-500 text-yellow-200/90"
                        />
                      </div>
                      
                      {/* ✅ 独立显示开关 */}
                      <button 
                        onClick={() => handleMetricUpdate(m.id, { showGoal: m.showGoal === undefined ? false : !m.showGoal })} 
                        className={`p-1.5 rounded transition-colors ${m.showGoal !== false ? 'bg-white/10 text-white' : 'text-white/20 hover:text-white'}`}
                      >
                        {m.showGoal !== false ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* --- Settings 视图 --- */}
      {view === 'settings' && (
        <div className="flex-1 flex flex-col w-full animate-fade-in pt-8 min-h-0">
          <h2 className="text-center text-white/50 text-xs mb-4 tracking-widest uppercase">Display Mode</h2>
          
          <div className="flex gap-2 mx-2 mb-4">
            <button onClick={() => setDisplayConfig({ ...displayConfig, mode: 'single' })} className={`w-20 flex flex-col items-center justify-center py-2 rounded-lg transition-all border ${displayConfig.mode === 'single' ? 'bg-blue-600 text-white border-blue-500' : 'bg-white/5 border-white/10 text-white/40 hover:text-white'}`}>
              <Eye size={14} className="mb-1"/> <span className="text-[10px]">Auto</span>
            </button>
            <div className="flex-1 flex items-center bg-white/5 border border-white/10 rounded-lg p-1 relative">
                <button onClick={() => setDisplayConfig({ ...displayConfig, mode: 'combined' })} className={`flex-1 flex flex-col items-center justify-center py-2 rounded-md transition-all ${displayConfig.mode === 'combined' || displayConfig.mode === 'overlay' ? 'bg-blue-600/80 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}>
                  <Layers size={14} className="mb-1"/> <span className="text-[10px]">Combined</span>
                </button>
                <button onClick={toggleOverlay} className={`mx-1 p-1 rounded-full transition-all z-10 ${displayConfig.mode === 'overlay' ? 'bg-white text-blue-600 shadow-[0_0_10px_rgba(255,255,255,0.5)] scale-110' : 'bg-black/20 text-white/20 hover:text-white hover:bg-white/10'}`} title={displayConfig.mode === 'overlay' ? "Disconnect Overlay" : "Connect Overlay"}>
                  {displayConfig.mode === 'overlay' ? <Link2 size={12} strokeWidth={3} /> : <Link2Off size={12} />}
                </button>
                <button onClick={() => setDisplayConfig({ ...displayConfig, mode: 'multi' })} className={`flex-1 flex flex-col items-center justify-center py-2 rounded-md transition-all ${displayConfig.mode === 'multi' || displayConfig.mode === 'overlay' ? 'bg-blue-600/80 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}>
                  <GitGraph size={14} className="mb-1"/> <span className="text-[10px]">Multi</span>
                </button>
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
                    <input type="color" value={displayConfig.combinedColor || '#60A5FA'} onChange={(e) => setDisplayConfig({...displayConfig, combinedColor: e.target.value})} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"/>
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
                    <div className="relative group/color">
                      <div className="w-3.5 h-3.5 rounded-full border border-white/20 overflow-hidden cursor-pointer" style={{ backgroundColor: m.color || '#60A5FA' }}></div>
                      <input type="color" value={m.color || '#60A5FA'} onChange={(e) => handleMetricUpdate(m.id, { color: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"/>
                    </div>
                    
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
                  <div>
                    <div className="flex flex-wrap gap-2">
                      {AVAILABLE_ICONS.map(iconKey => (
                        <button key={iconKey} onClick={() => setNewMetricIcon(iconKey)} className={`p-1.5 rounded transition-all ${newMetricIcon === iconKey ? 'bg-blue-500 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>{React.cloneElement(ICON_MAP[iconKey], { size: 14 })}</button>
                      ))}
                    </div>
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