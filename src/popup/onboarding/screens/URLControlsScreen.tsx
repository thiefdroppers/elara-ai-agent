/**
 * Elara Edge Engine - URL Controls Screen
 *
 * Manage whitelist (Always Allow) and blacklist (Always Block) domains.
 */

import React, { useState } from 'react';

// ============================================================================
// TYPES
// ============================================================================

interface URLControlsScreenProps {
  onComplete: (data: URLControlsData) => void;
  onBack: () => void;
}

export interface URLControlsData {
  whitelist: string[];
  blacklist: string[];
}

// ============================================================================
// COMPONENT
// ============================================================================

export function URLControlsScreen({ onComplete, onBack }: URLControlsScreenProps): React.ReactElement {
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [whitelistInput, setWhitelistInput] = useState('');
  const [blacklistInput, setBlacklistInput] = useState('');
  const [whitelistError, setWhitelistError] = useState('');
  const [blacklistError, setBlacklistError] = useState('');

  // Validate domain format
  const isValidDomain = (domain: string): boolean => {
    const domainRegex = /^([a-z0-9-]+\.)*[a-z0-9-]+\.[a-z]{2,}$/i;
    return domainRegex.test(domain);
  };

  // Normalize domain (strip protocol, www, etc.)
  const normalizeDomain = (domain: string): string => {
    let normalized = domain.toLowerCase().trim();
    normalized = normalized.replace(/^(https?:\/\/)?(www\.)?/, '');
    normalized = normalized.replace(/:\d+/, '');
    normalized = normalized.split('/')[0];
    normalized = normalized.split('?')[0];
    normalized = normalized.split('#')[0];
    return normalized;
  };

  // Add to whitelist
  const handleAddToWhitelist = () => {
    setWhitelistError('');

    if (!whitelistInput.trim()) {
      return;
    }

    const normalized = normalizeDomain(whitelistInput);

    if (!isValidDomain(normalized)) {
      setWhitelistError('Invalid domain format (e.g., example.com)');
      return;
    }

    if (whitelist.includes(normalized)) {
      setWhitelistError('Domain already in list');
      return;
    }

    setWhitelist(prev => [...prev, normalized]);
    setWhitelistInput('');
  };

  // Remove from whitelist
  const handleRemoveFromWhitelist = (domain: string) => {
    setWhitelist(prev => prev.filter(d => d !== domain));
  };

  // Add to blacklist
  const handleAddToBlacklist = () => {
    setBlacklistError('');

    if (!blacklistInput.trim()) {
      return;
    }

    const normalized = normalizeDomain(blacklistInput);

    if (!isValidDomain(normalized)) {
      setBlacklistError('Invalid domain format (e.g., example.com)');
      return;
    }

    if (blacklist.includes(normalized)) {
      setBlacklistError('Domain already in list');
      return;
    }

    setBlacklist(prev => [...prev, normalized]);
    setBlacklistInput('');
  };

  // Remove from blacklist
  const handleRemoveFromBlacklist = (domain: string) => {
    setBlacklist(prev => prev.filter(d => d !== domain));
  };

  // Handle finish
  const handleFinish = () => {
    onComplete({ whitelist, blacklist });
  };

  // Handle skip
  const handleSkip = () => {
    onComplete({ whitelist: [], blacklist: [] });
  };

  // Handle Enter key
  const handleWhitelistKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddToWhitelist();
    }
  };

  const handleBlacklistKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddToBlacklist();
    }
  };

  return (
    <div className="url-controls-screen">
      {/* Header */}
      <div className="screen-header">
        <h2 className="screen-title">Customize Your Protection</h2>
        <p className="screen-subtitle">
          Add domains you always trust or want to block
        </p>
      </div>

      {/* Content */}
      <div className="controls-content">
        {/* Whitelist Section */}
        <div className="control-section">
          <div className="section-header">
            <div className="section-icon">✓</div>
            <div>
              <h3 className="section-title">Always Allow</h3>
              <p className="section-description">
                Domains you trust - we'll skip scanning them
              </p>
            </div>
          </div>

          <div className="input-group">
            <input
              type="text"
              className="domain-input"
              placeholder="example.com"
              value={whitelistInput}
              onChange={(e) => {
                setWhitelistInput(e.target.value);
                setWhitelistError('');
              }}
              onKeyPress={handleWhitelistKeyPress}
            />
            <button
              className="btn btn-add"
              onClick={handleAddToWhitelist}
              disabled={!whitelistInput.trim()}
            >
              <span className="btn-icon">+</span>
              Add
            </button>
          </div>

          {whitelistError && (
            <div className="error-message">{whitelistError}</div>
          )}

          <div className="domain-list">
            {whitelist.length === 0 ? (
              <div className="empty-state">
                No domains added yet
              </div>
            ) : (
              whitelist.map(domain => (
                <div key={domain} className="domain-item whitelist-item">
                  <span className="domain-name">{domain}</span>
                  <button
                    className="remove-btn"
                    onClick={() => handleRemoveFromWhitelist(domain)}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Blacklist Section */}
        <div className="control-section">
          <div className="section-header">
            <div className="section-icon danger">×</div>
            <div>
              <h3 className="section-title">Always Block</h3>
              <p className="section-description">
                Domains you want to block automatically
              </p>
            </div>
          </div>

          <div className="input-group">
            <input
              type="text"
              className="domain-input"
              placeholder="suspicious-site.com"
              value={blacklistInput}
              onChange={(e) => {
                setBlacklistInput(e.target.value);
                setBlacklistError('');
              }}
              onKeyPress={handleBlacklistKeyPress}
            />
            <button
              className="btn btn-add"
              onClick={handleAddToBlacklist}
              disabled={!blacklistInput.trim()}
            >
              <span className="btn-icon">+</span>
              Add
            </button>
          </div>

          {blacklistError && (
            <div className="error-message">{blacklistError}</div>
          )}

          <div className="domain-list">
            {blacklist.length === 0 ? (
              <div className="empty-state">
                No domains added yet
              </div>
            ) : (
              blacklist.map(domain => (
                <div key={domain} className="domain-item blacklist-item">
                  <span className="domain-name">{domain}</span>
                  <button
                    className="remove-btn"
                    onClick={() => handleRemoveFromBlacklist(domain)}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="controls-footer">
        <button
          className="btn btn-secondary"
          onClick={onBack}
        >
          Back
        </button>

        <button
          className="btn btn-text"
          onClick={handleSkip}
        >
          Skip
        </button>

        <button
          className="btn btn-primary"
          onClick={handleFinish}
        >
          Finish
        </button>
      </div>

      {/* Styles */}
      <style>{`
        .url-controls-screen {
          display: flex;
          flex-direction: column;
          height: 100%;
          padding: 24px;
        }

        /* Header */
        .screen-header {
          margin-bottom: 24px;
          text-align: center;
        }

        .screen-title {
          font-size: 24px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 8px 0;
        }

        .screen-subtitle {
          font-size: 14px;
          color: #6b7280;
          margin: 0;
        }

        /* Content */
        .controls-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 24px;
          overflow-y: auto;
        }

        .control-section {
          background: #f9fafb;
          border-radius: 12px;
          padding: 20px;
        }

        .section-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 16px;
        }

        .section-icon {
          width: 40px;
          height: 40px;
          background: #22c55e;
          color: white;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: bold;
          flex-shrink: 0;
        }

        .section-icon.danger {
          background: #ef4444;
        }

        .section-title {
          font-size: 16px;
          font-weight: 600;
          color: #111827;
          margin: 0 0 4px 0;
        }

        .section-description {
          font-size: 13px;
          color: #6b7280;
          margin: 0;
        }

        /* Input Group */
        .input-group {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }

        .domain-input {
          flex: 1;
          padding: 10px 14px;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }

        .domain-input:focus {
          border-color: #6366f1;
        }

        .btn-add {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 10px 16px;
          background: #6366f1;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-add:hover:not(:disabled) {
          background: #4f46e5;
          transform: translateY(-1px);
        }

        .btn-add:disabled {
          background: #d1d5db;
          cursor: not-allowed;
        }

        .btn-icon {
          font-size: 18px;
          font-weight: bold;
        }

        .error-message {
          color: #ef4444;
          font-size: 12px;
          margin-bottom: 8px;
        }

        /* Domain List */
        .domain-list {
          max-height: 150px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .empty-state {
          text-align: center;
          color: #9ca3af;
          font-size: 13px;
          padding: 20px;
        }

        .domain-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          background: white;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          transition: all 0.2s;
        }

        .domain-item:hover {
          border-color: #d1d5db;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .whitelist-item {
          border-left: 3px solid #22c55e;
        }

        .blacklist-item {
          border-left: 3px solid #ef4444;
        }

        .domain-name {
          font-size: 13px;
          color: #374151;
          font-family: monospace;
        }

        .remove-btn {
          width: 24px;
          height: 24px;
          background: #f3f4f6;
          border: none;
          border-radius: 4px;
          color: #6b7280;
          font-size: 20px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }

        .remove-btn:hover {
          background: #ef4444;
          color: white;
        }

        /* Footer */
        .controls-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
        }

        .btn {
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
          outline: none;
        }

        .btn-primary {
          background: #6366f1;
          color: white;
        }

        .btn-primary:hover {
          background: #4f46e5;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(99, 102, 241, 0.3);
        }

        .btn-secondary {
          background: #f3f4f6;
          color: #374151;
        }

        .btn-secondary:hover {
          background: #e5e7eb;
        }

        .btn-text {
          background: transparent;
          color: #6b7280;
        }

        .btn-text:hover {
          color: #374151;
        }
      `}</style>
    </div>
  );
}
