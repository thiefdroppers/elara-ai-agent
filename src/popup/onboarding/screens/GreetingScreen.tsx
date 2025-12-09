/**
 * Elara AI Security - Greeting Screen
 * Welcome user with success animation
 */

import React from 'react';
import { SuccessCheckmark } from '../components/SuccessCheckmark';
import { ParticleBackground } from '../components/ParticleBackground';

interface GreetingScreenProps {
  firstName: string;
  onContinue: () => void;
}

export function GreetingScreen({ firstName, onContinue }: GreetingScreenProps): React.ReactElement {
  return (
    <>
      <ParticleBackground />

      <div className="onboarding-screen greeting-screen">
        <div style={{ animation: 'fadeInScale 0.8s ease-out' }}>
          <SuccessCheckmark size={100} />
        </div>

        <div>
          <h1 className="greeting-title">
            Hi, {firstName}! <span className="greeting-wave">👋</span>
          </h1>
          <p className="greeting-subtitle">
            Welcome to Elara. Your AI cybersecurity guardian is now active
            and ready to protect you.
          </p>
        </div>

        <div
          style={{
            width: '100%',
            animation: 'slideUp 0.6s ease-out 1s both',
          }}
        >
          <button
            className="onboarding-button onboarding-button-primary"
            onClick={onContinue}
            style={{ width: '100%' }}
          >
            Continue
            <span style={{ fontSize: '18px' }}>→</span>
          </button>
        </div>

        <div
          style={{
            textAlign: 'center',
            fontSize: '12px',
            color: 'var(--text-muted)',
            animation: 'slideUp 0.6s ease-out 1.2s both',
          }}
        >
          <p style={{ marginBottom: '8px' }}>
            Elara protects you with:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <span style={{ color: '#03d8fb' }}>✓</span>
              <span>Neural AI threat detection</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <span style={{ color: '#03d8fb' }}>✓</span>
              <span>Real-time phishing protection</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <span style={{ color: '#03d8fb' }}>✓</span>
              <span>Privacy-first edge computing</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
