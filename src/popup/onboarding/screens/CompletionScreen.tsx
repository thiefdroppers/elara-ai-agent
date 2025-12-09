/**
 * Elara AI Security - Completion Screen
 *
 * Final onboarding screen with celebration and call-to-action.
 */

import React, { useState, useEffect } from 'react';

// ============================================================================
// TYPES
// ============================================================================

interface CompletionScreenProps {
  onComplete: () => void;
}

interface Feature {
  icon: string;
  text: string;
  checked: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CompletionScreen({ onComplete }: CompletionScreenProps): React.ReactElement {
  const [showConfetti, setShowConfetti] = useState(false);
  const [features, setFeatures] = useState<Feature[]>([
    { icon: '🛡️', text: 'Real-time phishing protection', checked: false },
    { icon: '⚡', text: 'Lightning-fast edge scanning', checked: false },
    { icon: '🔒', text: 'Privacy-first architecture', checked: false },
  ]);
  const [shieldAnimated, setShieldAnimated] = useState(false);

  // Animate shield and features on mount
  useEffect(() => {
    // Shield animation
    setTimeout(() => setShieldAnimated(true), 100);

    // Confetti
    setTimeout(() => setShowConfetti(true), 300);

    // Staggered feature checkmarks
    features.forEach((_, index) => {
      setTimeout(() => {
        setFeatures(prev => prev.map((f, i) =>
          i === index ? { ...f, checked: true } : f
        ));
      }, 800 + index * 300);
    });
  }, []);

  // Generate confetti particles
  const confettiColors = ['#0230c0', '#020b86', '#0070f3', '#03d8fb', '#22c55e'];
  const confettiCount = 40;

  return (
    <div className="completion-screen">
      {/* Confetti */}
      {showConfetti && (
        <div className="confetti-container">
          {Array.from({ length: confettiCount }).map((_, i) => (
            <div
              key={i}
              className="confetti"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
                background: confettiColors[Math.floor(Math.random() * confettiColors.length)],
              }}
            />
          ))}
        </div>
      )}

      {/* Content */}
      <div className="completion-content">
        {/* Animated Shield */}
        <div className={`shield-container ${shieldAnimated ? 'animated' : ''}`}>
          <div className="shield-icon">🛡️</div>
          <div className="shield-badge">✓</div>
        </div>

        {/* Title */}
        <h1 className="completion-title">You're Protected!</h1>
        <p className="completion-subtitle">
          Elara is now guarding your browser
        </p>

        {/* Feature List */}
        <div className="feature-list">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`feature-item ${feature.checked ? 'checked' : ''}`}
            >
              <div className="feature-checkmark">
                {feature.checked ? '✓' : ''}
              </div>
              <span className="feature-icon">{feature.icon}</span>
              <span className="feature-text">{feature.text}</span>
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <button
          className="btn btn-primary btn-large"
          onClick={onComplete}
        >
          Start Protecting My Browser
        </button>

        {/* Footer Note */}
        <p className="footer-note">
          You can customize your settings anytime from the extension popup
        </p>
      </div>

      {/* Styles */}
      <style>{`
        .completion-screen {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          padding: 40px 24px;
          position: relative;
          overflow: hidden;
          background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);
        }

        /* Confetti */
        .confetti-container {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          overflow: hidden;
        }

        .confetti {
          position: absolute;
          width: 8px;
          height: 8px;
          border-radius: 2px;
          animation: confetti-fall linear forwards;
          opacity: 0;
        }

        @keyframes confetti-fall {
          0% {
            transform: translateY(-10px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }

        /* Content */
        .completion-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          max-width: 400px;
          z-index: 1;
        }

        /* Shield Animation */
        .shield-container {
          position: relative;
          margin-bottom: 32px;
          transform: scale(0.8);
          opacity: 0;
          transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .shield-container.animated {
          transform: scale(1);
          opacity: 1;
        }

        .shield-icon {
          font-size: 80px;
          filter: drop-shadow(0 8px 16px rgba(99, 102, 241, 0.3));
          animation: shield-pulse 2s ease-in-out infinite;
        }

        @keyframes shield-pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }

        .shield-badge {
          position: absolute;
          top: -5px;
          right: -5px;
          width: 32px;
          height: 32px;
          background: #22c55e;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: bold;
          border: 3px solid white;
          box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
          animation: badge-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s backwards;
        }

        @keyframes badge-pop {
          0% {
            transform: scale(0);
          }
          100% {
            transform: scale(1);
          }
        }

        /* Title */
        .completion-title {
          font-size: 32px;
          font-weight: 800;
          color: #111827;
          margin: 0 0 12px 0;
          background: linear-gradient(135deg, #0230c0 0%, #03d8fb 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .completion-subtitle {
          font-size: 16px;
          color: #6b7280;
          margin: 0 0 32px 0;
        }

        /* Feature List */
        .feature-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
          width: 100%;
          margin-bottom: 32px;
        }

        .feature-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: white;
          border-radius: 12px;
          border: 2px solid #e5e7eb;
          transform: translateX(-20px);
          opacity: 0;
          transition: all 0.3s ease;
        }

        .feature-item.checked {
          transform: translateX(0);
          opacity: 1;
          border-color: #22c55e;
          background: #f0fdf4;
        }

        .feature-checkmark {
          width: 24px;
          height: 24px;
          background: #22c55e;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: bold;
          flex-shrink: 0;
          transform: scale(0);
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .feature-item.checked .feature-checkmark {
          transform: scale(1);
        }

        .feature-icon {
          font-size: 24px;
          flex-shrink: 0;
        }

        .feature-text {
          font-size: 14px;
          color: #374151;
          font-weight: 500;
          text-align: left;
        }

        /* CTA Button */
        .btn {
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
          outline: none;
        }

        .btn-primary {
          background: linear-gradient(135deg, #0230c0 0%, #020b86 100%);
          color: white;
          box-shadow: 0 4px 12px rgba(2, 48, 192, 0.3);
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(3, 216, 251, 0.4);
        }

        .btn-large {
          padding: 16px 32px;
          font-size: 16px;
          width: 100%;
        }

        /* Footer Note */
        .footer-note {
          font-size: 12px;
          color: #9ca3af;
          margin: 16px 0 0 0;
          max-width: 280px;
        }

        /* Animations */
        @keyframes slide-up {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
