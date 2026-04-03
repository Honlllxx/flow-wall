import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';

// 1. 引入壁纸组件
// 如果你拆分了文件夹，路径通常是 ./components/WallpaperOverlay
// 如果没拆分，可能是 ./components/WallpaperOverlay.jsx
// Vite 会自动识别 index.jsx，所以直接引用文件夹即可
import WallpaperOverlay from './components/WallpaperOverlay';

// 2. 引入控制面板
// 同理，Vite 会自动寻找 ControlPanel.jsx 或 ControlPanel/index.jsx
import ControlPanel from './components/ControlPanel';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/wallpaper" element={<WallpaperOverlay />} />
        <Route path="/control" element={<ControlPanel />} />
      </Routes>
    </HashRouter>
  );
}

export default App;