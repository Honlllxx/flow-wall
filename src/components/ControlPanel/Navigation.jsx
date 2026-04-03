import React from 'react';
import { Settings, List, RotateCcw, Target, Clock, Sliders, Monitor } from 'lucide-react';

const Navigation = ({ view, setView, actions }) => {
  return (
    <div className="absolute top-4 right-4 flex gap-2 z-10">
      
      {/* 时间范围 */}
      {view !== 'ranges' && (
        <button onClick={() => setView('ranges')} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors" title="Time Ranges">
          <Clock size={18} />
        </button>
      )}

      {/* 目标设定 */}
      {view !== 'goals' && (
        <button onClick={() => setView('goals')} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors" title="Set Goals">
          <Target size={18} />
        </button>
      )}

      {/* 指标与显示配置 (原 Settings，现在图标改为 Sliders) */}
      {view !== 'settings' && (
        <button onClick={() => setView('settings')} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors" title="Metrics & Display">
          <Sliders size={18} />
        </button>
      )}
      
      {/* ✅ 新增：系统设置 (System) */}
      {view !== 'system' && (
        <button onClick={() => setView('system')} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors" title="Program Settings">
          <Settings size={18} />
        </button>
      )}
      
      {/* ✅ 新增：应用使用追踪 (App Usage) */}
      {view !== 'appUsage' && (
        <button onClick={() => setView('appUsage')} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors" title="App Usage Tracker">
          <Monitor size={18} />
        </button>
      )}
      
      {/* 历史/录入切换 */}
      {(view !== 'settings' && view !== 'goals' && view !== 'ranges' && view !== 'system' && view !== 'appUsage') && (
        <button onClick={() => { setView(view === 'record' ? 'history' : 'record'); if (view !== 'record') actions.loadData(); }} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors">
          {view === 'record' ? <List size={18} /> : <RotateCcw size={18} />}
        </button>
      )}
      
      {/* 返回录入 */}
      {(view === 'settings' || view === 'goals' || view === 'ranges' || view === 'system' || view === 'appUsage') && (
         <button onClick={() => { actions.loadData(); setView('record'); }} className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors">
           <RotateCcw size={18} />
         </button>
      )}
    </div>
  );
};

export default Navigation;