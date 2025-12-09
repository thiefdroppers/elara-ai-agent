/**
 * Elara AI Security - Authentication Screen
 * Login and signup with Google OAuth and email/password
 * Matches official Elara/ThiefDroppers design system
 */

import React, { useState } from 'react';
import { authService } from '@/lib/auth/auth-service';
import { ElaraIcon } from '../components/AnimatedLogo';

interface AuthScreenProps {
  onAuthSuccess: (user: { email: string; firstName: string }) => void;
}

type AuthMode = 'login' | 'register';

export function AuthScreen({ onAuthSuccess }: AuthScreenProps): React.ReactElement {
  const [mode, setMode] = useState<AuthMode>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await authService.loginWithGoogle();

      if (result.success && result.user) {
        onAuthSuccess({
          email: result.user.email,
          firstName: result.user.firstName || 'User',
        });
      } else {
        setError(result.error || 'Google authentication failed');
      }
    } catch (err) {
      console.error('Google auth error:', err);
      setError('Failed to authenticate with Google');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let result;
      if (mode === 'login') {
        result = await authService.loginWithEmail(email, password);
      } else {
        // Register with email only - firstName/lastName can be collected later
        result = await authService.registerWithEmail(email, password, '', '');
      }

      if (result.success && result.user) {
        onAuthSuccess({
          email: result.user.email,
          firstName: result.user.firstName || 'User',
        });
      } else {
        setError(result.error || 'Authentication failed');
      }
    } catch (err) {
      console.error('Email auth error:', err);
      setError('Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = mode === 'login'
    ? email && password
    : email && password;

  return (
    <div className="onboarding-screen auth-screen">
      {/* Elara Logo at top */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <ElaraIcon size={48} />
      </div>

      <div className="auth-header">
        <h2 className="auth-title">
          {mode === 'login' ? 'Sign in to continue' : 'Sign up to continue'}
        </h2>
        <p className="auth-subtitle">
          Fill the following form
        </p>
      </div>

      <div className="auth-form">
        {error && (
          <div className="error-message">
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* Email/Password Form - Matching ThiefDroppers design */}
        <form onSubmit={handleEmailAuth}>
          <div className="input-group">
            <input
              id="email"
              type="email"
              className="onboarding-input td-input"
              placeholder="Enter your Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="input-group">
            <input
              id="password"
              type="password"
              className="onboarding-input td-input"
              placeholder={mode === 'register' ? 'Set your Password' : 'Enter your Password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <button
            type="submit"
            className="onboarding-button onboarding-button-primary td-primary-btn"
            disabled={!isFormValid || loading}
            style={{ width: '100%', marginTop: '8px' }}
          >
            {loading ? (
              <>
                <div className="loading-spinner" />
                <span>{mode === 'login' ? 'Signing In...' : 'Setting Up...'}</span>
              </>
            ) : (
              <span>{mode === 'login' ? 'Sign In' : 'Set Up'}</span>
            )}
          </button>
        </form>

        {/* Google OAuth Button */}
        <button
          className="onboarding-button td-google-btn"
          onClick={handleGoogleAuth}
          disabled={loading}
          style={{ width: '100%', marginTop: '16px' }}
        >
          {loading ? (
            <>
              <div className="loading-spinner" style={{ borderTopColor: '#3b82f6' }} />
              <span>Authenticating...</span>
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 18 18">
                <path
                  fill="#4285F4"
                  d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
                />
                <path
                  fill="#34A853"
                  d="M9.003 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.96v2.332C2.44 15.983 5.485 18 9.003 18z"
                />
                <path
                  fill="#FBBC05"
                  d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.96H.957C.347 6.175 0 7.55 0 9.002c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                />
                <path
                  fill="#EA4335"
                  d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9.003 0 5.485 0 2.44 2.017.96 4.958L3.967 7.29c.708-2.127 2.692-3.71 5.036-3.71z"
                />
              </svg>
              <span>{mode === 'register' ? 'Sign up using Google' : 'Sign in with Google'}</span>
            </>
          )}
        </button>

        {/* Toggle Mode */}
        <div className="auth-toggle" style={{ marginTop: '24px' }}>
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
            </>
          ) : (
            <>
              Already have an account?{' '}
            </>
          )}
        </div>

        {/* Sign in/up toggle button */}
        <button
          className="onboarding-button td-outline-btn"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError(null);
          }}
          disabled={loading}
          style={{ width: '100%', marginTop: '8px' }}
        >
          {mode === 'login' ? 'Sign up' : 'Sign in'}
        </button>
      </div>
    </div>
  );
}
