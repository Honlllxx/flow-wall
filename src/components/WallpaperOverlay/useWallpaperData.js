import { useState, useEffect } from 'react';

export const useWallpaperData = () => {
  const [allData, setAllData] = useState([]);
  const [viewMode, setViewMode] = useState('raw'); 
  const [weights, setWeights] = useState({});
  const [displayConfig, setDisplayConfig] = useState({ 
    mode: 'single', combinedMetrics: [], multiMetrics: [], combinedColor: '#60A5FA',
    combinedGoal: 0, showCombinedGoal: true, showIndividualGoals: true, individualGoalModes: [],
    visibleButtons: ['raw', 'hour', 'day'], customRanges: []
  });
  const [metrics, setMetrics] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      if (window.api) {
        setAllData(await window.api.getData());
        setWeights(await window.api.getWeights());
        setDisplayConfig(await window.api.getDisplayConfig());
        setMetrics(await window.api.getMetrics());
      }
    };
    fetchData();

    if (window.api) {
        window.api.onDataUpdate(setAllData);
        window.api.onWeightsUpdate(setWeights);
        window.api.onDisplayConfigUpdate(setDisplayConfig);
        window.api.onMetricsUpdate(setMetrics);
    }
  }, []);

  return {
    allData,
    viewMode,
    setViewMode,
    weights,
    displayConfig,
    metrics
  };
};