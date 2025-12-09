/**
 * Elara AI Agent - Neural LLM Client Tests
 *
 * TDD tests for neural-llm-client.ts
 * Tests the fallback chain: Neural Service -> WebLLM -> Gemini
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import type { ChatMessage } from '@/types';

// Mock fetch globally
global.fetch = vi.fn();

// Mock types matching Neural Service API (elara-neural-service/src/main.py)
interface NeuralChatRequest {
  messages: Array<{ role: string; content: string }>;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop?: string[];
}

interface NeuralChatResponse {
  content: string;
  finish_reason: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  inference_time_ms: number;
  model: string;
}

// Mock MemoryContext from neural-memory-service.ts
interface MemoryContext {
  relevantMemories: Array<{
    id: string;
    type: string;
    content: string;
    importance: number;
    similarity?: number;
  }>;
  similarities: number[];
  insufficientData: boolean;
  suggestedActions?: string[];
  recentScans?: Array<{
    url: string;
    verdict: string;
    riskScore: number;
    timestamp: number;
  }>;
  threatPatterns?: Array<{
    pattern: string;
    confidence: number;
    occurrences: number;
  }>;
}

// Define the client interface we're testing
interface NeuralLLMClientConfig {
  neuralServiceUrl?: string;
  timeout?: number;
  maxRetries?: number;
  enableFallback?: boolean;
}

interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  memoryContext?: MemoryContext;
  stream?: boolean;
  onStream?: (chunk: string) => void;
}

interface GenerateResult {
  content: string;
  provider: 'neural' | 'webllm' | 'gemini';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
  memoryInjected: boolean;
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('NeuralLLMClient', () => {
  // Will be replaced with real implementation
  let NeuralLLMClient: any;
  let client: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    (global.fetch as Mock).mockReset();

    // Dynamic import to test implementation when available
    try {
      const module = await import('../neural-llm-client');
      NeuralLLMClient = module.NeuralLLMClient;
      client = new NeuralLLMClient({
        neuralServiceUrl: 'http://10.10.0.194:8200',
        timeout: 30000,
        maxRetries: 2,
        enableFallback: true,
      });
    } catch {
      // Module not yet implemented - tests will fail until implementation
      NeuralLLMClient = null;
      client = null;
    }
  });

  // --------------------------------------------------------------------------
  // Configuration Tests
  // --------------------------------------------------------------------------

  describe('Configuration', () => {
    it('should initialize with default config', async () => {
      if (!NeuralLLMClient) {
        expect.fail('NeuralLLMClient not implemented yet');
        return;
      }

      const defaultClient = new NeuralLLMClient();
      expect(defaultClient).toBeDefined();
      expect(defaultClient.getConfig().neuralServiceUrl).toBe('http://neural-service.e-brain.svc:8200');
    });

    it('should accept custom config', () => {
      if (!NeuralLLMClient) {
        expect.fail('NeuralLLMClient not implemented yet');
        return;
      }

      expect(client.getConfig().neuralServiceUrl).toBe('http://10.10.0.194:8200');
      expect(client.getConfig().timeout).toBe(30000);
      expect(client.getConfig().maxRetries).toBe(2);
    });

    it('should validate config values', () => {
      if (!NeuralLLMClient) {
        expect.fail('NeuralLLMClient not implemented yet');
        return;
      }

      expect(() => new NeuralLLMClient({ timeout: -1 })).toThrow('Invalid timeout');
      expect(() => new NeuralLLMClient({ maxRetries: -1 })).toThrow('Invalid maxRetries');
    });
  });

  // --------------------------------------------------------------------------
  // Neural Service Primary Tests
  // --------------------------------------------------------------------------

  describe('Neural Service (Primary)', () => {
    it('should call Neural Service chat endpoint', async () => {
      if (!client) {
        expect.fail('NeuralLLMClient not implemented yet');
        return;
      }

      const mockResponse: NeuralChatResponse = {
        content: 'Hello! I am Elara AI.',
        finish_reason: 'stop',
        usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
        inference_time_ms: 1500,
        model: 'Llama-3.2-3B-Instruct',
      };

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: Date.now() },
      ];

      const result = await client.generate(messages);

      expect(result.content).toBe('Hello! I am Elara AI.');
      expect(result.provider).toBe('neural');
      expect(result.usage.totalTokens).toBe(18);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://10.10.0.194:8200/api/v1/chat',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should pass correct request body to Neural Service', async () => {
      if (!client) {
        expect.fail('NeuralLLMClient not implemented yet');
        return;
      }

      const mockResponse: NeuralChatResponse = {
        content: 'Response',
        finish_reason: 'stop',
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
        inference_time_ms: 1000,
        model: 'Llama-3.2-3B-Instruct',
      };

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const messages: ChatMessage[] = [
        { id: '1', role: 'system', content: 'You are Elara AI', timestamp: Date.now() },
        { id: '2', role: 'user', content: 'Hello', timestamp: Date.now() },
      ];

      await client.generate(messages, { temperature: 0.5, maxTokens: 256 });

      const fetchCall = (global.fetch as Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.messages).toHaveLength(2);
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[1].role).toBe('user');
      expect(body.temperature).toBe(0.5);
      expect(body.max_tokens).toBe(256);
    });

    it('should handle Neural Service timeout with Gemini fallback', async () => {
      if (!client) {
        expect.fail('NeuralLLMClient not implemented yet');
        return;
      }

      // Neural service fails with timeout (retried)
      (global.fetch as Mock)
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('timeout'))
        // Gemini fallback succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ response: 'Gemini fallback response' }),
        });

      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: Date.now() },
      ];

      const result = await client.generate(messages);

      // Should fallback to Gemini since WebLLM isn't ready in tests
      expect(result.provider).toBe('gemini');
      expect(result.content).toBe('Gemini fallback response');
    });

    it('should retry on 5xx errors', async () => {
      if (!client) {
        expect.fail('NeuralLLMClient not implemented yet');
        return;
      }

      // First call fails with 503
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      // Second call succeeds
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          content: 'Success after retry',
          finish_reason: 'stop',
          usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
          inference_time_ms: 1000,
          model: 'Llama-3.2-3B-Instruct',
        }),
      });

      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: Date.now() },
      ];

      const result = await client.generate(messages);

      expect(result.content).toBe('Success after retry');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  // --------------------------------------------------------------------------
  // Memory Context Injection Tests (CRITICAL - Fix Write-Only Brain)
  // --------------------------------------------------------------------------

  describe('Memory Context Injection', () => {
    it('should inject memory context into system prompt', async () => {
      if (!client) {
        expect.fail('NeuralLLMClient not implemented yet');
        return;
      }

      const mockResponse: NeuralChatResponse = {
        content: 'I remember you asked about google.com before.',
        finish_reason: 'stop',
        usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 },
        inference_time_ms: 1200,
        model: 'Llama-3.2-3B-Instruct',
      };

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const memoryContext: MemoryContext = {
        relevantMemories: [
          {
            id: 'mem-1',
            type: 'episodic',
            content: 'User asked about google.com, verdict: SAFE',
            importance: 0.9,
            similarity: 0.85,
          },
        ],
        similarities: [0.85],
        insufficientData: false,
        recentScans: [
          {
            url: 'https://google.com',
            verdict: 'SAFE',
            riskScore: 0.05,
            timestamp: Date.now() - 60000,
          },
        ],
        suggestedActions: ['Remember previous safe scan results'],
      };

      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: 'Is google.com safe?', timestamp: Date.now() },
      ];

      const result = await client.generate(messages, { memoryContext });

      // Verify memory was injected
      expect(result.memoryInjected).toBe(true);

      // Check the request body includes memory context
      const fetchCall = (global.fetch as Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      // System message should contain memory context
      const systemMessage = body.messages.find((m: any) => m.role === 'system');
      expect(systemMessage).toBeDefined();
      expect(systemMessage.content).toContain('google.com');
      expect(systemMessage.content).toContain('SAFE');
    });

    it('should format memory context correctly in prompt', async () => {
      if (!client) {
        expect.fail('NeuralLLMClient not implemented yet');
        return;
      }

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          content: 'Response with context',
          finish_reason: 'stop',
          usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 },
          inference_time_ms: 1500,
          model: 'Llama-3.2-3B-Instruct',
        }),
      });

      const memoryContext: MemoryContext = {
        relevantMemories: [
          {
            id: 'mem-1',
            type: 'semantic',
            content: 'Phishing URLs often use typosquatting',
            importance: 0.95,
          },
          {
            id: 'mem-2',
            type: 'episodic',
            content: 'User scanned paypal-secure.com - DANGEROUS',
            importance: 0.85,
          },
        ],
        similarities: [0.9, 0.75],
        insufficientData: false,
        threatPatterns: [
          { pattern: 'typosquatting', confidence: 0.92, occurrences: 15 },
        ],
      };

      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: 'Check paypa1.com', timestamp: Date.now() },
      ];

      await client.generate(messages, { memoryContext });

      const fetchCall = (global.fetch as Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      const systemMessage = body.messages.find((m: any) => m.role === 'system');

      // Should include relevant memories section
      expect(systemMessage.content).toMatch(/relevant.*memor/i);
      expect(systemMessage.content).toContain('typosquatting');

      // Should include recent scans or threat patterns
      expect(systemMessage.content).toMatch(/threat.*pattern|recent.*scan/i);
    });

    it('should handle empty memory context gracefully', async () => {
      if (!client) {
        expect.fail('NeuralLLMClient not implemented yet');
        return;
      }

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          content: 'Response without memory',
          finish_reason: 'stop',
          usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 },
          inference_time_ms: 1000,
          model: 'Llama-3.2-3B-Instruct',
        }),
      });

      const emptyMemoryContext: MemoryContext = {
        relevantMemories: [],
        similarities: [],
        insufficientData: true,
      };

      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: Date.now() },
      ];

      const result = await client.generate(messages, { memoryContext: emptyMemoryContext });

      expect(result.memoryInjected).toBe(false);
      expect(result.content).toBe('Response without memory');
    });
  });

  // --------------------------------------------------------------------------
  // Fallback Chain Tests
  // --------------------------------------------------------------------------

  describe('Fallback Chain: Neural -> WebLLM -> Gemini', () => {
    it('should fallback to Gemini when Neural Service fails (WebLLM not ready in tests)', async () => {
      if (!client) {
        expect.fail('NeuralLLMClient not implemented yet');
        return;
      }

      // Neural Service fails (with retries)
      (global.fetch as Mock)
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockRejectedValueOnce(new Error('Connection refused'))
        // Gemini API succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ response: 'Gemini fallback response' }),
        });

      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: Date.now() },
      ];

      const result = await client.generate(messages);

      // In tests WebLLM isn't ready, so should fallback to Gemini
      expect(result.provider).toBe('gemini');
      expect(result.content).toBe('Gemini fallback response');
    });

    it('should fallback to Gemini when Neural returns invalid response', async () => {
      if (!client) {
        expect.fail('NeuralLLMClient not implemented yet');
        return;
      }

      // Neural Service returns invalid response (with retries - maxRetries=2 means 3 attempts)
      (global.fetch as Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ invalid: 'response' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ invalid: 'response' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ invalid: 'response' }),
        })
        // Gemini API succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ response: 'Gemini fallback response' }),
        });

      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: Date.now() },
      ];

      const result = await client.generate(messages);

      expect(result.provider).toBe('gemini');
    });

    it('should throw when all providers fail and fallback disabled', async () => {
      if (!NeuralLLMClient) {
        expect.fail('NeuralLLMClient not implemented yet');
        return;
      }

      const noFallbackClient = new NeuralLLMClient({
        neuralServiceUrl: 'http://10.10.0.194:8200',
        enableFallback: false,
      });

      (global.fetch as Mock)
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockRejectedValueOnce(new Error('Connection refused'));

      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: Date.now() },
      ];

      await expect(noFallbackClient.generate(messages)).rejects.toThrow();
    });

    it('should track provider in result', async () => {
      if (!client) {
        expect.fail('NeuralLLMClient not implemented yet');
        return;
      }

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          content: 'Neural response',
          finish_reason: 'stop',
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          inference_time_ms: 1000,
          model: 'Llama-3.2-3B-Instruct',
        }),
      });

      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: Date.now() },
      ];

      const result = await client.generate(messages);

      expect(result.provider).toBe('neural');
      expect(['neural', 'webllm', 'gemini']).toContain(result.provider);
    });
  });

  // --------------------------------------------------------------------------
  // Health Check Tests
  // --------------------------------------------------------------------------

  describe('Health Check', () => {
    it('should check Neural Service health', async () => {
      if (!client) {
        expect.fail('NeuralLLMClient not implemented yet');
        return;
      }

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          status: 'healthy',
          model_loaded: true,
          model: 'Llama-3.2-3B-Instruct',
        }),
      });

      const health = await client.checkHealth();

      expect(health.neural.available).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://10.10.0.194:8200/api/v1/llm/health',
        expect.any(Object)
      );
    });

    it('should check all providers health', async () => {
      if (!client) {
        expect.fail('NeuralLLMClient not implemented yet');
        return;
      }

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' }),
      });

      const health = await client.checkHealth();

      expect(health).toHaveProperty('neural');
      expect(health).toHaveProperty('webllm');
      expect(health).toHaveProperty('gemini');
    });
  });

  // --------------------------------------------------------------------------
  // Prompt Building Tests
  // --------------------------------------------------------------------------

  describe('Prompt Building with Memory', () => {
    it('should build memory-enriched system prompt', async () => {
      if (!NeuralLLMClient) {
        expect.fail('NeuralLLMClient not implemented yet');
        return;
      }

      const memoryContext: MemoryContext = {
        relevantMemories: [
          { id: '1', type: 'semantic', content: 'Phishing knowledge', importance: 0.9 },
        ],
        similarities: [0.85],
        insufficientData: false,
        recentScans: [
          { url: 'test.com', verdict: 'SAFE', riskScore: 0.1, timestamp: Date.now() },
        ],
      };

      // Access internal method for testing
      const enrichedPrompt = client.buildMemoryEnrichedPrompt(
        'You are Elara AI',
        memoryContext
      );

      expect(enrichedPrompt).toContain('You are Elara AI');
      expect(enrichedPrompt).toContain('Phishing knowledge');
      expect(enrichedPrompt).toContain('test.com');
      expect(enrichedPrompt).toContain('SAFE');
    });

    it('should prioritize high-importance memories', async () => {
      if (!NeuralLLMClient) {
        expect.fail('NeuralLLMClient not implemented yet');
        return;
      }

      const memoryContext: MemoryContext = {
        relevantMemories: [
          { id: '1', type: 'semantic', content: 'Low importance', importance: 0.3 },
          { id: '2', type: 'semantic', content: 'High importance', importance: 0.95 },
          { id: '3', type: 'semantic', content: 'Medium importance', importance: 0.6 },
        ],
        similarities: [0.5, 0.9, 0.7],
        insufficientData: false,
      };

      const enrichedPrompt = client.buildMemoryEnrichedPrompt(
        'System prompt',
        memoryContext
      );

      // High importance should appear before low importance
      const highIndex = enrichedPrompt.indexOf('High importance');
      const lowIndex = enrichedPrompt.indexOf('Low importance');

      expect(highIndex).toBeLessThan(lowIndex);
    });
  });

  // --------------------------------------------------------------------------
  // Error Handling Tests
  // --------------------------------------------------------------------------

  describe('Error Handling', () => {
    it('should handle malformed response from Neural Service with fallback', async () => {
      if (!client) {
        expect.fail('NeuralLLMClient not implemented yet');
        return;
      }

      // Neural Service returns malformed response (with retries - maxRetries=2 means 3 attempts)
      (global.fetch as Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ invalid: 'response' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ invalid: 'response' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ invalid: 'response' }),
        })
        // Gemini fallback
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ response: 'Gemini response' }),
        });

      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: Date.now() },
      ];

      const result = await client.generate(messages);
      // Should have fallen back to Gemini
      expect(result.provider).toBe('gemini');
    });

    it('should handle network errors with fallback', async () => {
      if (!client) {
        expect.fail('NeuralLLMClient not implemented yet');
        return;
      }

      (global.fetch as Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        // Gemini fallback
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ response: 'Gemini response' }),
        });

      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: Date.now() },
      ];

      // Should fallback to Gemini
      const result = await client.generate(messages);
      expect(result.provider).toBe('gemini');
    });

    it('should include fallback reason when using fallback', async () => {
      if (!client) {
        expect.fail('NeuralLLMClient not implemented yet');
        return;
      }

      (global.fetch as Mock)
        .mockRejectedValueOnce(new Error('Neural timeout'))
        .mockRejectedValueOnce(new Error('Neural timeout'))
        .mockRejectedValueOnce(new Error('Neural timeout'))
        // Gemini fallback succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ response: 'Fallback response' }),
        });

      const messages: ChatMessage[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: Date.now() },
      ];

      const result = await client.generate(messages);

      expect(result.provider).toBe('gemini');
      expect(result.fallbackReason).toBeDefined();
    });
  });
});

// ============================================================================
// INTEGRATION TESTS (Require actual services)
// ============================================================================

describe.skip('NeuralLLMClient Integration Tests', () => {
  let client: any;

  beforeEach(async () => {
    const { NeuralLLMClient } = await import('../neural-llm-client');
    client = new NeuralLLMClient({
      neuralServiceUrl: 'http://neural-service.e-brain.svc:8200',
      enableFallback: true,
    });
  });

  it('should connect to real Neural Service in GKE', async () => {
    const health = await client.checkHealth();
    console.log('Neural Service Health:', health);
    expect(health.neural.available).toBe(true);
  });

  it('should generate response from real Neural Service', async () => {
    const messages: ChatMessage[] = [
      { id: '1', role: 'user', content: 'Hello, what can you do?', timestamp: Date.now() },
    ];

    const result = await client.generate(messages);

    expect(result.content).toBeTruthy();
    expect(result.provider).toBe('neural');
    console.log('Response:', result.content);
    console.log('Latency:', result.latencyMs, 'ms');
  });
});
