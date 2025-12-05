/**
 * Elara AI Agent - Debug Panel Component
 *
 * Displays debug logs, performance metrics, and system health.
 * Useful for troubleshooting and monitoring.
 */

import React, { useState, useEffect } from 'react';
import { debugStore } from '@/lib/logging/debug-store';
import { traceLogger } from '@/lib/logging/trace-logger';
import { performanceMonitor } from '@/lib/logging/performance-monitor';

export function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'health' | 'logs' | 'performance'>('health');
  const [health, setHealth] = useState(debugStore.getHealth());
  const [logs, setLogs] = useState(traceLogger.getLogs().slice(-50));
  const [perfSummary, setPerfSummary] = useState(performanceMonitor.getSummary());

  // Refresh data periodically
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setHealth(debugStore.getHealth());
      setLogs(traceLogger.getLogs().slice(-50));
      setPerfSummary(performanceMonitor.getSummary());
    }, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, [isOpen]);

  const exportDebugInfo = () => {
    const data = debugStore.export();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `elara-debug-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearLogs = () => {
    traceLogger.clearLogs();
    debugStore.clear();
    performanceMonitor.clear();
    setLogs([]);
    setPerfSummary({});
  };

  const getHealthColor = (status: string): string => {
    if (status === 'ready' || status === 'healthy') return '#48bb78';
    if (status === 'degraded') return '#ed8936';
    if (status === 'error' || status === 'offline') return '#f56565';
    return '#a0aec0';
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        className="debug-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title="Toggle Debug Panel"
      >
        {isOpen ? '✕' : '🐛'}
      </button>

      {/* Debug Panel */}
      {isOpen && (
        <div className="debug-panel">
          <div className="debug-header">
            <h3>Debug Panel</h3>
            <div className="debug-actions">
              <button onClick={exportDebugInfo} className="action-btn">
                Export
              </button>
              <button onClick={clearLogs} className="action-btn">
                Clear
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="debug-tabs">
            <button
              className={`tab ${activeTab === 'health' ? 'active' : ''}`}
              onClick={() => setActiveTab('health')}
            >
              System Health
            </button>
            <button
              className={`tab ${activeTab === 'logs' ? 'active' : ''}`}
              onClick={() => setActiveTab('logs')}
            >
              Logs ({logs.length})
            </button>
            <button
              className={`tab ${activeTab === 'performance' ? 'active' : ''}`}
              onClick={() => setActiveTab('performance')}
            >
              Performance
            </button>
          </div>

          {/* Content */}
          <div className="debug-content">
            {activeTab === 'health' && (
              <div className="health-view">
                <div className="health-item">
                  <span className="health-label">LLM Engine:</span>
                  <span
                    className="health-status"
                    style={{ color: getHealthColor(health.llmEngine) }}
                  >
                    {health.llmEngine}
                  </span>
                </div>
                <div className="health-item">
                  <span className="health-label">Edge Engine:</span>
                  <span
                    className="health-status"
                    style={{ color: getHealthColor(health.edgeEngine) }}
                  >
                    {health.edgeEngine}
                  </span>
                </div>
                <div className="health-item">
                  <span className="health-label">Cloud API:</span>
                  <span
                    className="health-status"
                    style={{ color: getHealthColor(health.cloudAPI) }}
                  >
                    {health.cloudAPI}
                  </span>
                </div>
                <div className="health-item">
                  <span className="health-label">Cache Hit Rate:</span>
                  <span className="health-value">
                    {(health.cacheStatus.hitRate * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="health-item">
                  <span className="health-label">Memory Usage:</span>
                  <span className="health-value">
                    {(health.memoryUsage.heapUsed / 1024 / 1024).toFixed(0)}MB /{' '}
                    {(health.memoryUsage.heapTotal / 1024 / 1024).toFixed(0)}MB
                  </span>
                </div>
              </div>
            )}

            {activeTab === 'logs' && (
              <div className="logs-view">
                {logs.length === 0 ? (
                  <div className="empty-state">No logs available</div>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className={`log-entry ${log.level.toLowerCase()}`}>
                      <span className="log-time">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="log-level">{log.level}</span>
                      <span className="log-component">{log.component}</span>
                      <span className="log-message">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'performance' && (
              <div className="performance-view">
                {Object.keys(perfSummary).length === 0 ? (
                  <div className="empty-state">No performance metrics available</div>
                ) : (
                  Object.entries(perfSummary).map(([name, metrics]) => (
                    <div key={name} className="perf-metric">
                      <div className="perf-name">{name}</div>
                      <div className="perf-stats">
                        <span>Avg: {metrics.avg.toFixed(0)}ms</span>
                        <span>P50: {metrics.p50.toFixed(0)}ms</span>
                        <span>P95: {metrics.p95.toFixed(0)}ms</span>
                        <span>Count: {metrics.count}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .debug-toggle {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: #2d3748;
          color: white;
          border: none;
          font-size: 20px;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          z-index: 1000;
          transition: transform 0.2s, background 0.2s;
        }

        .debug-toggle:hover {
          transform: scale(1.1);
          background: #1a202c;
        }

        .debug-panel {
          position: fixed;
          bottom: 80px;
          right: 20px;
          width: 450px;
          max-height: 600px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
          z-index: 999;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .debug-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: #2d3748;
          color: white;
        }

        .debug-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }

        .debug-actions {
          display: flex;
          gap: 8px;
        }

        .action-btn {
          padding: 6px 12px;
          background: #4a5568;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .action-btn:hover {
          background: #718096;
        }

        .debug-tabs {
          display: flex;
          background: #f7fafc;
          border-bottom: 1px solid #e2e8f0;
        }

        .tab {
          flex: 1;
          padding: 12px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
          color: #718096;
        }

        .tab.active {
          color: #667eea;
          border-bottom-color: #667eea;
          font-weight: 600;
        }

        .tab:hover {
          background: #edf2f7;
        }

        .debug-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .health-view,
        .logs-view,
        .performance-view {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .health-item {
          display: flex;
          justify-content: space-between;
          padding: 10px;
          background: #f7fafc;
          border-radius: 6px;
        }

        .health-label {
          font-weight: 600;
          color: #4a5568;
          font-size: 13px;
        }

        .health-status,
        .health-value {
          font-size: 13px;
          font-weight: 600;
        }

        .log-entry {
          padding: 8px;
          background: #f7fafc;
          border-radius: 4px;
          font-size: 12px;
          display: grid;
          grid-template-columns: auto auto 1fr 2fr;
          gap: 8px;
          align-items: center;
        }

        .log-entry.error {
          background: #fff5f5;
          border-left: 3px solid #f56565;
        }

        .log-entry.warn {
          background: #fffaf0;
          border-left: 3px solid #ed8936;
        }

        .log-time {
          color: #718096;
          font-family: monospace;
        }

        .log-level {
          padding: 2px 6px;
          background: #e2e8f0;
          border-radius: 3px;
          font-weight: 600;
          font-size: 10px;
        }

        .log-component {
          color: #667eea;
          font-weight: 600;
        }

        .log-message {
          color: #2d3748;
        }

        .perf-metric {
          padding: 12px;
          background: #f7fafc;
          border-radius: 6px;
        }

        .perf-name {
          font-weight: 600;
          color: #2d3748;
          margin-bottom: 8px;
          font-size: 13px;
        }

        .perf-stats {
          display: flex;
          gap: 12px;
          font-size: 12px;
          color: #718096;
        }

        .empty-state {
          text-align: center;
          padding: 40px;
          color: #a0aec0;
          font-size: 14px;
        }
      `}</style>
    </>
  );
}
