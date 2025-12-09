/**
 * Elara AI Agent - Enhanced Loading State
 * Shows security tips while waiting for AI response
 */

import React, { useState, useEffect } from 'react';

// Security tips and facts that rotate during loading
const SECURITY_TIPS = [
  {
    icon: '🔐',
    title: 'Password Security',
    tip: 'Use a unique password for each account. Consider a password manager to keep track of them all.',
  },
  {
    icon: '🎣',
    title: 'Phishing Alert',
    tip: 'Always verify sender email addresses. Hover over links before clicking to see the actual URL.',
  },
  {
    icon: '📱',
    title: 'Mobile Safety',
    tip: 'Only download apps from official stores. Check app permissions before installing.',
  },
  {
    icon: '🔒',
    title: '2FA Protection',
    tip: 'Enable two-factor authentication on all important accounts for an extra layer of security.',
  },
  {
    icon: '🌐',
    title: 'Safe Browsing',
    tip: 'Look for HTTPS and the padlock icon before entering sensitive information on websites.',
  },
  {
    icon: '📧',
    title: 'Email Security',
    tip: 'Be cautious of urgent requests for personal info. Legitimate companies rarely ask via email.',
  },
  {
    icon: '💾',
    title: 'Backup Data',
    tip: 'Regularly backup important files. The 3-2-1 rule: 3 copies, 2 different media, 1 offsite.',
  },
  {
    icon: '🛡️',
    title: 'Software Updates',
    tip: 'Keep your OS and apps updated. Security patches fix vulnerabilities hackers exploit.',
  },
  {
    icon: '🔍',
    title: 'Deepfake Awareness',
    tip: 'AI can create fake videos and voices. Verify unexpected requests through a known channel.',
  },
  {
    icon: '📶',
    title: 'Public WiFi',
    tip: 'Avoid sensitive transactions on public WiFi. Use a VPN for secure browsing on open networks.',
  },
  {
    icon: '🎭',
    title: 'Social Engineering',
    tip: 'Scammers impersonate trusted contacts. Verify identity before sharing sensitive information.',
  },
  {
    icon: '💳',
    title: 'Financial Safety',
    tip: 'Monitor bank statements regularly. Set up transaction alerts for immediate fraud detection.',
  },
];

// Loading messages that progress over time
const LOADING_STAGES = [
  { time: 0, message: 'Analyzing your request...' },
  { time: 3000, message: 'Processing security data...' },
  { time: 6000, message: 'Gathering threat intelligence...' },
  { time: 10000, message: 'Almost there, this is a complex query...' },
  { time: 15000, message: 'Still working on it. Thanks for your patience!' },
  { time: 25000, message: 'Deep analysis in progress...' },
];

interface LoadingStateProps {
  startTime: number;
}

export function LoadingState({ startTime }: LoadingStateProps) {
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_STAGES[0].message);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Rotate tips every 5 seconds
  useEffect(() => {
    const tipInterval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % SECURITY_TIPS.length);
    }, 5000);

    return () => clearInterval(tipInterval);
  }, []);

  // Update loading message based on elapsed time
  useEffect(() => {
    const timeInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setElapsedTime(elapsed);

      // Find the appropriate message for current elapsed time
      for (let i = LOADING_STAGES.length - 1; i >= 0; i--) {
        if (elapsed >= LOADING_STAGES[i].time) {
          setLoadingMessage(LOADING_STAGES[i].message);
          break;
        }
      }
    }, 500);

    return () => clearInterval(timeInterval);
  }, [startTime]);

  const currentTip = SECURITY_TIPS[currentTipIndex];
  const showTips = elapsedTime > 2000; // Show tips after 2 seconds

  return (
    <div className="loading-state">
      {/* Main loading indicator */}
      <div className="loading-main">
        <div className="loading-avatar">
          <div className="pulse-ring"></div>
          <div className="loading-icon">
            <svg width="24" height="24" viewBox="0 0 111.92 111.92" xmlns="http://www.w3.org/2000/svg">
              <polygon fill="#0070f3" points="55.82 45.56 55.82 94.9 42.78 81 42.78 51.79 54.99 45.15 55.81 44.64 55.81 45.56 55.82 45.56"/>
              <polygon fill="#03d8fb" points="69.46 51.93 69.46 81 55.82 94.9 55.82 44.64 56.22 44.89 56.63 45.15 69.46 51.93"/>
              <polygon fill="#0070f3" points="55.81 44.64 54.99 45.15 42.78 51.79 18.91 40.04 18.22 26.68 55.19 44.37 55.81 44.64"/>
              <polygon fill="#03d8fb" points="55.81 31.53 55.81 44.64 55.19 44.37 18.22 26.68 33.19 21.71 55.81 31.53"/>
              <polygon fill="#0070f3" points="93.71 26.68 93.01 40.04 69.46 51.92 69.46 51.93 56.63 45.15 56.22 44.89 55.82 44.64 55.82 44.63 56.07 44.53 56.45 44.37 93.71 26.68"/>
              <polygon fill="#03d8fb" points="93.71 26.68 56.45 44.37 56.07 44.53 55.82 44.63 55.82 44.37 55.81 44.37 55.81 31.53 78.73 21.71 93.71 26.68"/>
            </svg>
          </div>
        </div>
        <div className="loading-content">
          <div className="loading-message">{loadingMessage}</div>
          <div className="loading-progress">
            <div className="progress-bar">
              <div className="progress-fill"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Security tip card - appears after 2 seconds */}
      {showTips && (
        <div className="security-tip-card">
          <div className="tip-header">
            <span className="tip-badge">💡 Security Tip</span>
          </div>
          <div className="tip-content">
            <span className="tip-icon">{currentTip.icon}</span>
            <div className="tip-text">
              <div className="tip-title">{currentTip.title}</div>
              <div className="tip-description">{currentTip.tip}</div>
            </div>
          </div>
          <div className="tip-indicators">
            {SECURITY_TIPS.slice(0, 5).map((_, index) => (
              <div
                key={index}
                className={`tip-dot ${index === currentTipIndex % 5 ? 'active' : ''}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default LoadingState;
