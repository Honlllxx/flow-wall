import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import WallpaperOverlay from './components/WallpaperOverlay';
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