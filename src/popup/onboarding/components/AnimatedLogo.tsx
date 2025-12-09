/**
 * Elara AI Security - Animated Logo Component
 * Official ThiefDroppers Arrow Icon with glow animation
 * Based on official ThiefDroppers branding assets
 */

import React from 'react';

interface AnimatedLogoProps {
  size?: number;
  showText?: boolean;
}

export function AnimatedLogo({ size = 120, showText = false }: AnimatedLogoProps): React.ReactElement {
  const iconSize = showText ? size * 0.6 : size;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: showText ? 16 : 0,
        animation: 'glowPulse 3s ease-in-out infinite',
      }}
    >
      {/* ThiefDroppers Official Arrow Icon */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 111.92 111.92"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Official background gradient - deep blue */}
          <linearGradient id="animBgGrad" x1="55.96" y1="10.25" x2="55.96" y2="113.18" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#0230c0"/>
            <stop offset="1" stopColor="#020b86"/>
          </linearGradient>

          {/* Glow filter */}
          <filter id="animGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Rounded square background */}
        <rect width="111.92" height="111.92" rx="12.95" ry="12.95" fill="url(#animBgGrad)" filter="url(#animGlow)"/>

        {/* Left side - blue */}
        <polygon fill="#0070f3" points="55.82 45.56 55.82 94.9 42.78 81 42.78 51.79 54.99 45.15 55.81 44.64 55.81 45.56 55.82 45.56">
          <animate attributeName="opacity" values="0.9;1;0.9" dur="2s" repeatCount="indefinite"/>
        </polygon>

        {/* Right side - cyan */}
        <polygon fill="#03d8fb" points="69.46 51.93 69.46 81 55.82 94.9 55.82 44.64 56.22 44.89 56.63 45.15 69.46 51.93">
          <animate attributeName="opacity" values="0.9;1;0.9" dur="2s" repeatCount="indefinite" begin="0.1s"/>
        </polygon>

        {/* Top left wing - blue */}
        <polygon fill="#0070f3" points="55.81 44.64 54.99 45.15 42.78 51.79 18.91 40.04 18.22 26.68 55.19 44.37 55.81 44.64">
          <animate attributeName="opacity" values="0.85;1;0.85" dur="2.5s" repeatCount="indefinite"/>
        </polygon>

        {/* Top left arrow - cyan */}
        <polygon fill="#03d8fb" points="55.81 31.53 55.81 44.64 55.19 44.37 18.22 26.68 33.19 21.71 55.81 31.53">
          <animate attributeName="opacity" values="0.8;1;0.8" dur="2s" repeatCount="indefinite" begin="0.2s"/>
        </polygon>

        {/* Top right wing - blue */}
        <polygon fill="#0070f3" points="93.71 26.68 93.01 40.04 69.46 51.92 69.46 51.93 56.63 45.15 56.22 44.89 55.82 44.64 55.82 44.63 56.07 44.53 56.45 44.37 93.71 26.68">
          <animate attributeName="opacity" values="0.85;1;0.85" dur="2.5s" repeatCount="indefinite" begin="0.15s"/>
        </polygon>

        {/* Top right arrow - cyan */}
        <polygon fill="#03d8fb" points="93.71 26.68 56.45 44.37 56.07 44.53 55.82 44.63 55.82 44.37 55.81 44.37 55.81 31.53 78.73 21.71 93.71 26.68">
          <animate attributeName="opacity" values="0.8;1;0.8" dur="2s" repeatCount="indefinite" begin="0.25s"/>
        </polygon>
      </svg>

      {/* Optional Text */}
      {showText && (
        <div
          style={{
            fontSize: size * 0.16,
            fontWeight: 600,
            letterSpacing: '0.05em',
            color: '#ffffff',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          Elara
        </div>
      )}
    </div>
  );
}

/**
 * Small icon-only version for headers and toolbars
 * Uses official Elara/ThiefDroppers arrow icon
 */
export function ElaraIcon({ size = 28 }: { size?: number }): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 111.92 111.92"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`iconBgGrad-${size}`} x1="55.96" y1="10.25" x2="55.96" y2="113.18" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0230c0"/>
          <stop offset="1" stopColor="#020b86"/>
        </linearGradient>
      </defs>

      {/* Rounded square background */}
      <rect width="111.92" height="111.92" rx="12.95" ry="12.95" fill={`url(#iconBgGrad-${size})`}/>

      {/* Left side - blue */}
      <polygon fill="#0070f3" points="55.82 45.56 55.82 94.9 42.78 81 42.78 51.79 54.99 45.15 55.81 44.64 55.81 45.56 55.82 45.56"/>
      {/* Right side - cyan */}
      <polygon fill="#03d8fb" points="69.46 51.93 69.46 81 55.82 94.9 55.82 44.64 56.22 44.89 56.63 45.15 69.46 51.93"/>
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
