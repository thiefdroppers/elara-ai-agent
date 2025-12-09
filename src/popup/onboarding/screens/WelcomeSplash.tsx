/**
 * Elara AI Security - Welcome Splash Screen
 * First screen with animated logo and call to action
 */

import React from 'react';
import { AnimatedLogo } from '../components/AnimatedLogo';

interface WelcomeSplashProps {
  onGetStarted: () => void;
}

export function WelcomeSplash({ onGetStarted }: WelcomeSplashProps): React.ReactElement {
  return (
    <>
      {/* Neural Grid Background */}
      <div className="neural-grid" />

      <div className="onboarding-screen welcome-splash">
        <div style={{ animation: 'fadeInScale 0.8s ease-out' }}>
          <AnimatedLogo size={140} />
        </div>

        <div style={{ textAlign: 'center' }}>
          <p
            style={{
              fontSize: '18px',
              color: 'rgba(255,255,255,0.7)',
              marginBottom: '8px',
              fontWeight: 400,
              animation: 'slideUp 0.6s ease-out 0.3s both',
            }}
          >
            Meet Your AI Guardian
          </p>
          <h1
            className="welcome-title"
            style={{ animation: 'slideUp 0.6s ease-out 0.4s both' }}
          >
            Elara
          </h1>
          <p
            className="welcome-subtitle"
            style={{ animation: 'slideUp 0.6s ease-out 0.5s both' }}
          >
            AI Cybersecurity Protection
          </p>
        </div>

        <div
          style={{
            width: '100%',
            animation: 'slideUp 0.6s ease-out 0.7s both',
          }}
        >
          <button
            className="onboarding-button onboarding-button-primary"
            onClick={onGetStarted}
            style={{ width: '100%' }}
          >
            Get Started
            <span style={{ fontSize: '18px' }}>→</span>
          </button>
        </div>

        <p
          style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            textAlign: 'center',
            animation: 'slideUp 0.6s ease-out 0.9s both',
          }}
        >
          Enterprise-grade threat detection
          <br />
          powered by Neural AI and edge ML
        </p>
      </div>
    </>
  );
}
