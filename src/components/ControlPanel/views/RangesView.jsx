import React, { useState } from 'react';
import { Eye, EyeOff, Trash2, Plus } from 'lucide-react';
import { STANDARD_RANGES } from '../../../constants';

const RangesView = ({ data, actions, requestDeleteRange }) => {
  const { displayConfig } = data;
  const { saveDisplayConfig } = actions;

  const [newRangeLabel, setNewRangeLabel] = useState('');
  const [newRangeDays, setNewRangeDays] = useState('');
  const [newRangeGrouping, setNewRangeGrouping] = useState('day'); 
  const [newRangeCustomGroup, setNewRangeCustomGroup] = useState(''); 
  const [isAddingRange, setIsAddingRange] = useState(false);

  const toggleTimeButton = (btnId) => {
    const current = displayConfig.visibleButtons || [];
    let next;
    if (current.includes(btnId)) next = current.filter(b => b !== btnId);
    else next = [...current, btnId];
    saveDisplayConfig({ ...displayConfig, visibleButtons: next });
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
    saveDisplayConfig({ ...displayConfig, customRanges: nextCustom });
    setNewRangeLabel(''); setNewRangeDays(''); setGroupingType('day'); setNewRangeCustomGroup(''); setIsAddingRange(false);
  };

  return (
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
  );
};

export default RangesView;