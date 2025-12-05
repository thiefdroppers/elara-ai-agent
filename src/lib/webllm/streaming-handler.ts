/**
 * Elara AI Agent - Streaming Response Handler
 *
 * Handles real-time streaming of LLM responses to the UI.
 * Implements token-by-token streaming for responsive user experience.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface StreamChunk {
  content: string;
  done: boolean;
  totalTokens?: number;
  finishReason?: 'stop' | 'length' | 'error';
}

export interface StreamMetrics {
  firstTokenLatency: number; // Time to first token (ms)
  totalLatency: number; // Total generation time (ms)
  tokensGenerated: number;
  averageTokensPerSecond: number;
}

export type StreamCallback = (chunk: StreamChunk) => void;

// ============================================================================
// STREAMING HANDLER CLASS
// ============================================================================

export class StreamingHandler {
  private startTime: number = 0;
  private firstTokenTime: number = 0;
  private tokensGenerated: number = 0;
  private fullResponse: string = '';
  private callbacks: Set<StreamCallback> = new Set();

  /**
   * Register a callback for stream updates
   */
  onStream(callback: StreamCallback): () => void {
    this.callbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Start a new streaming session
   */
  startStream(): void {
    this.startTime = performance.now();
    this.firstTokenTime = 0;
    this.tokensGenerated = 0;
    this.fullResponse = '';
  }

  /**
   * Process a new chunk from the LLM
   */
  processChunk(delta: string): void {
    // Record first token time
    if (this.tokensGenerated === 0 && delta.length > 0) {
      this.firstTokenTime = performance.now();
    }

    this.tokensGenerated++;
    this.fullResponse += delta;

    // Notify all callbacks
    this.notifyCallbacks({
      content: delta,
      done: false,
    });
  }

  /**
   * End the streaming session
   */
  endStream(finishReason: 'stop' | 'length' | 'error' = 'stop'): StreamMetrics {
    const endTime = performance.now();

    // Final notification
    this.notifyCallbacks({
      content: '',
      done: true,
      totalTokens: this.tokensGenerated,
      finishReason,
    });

    // Calculate metrics
    const metrics: StreamMetrics = {
      firstTokenLatency: this.firstTokenTime - this.startTime,
      totalLatency: endTime - this.startTime,
      tokensGenerated: this.tokensGenerated,
      averageTokensPerSecond:
        this.tokensGenerated / ((endTime - this.startTime) / 1000),
    };

    console.log('[StreamingHandler] Metrics:', metrics);

    return metrics;
  }

  /**
   * Get the accumulated response
   */
  getFullResponse(): string {
    return this.fullResponse;
  }

  /**
   * Get current token count
   */
  getTokenCount(): number {
    return this.tokensGenerated;
  }

  /**
   * Clear all callbacks
   */
  clearCallbacks(): void {
    this.callbacks.clear();
  }

  /**
   * Notify all registered callbacks
   */
  private notifyCallbacks(chunk: StreamChunk): void {
    this.callbacks.forEach((callback) => {
      try {
        callback(chunk);
      } catch (error) {
        console.error('[StreamingHandler] Callback error:', error);
      }
    });
  }
}

// ============================================================================
// UI UPDATE UTILITIES
// ============================================================================

/**
 * Create a debounced stream callback for UI updates
 * Prevents excessive re-renders by batching updates
 */
export function createDebouncedCallback(
  callback: (accumulated: string) => void,
  delay: number = 50 // 50ms debounce
): StreamCallback {
  let timeoutId: number | undefined;
  let accumulated = '';

  return (chunk: StreamChunk) => {
    accumulated += chunk.content;

    if (chunk.done) {
      // Flush immediately on completion
      if (timeoutId) clearTimeout(timeoutId);
      callback(accumulated);
      accumulated = '';
      return;
    }

    // Debounce intermediate updates
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      callback(accumulated);
      accumulated = '';
    }, delay);
  };
}

