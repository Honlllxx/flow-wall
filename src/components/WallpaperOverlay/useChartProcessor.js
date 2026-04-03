import { useMemo } from 'react';
import { 
  STANDARD_RANGES, 
  getLocalDayKey, 
  getLocalMonthKey, 
  getMetricColor, 
  getScore 
} from './utils';

export const useChartProcessor = ({ allData, viewMode, weights, displayConfig, metrics }) => {
  
  return useMemo(() => {
    // 安全默认值
    const safeConfig = displayConfig || { 
        mode: 'single', combinedMetrics: [], multiMetrics: [], 
        visibleButtons: ['raw', 'hour', 'day'], customRanges: [] 
    };
    const safeMetrics = metrics || [];
    const safeWeights = weights || {};

    // 0. 基础判空
    if (!allData || allData.length === 0) {
        return { 
            chartData: [], 
            displayInfo: { title: 'WAITING FOR DATA...', subTitle: '', mainNumber: 0 }, 
            areas: [], 
            referenceLines: [], 
            maxY: 100, 
            activeButtons: [] 
        };
    }

    const combinedColor = safeConfig.combinedColor || '#60A5FA';

    // --- 1. 时间窗口计算 ---
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let startDate = new Date(todayStart);
    let grouping = 'day'; 
    let rangeLabel = 'CUSTOM';

    const stdRange = STANDARD_RANGES.find(r => r.id === viewMode);
    const customRange = (safeConfig.customRanges || []).find(r => r.id === viewMode);

    if (stdRange) {
        rangeLabel = stdRange.label;
        grouping = stdRange.grouping;
        if (viewMode === 'day') startDate.setDate(startDate.getDate() - 6);
        else if (viewMode === 'week') startDate.setDate(startDate.getDate() - (7 * 11)); 
        else if (viewMode === 'month' || viewMode === 'year') {
            startDate.setMonth(startDate.getMonth() - 11); 
            startDate.setDate(1); 
        }
    } else if (customRange) {
        rangeLabel = customRange.label;
        grouping = customRange.grouping || 'day';
        startDate.setDate(startDate.getDate() - (customRange.days - 1));
    }

    const isHourly = grouping === 'hour';
    const isRaw = grouping === 'raw';
    const isYear = viewMode === 'year';
    
    // --- 2. 确定激活指标 & 需补0的Key ---
    let activeMetrics = [];
    let combinedSelected = safeConfig.combinedMetrics || [];
    let multiSelected = safeConfig.multiMetrics || [];
    
    // ✅ 定义需要强制补0的字段列表
    let keysToZeroFill = [];

    if (safeConfig.mode === 'single') {
        const lastEntry = allData[allData.length - 1];
        if (lastEntry) activeMetrics = [lastEntry.type];
        keysToZeroFill = ['score'];
    } else if (safeConfig.mode === 'overlay') {
        activeMetrics = [...new Set([...combinedSelected, ...multiSelected])];
        // Overlay模式：Combined总分 + Multi独立线 都要补0
        keysToZeroFill = ['totalScore', ...multiSelected];
    } else if (safeConfig.mode === 'multi') {
        activeMetrics = multiSelected;
        // Multi模式：独立线补0
        keysToZeroFill = [...multiSelected];
    } else {
        // Combined模式
        activeMetrics = combinedSelected;
        keysToZeroFill = ['totalScore'];
    }

    // --- 3. 生成图表区域配置 ---
    let chartAreas = [];
    if (safeConfig.mode === 'single') {
        if (activeMetrics.length > 0) {
            chartAreas.push({ 
                key: 'score', 
                color: getMetricColor(safeMetrics, activeMetrics[0], 0), 
                fill: true, 
                gradientId: 'gradFill', 
                strokeWidth: 3 
            });
        }
    } else {
        // Combined / Overlay 背景
        if ((safeConfig.mode === 'overlay' || safeConfig.mode === 'combined') && combinedSelected.length > 0) {
            chartAreas.push({ 
                key: 'totalScore', 
                color: combinedColor, 
                fill: true, 
                gradientId: safeConfig.mode === 'overlay' ? 'totalFill' : 'combinedLineFill', 
                strokeWidth: safeConfig.mode === 'overlay' ? 0 : 3,
                isTotal: true
            });
        }
        // Multi / Overlay 线条
        if (safeConfig.mode === 'overlay' || safeConfig.mode === 'multi') {
            multiSelected.forEach((metric, idx) => {
                chartAreas.push({ 
                    key: metric, 
                    color: getMetricColor(safeMetrics, metric, idx), 
                    fill: false, 
                    gradientId: null, 
                    strokeWidth: 3 
                });
            });
        }
    }

    // --- 4. 数据处理 ---
    let processedData = [];
    let mainNumber = 0;

    if (isRaw) {
        // Raw Mode
        let rawSourceData = allData;
        if (safeConfig.mode === 'single') {
             const targetType = activeMetrics[0];
             rawSourceData = allData.filter(i => i.type === targetType);
        } else {
             rawSourceData = allData.filter(i => activeMetrics.includes(i.type));
        }
        
        const filtered = rawSourceData.slice(-30);
        
        processedData = filtered.map(item => {
            const point = { label: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
            
            // 填充真实数据
            const score = getScore(safeWeights, item.value, item.type);
            if (safeConfig.mode === 'single') {
                point.score = score;
            } else {
                if (multiSelected.includes(item.type)) point[item.type] = score;
                if (combinedSelected.includes(item.type)) point.totalScore = score; // Raw模式下Combined也是点对点
            }
            
            // ✅【强制补0】确保所有应该显示的线，在没有数据时都归零
            keysToZeroFill.forEach(key => {
                if (point[key] === undefined) point[key] = 0;
            });

            return point;
        });

        const last = processedData[processedData.length-1];
        if (safeConfig.mode === 'single') mainNumber = last ? last.score : 0;
        else if (safeConfig.mode === 'combined') mainNumber = last ? (last.totalScore || 0) : 0;
        else mainNumber = last ? (last.totalScore || 0) : 0;
        
        if (safeConfig.mode === 'multi' && filtered.length > 0) {
             const lastEntry = filtered[filtered.length-1];
             mainNumber = getScore(safeWeights, lastEntry.value, lastEntry.type);
        }
    } 
    else { 
        // Aggregation Mode
        const bucketMap = {};
        const getKey = (d) => {
            if (grouping === 'hour') return (getLocalDayKey(d) === getLocalDayKey(now)) ? d.getHours() : null;
            if (grouping === 'day') return getLocalDayKey(d);
            if (grouping === 'week') {
                const onejan = new Date(d.getFullYear(), 0, 1);
                const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
                return `${d.getFullYear()}-W${week}`;
            }
            if (grouping === 'month') return getLocalMonthKey(d);
            if (typeof grouping === 'number') {
                const diffTime = d.getTime() - startDate.getTime();
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
                if (diffDays < 0) return null;
                return Math.floor(diffDays / grouping);
            }
            return null;
        };

        // Init Buckets
        if (grouping === 'hour') {
            new Array(24).fill(0).forEach((_, i) => bucketMap[i] = {});
        } else {
            let loopDate = new Date(startDate);
            let safety = 0;
            while (loopDate <= now && safety < 1000) {
                const key = getKey(loopDate);
                if (key !== null) bucketMap[key] = {};
                loopDate.setDate(loopDate.getDate() + 1);
                safety++;
            }
        }

        // Fill Data
        allData.filter(i => activeMetrics.includes(i.type) && new Date(i.timestamp) >= startDate).forEach(i => {
             const d = new Date(i.timestamp);
             const key = getKey(d);
             if (bucketMap[key]) {
                 const s = getScore(safeWeights, i.value, i.type);
                 if (safeConfig.mode === 'single') {
                     bucketMap[key].score = (bucketMap[key].score || 0) + s;
                 } else {
                     if (multiSelected.includes(i.type)) bucketMap[key][i.type] = (bucketMap[key][i.type] || 0) + s;
                     if (combinedSelected.includes(i.type)) bucketMap[key].totalScore = (bucketMap[key].totalScore || 0) + s;
                 }
             }
        });

        const currentHour = now.getHours();
        processedData = Object.entries(bucketMap).map(([k, vals]) => {
            if (grouping === 'hour' && parseInt(k) > currentHour) return null;
            
            // ✅【强制补0】聚合模式下更需要补0
            keysToZeroFill.forEach(key => {
                if (vals[key] === undefined) vals[key] = 0;
            });

            let label = k;
            if (grouping === 'hour') label = `${k}:00`;
            else if (grouping === 'day') label = k.slice(5);
            else if (grouping === 'month') {
                const m = parseInt(k.split('-')[1]);
                label = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m-1] || k;
            } else if (typeof grouping === 'number') label = `B.${k}`;

            return { label, ...vals };
        }).filter(Boolean);

        let totalSum = 0;
        processedData.forEach(p => { 
            if (safeConfig.mode === 'single') totalSum += p.score;
            else if (safeConfig.mode === 'combined' || safeConfig.mode === 'overlay') totalSum += (p.totalScore || 0);
            else if (safeConfig.mode === 'multi') multiSelected.forEach(m => totalSum += (p[m] || 0));
        });
        mainNumber = Math.round(totalSum);
    }

    // --- Titles ---
    let title = "";
    let subTitle = "";
    if (safeConfig.mode === 'single') {
        const targetType = activeMetrics[0] || 'NONE';
        title = `${targetType} · ${rangeLabel}`;
        subTitle = `Total: ${mainNumber}`;
    } else {
        title = safeConfig.mode === 'overlay' ? `COMBINED · ${rangeLabel}` : (safeConfig.mode === 'multi' ? `MULTI · ${rangeLabel}` : `SUM · ${rangeLabel}`);
        subTitle = `Period Total: ${mainNumber}`;
    }

    // --- Goals ---
    let goalMultiplier = 1;
    if (grouping === 'week') goalMultiplier = 7;
    else if (grouping === 'month') goalMultiplier = 30; 
    else if (typeof grouping === 'number') goalMultiplier = grouping;

    let refLines = [];
    
    const showTotal = (safeConfig.mode === 'combined' || safeConfig.mode === 'overlay') && safeConfig.showCombinedGoal !== false && safeConfig.combinedGoal > 0;
    if (showTotal) {
      refLines.push({ value: safeConfig.combinedGoal * goalMultiplier, color: '#FFFFFF', label: 'GOAL', opacity: 0.9, width: 2 });
    }

    const showIndivGlobal = safeConfig.showIndividualGoals !== false;
    const allowedModes = safeConfig.individualGoalModes || ['single', 'multi', 'overlay'];
    const isModeAllowed = allowedModes.includes(safeConfig.mode);

    if (showIndivGlobal && isModeAllowed) {
        let goalMetrics = [];
        if (safeConfig.mode === 'single') goalMetrics = activeMetrics;
        else if (safeConfig.mode === 'multi' || safeConfig.mode === 'overlay') goalMetrics = multiSelected;
        else if (safeConfig.mode === 'combined') goalMetrics = combinedSelected; // Combined模式下显示选中项的目标线
        
        goalMetrics.forEach(mName => {
            const mDef = safeMetrics.find(m => m.label === mName);
            if (mDef && mDef.target > 0 && mDef.showGoal !== false) {
                const baseScore = getScore(safeWeights, Number(mDef.target), mName);
                const finalTarget = baseScore * goalMultiplier;
                if (finalTarget > 0) {
                    refLines.push({ value: finalTarget, color: mDef.color || '#FFF', label: mName.toUpperCase(), opacity: 0.6, width: 1 });
                }
            }
        });
    }

    const currentMaxData = Math.max(
        ...processedData.map(d => {
            const vals = Object.values(d).filter(v => typeof v === 'number');
            return Math.max(...vals, 0);
        }), 0
    );
    const maxGoal = refLines.length > 0 ? Math.max(...refLines.map(l => l.value)) : 0;
    const finalMaxY = Math.max(currentMaxData, maxGoal) * 1.15;

    // Buttons
    const activeButtons = (safeConfig.visibleButtons || ['raw', 'hour', 'day']).map(id => {
        return STANDARD_RANGES.find(r => r.id === id);
    }).filter(Boolean);
    (safeConfig.customRanges || []).forEach(r => {
        activeButtons.push({ id: r.id, label: r.label });
    });

    return { 
        chartData: processedData, 
        displayInfo: { title, subTitle, mainNumber }, 
        areas: chartAreas, 
        referenceLines: refLines, 
        maxY: finalMaxY,
        activeButtons 
    };
  }, [allData, viewMode, weights, displayConfig, metrics]);
};