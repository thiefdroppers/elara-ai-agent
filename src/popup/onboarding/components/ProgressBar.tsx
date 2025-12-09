/**
 * Elara Edge Engine - Progress Bar Component
 * Shows current step in onboarding flow
 */

import React from 'react';

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

export function ProgressBar({ currentStep, totalSteps }: ProgressBarProps): React.ReactElement {
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="progress-container">
      <div className="progress-label">
        <span className="progress-step">
          Step {currentStep} of {totalSteps}
        </span>
      </div>
      <div
        className="progress-bar-track"
        role="progressbar"
        aria-valuenow={currentStep}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
        aria-label={`Onboarding progress: step ${currentStep} of ${totalSteps}`}
      >
        <div
          className="progress-bar-fill"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
