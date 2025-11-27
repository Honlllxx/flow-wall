import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, BookOpen, Coffee, Zap, Check, Trash2, List, RotateCcw, 
  Settings, Save, Plus, Star, Hash, Smile, Heart, Code, Music, Layers, Eye, GitGraph
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

const ControlPanel = () => {
  const [view, setView] = useState('record'); 
  const [step, setStep] = useState(1);
  const [type, setType] = useState('');
  const [unit, setUnit] = useState('');
  const [val, setVal] = useState('');
  const [history, setHistory] = useState([]); 
  const [weights, setWeights] = useState({});
  const [metrics, setMetrics] = useState([]);
  
  // ✅【修改】分离数据结构
  const [displayConfig, setDisplayConfig] = useState({ 
    mode: 'single', 
    combinedMetrics: [], // 专门用于 Combined 模式
    multiMetrics: []     // 专门用于 Multi 模式
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
    setView('record');
  };

  const handleAddMetric = () => {
    if (!newMetricName || !newMetricUnit) return;
    const newMetric = { id: Date.now().toString(), label: newMetricName, unit: newMetricUnit, iconKey: newMetricIcon };
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

  // ✅【核心修改】根据当前模式，操作不同的数组
  const toggleMetricSelection = (label) => {
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

  return (
    <div className="pointer-events-auto h-full w-full bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-white flex flex-col relative overflow-hidden">
      
      {/* 左上角 SAVE 按钮 */}
      <div className="absolute top-4 left-4 z-20">
        {view === 'settings' && (
          <button onClick={handleSaveWeights} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-full text-white transition-all shadow-lg border border-white/10 group">
            <Save size={14} className="group-hover:scale-110 transition-transform"/>
            <span className="text-xs font-medium tracking-wide">SAVE</span>
          </button>
        )}
      </div>

      {/* 右上角工具栏 */}
      <div className="absolute top-4 right-4 flex gap-2 z-10">
        {view !== 'settings' && (
          <button onClick={() => setView('settings')} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors">
            <Settings size={18} />
          </button>
        )}
        {view !== 'settings' && (
          <button onClick={() => { setView(view === 'record' ? 'history' : 'record'); if (view !== 'record') loadData(); }} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors">
            {view === 'record' ? <List size={18} /> : <RotateCcw size={18} />}
          </button>
        )}
        {view === 'settings' && (
           <button onClick={() => { window.api.getWeights().then(setWeights); window.api.getDisplayConfig().then(setDisplayConfig); setView('record'); }} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors">
             <RotateCcw size={18} />
           </button>
        )}
      </div>

      {/* --- 视图 1: 录入模式 --- */}
      {view === 'record' && (
        <div className="flex-1 flex flex-col items-center justify-center">
          {step === 1 && (
            <div className={`w-full animate-fade-in px-1 ${metrics.length > 12 ? 'max-h-[340px] overflow-y-auto custom-scrollbar' : ''}`}>
              <h2 className="text-center text-white/50 text-xs mb-4 tracking-widest uppercase">Select Metric</h2>
              <div className="grid grid-cols-2 gap-3">
                {metrics.map(m => (
                  <button key={m.id} onClick={() => handleSelect(m)} className="flex flex-col items-center justify-center p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all hover:scale-105 border border-transparent hover:border-white/20 shrink-0">
                    <div className="mb-1 opacity-80 text-blue-300">{ICON_MAP[m.iconKey] || <Hash size={20}/>}</div>
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

      {/* --- 视图 2: 历史模式 --- */}
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

      {/* --- 视图 3: 设置模式 --- */}
      {view === 'settings' && (
        <div className="flex-1 flex flex-col w-full animate-fade-in pt-8 min-h-0">
          <h2 className="text-center text-white/50 text-xs mb-4 tracking-widest uppercase">Display Mode</h2>
          
          {/* 模式切换 */}
          <div className="mx-2 mb-4 p-1 bg-white/5 rounded-lg flex border border-white/10">
            <button 
              onClick={() => setDisplayConfig({ ...displayConfig, mode: 'single' })}
              className={`flex-1 flex flex-col items-center justify-center py-2 rounded transition-all ${displayConfig.mode === 'single' ? 'bg-blue-600 text-white' : 'text-white/40 hover:text-white'}`}
            >
              <Eye size={14} className="mb-1"/> <span className="text-[10px]">Auto</span>
            </button>
            <button 
              onClick={() => setDisplayConfig({ ...displayConfig, mode: 'combined' })}
              className={`flex-1 flex flex-col items-center justify-center py-2 rounded transition-all ${displayConfig.mode === 'combined' ? 'bg-blue-600 text-white' : 'text-white/40 hover:text-white'}`}
            >
              <Layers size={14} className="mb-1"/> <span className="text-[10px]">Combined</span>
            </button>
            <button 
              onClick={() => setDisplayConfig({ ...displayConfig, mode: 'multi' })}
              className={`flex-1 flex flex-col items-center justify-center py-2 rounded transition-all ${displayConfig.mode === 'multi' ? 'bg-blue-600 text-white' : 'text-white/40 hover:text-white'}`}
            >
              <GitGraph size={14} className="mb-1"/> <span className="text-[10px]">Multi-View</span>
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-2 custom-scrollbar pb-2">
            
            {metrics.map(m => {
              // ✅【核心修改】根据当前 mode 读取不同的列表来判断是否勾选
              const isMultiMode = displayConfig.mode === 'multi';
              const currentList = isMultiMode ? (displayConfig.multiMetrics || []) : (displayConfig.combinedMetrics || []);
              const isSelected = currentList.includes(m.label);
              
              const isModeActive = displayConfig.mode !== 'single';
              
              return (
                <div key={m.id} className={`flex items-center justify-between p-2 rounded-lg border shrink-0 transition-colors ${isSelected && isModeActive ? 'bg-blue-500/10 border-blue-500/50' : 'bg-white/5 border-white/5'}`}>
                  
                  <div className="flex items-center gap-3 overflow-hidden flex-1">
                    {/* 复选框 */}
                    {isModeActive && (
                      <button 
                        onClick={() => toggleMetricSelection(m.label)}
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-white/20 hover:border-white/50'}`}
                      >
                        {isSelected && <Check size={10} />}
                      </button>
                    )}
                    
                    <div className="opacity-70 text-blue-400 shrink-0">
                        {ICON_MAP[m.iconKey] || <Hash size={18}/>}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium truncate">{m.label}</span>
                      <span className="text-[10px] text-white/30">{m.unit}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                     <span className="text-[10px] text-white/30">Wt:</span>
                     <input 
                      type="number" step="0.1"
                      value={weights[m.label] !== undefined ? weights[m.label] : 1}
                      onChange={(e) => setWeights({ ...weights, [m.label]: parseFloat(e.target.value) })}
                      className="w-12 bg-black/20 border border-white/10 rounded p-1 text-center text-xs focus:outline-none focus:border-blue-500"
                    />
                    <button onClick={() => handleDeleteMetric(m.id)} className="p-1.5 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}

            {!isAdding ? (
               <button onClick={() => setIsAdding(true)} className="w-full py-2 border border-dashed border-white/20 rounded-lg text-white/40 text-xs hover:text-white hover:border-white/40 transition-colors flex items-center justify-center gap-2 shrink-0">
                 <Plus size={14} /> Add New Metric
               </button>
            ) : (
               <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg space-y-3 animate-fade-in shrink-0">
                  <div className="flex gap-2">
                     <input placeholder="Name" value={newMetricName} onChange={e => setNewMetricName(e.target.value)} className="flex-1 bg-black/20 border border-white/10 rounded p-1.5 text-xs focus:outline-none focus:border-blue-400"/>
                     <input placeholder="Unit" value={newMetricUnit} onChange={e => setNewMetricUnit(e.target.value)} className="w-20 bg-black/20 border border-white/10 rounded p-1.5 text-xs focus:outline-none focus:border-blue-400"/>
                  </div>
                  <div>
                    <div className="flex flex-wrap gap-2">
                      {AVAILABLE_ICONS.map(iconKey => (
                        <button key={iconKey} onClick={() => setNewMetricIcon(iconKey)} className={`p-1.5 rounded transition-all ${newMetricIcon === iconKey ? 'bg-blue-500 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>
                          {React.cloneElement(ICON_MAP[iconKey], { size: 14 })}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={handleAddMetric} className="flex-1 py-1.5 bg-blue-600 rounded text-xs hover:bg-blue-500">Confirm</button>
                    <button onClick={() => setIsAdding(false)} className="px-3 py-1.5 bg-white/5 rounded text-xs hover:bg-white/10">Cancel</button>
                  </div>
               </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ControlPanel;