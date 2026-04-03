import React from 'react';
import { Settings, List, RotateCcw, Target, Clock, Save } from 'lucide-react';

const Navigation = ({ view, setView, actions }) => {
  return (
    <div className="absolute top-4 right-4 flex gap-2 z-10">
      {view !== 'ranges' && (
        <button onClick={() => setView('ranges')} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors" title="Time Ranges">
          <Clock size={18} />
        </button>
      )}
      {view !== 'goals' && (
        <button onClick={() => setView('goals')} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors" title="Set Goals">
          <Target size={18} />
        </button>
      )}
      {view !== 'settings' && (
        <button onClick={() => setView('settings')} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors" title="Configuration">
          <Settings size={18} />
        </button>
      )}
      
      {(view !== 'settings' && view !== 'goals' && view !== 'ranges') && (
        <button onClick={() => { setView(view === 'record' ? 'history' : 'record'); if (view !== 'record') actions.loadData(); }} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors">
          {view === 'record' ? <List size={18} /> : <RotateCcw size={18} />}
        </button>
      )}
      
      {(view === 'settings' || view === 'goals' || view === 'ranges') && (
         <button onClick={() => { 
           // 切换回 record 时重新加载数据以确保状态同步
           actions.loadData(); 
           setView('record'); 
         }} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors">
           <RotateCcw size={18} />
         </button>
      )}
    </div>
  );
};

export default Navigation;