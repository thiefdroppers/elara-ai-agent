/**
 * Elara AI Agent - Welcome Screen Component
 */

import React from 'react';

interface WelcomeScreenProps {
  onQuickAction: (action: string) => void;
}

export function WelcomeScreen({ onQuickAction }: WelcomeScreenProps) {
  return (
    <div className="welcome-screen">
      <div className="welcome-logo">
        <div className="logo-circle">
          <span>E</span>
        </div>
      </div>

      <h2 className="welcome-title">Hello! I'm Elara</h2>
      <p className="welcome-subtitle">Your AI-powered cybersecurity guardian</p>

      <div className="capabilities">
        <div className="capability">
          <div className="capability-icon scan">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <div className="capability-text">
            <h3>URL Scanning</h3>
            <p>Detect phishing & malware in real-time</p>
          </div>
        </div>

        <div className="capability">
          <div className="capability-icon deepfake">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21,15 16,10 5,21" />
            </svg>
          </div>
          <div className="capability-text">
            <h3>Deepfake Detection</h3>
            <p>Identify AI-manipulated images & videos</p>
          </div>
        </div>

        <div className="capability">
          <div className="capability-icon fact">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12A10 10 0 1112.93 2" />
              <polyline points="22,4 12,14.01 9,11.01" />
            </svg>
          </div>
          <div className="capability-text">
            <h3>Fact Checking</h3>
            <p>Verify claims against trusted sources</p>
          </div>
        </div>

        <div className="capability">
          <div className="capability-icon learn">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 3H22V21H2Z" />
              <path d="M7 8H17" />
              <path d="M7 12H17" />
              <path d="M7 16H13" />
            </svg>
          </div>
          <div className="capability-text">
            <h3>Security Education</h3>
            <p>Learn about cyber threats & protection</p>
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <button className="quick-action" onClick={() => onQuickAction('scan')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Scan Current Page
        </button>
        <button className="quick-action" onClick={() => onQuickAction('help')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9A3 3 0 0115 9.5C15 11 12 12 12 12" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          What Can You Do?
        </button>
      </div>

      <p className="welcome-hint">
        Paste a URL or type a question to get started
      </p>
    </div>
  );
}
