/**
 * Elara AI Agent - Threat Card Component
 */

import React from 'react';

interface ThreatCardProps {
  card: {
    verdict: string;
    riskLevel: string;
    riskScore: number;
    threatType?: string;
    indicators: Array<{
      type: string;
      value: string;
      severity: string;
      description: string;
    }>;
    recommendation: string;
  };
}

export function ThreatCard({ card }: ThreatCardProps) {
  const getVerdictClass = (verdict: string) => {
    switch (verdict) {
      case 'SAFE': return 'safe';
      case 'SUSPICIOUS': return 'suspicious';
      case 'DANGEROUS': return 'dangerous';
      default: return 'unknown';
    }
  };

  const getVerdictIcon = (verdict: string) => {
    switch (verdict) {
      case 'SAFE': return 'check';
      case 'SUSPICIOUS': return 'warning';
      case 'DANGEROUS': return 'alert';
      default: return 'help';
    }
  };

  const getSeverityClass = (severity: string) => {
    switch (severity) {
      case 'critical': return 'critical';
      case 'high': return 'high';
      case 'medium': return 'medium';
      default: return 'low';
    }
  };

  const riskPercent = Math.round(card.riskScore * 100);

  return (
    <div className={`threat-card ${getVerdictClass(card.verdict)}`}>
      <div className="threat-header">
        <div className="threat-verdict">
          <span className={`verdict-icon ${getVerdictClass(card.verdict)}`}>
            {getVerdictIcon(card.verdict) === 'check' && (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17L4 12" />
              </svg>
            )}
            {getVerdictIcon(card.verdict) === 'warning' && (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 9V13M12 17H12.01M10.29 3.86L1.82 18A2 2 0 003.64 21H20.36A2 2 0 0022.18 18L13.71 3.86A2 2 0 0010.29 3.86Z" />
              </svg>
            )}
            {getVerdictIcon(card.verdict) === 'alert' && (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
            {getVerdictIcon(card.verdict) === 'help' && (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9A3 3 0 0115 9.5C15 11 12 12 12 12" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            )}
          </span>
          <span className="verdict-text">{card.verdict}</span>
        </div>
        <div className="risk-badge">
          <span className="risk-level">{card.riskLevel}</span>
          <span className="risk-percent">{riskPercent}%</span>
        </div>
      </div>

      {card.threatType && (
        <div className="threat-type">
          <span className="type-label">Threat Type:</span>
          <span className="type-value">{card.threatType}</span>
        </div>
      )}

      {card.indicators.length > 0 && (
        <div className="threat-indicators">
          <div className="indicators-label">Indicators Found:</div>
          <ul className="indicators-list">
            {card.indicators.slice(0, 5).map((indicator, index) => (
              <li key={index} className={`indicator ${getSeverityClass(indicator.severity)}`}>
                <span className="indicator-severity">{indicator.severity.toUpperCase()}</span>
                <span className="indicator-desc">{indicator.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="threat-recommendation">
        <div className="recommendation-label">Recommendation:</div>
        <div className="recommendation-text">{card.recommendation}</div>
      </div>
    </div>
  );
}
