import { useState, useEffect } from 'react';

export const useFlowData = () => {
  const [history, setHistory] = useState([]); 
  const [allData, setAllData] = useState([]);
  const [weights, setWeights] = useState({});
  const [metrics, setMetrics] = useState([]);
  const [displayConfig, setDisplayConfig] = useState({ 
    mode: 'single', combinedMetrics: [], multiMetrics: [], combinedColor: '#60A5FA',
    combinedGoal: 0, showCombinedGoal: true, showIndividualGoals: true, individualGoalModes: ['single', 'multi', 'overlay'],
    visibleButtons: ['raw', 'hour', 'day'], customRanges: []
  });

  const loadData = () => {
    window.api.getData().then(data => {
      const sorted = [...data].reverse();
      setHistory(sorted);
      setAllData(sorted);
    });
  };

  useEffect(() => {
    loadData();
    window.api.getWeights().then(setWeights);
    window.api.getMetrics().then(setMetrics);
    window.api.getDisplayConfig().then(setDisplayConfig);

    const removeDataListener = window.api.onDataUpdate((newData) => {
        const sorted = [...newData].reverse();
        setHistory(sorted);
        setAllData(sorted);
    });
    
    // 注意：如果有其他 listener 也需要在这里处理 cleanup，但为了简化暂略
    // 实际开发中建议对每个 listener 都做 cleanup
  }, []);

  // --- Actions ---
  const addEntry = (data) => window.api.addEntry(data);
  const deleteEntry = (id) => window.api.deleteEntry(id);
  
  const saveWeights = (newWeights) => {
    setWeights(newWeights);
    window.api.saveWeights(newWeights);
  };

  const saveMetrics = (newMetrics) => {
    setMetrics(newMetrics);
    window.api.saveMetrics(newMetrics);
  };

  const saveDisplayConfig = (newConfig) => {
    setDisplayConfig(newConfig);
    window.api.saveDisplayConfig(newConfig);
  };

  const exportData = async () => {
    const result = await window.api.exportData();
    if (result.success) alert("Backup saved successfully!");
    else if (!result.cancelled) alert("Export failed: " + result.error);
  };

  const importData = async () => {
    if (!confirm("⚠️ Restore will overwrite current data. Continue?")) return;
    const result = await window.api.importData();
    if (result.success) {
      loadData();
      window.api.getWeights().then(setWeights);
      window.api.getMetrics().then(setMetrics);
      window.api.getDisplayConfig().then(setDisplayConfig);
      alert("Data restored successfully!");
    } else if (!result.cancelled) alert("Import failed: " + result.error);
  };

  return {
    data: { history, allData, weights, metrics, displayConfig },
    actions: { 
      addEntry, deleteEntry, saveWeights, saveMetrics, saveDisplayConfig, 
      exportData, importData, loadData 
    }
  };
};