/**
 * Ask Elara - AI Cybersecurity Guardian
 * Threat Card Component for displaying scan results
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
  const getCardClass = () => {
    switch (card.riskLevel.toLowerCase()) {
      case 'safe':
      case 'low':
        return 'safe';
      case 'medium':
      case 'suspicious':
        return 'suspicious';
      case 'high':
      case 'critical':
      case 'dangerous':
        return 'dangerous';
      default:
        return '';
    }
  };

  const getVerdictIcon = () => {
    switch (card.riskLevel.toLowerCase()) {
      case 'safe':
      case 'low':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <polyline points="20,6 9,17 4,12" />
          </svg>
        );
      case 'medium':
      case 'suspicious':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
        );
      case 'high':
      case 'critical':
      case 'dangerous':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        );
      default:
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9A3 3 0 0115 9.5C15 11 12 12 12 12" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        );
    }
  };

  return (
    <div className={`threat-card ${getCardClass()}`}>
      <div className="threat-header">
        <div className="threat-verdict">
          <div className={`verdict-icon ${getCardClass()}`}>
            {getVerdictIcon()}
          </div>
          <span className="verdict-text">{card.verdict}</span>
        </div>
        <div className="risk-badge">
          <span className="risk-level">{card.riskLevel}</span>
          <span className="risk-percent">{card.riskScore}%</span>
        </div>
      </div>

      {card.threatType && (
        <div className="threat-type">
          <span className="type-label">Threat Type:</span>
          <span className="type-value">{card.threatType}</span>
        </div>
      )}

      {card.indicators && card.indicators.length > 0 && (
        <div className="threat-indicators">
          <div className="indicators-label">Key Indicators</div>
          <ul className="indicators-list">
            {card.indicators.slice(0, 4).map((indicator, index) => (
              <li key={index} className={`indicator ${indicator.severity.toLowerCase()}`}>
                <span className="indicator-severity">{indicator.severity}</span>
                <span className="indicator-text">{indicator.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="threat-recommendation">
        <div className="recommendation-label">Recommendation</div>
        <div className="recommendation-text">{card.recommendation}</div>
      </div>
    </div>
  );
}
