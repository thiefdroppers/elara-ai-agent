/**
 * Ask Elara - AI Cybersecurity Guardian
 * Full sidepanel chat interface with ThiefDroppers branding
 * Features: Chat persistence, pending quick actions, enhanced loading
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChatInterface } from './components/ChatInterface';
import { WelcomeScreen } from './components/WelcomeScreen';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  metadata?: {
    scanResult?: unknown;
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
    processing?: boolean;
    error?: string;
  };
}

// Storage key for chat persistence
const CHAT_STORAGE_KEY = 'elara_chat_history';
const CHAT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStartTime, setLoadingStartTime] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load chat history on mount
  useEffect(() => {
    async function loadChatHistory() {
      try {
        const data = await chrome.storage.local.get([CHAT_STORAGE_KEY, 'pendingQuickAction']);

        // Load persisted messages if not expired
        if (data[CHAT_STORAGE_KEY]) {
          const { messages: savedMessages, timestamp } = data[CHAT_STORAGE_KEY];
          const isExpired = Date.now() - timestamp > CHAT_EXPIRY_MS;

          if (!isExpired && Array.isArray(savedMessages) && savedMessages.length > 0) {
            setMessages(savedMessages);
          }
        }

        setIsInitialized(true);

        // Handle pending quick action from popup
        if (data.pendingQuickAction) {
          // Clear the pending action
          await chrome.storage.local.remove('pendingQuickAction');

          // Execute the action after a short delay to ensure UI is ready
          setTimeout(() => {
            handleQuickAction(data.pendingQuickAction);
          }, 300);
        }
      } catch (err) {
        console.error('Failed to load chat history:', err);
        setIsInitialized(true);
      }
    }

    loadChatHistory();
  }, []);

  // Save messages to storage whenever they change
  useEffect(() => {
    if (!isInitialized || messages.length === 0) return;

    async function saveChatHistory() {
      try {
        await chrome.storage.local.set({
          [CHAT_STORAGE_KEY]: {
            messages,
            timestamp: Date.now(),
          },
        });
      } catch (err) {
        console.error('Failed to save chat history:', err);
      }
    }

    saveChatHistory();
  }, [messages, isInitialized]);

  // Listen for orchestrator state updates
  useEffect(() => {
    const handleMessage = (message: { type: string; payload?: unknown }) => {
      if (message.type === 'ORCHESTRATOR_STATE') {
        // Could update a progress indicator here
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

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

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CHAT_MESSAGE',
        payload: { content: content.trim() },
      });

      if (response.success) {
        const assistantMessage: Message = {
          id: response.message.id,
          role: 'assistant',
          content: response.message.content,
          timestamp: Date.now(),
          metadata: response.message.metadata,
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        setError(response.error || 'An error occurred');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
      setLoadingStartTime(0);
    }
  }, [isLoading]);

  const handleQuickAction = useCallback((action: string) => {
    switch (action) {
      case 'scan':
        sendMessage('Scan the current page for threats');
        break;
      case 'help':
        sendMessage('What can you do?');
        break;
      case 'explain':
        sendMessage('Explain common phishing techniques');
        break;
      case 'tips':
        sendMessage('Give me some cybersecurity tips for staying safe online');
        break;
    }
  }, [sendMessage]);

  const clearChat = useCallback(async () => {
    setMessages([]);
    setError(null);
    try {
      await chrome.storage.local.remove(CHAT_STORAGE_KEY);
    } catch (err) {
      console.error('Failed to clear chat history:', err);
    }
  }, []);

  // Show loading state while initializing
  if (!isInitialized) {
    return (
      <div className="app-container">
        <div className="loading" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="loading-spinner" />
          <span className="loading-text">Loading Elara...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-logo">
          {/* ThiefDroppers Arrow Logo */}
          <div className="logo-wrapper">
            <svg width="40" height="40" viewBox="0 0 111.92 111.92" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="headerBgGrad" x1="55.96" y1="10.25" x2="55.96" y2="113.18" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#0230c0"/>
                  <stop offset="1" stopColor="#020b86"/>
                </linearGradient>
              </defs>
              <rect width="111.92" height="111.92" rx="12.95" ry="12.95" fill="url(#headerBgGrad)"/>
              <polygon fill="#0070f3" points="55.82 45.56 55.82 94.9 42.78 81 42.78 51.79 54.99 45.15 55.81 44.64 55.81 45.56 55.82 45.56"/>
              <polygon fill="#03d8fb" points="69.46 51.93 69.46 81 55.82 94.9 55.82 44.64 56.22 44.89 56.63 45.15 69.46 51.93"/>
              <polygon fill="#0070f3" points="55.81 44.64 54.99 45.15 42.78 51.79 18.91 40.04 18.22 26.68 55.19 44.37 55.81 44.64"/>
              <polygon fill="#03d8fb" points="55.81 31.53 55.81 44.64 55.19 44.37 18.22 26.68 33.19 21.71 55.81 31.53"/>
              <polygon fill="#0070f3" points="93.71 26.68 93.01 40.04 69.46 51.92 69.46 51.93 56.63 45.15 56.22 44.89 55.82 44.64 55.82 44.63 56.07 44.53 56.45 44.37 93.71 26.68"/>
              <polygon fill="#03d8fb" points="93.71 26.68 56.45 44.37 56.07 44.53 55.82 44.63 55.82 44.37 55.81 44.37 55.81 31.53 78.73 21.71 93.71 26.68"/>
            </svg>
          </div>
          <div className="header-title">
            <h1>Ask Elara</h1>
            <span className="header-subtitle">AI Cybersecurity Guardian</span>
          </div>
        </div>
        <div className="header-actions">
          {messages.length > 0 && (
            <button
              className="clear-chat-btn"
              onClick={clearChat}
              title="Start new conversation"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            </button>
          )}
          <div className="header-status">
            <span className="status-dot"></span>
            <span className="status-text">Protected</span>
          </div>
        </div>
      </header>

      <main className="app-main">
        {messages.length === 0 ? (
          <WelcomeScreen onQuickAction={handleQuickAction} />
        ) : (
          <ChatInterface
            messages={messages}
            isLoading={isLoading}
            loadingStartTime={loadingStartTime}
            error={error}
          />
        )}
      </main>

      <footer className="app-footer">
        <ChatInput onSend={sendMessage} isLoading={isLoading} />
        <div className="footer-hint">
          Press Enter to send • Shift+Enter for new line
        </div>
      </footer>
    </div>
  );
}

function ChatInput({
  onSend,
  isLoading,
}: {
  onSend: (content: string) => void;
  isLoading: boolean;
}) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSend(input);
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 150) + 'px';
    }
  }, [input]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <form className="chat-input-form" onSubmit={handleSubmit}>
      <textarea
        ref={inputRef}
        className="chat-input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask Elara anything about cybersecurity..."
        rows={1}
        disabled={isLoading}
      />
      <button
        type="submit"
        className="send-button"
        disabled={!input.trim() || isLoading}
      >
        {isLoading ? (
          <span className="button-spinner" />
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 2L11 13" />
            <path d="M22 2L15 22L11 13L2 9L22 2Z" />
          </svg>
        )}
      </button>
    </form>
  );
}

export default App;
