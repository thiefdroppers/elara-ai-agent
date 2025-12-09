/**
 * Ask Elara - AI Cybersecurity Guardian
 * Welcome Screen with ThiefDroppers Branding
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
          {/* ThiefDroppers Arrow Logo */}
          <svg width="56" height="56" viewBox="0 0 111.92 111.92" xmlns="http://www.w3.org/2000/svg">
            <polygon fill="#0070f3" points="55.82 45.56 55.82 94.9 42.78 81 42.78 51.79 54.99 45.15 55.81 44.64 55.81 45.56 55.82 45.56"/>
            <polygon fill="#03d8fb" points="69.46 51.93 69.46 81 55.82 94.9 55.82 44.64 56.22 44.89 56.63 45.15 69.46 51.93"/>
            <polygon fill="#0070f3" points="55.81 44.64 54.99 45.15 42.78 51.79 18.91 40.04 18.22 26.68 55.19 44.37 55.81 44.64"/>
            <polygon fill="#03d8fb" points="55.81 31.53 55.81 44.64 55.19 44.37 18.22 26.68 33.19 21.71 55.81 31.53"/>
            <polygon fill="#0070f3" points="93.71 26.68 93.01 40.04 69.46 51.92 69.46 51.93 56.63 45.15 56.22 44.89 55.82 44.64 55.82 44.63 56.07 44.53 56.45 44.37 93.71 26.68"/>
            <polygon fill="#03d8fb" points="93.71 26.68 56.45 44.37 56.07 44.53 55.82 44.63 55.82 44.37 55.81 44.37 55.81 31.53 78.73 21.71 93.71 26.68"/>
          </svg>
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
            <h3>URL & Link Scanning</h3>
            <p>Detect phishing, malware, and suspicious URLs in real-time</p>
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
            <p>Identify AI-manipulated images and videos</p>
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
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div className="capability-text">
            <h3>Security Education</h3>
            <p>Learn about cyber threats and how to protect yourself</p>
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
        <button className="quick-action" onClick={() => onQuickAction('tips')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
          </svg>
          Security Tips
        </button>
      </div>

      <p className="welcome-hint">
        Paste a URL or type a question to get started
      </p>
    </div>
  );
}
