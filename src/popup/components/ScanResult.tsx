/**
 * Elara Edge Engine - Scan Result Component
 *
 * Displays scan results including:
 * - Quick scan results (Edge/Local AI)
 * - Deep scan results (Scanner V2 - full analysis)
 * - Model predictions with confidence
 * - Scanner V2 detailed findings
 */

import React, { useState, useEffect } from 'react';
import type { ScanResult as ScanResultType, DeepScanResult } from '@/types';

type AIStatus = 'idle' | 'loading' | 'ready' | 'error';

interface ScanResultProps {
  url: string;
  result: ScanResultType | null;
  deepScanResult: DeepScanResult | null;
  isScanning: boolean;
  isDeepScanning: boolean;
  error: string | null;
  deepScanError: string | null;
  onScan: () => void;
  onDeepScan: () => void;
}

export function ScanResult({
  url,
  result,
  deepScanResult,
  isScanning,
  isDeepScanning,
  error,
  deepScanError,
  onScan,
  onDeepScan,
}: ScanResultProps): React.ReactElement {
  const [showDetailedResults, setShowDetailedResults] = useState(false);
  const [aiStatus, setAIStatus] = useState<AIStatus>('idle');
  const [aiLoadingProgress, setAILoadingProgress] = useState<string>('');
  const [aiError, setAIError] = useState<string | null>(null);

  // Check AI status on mount
  useEffect(() => {
    chrome.runtime.sendMessage({ action: 'getAIStatus' }, (response) => {
      if (response?.status === 'ready') {
        setAIStatus('ready');
      }
    });
  }, []);

  const handleStartAI = async () => {
    setAIStatus('loading');
    setAILoadingProgress('Initializing...');
    setAIError(null);

    try {
      const response = await chrome.runtime.sendMessage({ action: 'preloadModels' });

      if (response?.success) {
        setAIStatus('ready');
        setAILoadingProgress('');
      } else {
        setAIStatus('error');
        setAIError(response?.error || 'Failed to load AI models');
      }
    } catch (err) {
      setAIStatus('error');
      setAIError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const verdictIcons: Record<string, string> = {
    SAFE: '✓',
    SUSPICIOUS: '⚠',
    DANGEROUS: '🚫',
    UNKNOWN: '?',
  };

  const verdictLabels: Record<string, string> = {
    SAFE: 'Safe',
    SUSPICIOUS: 'Suspicious',
    DANGEROUS: 'Dangerous',
    UNKNOWN: 'Unknown',
  };

  const decisionLabels: Record<string, string> = {
    ALLOW: 'Navigation allowed',
    WARN: 'Proceed with caution',
    BLOCK: 'Navigation blocked',
  };

  const sourceLabels: Record<string, string> = {
    edge: 'Edge (Local AI)',
    hybrid: 'Hybrid (Local + Cloud)',
    deep: 'Deep Scan (Scanner V2)',
  };

  // Determine if URL is scannable
  const isInternal = url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('about:');

  // Helper to classify error type for display
  const getErrorInfo = (errorMsg: string) => {
    if (errorMsg.includes('[TIMEOUT]')) {
      return { type: 'Timeout', icon: '⏱️', color: '#f97316' };
    }
    if (errorMsg.includes('[NETWORK_ERROR]')) {
      return { type: 'Network Error', icon: '🌐', color: '#ef4444' };
    }
    if (errorMsg.includes('[BACKEND_ERROR]')) {
      return { type: 'Backend Error', icon: '🔧', color: '#ef4444' };
    }
    if (errorMsg.includes('[AUTH_ERROR]')) {
      return { type: 'Auth Error', icon: '🔐', color: '#ef4444' };
    }
    return { type: 'Error', icon: '❌', color: '#ef4444' };
  };

  // Display error in a formatted way
  const renderError = (errorMsg: string, title: string) => {
    const errorInfo = getErrorInfo(errorMsg);
    return (
      <div className="error-card" style={{
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: 8,
        padding: 16,
        marginTop: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 20 }}>{errorInfo.icon}</span>
          <span style={{ fontWeight: 600, color: errorInfo.color }}>{title}: {errorInfo.type}</span>
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
          {errorMsg.replace(/^\[.*?\]\s*/, '')}
        </div>
      </div>
    );
  };

  // Render Scanner V2 detailed results
  const renderScannerV2Details = () => {
    const v2Data = deepScanResult?.scannerV2Data;
    if (!v2Data) return null;

    return (
      <div className="scanner-v2-details" style={{ marginTop: 16 }}>
        {/* Toggle button */}
        <button
          onClick={() => setShowDetailedResults(!showDetailedResults)}
          style={{
            width: '100%',
            padding: '12px 16px',
            background: 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)',
            border: 'none',
            borderRadius: 8,
            color: 'white',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>Scanner V2 Detailed Analysis</span>
          <span style={{ transform: showDetailedResults ? 'rotate(180deg)' : 'none', transition: '0.3s' }}>▼</span>
        </button>

        {showDetailedResults && (
          <div style={{ marginTop: 12 }}>
            {/* AI Summary */}
            {v2Data.aiSummary && (
              <div className="v2-section" style={{ background: 'var(--color-card)', borderRadius: 8, padding: 16, marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                  AI Analysis
                </div>
                {v2Data.aiSummary.explanation && (
                  <p style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>{v2Data.aiSummary.explanation}</p>
                )}
                {v2Data.aiSummary.keyFindings && v2Data.aiSummary.keyFindings.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 8 }}>Key Findings:</div>
                    <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                      {v2Data.aiSummary.keyFindings.map((finding, i) => (
                        <li key={i} style={{ padding: '4px 0 4px 16px', fontSize: 12, position: 'relative' }}>
                          <span style={{ position: 'absolute', left: 0 }}>•</span>
                          {finding}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Final Verdict */}
            {v2Data.finalVerdict && (
              <div className="v2-section" style={{ background: 'var(--color-card)', borderRadius: 8, padding: 16, marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                  Final Verdict
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{
                    padding: '8px 16px',
                    borderRadius: 20,
                    fontWeight: 700,
                    fontSize: 14,
                    background: v2Data.finalVerdict.verdict === 'SAFE' ? 'rgba(34, 197, 94, 0.15)' :
                               v2Data.finalVerdict.verdict === 'DANGEROUS' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(249, 115, 22, 0.15)',
                    color: v2Data.finalVerdict.verdict === 'SAFE' ? '#22c55e' :
                           v2Data.finalVerdict.verdict === 'DANGEROUS' ? '#ef4444' : '#f97316',
                  }}>
                    {v2Data.finalVerdict.verdict}
                  </div>
                  <div style={{ fontSize: 14 }}>
                    Trust Score: <strong>{v2Data.finalVerdict.trustScore}/100</strong>
                  </div>
                </div>
                {v2Data.finalVerdict.summary && (
                  <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--color-text-secondary)' }}>{v2Data.finalVerdict.summary}</p>
                )}
                {v2Data.finalVerdict.recommendation && (
                  <p style={{ fontSize: 12, marginTop: 8, padding: '8px 12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: 6, borderLeft: '3px solid #3b82f6' }}>
                    {v2Data.finalVerdict.recommendation}
                  </p>
                )}
              </div>
            )}

            {/* Stage 1 & Stage 2 ML Models */}
            {(v2Data.stage1 || v2Data.stage2) && (
              <div className="v2-section" style={{ background: 'var(--color-card)', borderRadius: 8, padding: 16, marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                  ML Model Predictions
                </div>
                {v2Data.stage1 && Object.entries(v2Data.stage1).map(([model, pred]) => (
                  <div key={`s1-${model}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                    <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>Stage 1: {model}</span>
                    <span style={{ fontWeight: 500, fontSize: 13 }}>
                      {((pred.probability || 0) * 100).toFixed(1)}%
                      <span style={{ color: '#64748b', marginLeft: 8 }}>({((pred.confidence || 0) * 100).toFixed(0)}% conf)</span>
                    </span>
                  </div>
                ))}
                {v2Data.stage2 && Object.entries(v2Data.stage2).map(([model, pred]) => (
                  <div key={`s2-${model}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                    <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>Stage 2: {model}</span>
                    <span style={{ fontWeight: 500, fontSize: 13 }}>
                      {((pred.probability || 0) * 100).toFixed(1)}%
                      <span style={{ color: '#64748b', marginLeft: 8 }}>({((pred.confidence || 0) * 100).toFixed(0)}% conf)</span>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Threat Intel */}
            {v2Data.threatIntel && (
              <div className="v2-section" style={{ background: 'var(--color-card)', borderRadius: 8, padding: 16, marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                  Threat Intelligence
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 600,
                    background: v2Data.threatIntel.hits > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                    color: v2Data.threatIntel.hits > 0 ? '#ef4444' : '#22c55e',
                  }}>
                    {v2Data.threatIntel.hits} hits
                  </span>
                  <span style={{ fontSize: 13 }}>{v2Data.threatIntel.verdict}</span>
                </div>
                {v2Data.threatIntel.sources && v2Data.threatIntel.sources.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    {v2Data.threatIntel.sources.map((src, i) => (
                      <div key={i} style={{ fontSize: 12, padding: '4px 0', color: 'var(--color-text-secondary)' }}>
                        {src.source}: {src.verdict} {src.severity && <span style={{ color: '#f97316' }}>({src.severity})</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Granular Checks */}
            {v2Data.granularChecks && v2Data.granularChecks.length > 0 && (
              <div className="v2-section" style={{ background: 'var(--color-card)', borderRadius: 8, padding: 16, marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                  Security Checks ({v2Data.granularChecks.length})
                </div>
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {v2Data.granularChecks.slice(0, 15).map((check, i) => (
                    <div key={i} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: '1px solid var(--color-border)',
                    }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{check.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{check.category}</div>
                      </div>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 600,
                        background: check.status === 'PASS' ? 'rgba(34, 197, 94, 0.15)' :
                                   check.status === 'FAIL' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                        color: check.status === 'PASS' ? '#22c55e' :
                               check.status === 'FAIL' ? '#ef4444' : '#64748b',
                      }}>
                        {check.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Category Results */}
            {v2Data.categoryResults && (
              <div className="v2-section" style={{ background: 'var(--color-card)', borderRadius: 8, padding: 16, marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                  Category Scores
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>
                    {v2Data.categoryResults.totalPoints}/{v2Data.categoryResults.totalPossible}
                  </div>
                  <div style={{
                    flex: 1,
                    height: 8,
                    background: 'var(--color-border)',
                    borderRadius: 4,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${(v2Data.categoryResults.totalPoints / v2Data.categoryResults.totalPossible) * 100}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #22c55e, #3b82f6)',
                      borderRadius: 4,
                    }} />
                  </div>
                </div>
                {v2Data.categoryResults.categories && v2Data.categoryResults.categories.map((cat, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12 }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{cat.categoryName}</span>
                    <span>{cat.points}/{cat.maxPoints} ({cat.percentage}%)</span>
                  </div>
                ))}
              </div>
            )}

            {/* Decision Graph */}
            {v2Data.decisionGraph && v2Data.decisionGraph.length > 0 && (
              <div className="v2-section" style={{ background: 'var(--color-card)', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                  Decision Pipeline
                </div>
                {v2Data.decisionGraph.map((stage, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 0',
                    borderBottom: i < v2Data.decisionGraph!.length - 1 ? '1px solid var(--color-border)' : 'none',
                  }}>
                    <span style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 600,
                      background: stage.status === 'PASS' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: stage.status === 'PASS' ? '#22c55e' : '#ef4444',
                    }}>
                      {stage.status === 'PASS' ? '✓' : '!'}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{stage.stage}</div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                      Risk: {(stage.riskContribution * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="scan-result">
      {/* URL Display */}
      <div className="url-display">
        <div className="url-label">Current URL</div>
        <div className="url-text">
          {url || 'No URL detected'}
        </div>
      </div>

      {/* Start Elara AI Button */}
      {!isInternal && aiStatus !== 'ready' && (
        <div style={{ marginBottom: 12 }}>
          <button
            onClick={handleStartAI}
            disabled={aiStatus === 'loading'}
            style={{
              width: '100%',
              padding: '14px 20px',
              background: aiStatus === 'loading'
                ? 'linear-gradient(135deg, #4b5563 0%, #6b7280 100%)'
                : aiStatus === 'error'
                  ? 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)'
                  : 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              border: 'none',
              borderRadius: 10,
              color: 'white',
              fontWeight: 600,
              fontSize: 14,
              cursor: aiStatus === 'loading' ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          >
            {aiStatus === 'loading' ? (
              <>
                <span className="spinner" style={{ width: 18, height: 18 }} />
                <span>Loading AI Models...</span>
              </>
            ) : aiStatus === 'error' ? (
              <>
                <span style={{ fontSize: 18 }}>⚠️</span>
                <span>Retry Load AI</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: 18 }}>🧠</span>
                <span>Start Elara AI</span>
              </>
            )}
          </button>
          {aiStatus === 'loading' && aiLoadingProgress && (
            <div style={{
              marginTop: 8,
              fontSize: 12,
              color: 'var(--color-text-secondary)',
              textAlign: 'center',
            }}>
              {aiLoadingProgress}
            </div>
          )}
          {aiStatus === 'error' && aiError && (
            <div style={{
              marginTop: 8,
              fontSize: 12,
              color: '#ef4444',
              textAlign: 'center',
            }}>
              {aiError}
            </div>
          )}
          {aiStatus === 'idle' && (
            <div style={{
              marginTop: 8,
              fontSize: 11,
              color: 'var(--color-text-muted)',
              textAlign: 'center',
            }}>
              Load pirocheto ML model for faster scans
            </div>
          )}
        </div>
      )}

      {/* AI Ready Indicator */}
      {aiStatus === 'ready' && (
        <div style={{
          marginBottom: 12,
          padding: '10px 16px',
          background: 'rgba(34, 197, 94, 0.1)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>✅</span>
          <span style={{ color: '#22c55e', fontWeight: 600, fontSize: 13 }}>
            Elara AI Ready
          </span>
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>
            (pirocheto model loaded)
          </span>
        </div>
      )}

      {/* Scan Buttons */}
      {!isInternal && (
        <div style={{ display: 'flex', gap: 8 }}>
          {/* Quick Scan Button */}
          <button
            className={`scan-button ${isScanning ? 'scanning' : ''}`}
            onClick={onScan}
            disabled={isScanning || isDeepScanning || !url}
            style={{ flex: 1 }}
          >
            {isScanning ? (
              <>
                <span className="spinner" style={{ width: 16, height: 16 }} />
                Scanning...
              </>
            ) : (
              <>Quick Scan</>
            )}
          </button>

          {/* Deep Scan Button */}
          <button
            className={`scan-button ${isDeepScanning ? 'scanning' : ''}`}
            onClick={onDeepScan}
            disabled={isScanning || isDeepScanning || !url}
            style={{
              flex: 1,
              background: isDeepScanning ? 'var(--color-card)' : 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
            }}
          >
            {isDeepScanning ? (
              <>
                <span className="spinner" style={{ width: 16, height: 16 }} />
                Analyzing...
              </>
            ) : (
              <>Deep Scan</>
            )}
          </button>
        </div>
      )}

      {/* Internal Page Notice */}
      {isInternal && (
        <div className="error-message">
          Internal browser pages cannot be scanned.
        </div>
      )}

      {/* Error Messages */}
      {error && renderError(error, 'Quick Scan Failed')}
      {deepScanError && renderError(deepScanError, 'Deep Scan Failed')}

      {/* Deep Scan Loading Progress */}
      {isDeepScanning && (
        <div style={{
          background: 'var(--color-card)',
          borderRadius: 8,
          padding: 20,
          textAlign: 'center',
          marginTop: 12,
        }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Running Scanner V2 Deep Analysis</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
            This may take 20-40 seconds...
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 12 }}>
            Analyzing: URL patterns, TI databases, ML models, DOM structure, TLS certificates...
          </div>
        </div>
      )}

      {/* Result Card */}
      {result && !isDeepScanning && (
        <div className="result-card">
          {/* Header */}
          <div className={`result-header ${result.verdict.toLowerCase()}`}>
            <div className="result-icon">
              {verdictIcons[result.verdict] || '?'}
            </div>
            <div className="result-verdict">
              <div className={`verdict-text ${result.verdict.toLowerCase()}`}>
                {verdictLabels[result.verdict] || 'Unknown'}
              </div>
              <div className="verdict-decision">
                {decisionLabels[result.decision] || 'Unknown'}
              </div>
            </div>
            <div className="result-score">
              <div className="score-value">{result.riskScore}</div>
              <div className="score-label">Risk Score</div>
            </div>
          </div>

          {/* Details */}
          <div className="result-details">
            <div className="detail-row">
              <span className="detail-label">Risk Level</span>
              <span className="detail-value">
                Grade {result.riskLevel}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Confidence</span>
              <span className="detail-value">
                {(result.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Confidence Interval</span>
              <span className="detail-value">
                {(result.confidenceInterval[0] * 100).toFixed(0)}% - {(result.confidenceInterval[1] * 100).toFixed(0)}%
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Scan Mode</span>
              <span className="detail-value">
                {sourceLabels[result.source] || result.source}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Latency</span>
              <span className="detail-value">
                {result.latency.toFixed(0)}ms
              </span>
            </div>
            {result.cached && (
              <div className="detail-row">
                <span className="detail-label">Source</span>
                <span className="detail-value">Cached</span>
              </div>
            )}
          </div>

          {/* Reasoning */}
          {result.reasoning && result.reasoning.length > 0 && (
            <div className="result-reasoning">
              <div className="reasoning-title">Analysis Details</div>
              <ul className="reasoning-list">
                {result.reasoning.slice(0, 5).map((reason, index) => (
                  <li key={index} className="reasoning-item">
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Model Predictions */}
          {result.models && Object.keys(result.models).length > 0 && (
            <div className="result-details">
              <div className="reasoning-title" style={{ marginBottom: 12 }}>
                Model Predictions
              </div>
              {Object.entries(result.models).map(([name, prediction]) => (
                prediction && (
                  <div key={name} className="detail-row">
                    <span className="detail-label" style={{ textTransform: 'capitalize' }}>
                      {name}
                    </span>
                    <span className="detail-value">
                      {(prediction.probability * 100).toFixed(1)}%
                      <span style={{ color: '#64748b', marginLeft: 8 }}>
                        ({prediction.latency?.toFixed(0) || 0}ms)
                      </span>
                    </span>
                  </div>
                )
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scanner V2 Detailed Results */}
      {deepScanResult && !isDeepScanning && renderScannerV2Details()}

      {/* Initial State */}
      {!result && !error && !isScanning && !isDeepScanning && !isInternal && (
        <div className="loading">
          <p style={{ textAlign: 'center', lineHeight: 1.6 }}>
            <strong>Quick Scan:</strong> Fast local AI analysis (~2-3s)<br />
            <strong>Deep Scan:</strong> Full Scanner V2 analysis (~20-40s)
          </p>
        </div>
      )}
    </div>
  );
}
