/**
 * Ask Elara - AI Cybersecurity Guardian
 * WebLLM-style chat popup with ThiefDroppers branding
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { OnboardingFlow } from './onboarding/OnboardingFlow';
import './styles.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  metadata?: {
    threatCard?: {
      verdict: string;
      riskLevel: string;
      riskScore: number;
      threatType?: string;
      indicators: Array<{
        type: string;
        value: string;
        severity: string;
        description: string;
      }>;
      recommendation: string;
    };
  };
}

// Storage key for chat persistence
const CHAT_STORAGE_KEY = 'elara_chat_history';
const CHAT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// Security tips for loading state
const SECURITY_TIPS = [
  { icon: '🔒', title: 'Check the URL', desc: 'Always verify the website address before entering sensitive info.' },
  { icon: '🛡️', title: 'Look for HTTPS', desc: 'Secure sites use HTTPS with a padlock icon in the browser.' },
  { icon: '📧', title: 'Beware of Urgency', desc: 'Phishing emails often create false urgency to trick you.' },
  { icon: '🔑', title: 'Use Strong Passwords', desc: 'Mix letters, numbers, and symbols. Never reuse passwords.' },
  { icon: '🎣', title: 'Verify Senders', desc: 'Check email addresses carefully - attackers use lookalikes.' },
];

export function App(): React.ReactElement {
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStartTime, setLoadingStartTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [currentTip, setCurrentTip] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Check onboarding status and load chat history
  useEffect(() => {
    async function initialize() {
      try {
        const data = await chrome.storage.local.get([
          'onboardingComplete',
          'auth_accessToken',
          'auth_user',
          CHAT_STORAGE_KEY,
        ]);

        // Check onboarding
        if (data.onboardingComplete === true || (data.auth_accessToken && data.auth_user)) {
          if (!data.onboardingComplete) {
            await chrome.storage.local.set({ onboardingComplete: true });
          }
          setOnboardingComplete(true);

          // Load chat history
          if (data[CHAT_STORAGE_KEY]) {
            const { messages: savedMessages, timestamp } = data[CHAT_STORAGE_KEY];
            const isExpired = Date.now() - timestamp > CHAT_EXPIRY_MS;
            if (!isExpired && Array.isArray(savedMessages) && savedMessages.length > 0) {
              setMessages(savedMessages);
            }
          }
        } else {
          setOnboardingComplete(false);
        }
      } catch (err) {
        console.error('Init error:', err);
        setOnboardingComplete(false);
      }
    }
    initialize();
  }, []);

  // Save messages when they change
  useEffect(() => {
    if (onboardingComplete && messages.length > 0) {
      chrome.storage.local.set({
        [CHAT_STORAGE_KEY]: { messages, timestamp: Date.now() }
      }).catch(console.error);
    }
  }, [messages, onboardingComplete]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Rotate security tips during loading
  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => {
      setCurrentTip(prev => (prev + 1) % SECURITY_TIPS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isLoading]);

  // Focus input on mount
  useEffect(() => {
    if (onboardingComplete) {
      inputRef.current?.focus();
    }
  }, [onboardingComplete]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setLoadingStartTime(Date.now());
    setError(null);
    setInput('');

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CHAT_MESSAGE',
        payload: { content: content.trim() },
      });

      if (response?.success) {
        const assistantMessage: Message = {
          id: response.message?.id || crypto.randomUUID(),
          role: 'assistant',
          content: response.message?.content || 'I received your message.',
          timestamp: Date.now(),
          metadata: response.message?.metadata,
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        setError(response?.error || 'Failed to get response');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
      setLoadingStartTime(0);
    }
  }, [isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = async () => {
    setMessages([]);
    setError(null);
    await chrome.storage.local.remove(CHAT_STORAGE_KEY).catch(console.error);
  };

  const handleQuickAction = (action: string) => {
    const prompts: Record<string, string> = {
      scan: 'Scan the current page for security threats',
      help: 'What can you help me with?',
      tips: 'Give me cybersecurity tips for staying safe online',
    };
    sendMessage(prompts[action] || action);
  };

  // Loading state
  if (onboardingComplete === null) {
    return (
      <div className="app-container">
        <div className="loading-screen">
          <div className="loading-spinner" />
          <span>Loading Elara...</span>
        </div>
      </div>
    );
  }

  // Onboarding
  if (!onboardingComplete) {
    return <OnboardingFlow onComplete={() => setOnboardingComplete(true)} />;
  }

  const elapsed = isLoading && loadingStartTime ? Math.floor((Date.now() - loadingStartTime) / 1000) : 0;
  const tip = SECURITY_TIPS[currentTip];

  return (
    <div className="app-container">
      {/* Header */}
      <header className="chat-header">
        <div className="header-brand">
          <div className="brand-logo">
            <svg width="32" height="32" viewBox="0 0 111.92 111.92">
              <defs>
                <linearGradient id="logoGrad" x1="55.96" y1="10" x2="55.96" y2="113" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#0230c0"/>
                  <stop offset="1" stopColor="#020b86"/>
                </linearGradient>
              </defs>
              <rect width="111.92" height="111.92" rx="12.95" fill="url(#logoGrad)"/>
              <polygon fill="#0070f3" points="55.82 45.56 55.82 94.9 42.78 81 42.78 51.79 55.82 45.56"/>
              <polygon fill="#03d8fb" points="69.46 51.93 69.46 81 55.82 94.9 55.82 45.56 69.46 51.93"/>
              <polygon fill="#0070f3" points="55.82 44.64 42.78 51.79 18.91 40.04 18.22 26.68 55.82 44.64"/>
              <polygon fill="#03d8fb" points="55.82 31.53 55.82 44.64 18.22 26.68 33.19 21.71 55.82 31.53"/>
              <polygon fill="#0070f3" points="93.71 26.68 93.01 40.04 69.46 51.93 55.82 44.64 93.71 26.68"/>
              <polygon fill="#03d8fb" points="93.71 26.68 55.82 44.64 55.82 31.53 78.73 21.71 93.71 26.68"/>
            </svg>
          </div>
          <div className="brand-text">
            <h1>Ask Elara</h1>
            <span>AI Security Guardian</span>
          </div>
        </div>
        <div className="header-actions">
          {messages.length > 0 && (
            <button className="icon-btn" onClick={clearChat} title="Clear chat">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
            </button>
          )}
          <div className="status-badge">
            <span className="status-dot"></span>
            <span>Protected</span>
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="chat-messages">
        {messages.length === 0 ? (
          <div className="welcome-view">
            <div className="welcome-logo">
              <svg width="80" height="80" viewBox="0 0 111.92 111.92">
                <defs>
                  <linearGradient id="welcomeGrad" x1="55.96" y1="10" x2="55.96" y2="113" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#0230c0"/>
                    <stop offset="1" stopColor="#020b86"/>
                  </linearGradient>
                </defs>
                <rect width="111.92" height="111.92" rx="16" fill="url(#welcomeGrad)"/>
                <polygon fill="#0070f3" points="55.82 45.56 55.82 94.9 42.78 81 42.78 51.79 55.82 45.56"/>
                <polygon fill="#03d8fb" points="69.46 51.93 69.46 81 55.82 94.9 55.82 45.56 69.46 51.93"/>
                <polygon fill="#0070f3" points="55.82 44.64 42.78 51.79 18.91 40.04 18.22 26.68 55.82 44.64"/>
                <polygon fill="#03d8fb" points="55.82 31.53 55.82 44.64 18.22 26.68 33.19 21.71 55.82 31.53"/>
                <polygon fill="#0070f3" points="93.71 26.68 93.01 40.04 69.46 51.93 55.82 44.64 93.71 26.68"/>
                <polygon fill="#03d8fb" points="93.71 26.68 55.82 44.64 55.82 31.53 78.73 21.71 93.71 26.68"/>
              </svg>
            </div>
            <h2>Welcome to Elara</h2>
            <p>Your AI-powered cybersecurity guardian. Ask me anything about online safety!</p>
            <div className="quick-actions">
              <button onClick={() => handleQuickAction('scan')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                </svg>
                Scan Page
              </button>
              <button onClick={() => handleQuickAction('help')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                Get Help
              </button>
              <button onClick={() => handleQuickAction('tips')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
                </svg>
                Security Tips
              </button>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div key={msg.id} className={`message ${msg.role}`}>
                {msg.role === 'assistant' && (
                  <div className="message-avatar">
                    <svg width="24" height="24" viewBox="0 0 111.92 111.92">
                      <rect width="111.92" height="111.92" rx="12" fill="#0230c0"/>
                      <polygon fill="#03d8fb" points="69.46 51.93 69.46 81 55.82 94.9 55.82 45.56 69.46 51.93"/>
                      <polygon fill="#03d8fb" points="93.71 26.68 55.82 44.64 55.82 31.53 78.73 21.71 93.71 26.68"/>
                    </svg>
                  </div>
                )}
                <div className="message-content">
                  <div className="message-text">{msg.content}</div>
                  {msg.metadata?.threatCard && (
                    <div className={`threat-card ${msg.metadata.threatCard.riskLevel.toLowerCase()}`}>
                      <div className="threat-header">
                        <span className="verdict">{msg.metadata.threatCard.verdict}</span>
                        <span className="risk-score">{msg.metadata.threatCard.riskScore}%</span>
                      </div>
                      {msg.metadata.threatCard.recommendation && (
                        <div className="threat-recommendation">{msg.metadata.threatCard.recommendation}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="message assistant">
                <div className="message-avatar">
                  <svg width="24" height="24" viewBox="0 0 111.92 111.92">
                    <rect width="111.92" height="111.92" rx="12" fill="#0230c0"/>
                    <polygon fill="#03d8fb" points="69.46 51.93 69.46 81 55.82 94.9 55.82 45.56 69.46 51.93"/>
                    <polygon fill="#03d8fb" points="93.71 26.68 55.82 44.64 55.82 31.53 78.73 21.71 93.71 26.68"/>
                  </svg>
                </div>
                <div className="message-content loading">
                  <div className="typing-dots">
                    <span></span><span></span><span></span>
                  </div>
                  <div className="loading-text">Analyzing... {elapsed}s</div>
                  {elapsed > 2 && (
                    <div className="security-tip">
                      <span className="tip-icon">{tip.icon}</span>
                      <div className="tip-content">
                        <strong>{tip.title}</strong>
                        <p>{tip.desc}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="error-banner">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                {error}
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Input */}
      <footer className="chat-input">
        <form onSubmit={handleSubmit}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Elara about cybersecurity..."
            rows={1}
            disabled={isLoading}
          />
          <button type="submit" disabled={!input.trim() || isLoading}>
            {isLoading ? (
              <span className="btn-spinner" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
              </svg>
            )}
          </button>
        </form>
        <div className="input-hint">Enter to send</div>
      </footer>
    </div>
  );
}

export default App;
