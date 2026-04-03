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
import SystemView from './views/SystemView'; // ✅ 引入新视图
import AppUsageView from './views/AppUsageView'; // ✅ 引入应用使用追踪视图

const ControlPanel = () => {
  const { data, actions } = useFlowData();
  const { displayConfig } = data;
  const [view, setView] = useState('record');
  
  // 删除确认状态
  const [deleteCandidate, setDeleteCandidate] = useState(null); 
  const [deleteType, setDeleteType] = useState(null); 

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

  // ✅ 计算动态样式
  const isLight = displayConfig.theme === 'light';
  const opacity = displayConfig.panelOpacity || 0.6;
  
  // 背景颜色逻辑：深色模式用黑，浅色模式用白
  // 使用 rgba 来控制透明度
  const bgStyle = {
      backgroundColor: isLight 
        ? `rgba(255, 255, 255, ${opacity})` 
        : `rgba(17, 24, 39, ${opacity})` // gray-900 equivalent
  };

  // 文字颜色类名
  const textColorClass = isLight ? 'text-gray-800' : 'text-white';

  return (
    <div 
        className={`pointer-events-auto h-full w-full backdrop-blur-xl border rounded-2xl p-6 flex flex-col relative overflow-hidden transition-colors duration-300 ${isLight ? 'border-black/10' : 'border-white/10'} ${textColorClass}`}
        style={bgStyle} // ✅ 应用动态透明度背景
    >
      
      {/* 左上角 SAVE (仅在配置页显示) */}
      {(view !== 'record' && view !== 'history') && (
        <div className="absolute top-4 left-4 z-20">
             <button 
                onClick={() => setView('record')} 
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all shadow-lg group ${isLight ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-blue-600 text-white hover:bg-blue-500 border border-white/10'}`}
             >
                <Save size={14}/> <span className="text-xs font-medium tracking-wide">DONE</span>
             </button>
        </div>
      )}

      {/* 顶部导航 */}
      <Navigation view={view} setView={setView} actions={actions} />

      {/* 主视图区域 */}
      {/* 将 isLight 传递给子视图，以便它们调整内部颜色 */}
      <div className="flex-1 flex flex-col w-full h-full min-h-0 relative">
          {view === 'record' && <RecordView data={data} actions={actions} isActive={view==='record'} isLight={isLight} />}
          {view === 'history' && <HistoryView data={data} actions={actions} isLight={isLight} />}
          {view === 'settings' && <SettingsView data={data} actions={actions} requestDeleteMetric={requestDeleteMetric} isLight={isLight} />}
          {view === 'goals' && <GoalsView data={data} actions={actions} isLight={isLight} />}
          {view === 'ranges' && <RangesView data={data} actions={actions} requestDeleteRange={requestDeleteRange} isLight={isLight} />}
          {/* ✅ 新增系统视图 */}
          {view === 'system' && <SystemView data={data} actions={actions} isLight={isLight} />}
          {/* ✅ 新增应用使用追踪视图 */}
          {view === 'appUsage' && <AppUsageView isLight={isLight} />}
      </div>

      {/* 弹窗 */}
      {deleteCandidate && (
          <ConfirmModal onConfirm={confirmDelete} onCancel={() => setDeleteCandidate(null)} isLight={isLight} />
      )}
    </div>
  );
};

export default ControlPanel;