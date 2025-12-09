/**
 * Elara Edge Engine - Settings Component
 */

import React, { useState, useEffect } from 'react';
import type { UserSettings } from '@/types';

interface AuthState {
  isAuthenticated: boolean;
  userEmail: string | null;
}

interface SettingsProps {
  settings: UserSettings;
  onChange: (settings: Partial<UserSettings>) => void;
}

export function Settings({ settings, onChange }: SettingsProps): React.ReactElement {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    userEmail: null,
  });
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Check auth state on mount
  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      // Use the correct storage keys from auth-service.ts
      const result = await chrome.storage.local.get(['auth_accessToken', 'auth_user']);
      let userEmail: string | null = null;

      if (result.auth_user) {
        try {
          const user = JSON.parse(result.auth_user);
          userEmail = user.email || null;
        } catch {
          // Invalid JSON, ignore
        }
      }

      setAuthState({
        isAuthenticated: !!result.auth_accessToken,
        userEmail,
      });
    } catch (err) {
      console.error('Failed to check auth state:', err);
    }
  };

  const handleSignIn = () => {
    // Open the onboarding/auth flow in a new tab
    chrome.tabs.create({
      url: chrome.runtime.getURL('welcome/index.html?action=signin'),
    });
  };

  const handleSignOut = async () => {
    if (!confirm('Are you sure you want to sign out? Cloud features will be disabled.')) {
      return;
    }

    setIsSigningOut(true);

    try {
      // Clear auth tokens (use correct storage keys from auth-service.ts)
      await chrome.storage.local.remove([
        'auth_accessToken',
        'auth_refreshToken',
        'auth_expiresAt',
        'auth_user',
        'auth_lastRefresh',
      ]);

      // Notify service worker
      await chrome.runtime.sendMessage({ action: 'signOut' });

      setAuthState({
        isAuthenticated: false,
        userEmail: null,
      });

      setSyncStatus('Signed out successfully');
    } catch (err) {
      setSyncStatus('Sign out failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsSigningOut(false);
      setTimeout(() => setSyncStatus(null), 3000);
    }
  };

  const handleToggle = (key: keyof UserSettings, value: boolean) => {
    onChange({ [key]: value });
  };

  const handleSelectChange = (key: keyof UserSettings, value: string) => {
    onChange({ [key]: value });
  };

  const handleThresholdChange = (key: 'high' | 'medium', value: number) => {
    onChange({
      confidenceThresholds: {
        ...settings.confidenceThresholds,
        [key]: value,
      },
    });
  };

  const handleSyncTI = async () => {
    setIsSyncing(true);
    setSyncStatus(null);

    try {
      const response = await chrome.runtime.sendMessage({ action: 'syncTI' });

      if (response?.success) {
        setSyncStatus('TI cache synchronized successfully');
      } else {
        setSyncStatus(response?.error || 'Sync failed');
      }
    } catch (err) {
      setSyncStatus('Sync failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(null), 3000);
    }
  };

  const handleClearCache = async () => {
    if (!confirm('Clear all cached scan results? This cannot be undone.')) {
      return;
    }

    setIsClearing(true);

    try {
      await chrome.runtime.sendMessage({ action: 'clearCache' });
      setSyncStatus('Cache cleared successfully');
    } catch (err) {
      setSyncStatus('Clear failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsClearing(false);
      setTimeout(() => setSyncStatus(null), 3000);
    }
  };

  return (
    <div className="settings">
      {/* Account Section */}
      <div className="settings-section">
        <div className="settings-title">Account</div>

        {authState.isAuthenticated ? (
          <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
            <div className="setting-info" style={{ width: '100%' }}>
              <div className="setting-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: '#22c55e',
                  display: 'inline-block'
                }} />
                Signed In
              </div>
              <div className="setting-description" style={{ marginTop: 4 }}>
                {authState.userEmail || 'Cloud features enabled'}
              </div>
            </div>
            <button
              className="scan-button"
              style={{
                width: '100%',
                padding: '10px 16px',
                fontSize: 13,
                background: '#dc2626',
              }}
              onClick={handleSignOut}
              disabled={isSigningOut}
            >
              {isSigningOut ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>
        ) : (
          <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
            <div className="setting-info" style={{ width: '100%' }}>
              <div className="setting-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: '#94a3b8',
                  display: 'inline-block'
                }} />
                Not Signed In
              </div>
              <div className="setting-description" style={{ marginTop: 4 }}>
                Sign in to enable cloud features (deep scans, TI sync)
              </div>
            </div>
            <button
              className="scan-button"
              style={{
                width: '100%',
                padding: '10px 16px',
                fontSize: 13,
                background: '#2563eb',
              }}
              onClick={handleSignIn}
            >
              Sign In
            </button>
          </div>
        )}
      </div>

      {/* Privacy Settings */}
      <div className="settings-section">
        <div className="settings-title">Privacy & Security</div>

        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">Privacy Mode</div>
            <div className="setting-description">
              Strict mode sends less data to cloud
            </div>
          </div>
          <select
            className="setting-select"
            value={settings.privacyMode}
            onChange={(e) => handleSelectChange('privacyMode', e.target.value)}
          >
            <option value="normal">Normal</option>
            <option value="strict">Strict</option>
          </select>
        </div>

        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">Anonymous Telemetry</div>
            <div className="setting-description">
              Help improve detection accuracy
            </div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.enableTelemetry}
              onChange={(e) => handleToggle('enableTelemetry', e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      {/* Performance Settings */}
      <div className="settings-section">
        <div className="settings-title">Performance</div>

        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">WebGPU Acceleration</div>
            <div className="setting-description">
              Use GPU for faster ML inference
            </div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.enableWebGPU}
              onChange={(e) => handleToggle('enableWebGPU', e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">Gemini Nano (Experimental)</div>
            <div className="setting-description">
              Use Chrome's built-in AI (if available)
            </div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.enableGeminiNano}
              onChange={(e) => handleToggle('enableGeminiNano', e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      {/* Scanning Settings */}
      <div className="settings-section">
        <div className="settings-title">Scanning</div>

        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">Auto-Scan on Navigation</div>
            <div className="setting-description">
              Automatically scan pages you visit
            </div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.autoScan}
              onChange={(e) => handleToggle('autoScan', e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">Show Warnings</div>
            <div className="setting-description">
              Display warnings for suspicious sites
            </div>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.showWarnings}
              onChange={(e) => handleToggle('showWarnings', e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">Warning Style</div>
            <div className="setting-description">
              How to display security warnings
            </div>
          </div>
          <select
            className="setting-select"
            value={settings.warningStyle}
            onChange={(e) => handleSelectChange('warningStyle', e.target.value)}
          >
            <option value="banner">Banner</option>
            <option value="overlay">Full Overlay</option>
            <option value="popup">Popup</option>
          </select>
        </div>
      </div>

      {/* Confidence Thresholds */}
      <div className="settings-section">
        <div className="settings-title">Confidence Thresholds</div>

        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">Edge-Only Threshold</div>
            <div className="setting-description">
              Min confidence for local-only scans ({Math.round(settings.confidenceThresholds.high * 100)}%)
            </div>
          </div>
          <input
            type="range"
            min="0.7"
            max="0.99"
            step="0.01"
            value={settings.confidenceThresholds.high}
            onChange={(e) => handleThresholdChange('high', parseFloat(e.target.value))}
            style={{ width: 100 }}
          />
        </div>

        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">Hybrid Threshold</div>
            <div className="setting-description">
              Min confidence for hybrid mode ({Math.round(settings.confidenceThresholds.medium * 100)}%)
            </div>
          </div>
          <input
            type="range"
            min="0.5"
            max="0.9"
            step="0.01"
            value={settings.confidenceThresholds.medium}
            onChange={(e) => handleThresholdChange('medium', parseFloat(e.target.value))}
            style={{ width: 100 }}
          />
        </div>
      </div>

      {/* Data Management */}
      <div className="settings-section">
        <div className="settings-title">Data Management</div>

        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">Sync Threat Intelligence</div>
            <div className="setting-description">
              Update local TI cache from cloud
            </div>
          </div>
          <button
            className="scan-button"
            style={{
              width: 'auto',
              padding: '8px 16px',
              fontSize: 13,
            }}
            onClick={handleSyncTI}
            disabled={isSyncing}
          >
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>

        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">Clear Cache</div>
            <div className="setting-description">
              Remove all cached scan results
            </div>
          </div>
          <button
            className="scan-button"
            style={{
              width: 'auto',
              padding: '8px 16px',
              fontSize: 13,
              background: '#dc2626',
            }}
            onClick={handleClearCache}
            disabled={isClearing}
          >
            {isClearing ? 'Clearing...' : 'Clear'}
          </button>
        </div>

        {syncStatus && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              background: syncStatus.includes('success') ? '#dcfce7' : '#fee2e2',
              color: syncStatus.includes('success') ? '#166534' : '#991b1b',
              borderRadius: 8,
              fontSize: 13,
              textAlign: 'center',
            }}
          >
            {syncStatus}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="footer">
        <span>ThiefDroppers v1.0.0</span>
        <a
          href="https://thiefdroppers.com/support"
          target="_blank"
          rel="noopener noreferrer"
        >
          Help & Support
        </a>
      </div>
    </div>
  );
}
