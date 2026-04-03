import React from 'react';
import { 
  Power, Moon, Sun, Droplet, Save, Download, Upload, Trash2, Monitor, AlertOctagon
} from 'lucide-react';

const SystemView = ({ data, actions }) => {
  const { displayConfig, autoLaunch } = data;
  const { saveDisplayConfig, toggleAutoLaunch, exportData, importData, loadData } = actions;

  // 处理配置变更
  const updateConfig = (key, value) => {
    const newConfig = { ...displayConfig, [key]: value };
    saveDisplayConfig(newConfig);
  };

  // 恢复出厂设置 (清空数据但保留配置，或完全清空)
  const handleFactoryReset = async () => {
    if (confirm("DANGER: This will wipe ALL your history and settings. Are you sure?")) {
       if (confirm("Final Confirmation: This cannot be undone.")) {
           // 这里调用后端清空 store 的方法，或者简单地清除 electron-store
           // 为了演示，我们模拟清空数据逻辑
           // 实际项目中建议在 main.js 添加 store.clear() 的 IPC
           alert("Please implement store.clear() in main.js for full reset.");
       }
    }
  };

  const isDark = displayConfig.theme !== 'light';

  return (
    <div className="flex-1 flex flex-col w-full animate-fade-in pt-8 min-h-0">
      <h2 className={`text-center text-xs mb-6 tracking-widest uppercase ${isDark ? 'text-white/50' : 'text-black/50'}`}>
        System Settings
      </h2>
      
      <div className="flex-1 space-y-4 overflow-y-auto px-2 custom-scrollbar pb-2">
        
        {/* 1. Startup & Theme Group */}
        <div className={`p-1 rounded-xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}>
            
            {/* Auto Launch */}
            <div className={`flex items-center justify-between p-3 border-b ${isDark ? 'border-white/5' : 'border-black/5'}`}>
                <div className={`flex items-center gap-3 ${isDark ? 'text-white' : 'text-black'}`}>
                    <Power size={18} className="opacity-70"/>
                    <div className="flex flex-col">
                        <span className="text-xs font-medium">Auto Launch</span>
                        <span className="text-[10px] opacity-50">Start FlowWall on login</span>
                    </div>
                </div>
                <button 
                    onClick={toggleAutoLaunch} 
                    className={`w-10 h-5 rounded-full relative transition-colors ${autoLaunch ? 'bg-green-500' : (isDark ? 'bg-white/20' : 'bg-black/20')}`}
                >
                    <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${autoLaunch ? 'translate-x-5' : ''}`}></div>
                </button>
            </div>

            {/* Theme Mode */}
            <div className="flex items-center justify-between p-3">
                <div className={`flex items-center gap-3 ${isDark ? 'text-white' : 'text-black'}`}>
                    {isDark ? <Moon size={18} className="opacity-70"/> : <Sun size={18} className="opacity-70"/>}
                    <div className="flex flex-col">
                        <span className="text-xs font-medium">Appearance</span>
                        <span className="text-[10px] opacity-50">{isDark ? 'Dark Mode' : 'Light Mode'}</span>
                    </div>
                </div>
                <div className={`flex bg-black/20 rounded-lg p-0.5 ${isDark ? 'bg-black/40' : 'bg-black/10'}`}>
                    <button onClick={() => updateConfig('theme', 'light')} className={`p-1.5 rounded-md transition-all ${!isDark ? 'bg-white shadow text-black' : 'text-white/30 hover:text-white'}`}><Sun size={14}/></button>
                    <button onClick={() => updateConfig('theme', 'dark')} className={`p-1.5 rounded-md transition-all ${isDark ? 'bg-gray-700 shadow text-white' : 'text-black/30 hover:text-black'}`}><Moon size={14}/></button>
                </div>
            </div>
        </div>

        {/* 2. Visual Customization */}
        <div className={`p-4 rounded-xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}>
             <div className={`flex items-center gap-3 mb-3 ${isDark ? 'text-white' : 'text-black'}`}>
                <Droplet size={18} className="opacity-70"/>
                <span className="text-xs font-medium">Panel Opacity</span>
                <span className="text-xs opacity-50 ml-auto">{Math.round((displayConfig.panelOpacity || 0.6) * 100)}%</span>
             </div>
             <input 
                type="range" 
                min="0.2" max="1" step="0.05"
                value={displayConfig.panelOpacity || 0.6}
                onChange={(e) => updateConfig('panelOpacity', parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-500/30 rounded-lg appearance-none cursor-pointer accent-blue-500"
             />
        </div>

        {/* 3. Data Management */}
        <div className={`p-1 rounded-xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}>
            <div className={`px-3 py-2 text-[10px] uppercase tracking-widest opacity-40 ${isDark ? 'text-white' : 'text-black'}`}>Data Management</div>
            
            <button onClick={exportData} className={`w-full flex items-center gap-3 p-3 text-left hover:bg-white/5 transition-colors ${isDark ? 'text-blue-200' : 'text-blue-600'}`}>
                <Download size={16} />
                <span className="text-xs">Backup Data (Export JSON)</span>
            </button>
            
            <button onClick={importData} className={`w-full flex items-center gap-3 p-3 text-left hover:bg-white/5 transition-colors border-t ${isDark ? 'text-blue-200 border-white/5' : 'text-blue-600 border-black/5'}`}>
                <Upload size={16} />
                <span className="text-xs">Restore Data (Import JSON)</span>
            </button>
        </div>

        {/* 4. Danger Zone */}
        <div className="mt-4 pt-2">
            <button onClick={handleFactoryReset} className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 transition-colors">
                <AlertOctagon size={16} />
                <span className="text-xs font-medium">Factory Reset</span>
            </button>
        </div>

      </div>
    </div>
  );
};

export default SystemView;