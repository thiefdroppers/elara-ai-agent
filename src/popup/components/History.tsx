/**
 * Elara Edge Engine - History Component
 */

import React, { useState, useEffect } from 'react';
import type { ScanResult } from '@/types';

export function History(): React.ReactElement {
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedResult, setSelectedResult] = useState<ScanResult | null>(null);

  useEffect(() => {
    async function loadHistory() {
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'getHistory',
          payload: { limit: 50 },
        });

        if (Array.isArray(response)) {
          setHistory(response);
        }
      } catch (err) {
        console.error('Failed to load history:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadHistory();
  }, []);

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // Less than 1 minute
    if (diff < 60000) {
      return 'Just now';
    }

    // Less than 1 hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes}m ago`;
    }

    // Less than 24 hours
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    }

    // More than 24 hours
    return date.toLocaleDateString();
  };

  const getVerdictIcon = (verdict: string): string => {
    const icons: Record<string, string> = {
      SAFE: '✓',
      SUSPICIOUS: '⚠',
      DANGEROUS: '🚫',
      UNKNOWN: '?',
    };
    return icons[verdict] || '?';
  };

  const truncateUrl = (url: string, maxLength = 40): string => {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
  };

  if (isLoading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <span>Loading history...</span>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="history-empty">
        <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
        <p>No scan history yet.</p>
        <p style={{ fontSize: 12, marginTop: 8 }}>
          Scanned URLs will appear here.
        </p>
      </div>
    );
  }

  // Show selected result detail
  if (selectedResult) {
    return (
      <div className="scan-result">
        <button
          onClick={() => setSelectedResult(null)}
          style={{
            background: 'none',
            border: 'none',
            color: '#3b82f6',
            cursor: 'pointer',
            fontSize: 13,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          ← Back to History
        </button>

        <div className="url-display">
          <div className="url-label">URL</div>
          <div className="url-text">{selectedResult.url}</div>
        </div>

        <div className="result-card">
          <div className={`result-header ${selectedResult.verdict.toLowerCase()}`}>
            <div className="result-icon">
              {getVerdictIcon(selectedResult.verdict)}
            </div>
            <div className="result-verdict">
              <div className={`verdict-text ${selectedResult.verdict.toLowerCase()}`}>
                {selectedResult.verdict}
              </div>
              <div className="verdict-decision">
                Scanned {formatTime(selectedResult.timestamp)}
              </div>
            </div>
            <div className="result-score">
              <div className="score-value">{selectedResult.riskScore}</div>
              <div className="score-label">Risk Score</div>
            </div>
          </div>

          <div className="result-details">
            <div className="detail-row">
              <span className="detail-label">Risk Level</span>
              <span className="detail-value">Grade {selectedResult.riskLevel}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Confidence</span>
              <span className="detail-value">
                {(selectedResult.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Decision</span>
              <span className="detail-value">{selectedResult.decision}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Scan Mode</span>
              <span className="detail-value">{selectedResult.source}</span>
            </div>
          </div>

          {selectedResult.reasoning && selectedResult.reasoning.length > 0 && (
            <div className="result-reasoning">
              <div className="reasoning-title">Analysis Details</div>
              <ul className="reasoning-list">
                {selectedResult.reasoning.map((reason, index) => (
                  <li key={index} className="reasoning-item">{reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show history list
  return (
    <div className="history-list">
      <div style={{ marginBottom: 16 }}>
        <span style={{ fontWeight: 600 }}>Recent Scans</span>
        <span style={{ color: '#64748b', marginLeft: 8 }}>
          ({history.length} results)
        </span>
      </div>

      {history.map((item, index) => (
        <div
          key={index}
          className="history-item"
          onClick={() => setSelectedResult(item)}
        >
          <div className="history-url" title={item.url}>
            {truncateUrl(item.url)}
          </div>
          <div className="history-meta">
            <span className={`history-verdict ${item.verdict.toLowerCase()}`}>
              {getVerdictIcon(item.verdict)} {item.verdict}
            </span>
            <span className="history-time">
              {formatTime(item.timestamp)}
            </span>
          </div>
        </div>
      ))}

      {/* Stats Summary */}
      <div style={{ marginTop: 24 }}>
        <div className="reasoning-title">Summary</div>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">
              {history.filter(h => h.verdict === 'SAFE').length}
            </div>
            <div className="stat-label">Safe</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#f59e0b' }}>
              {history.filter(h => h.verdict === 'SUSPICIOUS').length}
            </div>
            <div className="stat-label">Suspicious</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#dc2626' }}>
              {history.filter(h => h.verdict === 'DANGEROUS').length}
            </div>
            <div className="stat-label">Blocked</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#22c55e' }}>
              {history.filter(h => h.source === 'edge').length}
            </div>
            <div className="stat-label">Edge Scans</div>
          </div>
        </div>
      </div>
    </div>
  );
}
