/**
 * Elara Edge Engine - Particle Background Component
 * Floating particles with random animation
 */

import React, { useEffect, useRef } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  tx: number;
  ty: number;
}

export function ParticleBackground(): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [particles, setParticles] = React.useState<Particle[]>([]);

  useEffect(() => {
    // Generate particles
    const newParticles: Particle[] = [];
    for (let i = 0; i < 20; i++) {
      newParticles.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 2 + Math.random() * 4,
        duration: 8 + Math.random() * 12,
        delay: Math.random() * 5,
        tx: (Math.random() - 0.5) * 100,
        ty: -50 - Math.random() * 100,
      });
    }
    setParticles(newParticles);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      {particles.map((particle) => (
        <div
          key={particle.id}
          style={{
            position: 'absolute',
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            borderRadius: '50%',
            background: 'radial-gradient(circle, #00d9ff 0%, transparent 70%)',
            opacity: 0,
            animation: `particleFloat ${particle.duration}s ease-in-out ${particle.delay}s infinite`,
            // @ts-ignore - CSS custom properties
            '--tx': `${particle.tx}px`,
            '--ty': `${particle.ty}px`,
          }}
        />
      ))}
    </div>
  );
}
