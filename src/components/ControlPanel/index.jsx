import React, { useState } from 'react';
import { Save, AlertTriangle } from 'lucide-react';
import { useFlowData } from '../../hooks/useFlowData';
import Navigation from './Navigation';
import ConfirmModal from './ConfirmModal';

// Views
import RecordView from './views/RecordView';
import HistoryView from './views/HistoryView';
import SettingsView from './views/SettingsView';
import GoalsView from './views/GoalsView';
import RangesView from './views/RangesView';

const ControlPanel = () => {
  const { data, actions } = useFlowData();
  const [view, setView] = useState('record');
  
  // 删除确认状态
  const [deleteCandidate, setDeleteCandidate] = useState(null); 
  const [deleteType, setDeleteType] = useState(null); // 'metric' or 'range'

  const requestDeleteMetric = (id) => { setDeleteCandidate(id); setDeleteType('metric'); };
  const requestDeleteRange = (id) => { setDeleteCandidate(id); setDeleteType('range'); };

  const confirmDelete = () => {
      if (deleteType === 'metric') {
          const updated = data.metrics.filter(m => m.id !== deleteCandidate);
          actions.saveMetrics(updated);
      } else if (deleteType === 'range') {
          const nextCustom = (data.displayConfig.customRanges || []).filter(r => r.id !== deleteCandidate);
          actions.saveDisplayConfig({ ...data.displayConfig, customRanges: nextCustom });
      }
      setDeleteCandidate(null);
  };

  return (
    <div className="pointer-events-auto h-full w-full bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-white flex flex-col relative overflow-hidden">
      
      {/* 左上角 SAVE (仅在配置页显示，且点击触发手动保存权重等，虽然现在都是自动保存了，保留作为心理确认) */}
      {(view !== 'record' && view !== 'history') && (
        <div className="absolute top-4 left-4 z-20">
             <button onClick={() => setView('record')} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-full text-white transition-all shadow-lg border border-white/10 group">
                <Save size={14}/> <span className="text-xs font-medium tracking-wide">DONE</span>
             </button>
        </div>
      )}

      {/* 顶部导航 */}
      <Navigation view={view} setView={setView} actions={actions} />

      {/* 主视图区域 */}
      {view === 'record' && <RecordView data={data} actions={actions} isActive={view==='record'} />}
      {view === 'history' && <HistoryView data={data} actions={actions} />}
      {view === 'settings' && <SettingsView data={data} actions={actions} requestDeleteMetric={requestDeleteMetric} />}
      {view === 'goals' && <GoalsView data={data} actions={actions} />}
      {view === 'ranges' && <RangesView data={data} actions={actions} requestDeleteRange={requestDeleteRange} />}

      {/* 弹窗 */}
      {deleteCandidate && (
          <ConfirmModal onConfirm={confirmDelete} onCancel={() => setDeleteCandidate(null)} />
      )}
    </div>
  );
};

export default ControlPanel;