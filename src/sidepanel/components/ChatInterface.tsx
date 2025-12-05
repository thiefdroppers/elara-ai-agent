/**
 * Elara AI Agent - Chat Interface Component
 */

import React, { useRef, useEffect } from 'react';
import { MessageBubble } from './MessageBubble';
import { ThreatCard } from './ThreatCard';

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

interface ChatInterfaceProps {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}

export function ChatInterface({ messages, isLoading, error }: ChatInterfaceProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="chat-interface">
      <div className="messages-container">
        {messages.map((message) => (
          <div key={message.id} className={`message-wrapper ${message.role}`}>
            <MessageBubble message={message} />
            {message.metadata?.threatCard && (
              <ThreatCard card={message.metadata.threatCard} />
            )}
          </div>
        ))}

        {isLoading && (
          <div className="message-wrapper assistant">
            <div className="message-bubble assistant loading">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span className="loading-text">Analyzing...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="error-message">
            <span className="error-icon">!</span>
            <span>{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
