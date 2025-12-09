/**
 * Elara AI Agent - Message Bubble Component
 */

import React from 'react';
import { ElaraIcon } from '../onboarding/components/AnimatedLogo';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const formatContent = (content: string) => {
    // Convert markdown-style formatting to HTML
    let formatted = content
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Code
      .replace(/`(.*?)`/g, '<code>$1</code>')
      // Line breaks
      .replace(/\n/g, '<br />');

    return formatted;
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={`message-bubble ${message.role}`}>
      {message.role === 'assistant' && (
        <div className="message-avatar">
          <ElaraIcon size={28} />
        </div>
      )}
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
