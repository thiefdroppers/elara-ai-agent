/**
 * Ask Elara - AI Cybersecurity Guardian
 * Message Bubble Component with ThiefDroppers Branding
 */

import React from 'react';

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

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Simple markdown-like formatting
  const formatContent = (content: string) => {
    // Bold text **text** or __text__
    let formatted = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/__(.*?)__/g, '<strong>$1</strong>');

    // Inline code `code`
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Line breaks
    formatted = formatted.replace(/\n/g, '<br/>');

    return formatted;
  };

  if (message.role === 'user') {
    return (
      <div className="message-bubble user">
        <div className="message-text">{message.content}</div>
        <div className="message-time">{formatTime(message.timestamp)}</div>
      </div>
    );
  }

  return (
    <div className="message-bubble assistant">
      <div className="message-avatar">
        <div className="avatar-icon">
          {/* ThiefDroppers Arrow Icon */}
          <svg width="18" height="18" viewBox="0 0 111.92 111.92" xmlns="http://www.w3.org/2000/svg">
            <polygon fill="#0070f3" points="55.82 45.56 55.82 94.9 42.78 81 42.78 51.79 54.99 45.15 55.81 44.64 55.81 45.56 55.82 45.56"/>
            <polygon fill="#03d8fb" points="69.46 51.93 69.46 81 55.82 94.9 55.82 44.64 56.22 44.89 56.63 45.15 69.46 51.93"/>
            <polygon fill="#0070f3" points="55.81 44.64 54.99 45.15 42.78 51.79 18.91 40.04 18.22 26.68 55.19 44.37 55.81 44.64"/>
            <polygon fill="#03d8fb" points="55.81 31.53 55.81 44.64 55.19 44.37 18.22 26.68 33.19 21.71 55.81 31.53"/>
            <polygon fill="#0070f3" points="93.71 26.68 93.01 40.04 69.46 51.92 69.46 51.93 56.63 45.15 56.22 44.89 55.82 44.64 55.82 44.63 56.07 44.53 56.45 44.37 93.71 26.68"/>
            <polygon fill="#03d8fb" points="93.71 26.68 56.45 44.37 56.07 44.53 55.82 44.63 55.82 44.37 55.81 44.37 55.81 31.53 78.73 21.71 93.71 26.68"/>
          </svg>
        </div>
      </div>
      <div className="message-content">
        <div
          className="message-text"
          dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
        />
        <div className="message-time">{formatTime(message.timestamp)}</div>
      </div>
    </div>
  );
}
