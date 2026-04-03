import React, { useState } from 'react';
import { Layers, Eye, GitGraph, Link2, Link2Off, Palette, Save, Download, Upload, Plus, Trash2, Check, Power } from 'lucide-react';
import { ICON_MAP, AVAILABLE_ICONS, DEFAULT_COLORS } from '../../../constants';

const SettingsView = ({ data, actions, requestDeleteMetric }) => {
  const { displayConfig, metrics, weights, autoLaunch } = data;
  const { saveDisplayConfig, saveMetrics, saveWeights, exportData, importData, toggleAutoLaunch } = actions;

  const [isAdding, setIsAdding] = useState(false);
  const [newMetricName, setNewMetricName] = useState('');
  const [newMetricUnit, setNewMetricUnit] = useState('');
  const [newMetricIcon, setNewMetricIcon] = useState('star');

  const changeMode = (mode) => saveDisplayConfig({ ...displayConfig, mode });
  const toggleOverlay = () => changeMode(displayConfig.mode === 'overlay' ? 'multi' : 'overlay');
  
  const toggleMetricSelection = (label) => {
    if (displayConfig.mode === 'overlay') return;
    const targetKey = displayConfig.mode === 'multi' ? 'multiMetrics' : 'combinedMetrics';
    const currentList = displayConfig[targetKey] || [];
    const newList = currentList.includes(label) ? currentList.filter(l => l !== label) : [...currentList, label];
    saveDisplayConfig({ ...displayConfig, [targetKey]: newList });
  };

  const handleMetricUpdate = (metricId, changes) => {
    const updatedMetrics = metrics.map(m => m.id === metricId ? { ...m, ...changes } : m);
    saveMetrics(updatedMetrics);
  };

  const handleAdd = () => {
      if(!newMetricName || !newMetricUnit) return;
      const newMetric = { 
          id: Date.now().toString(), label: newMetricName, unit: newMetricUnit, iconKey: newMetricIcon, 
          color: DEFAULT_COLORS[Math.floor(Math.random()*DEFAULT_COLORS.length)], target: 0, showGoal: true 
      };
      saveMetrics([...metrics, newMetric]);
      saveWeights({...weights, [newMetricName]: 1});
      setIsAdding(false); setNewMetricName(''); setNewMetricUnit('');
  };

  return (
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
                 <div className="flex gap-2 text-xs text-white/70 font-medium"><Palette size={14}/> Total Sum Color</div>
                 <div className="relative group/color"><div className="w-5 h-5 rounded border border-white/20 overflow-hidden cursor-pointer shadow-sm" style={{ backgroundColor: displayConfig.combinedColor || '#60A5FA' }}></div><input type="color" value={displayConfig.combinedColor || '#60A5FA'} onChange={e => saveDisplayConfig({...displayConfig, combinedColor: e.target.value})} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"/></div>
             </div>
         )}
         {displayConfig.mode === 'overlay' && <div className="p-2 mb-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-[10px] text-blue-200 text-center">Overlay Mode Active. Switch to <b>Combined</b> or <b>Multi</b> tabs to select metrics.</div>}

         {metrics.map(m => {
             const isMultiMode = displayConfig.mode === 'multi';
             const currentList = isMultiMode ? (displayConfig.multiMetrics || []) : (displayConfig.combinedMetrics || []);
             const isSelected = currentList.includes(m.label);
             const isModeEditable = displayConfig.mode === 'multi' || displayConfig.mode === 'combined';
             return (
                 <div key={m.id} className={`flex items-center justify-between p-2 rounded-lg border shrink-0 transition-colors ${isSelected && isModeEditable ? 'bg-blue-500/10 border-blue-500/50' : 'bg-white/5 border-white/5'} ${!isModeEditable ? 'opacity-50' : ''}`}>
                     <div className="flex items-center gap-3 overflow-hidden flex-1">
                         {displayConfig.mode !== 'single' && displayConfig.mode !== 'overlay' && (
                             <button onClick={() => toggleMetricSelection(m.label)} className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-white/20 hover:border-white/50'}`}>{isSelected && <Check size={10} />}</button>
                         )}
                         <div style={{color: m.color}}>{ICON_MAP[m.iconKey]}</div>
                         <div className="flex flex-col"><span className="text-sm font-medium truncate">{m.label}</span><span className="text-[10px] text-white/30">{m.unit}</span></div>
                     </div>
                     <div className="flex items-center gap-2">
                         {displayConfig.mode !== 'combined' && <div className="relative group/color"><div className="w-3.5 h-3.5 rounded-full border border-white/20 overflow-hidden cursor-pointer" style={{ backgroundColor: m.color || '#60A5FA' }}></div><input type="color" value={m.color || '#60A5FA'} onChange={e => handleMetricUpdate(m.id, { color: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"/></div>}
                         <div className="flex flex-col items-center"><span className="text-[8px] text-white/30">Wt</span><input type="number" value={weights[m.label]} onChange={e => saveWeights({...weights, [m.label]: parseFloat(e.target.value)})} className="w-12 bg-black/20 border border-white/10 rounded p-0.5 text-center text-[10px] focus:outline-none focus:border-blue-500"/></div>
                         <button onClick={() => requestDeleteMetric(m.id)} className="p-1 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"><Trash2 size={12}/></button>
                     </div>
                 </div>
             );
         })}

         {!isAdding ? (
            <button onClick={() => setIsAdding(true)} className="w-full py-2 border border-dashed border-white/20 rounded-lg text-white/40 text-xs hover:text-white hover:border-white/40 transition-colors flex items-center justify-center gap-2 shrink-0"><Plus size={14} /> Add New Metric</button>
         ) : (
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg space-y-3 animate-fade-in shrink-0">
               <div className="flex gap-2"><input placeholder="Name" value={newMetricName} onChange={e => setNewMetricName(e.target.value)} className="flex-1 bg-black/20 border border-white/10 rounded p-1.5 text-xs focus:outline-none focus:border-blue-400"/><input placeholder="Unit" value={newMetricUnit} onChange={e => setNewMetricUnit(e.target.value)} className="w-20 bg-black/20 border border-white/10 rounded p-1.5 text-xs focus:outline-none focus:border-blue-400"/></div>
               <div className="flex flex-wrap gap-2">{AVAILABLE_ICONS.map(iconKey => (<button key={iconKey} onClick={() => setNewMetricIcon(iconKey)} className={`p-1.5 rounded transition-all ${newMetricIcon === iconKey ? 'bg-blue-500 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>{React.cloneElement(ICON_MAP[iconKey], { size: 14 })}</button>))}</div>
               <div className="flex gap-2 pt-1"><button onClick={handleAdd} className="flex-1 py-1.5 bg-blue-600 rounded text-xs hover:bg-blue-500">Confirm</button><button onClick={() => setIsAdding(false)} className="px-3 py-1.5 bg-white/5 rounded text-xs hover:bg-white/10">Cancel</button></div>
            </div>
         )}

         <div className="mt-8 pt-4 border-t border-white/10 pb-4">
            <div className="flex items-center gap-2 mb-3"><Save size={12} className="text-white/30"/><span className="text-[10px] uppercase text-white/30 tracking-widest">Data Backup</span></div>
            <div className="flex gap-2">
               <button onClick={exportData} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-black/20 hover:bg-blue-600/20 border border-white/5 hover:border-blue-500/50 rounded-lg text-xs transition-all group"><Download size={14} className="text-blue-400 group-hover:text-blue-300" /> <span className="text-blue-100/80 group-hover:text-white">Export JSON</span></button>
               <button onClick={importData} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-black/20 hover:bg-red-600/20 border border-white/5 hover:border-red-500/50 rounded-lg text-xs transition-all group"><Upload size={14} className="text-red-400 group-hover:text-red-300" /> <span className="text-red-100/80 group-hover:text-white">Import JSON</span></button>
            </div>
            <div className="mt-4 pt-4 border-t border-white/10">
               <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2"><Power size={14} className="text-white/50"/><span className="text-xs text-white/70">Launch at Startup</span></div>
                   <button onClick={toggleAutoLaunch} className={`w-8 h-4 rounded-full relative transition-colors ${autoLaunch ? 'bg-blue-500' : 'bg-white/10'}`}><div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${autoLaunch ? 'translate-x-4' : ''}`}></div></button>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default SettingsView;