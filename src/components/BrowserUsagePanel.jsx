import React, { useState, useEffect } from 'react';
import { Globe, ExternalLink, Download, Upload, Clock, AlertCircle } from 'lucide-react';

const BrowserUsagePanel = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [browserExtensionInstalled, setBrowserExtensionInstalled] = useState(false);
  const [importStatus, setImportStatus] = useState('');

  useEffect(() => {
    loadBrowserData();
    checkBrowserExtension();
  }, []);

  const loadBrowserData = async () => {
    setLoading(true);
    try {
      const recordsData = await window.api.getBrowserUsageRecords({ limit: 50 });
      setRecords(recordsData);
    } catch (error) {
      console.error('加载浏览器数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkBrowserExtension = () => {
    // 这里应该检查浏览器扩展是否安装
    // 暂时设为false
    setBrowserExtensionInstalled(false);
  };

  const importBrowserData = async () => {
    // 这里应该从浏览器扩展导入数据
    // 暂时显示提示
    setImportStatus('浏览器扩展功能尚未实现');
    setTimeout(() => setImportStatus(''), 3000);
  };

  const exportBrowserData = async () => {
    try {
      const result = await window.api.exportBrowserUsageData('csv');
      if (result.success) {
        alert(`数据已导出到: ${result.filePath}`);
      } else if (!result.cancelled) {
        alert(`导出失败: ${result.error}`);
      }
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出失败，请重试');
    }
  };

  const formatDuration = (milliseconds) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours} 小时 ${minutes % 60} 分钟`;
    } else if (minutes > 0) {
      return `${minutes} 分钟 ${seconds % 60} 秒`;
    } else {
      return `${seconds} 秒`;
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDomainFromUrl = (url) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  const openUrl = (url) => {
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-2"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* 头部控制栏 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Globe className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-semibold">网站使用时间</h2>
        </div>

        <div className="flex items-center space-x-2">
          {!browserExtensionInstalled && (
            <div className="flex items-center px-3 py-1 bg-yellow-100 text-yellow-800 rounded-md">
              <AlertCircle className="w-4 h-4 mr-1" />
              <span className="text-sm">需要安装浏览器扩展</span>
            </div>
          )}

          <button
            onClick={importBrowserData}
            className="px-3 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200 flex items-center space-x-1"
            disabled={!browserExtensionInstalled}
          >
            <Upload className="w-4 h-4" />
            <span>导入数据</span>
          </button>

          <button
            onClick={exportBrowserData}
            className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 flex items-center space-x-1"
          >
            <Download className="w-4 h-4" />
            <span>导出数据</span>
          </button>
        </div>
      </div>

      {importStatus && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <p className="text-blue-700 text-sm">{importStatus}</p>
        </div>
      )}

      {/* 功能介绍 */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h3 className="font-medium mb-2">如何使用网站使用时间功能</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>1. 安装 Chrome/Firefox 浏览器扩展</li>
          <li>2. 扩展会自动记录您访问的网站和使用时间</li>
          <li>3. 点击"导入数据"将浏览器数据同步到本应用</li>
          <li>4. 查看网站使用统计和分析报告</li>
        </ul>
        <div className="mt-3">
          <button className="text-blue-600 hover:text-blue-800 text-sm">
            下载浏览器扩展 →
          </button>
        </div>
      </div>

      {/* 记录列表 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">最近访问记录</h3>
            <div className="flex items-center text-sm text-gray-500">
              <Clock className="w-4 h-4 mr-1" />
              <span>{records.length} 条记录</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">网站</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">标题</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">开始时间</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">使用时长</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {records.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                    暂无浏览器使用记录
                    <p className="text-sm mt-1">请先安装浏览器扩展并导入数据</p>
                  </td>
                </tr>
              ) : (
                records.map(record => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center mr-2">
                          <Globe className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {getDomainFromUrl(record.url)}
                          </div>
                          <div className="text-xs text-gray-500 truncate max-w-xs" title={record.url}>
                            {record.url}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-700 truncate max-w-xs" title={record.title}>
                        {record.title || '无标题'}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {formatTime(record.startTime)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatDuration(record.duration)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <button
                        onClick={() => openUrl(record.url)}
                        className="text-blue-600 hover:text-blue-900 flex items-center"
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        打开
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 统计信息 */}
      {records.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-medium mb-4">网站使用统计</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">总使用时间</p>
              <p className="text-xl font-bold text-gray-800">
                {formatDuration(records.reduce((sum, record) => sum + (record.duration || 0), 0))}
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">访问网站数量</p>
              <p className="text-xl font-bold text-gray-800">
                {new Set(records.map(r => getDomainFromUrl(r.url))).size} 个
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BrowserUsagePanel;