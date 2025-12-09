/**
 * Elara Edge Engine - Option Card Component
 * Selectable card with icon, title, and description
 */

import React from 'react';

interface OptionCardProps {
  icon: string;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}

export function OptionCard({
  icon,
  title,
  description,
  selected,
  onClick,
}: OptionCardProps): React.ReactElement {
  return (
    <div
      className={`option-card ${selected ? 'selected' : ''}`}
      onClick={onClick}
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="option-card-icon">{icon}</div>
      <div className="option-card-title">{title}</div>
      <div className="option-card-description">{description}</div>
      <div className="option-card-checkmark">✓</div>
    </div>
  );
}
