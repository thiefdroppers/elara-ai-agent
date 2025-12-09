/**
 * Elara Edge Engine - Debug Panel
 *
 * Tests TI DB, Cloud API, and shows auth state for troubleshooting.
 */

import React, { useState, useEffect } from 'react';

interface StorageData {
  auth_accessToken?: string;
  auth_refreshToken?: string;
  auth_user?: string;
  auth_expiresAt?: string;
  onboardingComplete?: boolean;
  userProfile?: object;
}

interface TestResult {
  name: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  details?: string;
  latency?: number;
}

const API_BASE_URL = 'https://dev-api.thiefdroppers.com/api/v2';
const HEALTH_URL = 'https://dev-api.thiefdroppers.com/health'; // Root level, not under /api/v2

export function Debug(): React.ReactElement {
  const [storageData, setStorageData] = useState<StorageData>({});
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    const timestamp = new Date().toISOString().substring(11, 23);
    setLogs(prev => [...prev, `[${timestamp}] ${msg}`]);
  };

  // Load storage data on mount
  useEffect(() => {
    loadStorageData();
  }, []);

  const loadStorageData = async () => {
    try {
      const data = await chrome.storage.local.get([
        'auth_accessToken',
        'auth_refreshToken',
        'auth_user',
        'auth_expiresAt',
        'onboardingComplete',
        'userProfile',
      ]);
      setStorageData(data);
      addLog('Storage data loaded');
    } catch (err) {
      addLog(`Storage load error: ${err}`);
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    setLogs([]);
    addLog('=== Starting API Tests ===');

    const results: TestResult[] = [];

    // Test 1: Check Auth State
    addLog('Test 1: Checking auth state...');
    const authResult = await testAuthState();
    results.push(authResult);
    setTestResults([...results]);

    // Test 2: Test /auth/me endpoint
    addLog('Test 2: Testing /auth/me endpoint...');
    const meResult = await testAuthMe();
    results.push(meResult);
    setTestResults([...results]);

    // Test 3: Test TI DB Lookup
    addLog('Test 3: Testing TI DB lookup...');
    const tiResult = await testTILookup();
    results.push(tiResult);
    setTestResults([...results]);

    // Test 4: Test Cloud Health
    addLog('Test 4: Testing Cloud API health...');
    const healthResult = await testCloudHealth();
    results.push(healthResult);
    setTestResults([...results]);

    addLog('=== All Tests Complete ===');
    setIsRunning(false);
  };

  const testAuthState = async (): Promise<TestResult> => {
    try {
      const data = await chrome.storage.local.get(['auth_accessToken', 'auth_user']);

      if (!data.auth_accessToken) {
        addLog('AUTH: No access token found in storage');
        return {
          name: 'Auth State',
          status: 'error',
          message: 'No access token',
          details: 'auth_accessToken is missing from chrome.storage.local',
        };
      }

      const tokenPreview = data.auth_accessToken.substring(0, 20) + '...';
      addLog(`AUTH: Token found: ${tokenPreview}`);

      let userEmail = 'unknown';
      if (data.auth_user) {
        try {
          const user = JSON.parse(data.auth_user);
          userEmail = user.email || 'no email';
          addLog(`AUTH: User email: ${userEmail}`);
        } catch {
          addLog('AUTH: Could not parse auth_user JSON');
        }
      }

      return {
        name: 'Auth State',
        status: 'success',
        message: `Authenticated as ${userEmail}`,
        details: `Token: ${tokenPreview}`,
      };
    } catch (err) {
      addLog(`AUTH ERROR: ${err}`);
      return {
        name: 'Auth State',
        status: 'error',
        message: 'Failed to check auth',
        details: String(err),
      };
    }
  };

  const testAuthMe = async (): Promise<TestResult> => {
    try {
      const data = await chrome.storage.local.get(['auth_accessToken']);

      if (!data.auth_accessToken) {
        addLog('/auth/me: Skipped - no token');
        return {
          name: '/auth/me',
          status: 'error',
          message: 'No token available',
        };
      }

      const startTime = performance.now();
      addLog('/auth/me: Making request...');

      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${data.auth_accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const latency = Math.round(performance.now() - startTime);
      addLog(`/auth/me: Response ${response.status} (${latency}ms)`);

      if (!response.ok) {
        const errorText = await response.text();
        addLog(`/auth/me ERROR: ${errorText}`);
        return {
          name: '/auth/me',
          status: 'error',
          message: `HTTP ${response.status}`,
          details: errorText,
          latency,
        };
      }

      const result = await response.json();
      addLog(`/auth/me: Success - ${JSON.stringify(result).substring(0, 100)}`);

      return {
        name: '/auth/me',
        status: 'success',
        message: `User: ${result.user?.email || result.email || 'OK'}`,
        latency,
      };
    } catch (err) {
      addLog(`/auth/me EXCEPTION: ${err}`);
      return {
        name: '/auth/me',
        status: 'error',
        message: 'Request failed',
        details: String(err),
      };
    }
  };

  const testTILookup = async (): Promise<TestResult> => {
    try {
      const data = await chrome.storage.local.get(['auth_accessToken']);

      if (!data.auth_accessToken) {
        addLog('TI Lookup: Skipped - no token');
        return {
          name: 'TI Lookup',
          status: 'error',
          message: 'No token available',
        };
      }

      const testUrl = 'https://google.com';
      const startTime = performance.now();
      addLog(`TI Lookup: Testing with ${testUrl}...`);

      const response = await fetch(`${API_BASE_URL}/ti/lookup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${data.auth_accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: testUrl }),
      });

      const latency = Math.round(performance.now() - startTime);
      addLog(`TI Lookup: Response ${response.status} (${latency}ms)`);

      if (!response.ok) {
        const errorText = await response.text();
        addLog(`TI Lookup ERROR: ${errorText}`);
        return {
          name: 'TI Lookup',
          status: 'error',
          message: `HTTP ${response.status}`,
          details: errorText,
          latency,
        };
      }

      const result = await response.json();
      addLog(`TI Lookup: Full response - ${JSON.stringify(result)}`);

      // Check if TI DB returned whitelist/blacklist data
      // Backend returns: { whitelist: {...}, blacklist: {...}, whitelistHits, blacklistHits, tier1WhitelistHits, tier1BlacklistHits }
      const tiData = result.data || result || {};
      const hasWhitelist = tiData.whitelist || tiData.whitelistHits > 0 || tiData.tier1WhitelistHits > 0;
      const hasBlacklist = tiData.blacklist || tiData.blacklistHits > 0 || tiData.tier1BlacklistHits > 0;

      let statusMsg = 'No TI hits';
      if (hasWhitelist) statusMsg = `Whitelist: ${tiData.whitelist?.source || tiData.whitelist?.category || 'Found'}`;
      if (hasBlacklist) statusMsg = `Blacklist: ${tiData.blacklist?.source || tiData.blacklist?.category || 'Found'}`;

      return {
        name: 'TI Lookup',
        status: 'success',
        message: statusMsg,
        details: JSON.stringify(result, null, 2),
        latency,
      };
    } catch (err) {
      addLog(`TI Lookup EXCEPTION: ${err}`);
      return {
        name: 'TI Lookup',
        status: 'error',
        message: 'Request failed',
        details: String(err),
      };
    }
  };

  const testCloudHealth = async (): Promise<TestResult> => {
    try {
      const startTime = performance.now();
      addLog('Health: Checking API health...');

      const response = await fetch(HEALTH_URL, {
        method: 'GET',
      });

      const latency = Math.round(performance.now() - startTime);
      addLog(`Health: Response ${response.status} (${latency}ms)`);

      if (!response.ok) {
        return {
          name: 'Cloud Health',
          status: 'error',
          message: `HTTP ${response.status}`,
          latency,
        };
      }

      const result = await response.json();
      addLog(`Health: ${JSON.stringify(result)}`);

      return {
        name: 'Cloud Health',
        status: 'success',
        message: result.status || 'OK',
        details: `DB: ${result.database || 'unknown'}`,
        latency,
      };
    } catch (err) {
      addLog(`Health EXCEPTION: ${err}`);
      return {
        name: 'Cloud Health',
        status: 'error',
        message: 'API unreachable',
        details: String(err),
      };
    }
  };

  const copyLogs = () => {
    const logText = logs.join('\n');
    navigator.clipboard.writeText(logText);
    addLog('Logs copied to clipboard!');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return '#22c55e';
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return '✓';
      case 'error': return '✗';
      default: return '○';
    }
  };

  return (
    <div style={{ padding: '16px', fontSize: '12px' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#3b82f6' }}>
        🔧 Debug Panel
      </h3>

      {/* Storage State */}
      <div style={{ background: '#1e293b', padding: '8px', borderRadius: '6px', marginBottom: '12px' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#94a3b8' }}>Storage State:</div>
        <div style={{ color: storageData.auth_accessToken ? '#22c55e' : '#ef4444' }}>
          Token: {storageData.auth_accessToken ? '✓ Present' : '✗ Missing'}
        </div>
        <div style={{ color: storageData.onboardingComplete ? '#22c55e' : '#ef4444' }}>
          Onboarding: {storageData.onboardingComplete ? '✓ Complete' : '✗ Incomplete'}
        </div>
        <div style={{ color: storageData.userProfile ? '#22c55e' : '#f59e0b' }}>
          Profile: {storageData.userProfile ? '✓ Saved' : '○ Not found'}
        </div>
      </div>

      {/* Test Button */}
      <button
        onClick={runAllTests}
        disabled={isRunning}
        style={{
          width: '100%',
          padding: '10px',
          background: isRunning ? '#4b5563' : '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: isRunning ? 'wait' : 'pointer',
          fontWeight: 'bold',
          marginBottom: '12px',
        }}
      >
        {isRunning ? '⏳ Running Tests...' : '▶ Run API Tests'}
      </button>

      {/* Test Results */}
      {testResults.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#94a3b8' }}>Test Results:</div>
          {testResults.map((result, i) => (
            <div
              key={i}
              style={{
                background: '#1e293b',
                padding: '8px',
                borderRadius: '4px',
                marginBottom: '4px',
                borderLeft: `3px solid ${getStatusColor(result.status)}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: getStatusColor(result.status), fontWeight: 'bold' }}>
                  {getStatusIcon(result.status)} {result.name}
                </span>
                {result.latency && (
                  <span style={{ color: '#6b7280', fontSize: '10px' }}>{result.latency}ms</span>
                )}
              </div>
              <div style={{ color: '#e2e8f0', marginTop: '2px' }}>{result.message}</div>
              {result.details && (
                <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '2px', wordBreak: 'break-all' }}>
                  {result.details}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontWeight: 'bold', color: '#94a3b8' }}>Logs:</span>
            <button
              onClick={copyLogs}
              style={{
                padding: '4px 8px',
                background: '#374151',
                color: '#e2e8f0',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '10px',
              }}
            >
              📋 Copy
            </button>
          </div>
          <div
            style={{
              background: '#0f172a',
              padding: '8px',
              borderRadius: '4px',
              maxHeight: '150px',
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: '10px',
              color: '#94a3b8',
            }}
          >
            {logs.map((log, i) => (
              <div key={i} style={{ marginBottom: '2px' }}>{log}</div>
            ))}
          </div>
        </div>
      )}

      {/* Test Scan Button */}
      <button
        onClick={async () => {
          addLog('=== Testing Scan ===');
          try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.url) {
              addLog('ERROR: No active tab');
              return;
            }
            addLog(`Scanning: ${tab.url.substring(0, 50)}...`);
            addLog('Sending scanURL message to service worker...');
            const startTime = performance.now();

            const result = await chrome.runtime.sendMessage({
              action: 'scanURL',
              payload: {
                url: tab.url,
                context: {
                  tabId: tab.id,
                  triggeredBy: 'debug',
                  privacyMode: 'normal',
                  timestamp: Date.now(),
                },
              },
            });

            const latency = Math.round(performance.now() - startTime);
            addLog(`Scan completed in ${latency}ms`);
            addLog(`Result: ${JSON.stringify(result).substring(0, 200)}`);
          } catch (err) {
            addLog(`Scan FAILED: ${err}`);
          }
        }}
        style={{
          width: '100%',
          padding: '10px',
          background: '#059669',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: 'bold',
          marginTop: '12px',
        }}
      >
        🔍 Test Scan Current Page
      </button>

      {/* Reload Button */}
      <button
        onClick={loadStorageData}
        style={{
          width: '100%',
          padding: '8px',
          background: '#374151',
          color: '#e2e8f0',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          marginTop: '12px',
        }}
      >
        🔄 Refresh Storage Data
      </button>
    </div>
  );
}
