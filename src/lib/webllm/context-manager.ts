/**
 * Elara AI Agent - Conversation Context Manager
 *
 * Manages conversation history with intelligent context window truncation.
 * Implements sliding window strategy to fit within model token limits.
 */

import type { ChatMessage } from '@/types';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_MAX_TOKENS = 4096;
const SYSTEM_PROMPT_RESERVE = 512; // Tokens reserved for system prompt
const RESPONSE_RESERVE = 768; // Tokens reserved for response generation

// Rough token estimation: ~4 characters per token (English text)
const CHARS_PER_TOKEN = 4;

// ============================================================================
// TOKEN ESTIMATION
// ============================================================================

/**
 * Estimate token count for a text string
 * Note: This is a rough approximation. Actual tokenization depends on model.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Estimate tokens for a chat message
 */
export function estimateMessageTokens(message: ChatMessage): number {
  let tokens = 0;

  // Role tokens (role name + formatting)
  tokens += 4; // "role: " prefix

  // Content tokens
  tokens += estimateTokens(message.content);

  // Metadata overhead (minimal)
  tokens += 10;

  return tokens;
}

// ============================================================================
// CONTEXT WINDOW MANAGEMENT
// ============================================================================

export interface ContextWindowOptions {
  maxTokens?: number;
  preserveSystemPrompt?: boolean;
  preserveRecent?: number; // Number of recent messages to always keep
}

export class ContextManager {
  private maxTokens: number;
  private systemPromptTokens: number;

  constructor(
    maxTokens: number = DEFAULT_MAX_TOKENS,
    systemPromptTokens: number = SYSTEM_PROMPT_RESERVE
  ) {
    this.maxTokens = maxTokens;
    this.systemPromptTokens = systemPromptTokens;
  }

  /**
   * Truncate conversation history to fit within context window
   *
   * Strategy:
   * 1. Always preserve system prompt (first message)
   * 2. Always preserve last N messages (recent context)
   * 3. Remove middle messages (oldest first) if needed
   * 4. Reserve space for response generation
   */
  truncate(
    messages: ChatMessage[],
    options: ContextWindowOptions = {}
  ): ChatMessage[] {
    const {
      maxTokens = this.maxTokens,
      preserveSystemPrompt = true,
      preserveRecent = 4,
    } = options;

    if (messages.length === 0) return [];

    // Calculate available tokens (reserve space for response)
    const availableTokens = maxTokens - RESPONSE_RESERVE;

    // Separate system prompt from conversation
    const systemMessage = messages[0]?.role === 'system' ? messages[0] : null;
    const conversationMessages = systemMessage ? messages.slice(1) : messages;

    let currentTokens = 0;

    // Account for system prompt
    if (preserveSystemPrompt && systemMessage) {
      currentTokens += this.systemPromptTokens;
    }

    // Check if conversation fits entirely
    const totalConversationTokens = conversationMessages.reduce(
      (sum, msg) => sum + estimateMessageTokens(msg),
      0
    );

    if (currentTokens + totalConversationTokens <= availableTokens) {
      // Everything fits, return as-is
      return messages;
    }

    // Truncation needed - implement sliding window
    const truncated: ChatMessage[] = [];

    if (preserveSystemPrompt && systemMessage) {
      truncated.push(systemMessage);
    }

    // Preserve recent messages (from end)
    const recentMessages = conversationMessages.slice(-preserveRecent);
    const recentTokens = recentMessages.reduce(
      (sum, msg) => sum + estimateMessageTokens(msg),
      0
    );

    currentTokens += recentTokens;

    // Add older messages if space available
    const olderMessages = conversationMessages.slice(0, -preserveRecent);
    const includedOlder: ChatMessage[] = [];

    // Add messages from oldest to newest until we hit token limit
    for (const message of olderMessages) {
      const msgTokens = estimateMessageTokens(message);

      if (currentTokens + msgTokens <= availableTokens) {
        includedOlder.push(message);
        currentTokens += msgTokens;
      } else {
        break; // Stop when we exceed limit
      }
    }

    // Combine: system + older + recent
    return [...truncated, ...includedOlder, ...recentMessages];
  }

  /**
   * Check if adding a new message would exceed context window
   */
  wouldExceed(messages: ChatMessage[], newMessage: ChatMessage): boolean {
    const currentTokens = messages.reduce(
      (sum, msg) => sum + estimateMessageTokens(msg),
      0
    );
    const newTokens = estimateMessageTokens(newMessage);
    const totalTokens = currentTokens + newTokens + RESPONSE_RESERVE;

    return totalTokens > this.maxTokens;
  }

  /**
   * Get current token usage statistics
   */
  getUsageStats(messages: ChatMessage[]): {
    totalTokens: number;
    availableTokens: number;
    utilizationPercent: number;
    needsTruncation: boolean;
  } {
    const totalTokens = messages.reduce(
      (sum, msg) => sum + estimateMessageTokens(msg),
      0
    );
    const availableTokens = this.maxTokens - totalTokens - RESPONSE_RESERVE;
    const utilizationPercent = (totalTokens / this.maxTokens) * 100;
    const needsTruncation = totalTokens + RESPONSE_RESERVE > this.maxTokens;

    return {
      totalTokens,
      availableTokens: Math.max(0, availableTokens),
      utilizationPercent,
      needsTruncation,
    };
  }

  /**
   * Update max tokens (e.g., when switching models)
   */
  setMaxTokens(maxTokens: number): void {
    this.maxTokens = maxTokens;
  }

  /**
   * Get maximum context window size
   */
  getMaxTokens(): number {
    return this.maxTokens;
  }
}

// ============================================================================
// CONTEXT COMPRESSION
// ============================================================================

/**
 * Summarize old messages to preserve more context
 * (Future enhancement - requires additional LLM call)
 */
export async function summarizeOldMessages(
  messages: ChatMessage[]
): Promise<string> {
  // TODO: Implement message summarization
  // This would use the LLM to create a concise summary of old messages
  // For now, return a simple concatenation

  const summary = messages
    .map(
      (msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content.slice(0, 100)}...`
    )
    .join('\n');

  return `[Conversation Summary]\n${summary}`;
}

// ============================================================================
// MESSAGE UTILITIES
// ============================================================================

/**
 * Create a system message from prompt text
 */
export function createSystemMessage(content: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: 'system',
    content,
    timestamp: Date.now(),
  };
}

/**
 * Filter messages by role
 */
export function filterByRole(
  messages: ChatMessage[],
  role: 'user' | 'assistant' | 'system'
): ChatMessage[] {
  return messages.filter((msg) => msg.role === role);
}

/**
 * Get last N messages
 */
export function getLastN(messages: ChatMessage[], n: number): ChatMessage[] {
  return messages.slice(-n);
}

/**
 * Count messages by role
 */
export function countByRole(messages: ChatMessage[]): {
  user: number;
  assistant: number;
  system: number;
} {
  return messages.reduce(
    (counts, msg) => {
      counts[msg.role]++;
      return counts;
    },
    { user: 0, assistant: 0, system: 0 }
  );
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const contextManager = new ContextManager();
