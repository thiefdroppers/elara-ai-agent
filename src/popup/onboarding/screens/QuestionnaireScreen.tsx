/**
 * ThiefDroppers - Questionnaire Screen (Popup Version)
 *
 * Single-question-at-a-time onboarding flow for user preferences.
 * Uses new user profile types.
 */

import React, { useState } from 'react';
import type { UserType, PrimaryUse, ProtectionFocus } from '@/lib/user-profile';

// ============================================================================
// TYPES
// ============================================================================

interface QuestionnaireScreenProps {
  onComplete: (data: QuestionnaireData) => void;
  onBack: () => void;
}

export interface QuestionnaireData {
  userType?: UserType;
  primaryUse?: PrimaryUse;
  protectionFocus: ProtectionFocus[];
}

interface Question {
  id: string;
  title: string;
  subtitle?: string;
  type: 'single-select' | 'multi-select';
  options: Option[];
}

interface Option {
  value: string;
  label: string;
  icon?: string;
}

// ============================================================================
// QUESTIONS CONFIGURATION
// ============================================================================

const QUESTIONS: Question[] = [
  {
    id: 'userType',
    title: 'Who is using this browser?',
    subtitle: 'This helps us customize your security experience',
    type: 'single-select',
    options: [
      { value: 'child', label: 'Child (Under 13)', icon: '👧' },
      { value: 'teen', label: 'Teenager (13-17)', icon: '🧑' },
      { value: 'adult', label: 'Adult (18-59)', icon: '👨' },
      { value: 'senior', label: 'Senior (60+)', icon: '👴' },
    ],
  },
  {
    id: 'primaryUse',
    title: 'What do you mostly do online?',
    subtitle: 'Helps us focus protection on relevant areas',
    type: 'single-select',
    options: [
      { value: 'social', label: 'Social Media', icon: '💬' },
      { value: 'shopping', label: 'Online Shopping', icon: '🛒' },
      { value: 'banking', label: 'Banking & Finance', icon: '🏦' },
      { value: 'work', label: 'Work & Productivity', icon: '💼' },
      { value: 'general', label: 'General Browsing', icon: '🌐' },
    ],
  },
  {
    id: 'protectionFocus',
    title: 'What threats concern you most?',
    subtitle: 'Select all that apply',
    type: 'multi-select',
    options: [
      { value: 'phishing', label: 'Phishing & Fake Sites', icon: '🎣' },
      { value: 'scams', label: 'Online Scams & Fraud', icon: '💸' },
      { value: 'malware', label: 'Malware & Viruses', icon: '🦠' },
      { value: 'privacy', label: 'Privacy & Tracking', icon: '👁️' },
    ],
  },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function QuestionnaireScreen({ onComplete, onBack }: QuestionnaireScreenProps): React.ReactElement {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({
    protectionFocus: [],
  });
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);

  const currentQuestion = QUESTIONS[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / QUESTIONS.length) * 100;
  const isLastQuestion = currentQuestionIndex === QUESTIONS.length - 1;
  const isMultiSelect = currentQuestion.type === 'multi-select';
  const currentAnswer = answers[currentQuestion.id];
  const hasAnswer = isMultiSelect
    ? (currentAnswer as string[] || []).length > 0
    : !!currentAnswer;

  const handleSingleSelect = (value: string) => {
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: value }));
    setTimeout(() => {
      goToNext();
    }, 300);
  };

  const handleMultiSelectToggle = (value: string) => {
    const current = (answers[currentQuestion.id] as string[]) || [];
    const newValue = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: newValue }));
  };

  const goToNext = () => {
    if (isLastQuestion) {
      const data: QuestionnaireData = {
        userType: answers.userType as UserType,
        primaryUse: answers.primaryUse as PrimaryUse,
        protectionFocus: answers.protectionFocus as ProtectionFocus[],
      };
      onComplete(data);
    } else {
      setSlideDirection('left');
      setTimeout(() => {
        setCurrentQuestionIndex(prev => prev + 1);
        setSlideDirection(null);
      }, 300);
    }
  };

  const goToPrevious = () => {
    if (currentQuestionIndex === 0) {
      onBack();
    } else {
      setSlideDirection('right');
      setTimeout(() => {
        setCurrentQuestionIndex(prev => prev - 1);
        setSlideDirection(null);
      }, 300);
    }
  };

  const handleSkip = () => {
    goToNext();
  };

  return (
    <div className="questionnaire-screen">
      <div className="progress-bar-container">
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="progress-text">
          Question {currentQuestionIndex + 1} of {QUESTIONS.length}
        </div>
      </div>

      <div className={`question-container ${slideDirection ? `slide-${slideDirection}` : ''}`}>
        <div className="question-header">
          <h2 className="question-title">{currentQuestion.title}</h2>
          {currentQuestion.subtitle && (
            <p className="question-subtitle">{currentQuestion.subtitle}</p>
          )}
        </div>

        <div className="question-options">
          {currentQuestion.options.map(option => {
            const isSelected = isMultiSelect
              ? (currentAnswer as string[] || []).includes(option.value)
              : currentAnswer === option.value;

            return (
              <button
                key={option.value}
                className={`option-button ${isSelected ? 'selected' : ''}`}
                onClick={() => {
                  if (isMultiSelect) {
                    handleMultiSelectToggle(option.value);
                  } else {
                    handleSingleSelect(option.value);
                  }
                }}
              >
                {option.icon && <span className="option-icon">{option.icon}</span>}
                <span className="option-label">{option.label}</span>
                {isMultiSelect && (
                  <span className="option-checkbox">{isSelected ? '✓' : ''}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="questionnaire-footer">
        <button className="btn btn-secondary" onClick={goToPrevious}>Back</button>
        <button className="btn btn-text" onClick={handleSkip}>Skip</button>
        {isMultiSelect && (
          <button className="btn btn-primary" onClick={goToNext} disabled={!hasAnswer}>
            {isLastQuestion ? 'Complete' : 'Continue'}
          </button>
        )}
      </div>

      <style>{`
        .questionnaire-screen {
          display: flex;
          flex-direction: column;
          height: 100%;
          padding: 24px;
          overflow: hidden;
        }
        .progress-bar-container { margin-bottom: 32px; }
        .progress-bar {
          height: 4px;
          background: var(--td-bg-card, #1a2033);
          border-radius: 2px;
          overflow: hidden;
          margin-bottom: 8px;
        }
        .progress-bar-fill {
          height: 100%;
          background: var(--td-gradient, linear-gradient(90deg, #3b82f6, #7c3aed));
          transition: width 0.3s ease;
          border-radius: 2px;
        }
        .progress-text {
          font-size: 12px;
          color: var(--td-text-muted, #64748b);
          text-align: center;
        }
        .question-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          transition: transform 0.3s ease, opacity 0.3s ease;
        }
        .question-container.slide-left { transform: translateX(-20px); opacity: 0; }
        .question-container.slide-right { transform: translateX(20px); opacity: 0; }
        .question-header { margin-bottom: 24px; text-align: center; }
        .question-title {
          font-size: 20px;
          font-weight: 700;
          color: var(--td-text-primary, #ffffff);
          margin: 0 0 8px 0;
        }
        .question-subtitle {
          font-size: 14px;
          color: var(--td-text-muted, #64748b);
          margin: 0;
        }
        .question-options {
          display: flex;
          flex-direction: column;
          gap: 10px;
          flex: 1;
          overflow-y: auto;
        }
        .option-button {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          background: var(--td-bg-card, #0f1d32);
          border: 2px solid var(--td-border, rgba(59, 130, 246, 0.2));
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 15px;
          font-weight: 500;
          color: var(--td-text-primary, #ffffff);
          text-align: left;
        }
        .option-button:hover {
          border-color: var(--td-blue, #3b82f6);
          transform: translateY(-2px);
        }
        .option-button.selected {
          border-color: var(--td-blue, #3b82f6);
          background: rgba(59, 130, 246, 0.15);
        }
        .option-icon { font-size: 20px; flex-shrink: 0; }
        .option-label { flex: 1; }
        .option-checkbox {
          width: 20px;
          height: 20px;
          border: 2px solid var(--td-border-input, rgba(148, 163, 184, 0.3));
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          flex-shrink: 0;
          transition: all 0.2s;
        }
        .option-button.selected .option-checkbox {
          background: var(--td-blue, #3b82f6);
          border-color: var(--td-blue, #3b82f6);
          color: white;
        }
        .questionnaire-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid var(--td-border, rgba(59, 130, 246, 0.2));
        }
        .btn {
          padding: 10px 18px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
          outline: none;
        }
        .btn-primary {
          background: var(--td-gradient, linear-gradient(135deg, #3b82f6, #7c3aed));
          color: white;
        }
        .btn-primary:hover:not(:disabled) { transform: translateY(-1px); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-secondary {
          background: var(--td-bg-input, rgba(15, 29, 50, 0.8));
          color: var(--td-text-secondary, #94a3b8);
          border: 1px solid var(--td-border-input, rgba(148, 163, 184, 0.2));
        }
        .btn-secondary:hover { background: var(--td-bg-card, #0f1d32); }
        .btn-text { background: transparent; color: var(--td-text-muted, #64748b); }
        .btn-text:hover { color: var(--td-text-secondary, #94a3b8); }
      `}</style>
    </div>
  );
}
