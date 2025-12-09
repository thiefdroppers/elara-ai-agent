/**
 * ThiefDroppers - Onboarding Flow Coordinator
 * Manages the onboarding process and navigation between screens
 */

import React, { useState, useEffect } from 'react';
import { WelcomeSplash } from './screens/WelcomeSplash';
import { AuthScreen } from './screens/AuthScreen';
import { GreetingScreen } from './screens/GreetingScreen';
import { QuestionnaireScreen, type QuestionnaireData } from './screens/QuestionnaireScreen';
import { URLControlsScreen, type URLControlsData } from './screens/URLControlsScreen';
import { CompletionScreen } from './screens/CompletionScreen';
import './styles/onboarding.css';

type OnboardingStep = 'welcome' | 'auth' | 'greeting' | 'questionnaire' | 'urlControls' | 'completion';

interface OnboardingData {
  email?: string;
  firstName?: string;
  lastName?: string;
  authToken?: string;
  questionnaireData?: QuestionnaireData;
  urlControlsData?: URLControlsData;
}

interface OnboardingFlowProps {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps): React.ReactElement {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [data, setData] = useState<OnboardingData>({});

  // Load CSS
  useEffect(() => {
    // CSS is already imported above
  }, []);

  const handleGetStarted = () => {
    setCurrentStep('auth');
  };

  const handleAuthSuccess = async (user: { email: string; firstName: string }) => {
    setData((prev) => ({
      ...prev,
      email: user.email,
      firstName: user.firstName,
    }));
    setCurrentStep('greeting');
  };

  const handleGreetingContinue = () => {
    setCurrentStep('questionnaire');
  };

  const handleQuestionnaireComplete = (questionnaireData: QuestionnaireData) => {
    setData((prev) => ({ ...prev, questionnaireData }));
    setCurrentStep('urlControls');
  };

  const handleURLControlsComplete = (urlControlsData: URLControlsData) => {
    setData((prev) => ({ ...prev, urlControlsData }));
    saveProfileAndContinue(urlControlsData);
  };

  const saveProfileAndContinue = async (urlControlsData: URLControlsData) => {
    try {
      // Create complete profile
      const profile = {
        userId: `user_${Date.now()}`,
        email: data.email || '',
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        userType: data.questionnaireData?.userType || null,
        primaryUse: data.questionnaireData?.primaryUse || null,
        securityExperience: null,
        concernLevel: null,
        protectionFocus: data.questionnaireData?.protectionFocus || [],
        whitelist: urlControlsData.whitelist,
        blacklist: urlControlsData.blacklist,
        reportedUrls: [],
        onboardingComplete: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Save to service worker
      await chrome.runtime.sendMessage({
        action: 'saveProfile',
        payload: profile,
      });

      console.log('[Onboarding] Profile saved successfully');

      // Move to completion screen
      setCurrentStep('completion');
    } catch (error) {
      console.error('[Onboarding] Failed to save profile:', error);
      // Still move to completion - profile save is non-critical
      setCurrentStep('completion');
    }
  };

  const handleBack = () => {
    switch (currentStep) {
      case 'auth':
        setCurrentStep('welcome');
        break;
      case 'greeting':
        setCurrentStep('auth');
        break;
      case 'questionnaire':
        setCurrentStep('greeting');
        break;
      case 'urlControls':
        setCurrentStep('questionnaire');
        break;
      default:
        break;
    }
  };

  const handleComplete = async () => {
    try {
      // Save onboarding completion state
      await chrome.storage.local.set({
        onboardingComplete: true,
        userEmail: data.email,
        userFirstName: data.firstName,
        onboardingCompletedAt: new Date().toISOString(),
      });

      // Notify parent component
      onComplete();
    } catch (err) {
      console.error('Failed to save onboarding state:', err);
      // Still complete even if storage fails
      onComplete();
    }
  };

  return (
    <div className="onboarding-container">
      {currentStep === 'welcome' && (
        <WelcomeSplash onGetStarted={handleGetStarted} />
      )}

      {currentStep === 'auth' && (
        <AuthScreen onAuthSuccess={handleAuthSuccess} />
      )}

      {currentStep === 'greeting' && (
        <GreetingScreen
          firstName={data.firstName || 'User'}
          onContinue={handleGreetingContinue}
        />
      )}

      {currentStep === 'questionnaire' && (
        <QuestionnaireScreen
          onComplete={handleQuestionnaireComplete}
          onBack={handleBack}
        />
      )}

      {currentStep === 'urlControls' && (
        <URLControlsScreen
          onComplete={handleURLControlsComplete}
          onBack={handleBack}
        />
      )}

      {currentStep === 'completion' && (
        <CompletionScreen onComplete={handleComplete} />
      )}
    </div>
  );
}
