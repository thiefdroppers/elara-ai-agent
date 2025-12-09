/**
 * Ask Elara - AI Cybersecurity Guardian
 * Chat Interface with Enhanced Loading State
 */

import React, { useRef, useEffect } from 'react';
import { MessageBubble } from './MessageBubble';
import { ThreatCard } from './ThreatCard';
import { LoadingState } from './LoadingState';

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
  loadingStartTime: number;
  error: string | null;
}

export function ChatInterface({ messages, isLoading, loadingStartTime, error }: ChatInterfaceProps) {
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

        {isLoading && loadingStartTime > 0 && (
          <div className="message-wrapper assistant">
            <LoadingState startTime={loadingStartTime} />
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
