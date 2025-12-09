/**
 * Elara AI Security - Header Component
 * Ask Elara - Your Cybersecurity AI Assistant
 */

import React from 'react';

type Tab = 'scan' | 'history' | 'settings' | 'debug';

interface HeaderProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

// Elara Official Logo - ThiefDroppers Arrow Icon with Glow
function ElaraLogo(): React.ReactElement {
  return (
    <svg width="32" height="32" viewBox="0 0 111.92 111.92" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="headerBgGrad" x1="55.96" y1="10.25" x2="55.96" y2="113.18" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0230c0"/>
          <stop offset="1" stopColor="#020b86"/>
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      {/* Rounded square background */}
      <rect width="111.92" height="111.92" rx="12.95" ry="12.95" fill="url(#headerBgGrad)"/>
      {/* Left side - blue */}
      <polygon fill="#0070f3" points="55.82 45.56 55.82 94.9 42.78 81 42.78 51.79 54.99 45.15 55.81 44.64 55.81 45.56 55.82 45.56" filter="url(#glow)"/>
      {/* Right side - cyan */}
      <polygon fill="#03d8fb" points="69.46 51.93 69.46 81 55.82 94.9 55.82 44.64 56.22 44.89 56.63 45.15 69.46 51.93" filter="url(#glow)"/>
      {/* Top left wing - blue */}
      <polygon fill="#0070f3" points="55.81 44.64 54.99 45.15 42.78 51.79 18.91 40.04 18.22 26.68 55.19 44.37 55.81 44.64"/>
      {/* Top left arrow - cyan */}
      <polygon fill="#03d8fb" points="55.81 31.53 55.81 44.64 55.19 44.37 18.22 26.68 33.19 21.71 55.81 31.53"/>
      {/* Top right wing - blue */}
      <polygon fill="#0070f3" points="93.71 26.68 93.01 40.04 69.46 51.92 69.46 51.93 56.63 45.15 56.22 44.89 55.82 44.64 55.82 44.63 56.07 44.53 56.45 44.37 93.71 26.68"/>
      {/* Top right arrow - cyan */}
      <polygon fill="#03d8fb" points="93.71 26.68 56.45 44.37 56.07 44.53 55.82 44.63 55.82 44.37 55.81 44.37 55.81 31.53 78.73 21.71 93.71 26.68"/>
    </svg>
  );
}

export function Header({ activeTab, onTabChange }: HeaderProps): React.ReactElement {
  return (
    <header className="header">
      <div className="header-top">
        <div className="header-logo">
          <ElaraLogo />
        </div>
        <div>
          <div className="header-title">Ask Elara</div>
          <div className="header-version">AI Cybersecurity Guardian</div>
        </div>
      </div>

      <nav className="header-tabs">
        <button
          className={`header-tab ${activeTab === 'scan' ? 'active' : ''}`}
          onClick={() => onTabChange('scan')}
        >
          Scan
        </button>
        <button
          className={`header-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => onTabChange('history')}
        >
          History
        </button>
        <button
          className={`header-tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => onTabChange('settings')}
        >
          Settings
        </button>
        <button
          className={`header-tab ${activeTab === 'debug' ? 'active' : ''}`}
          onClick={() => onTabChange('debug')}
          style={{ color: activeTab === 'debug' ? '#03d8fb' : '#0070f3' }}
        >
          🔧
        </button>
      </nav>
    </header>
  );
}
