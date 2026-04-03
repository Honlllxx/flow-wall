import React from 'react';
import { Target, Eye, EyeOff, Hash } from 'lucide-react';
import { ICON_MAP } from '../../../constants';

const GoalsView = ({ data, actions }) => {
  const { displayConfig, metrics } = data;
  const { saveDisplayConfig, saveMetrics } = actions;

  const toggleGoalVisibility = (key) => {
    const newConfig = { ...displayConfig, [key]: !displayConfig[key] };
    saveDisplayConfig(newConfig);
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
    saveDisplayConfig(newConfig);
  };

  const handleMetricUpdate = (metricId, changes) => {
    const updatedMetrics = metrics.map(m => m.id === metricId ? { ...m, ...changes } : m);
    saveMetrics(updatedMetrics);
  };

  return (
    <div className="flex-1 flex flex-col w-full animate-fade-in pt-8 min-h-0">
      <h2 className="text-center text-white/50 text-xs mb-6 tracking-widest uppercase">Target Settings</h2>
      <div className="flex-1 space-y-6 overflow-y-auto px-2 custom-scrollbar pb-2">
        
        {/* Total Goal */}
        <div className={`p-4 border rounded-xl transition-colors ${displayConfig.showCombinedGoal ? 'bg-gradient-to-br from-blue-900/30 to-purple-900/30 border-white/10' : 'bg-white/5 border-white/5 opacity-60'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-blue-200"><Target size={16} /><span className="text-xs font-bold uppercase tracking-wider">Total Daily Energy</span></div>
            <button onClick={() => toggleGoalVisibility('showCombinedGoal')} className={`p-1.5 rounded-full transition-colors ${displayConfig.showCombinedGoal ? 'bg-blue-500 text-white' : 'bg-white/10 text-white/30 hover:text-white'}`}>{displayConfig.showCombinedGoal ? <Eye size={14} /> : <EyeOff size={14} />}</button>
          </div>
          <div className="flex items-end gap-2">
            <input type="number" value={displayConfig.combinedGoal || ''} onChange={(e) => saveDisplayConfig({...displayConfig, combinedGoal: Number(e.target.value)})} placeholder="0" className="w-full bg-transparent text-4xl font-thin text-white border-b border-white/20 focus:border-blue-500 outline-none pb-1"/>
            <span className="text-xs text-white/40 mb-2 font-mono">PTS</span>
          </div>
          <p className="text-[10px] text-white/30 mt-2">Target for Combined & Overlay modes.</p>
        </div>

        {/* Individual Goals */}
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
                  <div className="flex items-center gap-1"><input type="number" placeholder="-" value={m.target ?? ''} onChange={(e) => handleMetricUpdate(m.id, { target: e.target.value === '' ? 0 : Number(e.target.value) })} className="w-14 bg-black/20 border border-white/10 rounded p-1.5 text-center text-sm font-mono focus:outline-none focus:border-blue-500 text-yellow-200/90"/></div>
                  <button onClick={() => handleMetricUpdate(m.id, { showGoal: m.showGoal === undefined ? false : !m.showGoal })} className={`p-1.5 rounded transition-colors ${m.showGoal !== false ? 'bg-white/10 text-white' : 'text-white/20 hover:text-white'}`}>{m.showGoal !== false ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoalsView;