/**
 * Elara Edge Engine - Success Checkmark Component
 * Animated checkmark with circle drawing effect
 */

import React, { useEffect, useState } from 'react';

interface SuccessCheckmarkProps {
  size?: number;
}

export function SuccessCheckmark({ size = 80 }: SuccessCheckmarkProps): React.ReactElement {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    // Trigger animation after mount
    const timer = setTimeout(() => setAnimate(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const circleCircumference = 2 * Math.PI * 45; // radius = 45

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="checkGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00d9ff" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>

      {/* Circle */}
      <circle
        cx="50"
        cy="50"
        r="45"
        stroke="url(#checkGradient)"
        strokeWidth="4"
        fill="none"
        strokeDasharray={circleCircumference}
        strokeDashoffset={animate ? 0 : circleCircumference}
        style={{
          transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />

      {/* Checkmark */}
      <path
        d="M 30 50 L 43 63 L 70 36"
        stroke="url(#checkGradient)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeDasharray="50"
        strokeDashoffset={animate ? 0 : 50}
        style={{
          transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.4s',
        }}
      />

      {/* Glow effect */}
      {animate && (
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="#00d9ff"
          strokeWidth="2"
          opacity="0.3"
          style={{
            animation: 'glowPulse 2s ease-in-out infinite',
          }}
        />
      )}
    </svg>
  );
}
