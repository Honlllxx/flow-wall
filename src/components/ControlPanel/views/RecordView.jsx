import React, { useState, useRef, useEffect } from 'react';
import { Check, Hash, RotateCcw, Plus } from 'lucide-react';
import { ICON_MAP } from '../../../constants';

const RecordView = ({ data, actions, isActive }) => {
  const { metrics, displayConfig } = data;
  const [step, setStep] = useState(1);
  const [type, setType] = useState('');
  const [unit, setUnit] = useState('');
  const [val, setVal] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isActive && step === 2 && inputRef.current) inputRef.current.focus();
  }, [isActive, step]);

  const handleSelect = (m) => { setType(m.label); setUnit(m.unit); setStep(2); };
  const handleReset = () => { setStep(1); setVal(''); setType(''); setUnit(''); };

  const handleSubmit = (e) => {
    if (e.key === 'Enter' && val) {
      actions.addEntry({ type, unit, value: Number(val) });
      
      // 自动勾选逻辑
      let newConfig = { ...displayConfig };
      let configChanged = false;
      if ((newConfig.mode === 'multi' || newConfig.mode === 'overlay') && !newConfig.multiMetrics.includes(type)) {
        newConfig.multiMetrics = [...newConfig.multiMetrics, type];
        configChanged = true;
      } else if (newConfig.mode === 'combined' && !newConfig.combinedMetrics.includes(type)) {
        newConfig.combinedMetrics = [...newConfig.combinedMetrics, type];
        configChanged = true;
      }
      if (configChanged) actions.saveDisplayConfig(newConfig);

      setStep(3);
      setTimeout(() => { if (step === 3) handleReset(); }, 2000); // 2秒后自动重置，也可点按钮
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center">
      {step === 1 && (
        <div className="w-full animate-fade-in px-1 max-h-[340px] overflow-y-auto custom-scrollbar">
          <h2 className="text-center text-white/50 text-xs mb-4 tracking-widest uppercase">Select Metric</h2>
          <div className="grid grid-cols-2 gap-3">
            {metrics.map(m => (
              <button key={m.id} onClick={() => handleSelect(m)} className="flex flex-col items-center justify-center p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-transparent hover:border-white/20 shrink-0">
                <div className="mb-1 opacity-80" style={{ color: m.color || '#60A5FA' }}>{ICON_MAP[m.iconKey] || <Hash size={20}/>}</div>
                <span className="text-sm truncate max-w-full">{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="w-full text-center animate-fade-in relative">
          <button onClick={handleReset} className="absolute -top-8 left-0 p-1 text-white/20 hover:text-white transition-colors"><RotateCcw size={14} /></button>
          <h2 className="text-white/50 text-sm mb-6 tracking-widest">{type} ({unit})</h2>
          <input ref={inputRef} type="number" value={val} onChange={e => setVal(e.target.value)} onKeyDown={handleSubmit} placeholder="0" className="w-full bg-transparent text-6xl text-center font-thin focus:outline-none border-b border-white/20 focus:border-white/80 transition-colors pb-2"/>
          <p className="text-xs text-white/30 mt-4">Press Enter</p>
        </div>
      )}
      {step === 3 && (
        <div className="flex flex-col items-center animate-fade-in gap-4">
          <div className="flex flex-col items-center text-green-400"><Check size={48} /><span className="mt-2 text-sm tracking-widest uppercase">Saved</span></div>
          <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-xs transition-colors text-white/80"><Plus size={14} /> Record Another</button>
        </div>
      )}
    </div>
  );
};

export default RecordView;