/**
 * Elara AI Agent - Streaming Message Component
 *
 * Displays AI responses with real-time token streaming.
 * Shows typing indicator and smoothly updates as tokens arrive.
 */

import React, { useState, useEffect, useRef } from 'react';

interface StreamingMessageProps {
  content: string;
  isStreaming: boolean;
  onStreamComplete?: () => void;
}

export function StreamingMessage({
  content,
  isStreaming,
  onStreamComplete,
}: StreamingMessageProps) {
  const [displayedContent, setDisplayedContent] = useState('');
  const [showCursor, setShowCursor] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const previousContentRef = useRef('');

  // Update displayed content when streaming
  useEffect(() => {
    if (content === previousContentRef.current) return;

    setDisplayedContent(content);
    previousContentRef.current = content;

    // Auto-scroll to bottom
    if (contentRef.current) {
      contentRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [content]);

  // Blinking cursor effect
  useEffect(() => {
    if (!isStreaming) {
      setShowCursor(false);
      return;
    }

    const interval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 500);

    return () => clearInterval(interval);
  }, [isStreaming]);

  // Call onStreamComplete when streaming ends
  useEffect(() => {
    if (!isStreaming && onStreamComplete) {
      onStreamComplete();
    }
  }, [isStreaming, onStreamComplete]);

  return (
    <div className="streaming-message" ref={contentRef}>
      <div className="message-content">
        {displayedContent}
        {isStreaming && (
          <span className={`cursor ${showCursor ? 'visible' : 'hidden'}`}>|</span>
        )}
      </div>

      {isStreaming && (
        <div className="streaming-indicator">
          <span className="dot"></span>
          <span className="dot"></span>
          <span className="dot"></span>
        </div>
      )}

      <style>{`
        .streaming-message {
          position: relative;
          padding: 12px 16px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 16px 16px 4px 16px;
          max-width: 85%;
          margin: 8px 0;
          line-height: 1.5;
          box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
        }

        .message-content {
          word-wrap: break-word;
          white-space: pre-wrap;
        }

        .cursor {
          display: inline-block;
          width: 2px;
          margin-left: 2px;
          animation: blink 1s step-end infinite;
        }

        .cursor.visible {
          opacity: 1;
        }

        .cursor.hidden {
          opacity: 0;
        }

        @keyframes blink {
          50% {
            opacity: 0;
          }
        }

        .streaming-indicator {
          display: flex;
          gap: 4px;
          margin-top: 8px;
          align-items: center;
        }

        .streaming-indicator .dot {
          width: 6px;
          height: 6px;
          background: rgba(255, 255, 255, 0.6);
          border-radius: 50%;
          animation: pulse 1.4s ease-in-out infinite;
        }

        .streaming-indicator .dot:nth-child(1) {
          animation-delay: 0s;
        }

        .streaming-indicator .dot:nth-child(2) {
          animation-delay: 0.2s;
        }

        .streaming-indicator .dot:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes pulse {
          0%,
          80%,
          100% {
            opacity: 0.4;
            transform: scale(1);
          }
          40% {
            opacity: 1;
            transform: scale(1.3);
          }
        }
      `}</style>
    </div>
  );
}
