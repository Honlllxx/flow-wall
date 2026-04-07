import React, { useState } from 'react';
import { Save, AlertTriangle, LayoutGrid, Lock } from 'lucide-react';
import { useFlowData } from '../../hooks/useFlowData';
import { useWindowInteraction } from '../../hooks/useWindowInteraction';
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
  const { isLocked, lockMessage, getInteractionStyle } = useWindowInteraction();
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
        className={`pointer-events-auto h-full w-full backdrop-blur-xl border rounded-2xl p-4 pb-6 flex flex-col relative transition-colors duration-300 ${isLight ? 'border-black/10' : 'border-white/10'} ${textColorClass}`}
        style={{ ...bgStyle, ...getInteractionStyle() }} // ✅ 应用动态透明度背景和交互锁定样式
    >
      {/* 交互锁定提示 */}
      {isLocked && (
        <div className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/20 rounded-2xl">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-xl ${isLight ? 'bg-white shadow-xl' : 'bg-gray-800 shadow-xl'}`}>
            <Lock size={20} className={isLight ? 'text-blue-600' : 'text-blue-400'} />
            <span className={`text-sm font-medium ${isLight ? 'text-gray-800' : 'text-white'}`}>
              {lockMessage || '正在调整窗口位置，请稍候...'}
            </span>
          </div>
        </div>
      )}
      
      {/* 左上角 SAVE (仅在配置页显示) */}
      {(view !== 'record' && view !== 'history' && view !== 'appList') && (
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

      {/* 主视图区域 - 添加顶部padding避免与导航栏重叠 */}
      {/* 将 isLight 传递给子视图，以便它们调整内部颜色 */}
      <div className="flex-1 flex flex-col w-full h-full min-h-0 relative pt-10 overflow-visible">
          {view === 'record' && <RecordView data={data} actions={actions} isActive={view==='record'} isLight={isLight} />}
          {view === 'history' && <HistoryView data={data} actions={actions} isLight={isLight} />}
          {view === 'settings' && <SettingsView data={data} actions={actions} requestDeleteMetric={requestDeleteMetric} isLight={isLight} />}
          {view === 'goals' && <GoalsView data={data} actions={actions} isLight={isLight} />}
          {view === 'ranges' && <RangesView data={data} actions={actions} requestDeleteRange={requestDeleteRange} isLight={isLight} />}
          {/* ✅ 新增系统视图 */}
          {view === 'system' && <SystemView data={data} actions={actions} isLight={isLight} />}
          {/* ✅ 新增应用使用追踪视图 */}
          {view === 'appUsage' && <AppUsageView isLight={isLight} />}
          {view === 'appList' && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className={`mb-4 p-4 rounded-2xl ${isLight ? 'bg-blue-50' : 'bg-blue-500/10'}`}>
                  <LayoutGrid size={48} className={isLight ? 'text-blue-600' : 'text-blue-400'} />
                </div>
                <h2 className={`text-xl font-bold mb-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>应用列表</h2>
                <p className={`text-sm mb-4 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>查看今日应用使用统计</p>
                <button 
                  onClick={() => window.api?.showAppList()} 
                  className={`px-6 py-3 rounded-xl font-medium transition-all ${isLight ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-blue-600 text-white hover:bg-blue-500'}`}
                >
                  打开应用列表
                </button>
              </div>
            </div>
          )}
      </div>

      {/* 弹窗 */}
      {deleteCandidate && (
          <ConfirmModal onConfirm={confirmDelete} onCancel={() => setDeleteCandidate(null)} isLight={isLight} />
      )}
    </div>
  );
};

export default ControlPanel;