/**
 * Create a callback that updates a React state
 */
export function createStateCallback(
  setState: (value: string | ((prev: string) => string)) => void
): StreamCallback {
  return (chunk: StreamChunk) => {
    if (chunk.content) {
      setState((prev) => prev + chunk.content);
    }
  };
}

// ============================================================================
// STREAM PROCESSING UTILITIES
// ============================================================================

/**
 * Process an async iterable stream (WebLLM native format)
 */
export async function processAsyncStream(
  stream: AsyncIterable<{ choices: Array<{ delta?: { content?: string } }> }>,
  handler: StreamingHandler
): Promise<string> {
  handler.startStream();

  try {
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        handler.processChunk(delta);
      }
    }

    handler.endStream('stop');
    return handler.getFullResponse();
  } catch (error) {
    console.error('[StreamingHandler] Stream processing error:', error);
    handler.endStream('error');
    throw error;
  }
}

/**
 * Convert streaming response to a Promise (non-streaming mode)
 */
export async function collectStreamToString(
  stream: AsyncIterable<{ choices: Array<{ delta?: { content?: string } }> }>
): Promise<string> {
  let fullResponse = '';

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || '';
    fullResponse += delta;
  }

  return fullResponse;
}

// ============================================================================
// FORMATTING UTILITIES
// ============================================================================

/**
 * Format streaming text with markdown support
 * (Can be enhanced with actual markdown parsing)
 */
export function formatStreamingText(text: string): string {
  // Basic formatting - can be extended with markdown library
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
    .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
    .replace(/`(.*?)`/g, '<code>$1</code>') // Inline code
    .replace(/\n/g, '<br/>'); // Line breaks
}

/**
 * Detect if streaming text contains code blocks
 */
export function hasCodeBlock(text: string): boolean {
  return /```[\s\S]*?```/.test(text);
}

/**
 * Extract code blocks from streaming text
 */
export function extractCodeBlocks(text: string): Array<{
  language: string;
  code: string;
}> {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const blocks: Array<{ language: string; code: string }> = [];

  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    blocks.push({
      language: match[1] || 'plaintext',
      code: match[2].trim(),
    });
  }

  return blocks;
}

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

export class StreamPerformanceMonitor {
  private metrics: StreamMetrics[] = [];
  private readonly maxHistory = 10;

  recordMetrics(metrics: StreamMetrics): void {
    this.metrics.push(metrics);

    // Keep only last N metrics
    if (this.metrics.length > this.maxHistory) {
      this.metrics.shift();
    }
  }

  getAverageMetrics(): {
    avgFirstTokenLatency: number;
    avgTotalLatency: number;
    avgTokensPerSecond: number;
  } {
    if (this.metrics.length === 0) {
      return {
        avgFirstTokenLatency: 0,
        avgTotalLatency: 0,
        avgTokensPerSecond: 0,
      };
    }

    const sum = this.metrics.reduce(
      (acc, m) => ({
        firstTokenLatency: acc.firstTokenLatency + m.firstTokenLatency,
        totalLatency: acc.totalLatency + m.totalLatency,
        tokensPerSecond: acc.tokensPerSecond + m.averageTokensPerSecond,
      }),
      { firstTokenLatency: 0, totalLatency: 0, tokensPerSecond: 0 }
    );

    return {
      avgFirstTokenLatency: sum.firstTokenLatency / this.metrics.length,
      avgTotalLatency: sum.totalLatency / this.metrics.length,
      avgTokensPerSecond: sum.tokensPerSecond / this.metrics.length,
    };
  }

  getLastMetrics(): StreamMetrics | null {
    return this.metrics[this.metrics.length - 1] || null;
  }

  clear(): void {
    this.metrics = [];
  }
}

// ============================================================================
// SINGLETON INSTANCES
// ============================================================================

export const performanceMonitor = new StreamPerformanceMonitor();
