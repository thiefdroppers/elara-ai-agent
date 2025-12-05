/**
 * Elara AI Agent - Sidepanel Chat Application
 *
 * GPT/KIMI-style conversational interface for security intelligence.
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChatInterface } from './components/ChatInterface';
import { WelcomeScreen } from './components/WelcomeScreen';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  metadata?: {
    scanResult?: unknown;
    threatCard?: unknown;
    processing?: boolean;
    error?: string;
  };
}

export function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
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
    }
  };

  const handleQuickAction = (action: string) => {
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
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-logo">
          <div className="logo-icon">E</div>
          <div className="header-title">
            <h1>Ask Elara</h1>
            <span className="header-subtitle">Security Assistant</span>
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
            error={error}
          />
        )}
      </main>

      <footer className="app-footer">
        <ChatInput onSend={sendMessage} isLoading={isLoading} />
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
        placeholder="Type your question or paste a URL..."
        rows={1}
        disabled={isLoading}
      />
      <button
        type="submit"
        className="send-button"
        disabled={!input.trim() || isLoading}
      >
        {isLoading ? (
          <span className="loading-spinner" />
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

// Export for main.tsx
export default App;
