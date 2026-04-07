import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';

// 1. 引入壁纸组件
import WallpaperOverlay from './components/WallpaperOverlay';

// 2. 引入控制面板
import ControlPanel from './components/ControlPanel';

// 3. 引入应用列表窗口
import AppListPanel from './components/AppListPanel';

// 4. 引入应用详情面板
import AppDetailPanel from './components/AppDetailPanel';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/wallpaper" element={<WallpaperOverlay />} />
        <Route path="/control" element={<ControlPanel />} />
        <Route path="/app-list" element={<AppListPanel />} />
        <Route path="/app-detail" element={<AppDetailPanel />} />
      </Routes>
    </HashRouter>
  );
}

export default App;