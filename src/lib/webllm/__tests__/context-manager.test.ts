/**
 * Elara AI Agent - Context Manager Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ContextManager,
  estimateTokens,
  estimateMessageTokens,
  createSystemMessage,
} from '../context-manager';
import type { ChatMessage } from '@/types';

describe('ContextManager', () => {
  let contextManager: ContextManager;

  beforeEach(() => {
    contextManager = new ContextManager(4096, 512);
  });

  describe('estimateTokens', () => {
    it('should estimate tokens correctly', () => {
      expect(estimateTokens('Hello world')).toBe(3); // 11 chars / 4 = 2.75 -> 3
      expect(estimateTokens('This is a longer sentence with more words')).toBe(11);
      expect(estimateTokens('')).toBe(0);
    });
  });

  describe('estimateMessageTokens', () => {
    it('should estimate message tokens with overhead', () => {
      const message: ChatMessage = {
        id: '1',
        role: 'user',
        content: 'Hello',
        timestamp: Date.now(),
      };

      const tokens = estimateMessageTokens(message);
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeGreaterThan(estimateTokens('Hello'));
    });
  });

  describe('truncate', () => {
    it('should not truncate if messages fit in context window', () => {
      const messages: ChatMessage[] = [
        {
          id: '1',
          role: 'system',
          content: 'You are a helpful assistant',
          timestamp: Date.now(),
        },
        {
          id: '2',
          role: 'user',
          content: 'Hello',
          timestamp: Date.now(),
        },
      ];

      const truncated = contextManager.truncate(messages);
      expect(truncated).toHaveLength(2);
    });

    it('should preserve system prompt and recent messages', () => {
      const messages: ChatMessage[] = [
        {
          id: '1',
          role: 'system',
          content: 'System prompt',
          timestamp: Date.now(),
        },
        ...Array.from({ length: 100 }, (_, i) => ({
          id: `${i + 2}`,
          role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
          content: `Message ${i}`,
          timestamp: Date.now(),
        })),
      ];

      const truncated = contextManager.truncate(messages, {
        preserveRecent: 4,
        maxTokens: 1000,
      });

      // Should have system prompt + some messages
      expect(truncated.length).toBeGreaterThan(0);
      expect(truncated[0].role).toBe('system');

      // Recent messages should be preserved
      const lastFour = truncated.slice(-4);
      expect(lastFour).toHaveLength(4);
    });

    it('should return empty array for empty input', () => {
      const truncated = contextManager.truncate([]);
      expect(truncated).toHaveLength(0);
    });
  });

  describe('getUsageStats', () => {
    it('should calculate usage statistics correctly', () => {
      const messages: ChatMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello world',
          timestamp: Date.now(),
        },
      ];

      const stats = contextManager.getUsageStats(messages);

      expect(stats.totalTokens).toBeGreaterThan(0);
      expect(stats.availableTokens).toBeGreaterThan(0);
      expect(stats.utilizationPercent).toBeGreaterThan(0);
      expect(stats.utilizationPercent).toBeLessThan(100);
      expect(stats.needsTruncation).toBe(false);
    });
  });

  describe('createSystemMessage', () => {
    it('should create a system message', () => {
      const message = createSystemMessage('You are a helpful assistant');

      expect(message.role).toBe('system');
      expect(message.content).toBe('You are a helpful assistant');
      expect(message.id).toBeDefined();
      expect(message.timestamp).toBeDefined();
    });
  });
});
