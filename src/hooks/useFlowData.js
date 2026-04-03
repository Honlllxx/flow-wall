import { useState, useEffect } from 'react';

export const useFlowData = () => {
  const [allData, setAllData] = useState([]);
  const [history, setHistory] = useState([]); // 倒序的最近记录
  const [weights, setWeights] = useState({});
  const [metrics, setMetrics] = useState([]);
  const [displayConfig, setDisplayConfig] = useState({ 
    mode: 'single', combinedMetrics: [], multiMetrics: [], combinedColor: '#60A5FA',
    combinedGoal: 0, showCombinedGoal: true, showIndividualGoals: true, individualGoalModes: ['single', 'multi', 'overlay'],
    visibleButtons: ['raw', 'hour', 'day'], customRanges: []
  });
  const [autoLaunch, setAutoLaunch] = useState(false);

  const loadData = () => {
    if (window.api) {
        window.api.getData().then(data => {
            const sorted = [...data].reverse();
            setHistory(sorted);
            setAllData(sorted);
        });
    }
  };

  useEffect(() => {
    const init = async () => {
        if (window.api) {
            loadData();
            window.api.getWeights().then(setWeights);
            window.api.getMetrics().then(setMetrics);
            window.api.getDisplayConfig().then(setDisplayConfig);
            if (window.api.getAutoLaunch) window.api.getAutoLaunch().then(setAutoLaunch);
        }
    };
    init();

    if (window.api) {
        const removeDataListener = window.api.onDataUpdate((newData) => {
            const sorted = [...newData].reverse();
            setHistory(sorted);
            setAllData(sorted);
        });
        const removeMetricsListener = window.api.onMetricsUpdate ? window.api.onMetricsUpdate(setMetrics) : null;
        
        // Cleanup listener (Optional, usually fine to leave in Electron app)
    }
  }, []);

  // --- Actions ---
  const actions = {
      addEntry: (data) => window.api.addEntry(data),
      deleteEntry: (id) => window.api.deleteEntry(id),
      
      saveWeights: (newWeights) => {
          setWeights(newWeights);
          window.api.saveWeights(newWeights);
      },
      saveMetrics: (newMetrics) => {
          setMetrics(newMetrics);
          window.api.saveMetrics(newMetrics);
      },
      saveDisplayConfig: (newConfig) => {
          setDisplayConfig(newConfig);
          window.api.saveDisplayConfig(newConfig);
      },
      
      exportData: async () => {
          const result = await window.api.exportData();
          if (result.success) alert("Backup saved successfully!");
          else if (!result.cancelled) alert("Export failed: " + result.error);
      },
      importData: async () => {
          if (!confirm("⚠️ Restore will overwrite current data. Continue?")) return;
          const result = await window.api.importData();
          if (result.success) {
              loadData();
              window.api.getWeights().then(setWeights);
              window.api.getMetrics().then(setMetrics);
              window.api.getDisplayConfig().then(setDisplayConfig);
              alert("Data restored successfully!");
          } else if (!result.cancelled) alert("Import failed: " + result.error);
      },
      
      toggleAutoLaunch: () => {
          const newState = !autoLaunch;
          setAutoLaunch(newState);
          if (window.api.toggleAutoLaunch) window.api.toggleAutoLaunch(newState);
      },
      
      loadData // 暴露给 Navigation 刷新用
  };

  return {
    data: { allData, history, weights, metrics, displayConfig, autoLaunch },
    actions
  };
};