/**
 * Ask Elara - Full-Page WebLLM-Style Chat Interface
 * ThiefDroppers Brand Theme
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';

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

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

const CHAT_STORAGE_KEY = 'elara_chat_sessions';
const ACTIVE_SESSION_KEY = 'elara_active_session';

const SECURITY_TIPS = [
  { icon: '🔒', title: 'Check the URL', desc: 'Always verify the website address before entering sensitive info.' },
  { icon: '🛡️', title: 'Look for HTTPS', desc: 'Secure sites use HTTPS with a padlock icon in the browser.' },
  { icon: '📧', title: 'Beware of Urgency', desc: 'Phishing emails often create false urgency to trick you.' },
  { icon: '🔑', title: 'Use Strong Passwords', desc: 'Mix letters, numbers, and symbols. Never reuse passwords.' },
  { icon: '🎣', title: 'Verify Senders', desc: 'Check email addresses carefully - attackers use lookalikes.' },
];

export function ChatApp(): React.ReactElement {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStartTime, setLoadingStartTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [currentTip, setCurrentTip] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Initialize and load sessions
  useEffect(() => {
    async function initialize() {
      try {
        const data = await chrome.storage.local.get([CHAT_STORAGE_KEY, ACTIVE_SESSION_KEY]);

        if (data[CHAT_STORAGE_KEY]) {
          const savedSessions: ChatSession[] = data[CHAT_STORAGE_KEY];
          setSessions(savedSessions);

          // Load active session or most recent
          const activeId = data[ACTIVE_SESSION_KEY] || savedSessions[0]?.id;
          if (activeId) {
            const session = savedSessions.find(s => s.id === activeId);
            if (session) {
              setActiveSessionId(session.id);
              setMessages(session.messages);
            }
          }
        }

        setIsInitialized(true);
      } catch (err) {
        console.error('Init error:', err);
        setIsInitialized(true);
      }
    }
    initialize();
  }, []);

  // Save sessions when they change
  useEffect(() => {
    if (!isInitialized) return;

    chrome.storage.local.set({
      [CHAT_STORAGE_KEY]: sessions,
      [ACTIVE_SESSION_KEY]: activeSessionId
    }).catch(console.error);
  }, [sessions, activeSessionId, isInitialized]);

  // Update active session messages
  useEffect(() => {
    if (!activeSessionId || !isInitialized) return;

    setSessions(prev => prev.map(s =>
      s.id === activeSessionId
        ? { ...s, messages, updatedAt: Date.now(), title: messages[0]?.content.slice(0, 30) || 'New Chat' }
        : s
    ));
  }, [messages, activeSessionId, isInitialized]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Rotate tips during loading
  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => {
      setCurrentTip(prev => (prev + 1) % SECURITY_TIPS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isLoading]);

  // Focus input
  useEffect(() => {
    if (isInitialized) inputRef.current?.focus();
  }, [isInitialized, activeSessionId]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  const createNewSession = useCallback(() => {
    const newSession: ChatSession = {
      id: crypto.randomUUID(),
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setMessages([]);
    setError(null);
  }, []);

  const selectSession = useCallback((sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setActiveSessionId(session.id);
      setMessages(session.messages);
      setError(null);
    }
  }, [sessions]);

  const deleteSession = useCallback((sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (activeSessionId === sessionId) {
      const remaining = sessions.filter(s => s.id !== sessionId);
      if (remaining.length > 0) {
        setActiveSessionId(remaining[0].id);
        setMessages(remaining[0].messages);
      } else {
        setActiveSessionId(null);
        setMessages([]);
      }
    }
  }, [sessions, activeSessionId]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    // Create session if none exists
    if (!activeSessionId) {
      const newSession: ChatSession = {
        id: crypto.randomUUID(),
        title: content.slice(0, 30),
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      setSessions(prev => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
    }

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
  }, [isLoading, activeSessionId]);

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

  const handleQuickAction = (action: string) => {
    const prompts: Record<string, string> = {
      scan: 'Scan the current page for security threats',
      help: 'What can you help me with?',
      tips: 'Give me cybersecurity tips for staying safe online',
      phishing: 'How do I recognize phishing attempts?',
    };
    sendMessage(prompts[action] || action);
  };

  if (!isInitialized) {
    return (
      <div className="app-container">
        <div className="loading-screen">
          <div className="loading-logo">
            <ElaraLogo size={64} />
          </div>
          <div className="loading-spinner" />
          <span className="loading-text">Initializing Elara...</span>
        </div>
      </div>
    );
  }

  const elapsed = isLoading && loadingStartTime ? Math.floor((Date.now() - loadingStartTime) / 1000) : 0;
  const tip = SECURITY_TIPS[currentTip];

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <ElaraLogo size={32} />
            <span className="brand-name">Elara</span>
          </div>
          <button className="new-chat-btn" onClick={createNewSession}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        <div className="sidebar-sessions">
          {sessions.length === 0 ? (
            <div className="no-sessions">
              <p>No conversations yet</p>
              <p className="hint">Start a new chat to begin</p>
            </div>
          ) : (
            sessions.map(session => (
              <div
                key={session.id}
                className={`session-item ${session.id === activeSessionId ? 'active' : ''}`}
                onClick={() => selectSession(session.id)}
              >
                <div className="session-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                </div>
                <div className="session-info">
                  <span className="session-title">{session.title || 'New Chat'}</span>
                  <span className="session-date">{new Date(session.updatedAt).toLocaleDateString()}</span>
                </div>
                <button
                  className="session-delete"
                  onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>

        <div className="sidebar-footer">
          <div className="status-indicator">
            <span className="status-dot"></span>
            <span>Protected</span>
          </div>
        </div>
      </aside>

      {/* Toggle Sidebar */}
      <button
        className="sidebar-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {sidebarOpen ? (
            <path d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
          ) : (
            <path d="M13 5l7 7-7 7M6 5l7 7-7 7" />
          )}
        </svg>
      </button>

      {/* Main Chat Area */}
      <main className="chat-main">
        <div className="chat-container">
          {/* Messages */}
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="welcome-screen">
                <div className="welcome-logo">
                  <ElaraLogo size={80} />
                </div>
                <h1>Ask Elara</h1>
                <p className="welcome-subtitle">Your AI Cybersecurity Guardian</p>
                <p className="welcome-desc">
                  I can help you analyze websites, identify threats, and stay safe online.
                </p>

                <div className="quick-actions">
                  <button onClick={() => handleQuickAction('scan')}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8" />
                      <path d="M21 21l-4.35-4.35" />
                    </svg>
                    Scan Current Page
                  </button>
                  <button onClick={() => handleQuickAction('phishing')}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    Identify Phishing
                  </button>
                  <button onClick={() => handleQuickAction('tips')}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    Security Tips
                  </button>
                  <button onClick={() => handleQuickAction('help')}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    Get Help
                  </button>
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <div key={msg.id} className={`message ${msg.role}`}>
                    {msg.role === 'assistant' && (
                      <div className="message-avatar">
                        <ElaraLogo size={28} />
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
                    {msg.role === 'user' && (
                      <div className="message-avatar user-avatar">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="message assistant">
                    <div className="message-avatar">
                      <ElaraLogo size={28} />
                    </div>
                    <div className="message-content loading">
                      <div className="typing-indicator">
                        <span></span><span></span><span></span>
                      </div>
                      <div className="loading-info">
                        <span className="loading-text">Analyzing... {elapsed}s</span>
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
                  </div>
                )}

                {error && (
                  <div className="error-banner">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="chat-input-container">
            <form onSubmit={handleSubmit} className="chat-input-form">
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
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                )}
              </button>
            </form>
            <div className="input-hint">Press Enter to send, Shift+Enter for new line</div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Elara Logo Component
function ElaraLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 111.92 111.92" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="elaraGrad" x1="55.96" y1="10" x2="55.96" y2="113" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0230c0"/>
          <stop offset="1" stopColor="#020b86"/>
        </linearGradient>
      </defs>
      <rect width="111.92" height="111.92" rx="16" fill="url(#elaraGrad)"/>
      <polygon fill="#0070f3" points="55.82 45.56 55.82 94.9 42.78 81 42.78 51.79 55.82 45.56"/>
      <polygon fill="#03d8fb" points="69.46 51.93 69.46 81 55.82 94.9 55.82 45.56 69.46 51.93"/>
      <polygon fill="#0070f3" points="55.82 44.64 42.78 51.79 18.91 40.04 18.22 26.68 55.82 44.64"/>
      <polygon fill="#03d8fb" points="55.82 31.53 55.82 44.64 18.22 26.68 33.19 21.71 55.82 31.53"/>
      <polygon fill="#0070f3" points="93.71 26.68 93.01 40.04 69.46 51.93 55.82 44.64 93.71 26.68"/>
      <polygon fill="#03d8fb" points="93.71 26.68 55.82 44.64 55.82 31.53 78.73 21.71 93.71 26.68"/>
    </svg>
  );
}

export default ChatApp;
