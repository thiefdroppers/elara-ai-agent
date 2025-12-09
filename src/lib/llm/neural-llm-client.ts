/**
 * Elara AI Agent - Neural LLM Client
 *
 * Unified LLM client with fallback chain:
 * Neural Service (GKE) -> WebLLM (browser) -> Gemini (cloud)
 *
 * CRITICAL: This module fixes the "Write-Only Brain" problem by injecting
 * E-BRAIN memory context into LLM prompts for context-aware responses.
 */

import type { ChatMessage } from '@/types';
import { webLLMEngine } from '@/lib/webllm/webllm-engine';
import { SYSTEM_PROMPT } from '@/lib/webllm/model-config';
import { ELARA_V3_SYSTEM_PROMPT } from './system-prompts';

// ============================================================================
// TYPES
// ============================================================================

export interface MemoryContext {
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
  userProfile?: {
    scanHistory: number;
    riskTolerance: string;
    preferredActions: string[];
  };
}

export interface NeuralLLMClientConfig {
  neuralServiceUrl?: string;
  timeout?: number;
  maxRetries?: number;
  enableFallback?: boolean;
  geminiEndpoint?: string;
}

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  memoryContext?: MemoryContext;
  stream?: boolean;
  onStream?: (chunk: string) => void;
  stopSequences?: string[];
}

export interface GenerateResult {
  content: string;
  provider: 'neural' | 'webllm' | 'gemini';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
  memoryInjected: boolean;
  fallbackReason?: string;
}

export interface HealthStatus {
  neural: {
    available: boolean;
    modelLoaded?: boolean;
    model?: string;
    error?: string;
  };
  webllm: {
    available: boolean;
    model?: string;
    error?: string;
  };
  gemini: {
    available: boolean;
    error?: string;
  };
}

interface NeuralChatRequest {
  messages: Array<{ role: string; content: string }>;
  max_tokens: number;
  temperature: number;
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

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: Required<NeuralLLMClientConfig> = {
  // Cloud Run URL - publicly accessible with API key authentication
  neuralServiceUrl: 'https://neural-service-api-p5ijr7bleq-uw.a.run.app',
  timeout: 60000, // 60s for LLM inference
  maxRetries: 2,
  enableFallback: true,
  geminiEndpoint: 'https://dev-api.thiefdroppers.com/api/v2/ai/chat',
};

// API Key for Neural Service authentication
const NEURAL_SERVICE_API_KEY = 'elara_neural_2025_secure_key';

// Memory injection prompt template
const MEMORY_CONTEXT_TEMPLATE = `
## Relevant Context from E-BRAIN Memory

{{#if recentScans}}
### Recent Scans
{{#each recentScans}}
- **{{url}}**: {{verdict}} (Risk: {{riskScore}})
{{/each}}
{{/if}}

{{#if relevantMemories}}
### Relevant Knowledge
{{#each relevantMemories}}
- [{{type}}] {{content}} (importance: {{importance}})
{{/each}}
{{/if}}

{{#if threatPatterns}}
### Threat Patterns Detected
{{#each threatPatterns}}
- **{{pattern}}**: {{confidence}}% confidence, {{occurrences}} occurrences
{{/each}}
{{/if}}

{{#if suggestedActions}}
### Suggested Actions
{{#each suggestedActions}}
- {{this}}
{{/each}}
{{/if}}

---
Use the above context to provide informed, personalized responses.
`;

// ============================================================================
// NEURAL LLM CLIENT CLASS
// ============================================================================

export class NeuralLLMClient {
  private config: Required<NeuralLLMClientConfig>;

  constructor(config: NeuralLLMClientConfig = {}) {
    // Validate config
    if (config.timeout !== undefined && config.timeout < 0) {
      throw new Error('Invalid timeout: must be non-negative');
    }
    if (config.maxRetries !== undefined && config.maxRetries < 0) {
      throw new Error('Invalid maxRetries: must be non-negative');
    }

    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  getConfig(): Required<NeuralLLMClientConfig> {
    return { ...this.config };
  }

  // --------------------------------------------------------------------------
  // Main Generate Method
  // --------------------------------------------------------------------------

  async generate(
    messages: ChatMessage[],
    options: GenerateOptions = {}
  ): Promise<GenerateResult> {
    const startTime = performance.now();

    console.log('[NeuralLLMClient] generate() called with', messages.length, 'messages');
    console.log('[NeuralLLMClient] Config:', {
      neuralServiceUrl: this.config.neuralServiceUrl,
      enableFallback: this.config.enableFallback,
    });

    // Build messages with memory context if provided
    const enrichedMessages = this.injectMemoryContext(messages, options.memoryContext);
    const memoryInjected = options.memoryContext
      ? !options.memoryContext.insufficientData &&
        options.memoryContext.relevantMemories.length > 0
      : false;

    // Try Neural Service first
    console.log('[NeuralLLMClient] Attempting Neural Service at:', this.config.neuralServiceUrl);
    try {
      const result = await this.generateFromNeuralService(enrichedMessages, options);
      return {
        ...result,
        memoryInjected,
        latencyMs: performance.now() - startTime,
      };
    } catch (neuralError) {
      console.warn('[NeuralLLMClient] Neural Service failed:', neuralError);

      if (!this.config.enableFallback) {
        throw new Error(
          `Neural Service failed and fallback disabled: ${neuralError instanceof Error ? neuralError.message : String(neuralError)}`
        );
      }

      // Try WebLLM fallback
      try {
        if (webLLMEngine.isReady()) {
          const result = await this.generateFromWebLLM(enrichedMessages, options);
          return {
            ...result,
            memoryInjected,
            latencyMs: performance.now() - startTime,
            fallbackReason: `Neural Service: ${neuralError instanceof Error ? neuralError.message : String(neuralError)}`,
          };
        }
      } catch (webllmError) {
        console.warn('[NeuralLLMClient] WebLLM failed:', webllmError);
      }

      // Try Gemini fallback
      try {
        const result = await this.generateFromGemini(enrichedMessages, options);
        return {
          ...result,
          memoryInjected,
          latencyMs: performance.now() - startTime,
          fallbackReason: `Neural Service failed, WebLLM unavailable`,
        };
      } catch (geminiError) {
        console.error('[NeuralLLMClient] All providers failed');
        throw new Error(
          `All LLM providers failed. Neural: ${neuralError}, Gemini: ${geminiError}`
        );
      }
    }
  }

  // --------------------------------------------------------------------------
  // Neural Service Provider
  // --------------------------------------------------------------------------

  private async generateFromNeuralService(
    messages: ChatMessage[],
    options: GenerateOptions
  ): Promise<Omit<GenerateResult, 'memoryInjected' | 'latencyMs'>> {
    const url = `${this.config.neuralServiceUrl}/api/v1/chat`;

    const requestBody: NeuralChatRequest = {
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: options.maxTokens ?? 1024,
      temperature: options.temperature ?? 0.7,
      top_p: 0.9,
      stop: options.stopSequences,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        console.log('[NeuralLLMClient] Fetching:', url, 'attempt:', attempt + 1);

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': NEURAL_SERVICE_API_KEY,
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        console.log('[NeuralLLMClient] Response status:', response.status);

        if (!response.ok) {
          // Retry on 5xx errors
          if (response.status >= 500 && attempt < this.config.maxRetries) {
            console.log('[NeuralLLMClient] 5xx error, retrying...');
            await this.delay(1000 * (attempt + 1)); // Exponential backoff
            continue;
          }
          throw new Error(`Neural Service error: ${response.status} ${response.statusText}`);
        }

        const data: NeuralChatResponse = await response.json();
        console.log('[NeuralLLMClient] Neural Service response received, model:', data.model);
        console.log('[NeuralLLMClient] Response content:', data.content?.substring(0, 200) + (data.content?.length > 200 ? '...' : ''));

        // Validate response
        if (!data.content && data.content !== '') {
          throw new Error('Invalid response: missing content field');
        }

        return {
          content: data.content,
          provider: 'neural',
          usage: {
            promptTokens: data.usage?.prompt_tokens ?? 0,
            completionTokens: data.usage?.completion_tokens ?? 0,
            totalTokens: data.usage?.total_tokens ?? 0,
          },
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (error instanceof Error && error.name === 'AbortError') {
          lastError = new Error('Neural Service timeout');
        }

        if (attempt < this.config.maxRetries) {
          await this.delay(1000 * (attempt + 1));
        }
      }
    }

    throw lastError || new Error('Neural Service request failed');
  }

  // --------------------------------------------------------------------------
  // WebLLM Provider
  // --------------------------------------------------------------------------

  private async generateFromWebLLM(
    messages: ChatMessage[],
    options: GenerateOptions
  ): Promise<Omit<GenerateResult, 'memoryInjected' | 'latencyMs'>> {
    // WebLLM uses StreamChunk, adapt our simple callback
    const webllmOnStream = options.onStream
      ? (chunk: { content: string; done: boolean }) => {
          options.onStream!(chunk.content);
        }
      : undefined;

    const result = await webLLMEngine.generate(messages, {
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      stream: options.stream,
      onStream: webllmOnStream,
      stopSequences: options.stopSequences,
    });

    return {
      content: result.content,
      provider: 'webllm',
      usage: {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
      },
    };
  }

  // --------------------------------------------------------------------------
  // Gemini Provider (via Scanner API)
  // --------------------------------------------------------------------------

  private async generateFromGemini(
    messages: ChatMessage[],
    options: GenerateOptions
  ): Promise<Omit<GenerateResult, 'memoryInjected' | 'latencyMs'>> {
    // Convert messages to Gemini format
    const lastUserMessage = messages.filter((m) => m.role === 'user').pop();
    const systemMessage = messages.find((m) => m.role === 'system');

    const prompt = systemMessage
      ? `${systemMessage.content}\n\nUser: ${lastUserMessage?.content || ''}`
      : lastUserMessage?.content || '';

    const response = await fetch(this.config.geminiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: prompt,
        temperature: options.temperature ?? 0.7,
        maxTokens: options.maxTokens ?? 1024,
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return {
      content: data.response || data.content || '',
      provider: 'gemini',
      usage: {
        promptTokens: Math.floor(prompt.length / 4),
        completionTokens: Math.floor((data.response || '').length / 4),
        totalTokens: Math.floor((prompt.length + (data.response || '').length) / 4),
      },
    };
  }

  // --------------------------------------------------------------------------
  // Memory Context Injection (CRITICAL - Fixes Write-Only Brain)
  // --------------------------------------------------------------------------

  private injectMemoryContext(
    messages: ChatMessage[],
    memoryContext?: MemoryContext
  ): ChatMessage[] {
    // Find or create system message - use V3 system prompt by default
    const hasSystemMessage = messages.length > 0 && messages[0].role === 'system';
    let systemContent = hasSystemMessage ? messages[0].content : ELARA_V3_SYSTEM_PROMPT;

    // Only inject if we have meaningful memory context
    if (
      memoryContext &&
      !memoryContext.insufficientData &&
      (memoryContext.relevantMemories.length > 0 ||
        (memoryContext.recentScans && memoryContext.recentScans.length > 0) ||
        (memoryContext.threatPatterns && memoryContext.threatPatterns.length > 0))
    ) {
      const memorySection = this.buildMemoryEnrichedPrompt('', memoryContext);
      systemContent = `${systemContent}\n\n${memorySection}`;
    }

    // Build final message array
    const systemMessage: ChatMessage = {
      id: hasSystemMessage ? messages[0].id : crypto.randomUUID(),
      role: 'system',
      content: systemContent,
      timestamp: hasSystemMessage ? messages[0].timestamp : Date.now(),
    };

    if (hasSystemMessage) {
      return [systemMessage, ...messages.slice(1)];
    } else {
      return [systemMessage, ...messages];
    }
  }

  /**
   * Build memory-enriched prompt section
   * Exported for testing
   */
  buildMemoryEnrichedPrompt(basePrompt: string, memoryContext: MemoryContext): string {
    const sections: string[] = [];

    if (basePrompt) {
      sections.push(basePrompt);
    }

    sections.push('\n## Relevant Context from E-BRAIN Memory\n');

    // Add recent scans (most relevant for security queries)
    if (memoryContext.recentScans && memoryContext.recentScans.length > 0) {
      sections.push('### Recent Scans');
      memoryContext.recentScans.forEach((scan) => {
        sections.push(
          `- **${scan.url}**: ${scan.verdict} (Risk Score: ${(scan.riskScore * 100).toFixed(1)}%)`
        );
      });
      sections.push('');
    }

    // Add relevant memories sorted by importance
    if (memoryContext.relevantMemories.length > 0) {
      sections.push('### Relevant Knowledge');
      const sortedMemories = [...memoryContext.relevantMemories].sort(
        (a, b) => b.importance - a.importance
      );
      sortedMemories.forEach((memory) => {
        const importanceLabel =
          memory.importance >= 0.8
            ? 'HIGH'
            : memory.importance >= 0.5
              ? 'MEDIUM'
              : 'LOW';
        sections.push(`- [${memory.type}/${importanceLabel}] ${memory.content}`);
      });
      sections.push('');
    }

    // Add threat patterns
    if (memoryContext.threatPatterns && memoryContext.threatPatterns.length > 0) {
      sections.push('### Detected Threat Patterns');
      memoryContext.threatPatterns.forEach((pattern) => {
        sections.push(
          `- **${pattern.pattern}**: ${(pattern.confidence * 100).toFixed(0)}% confidence (${pattern.occurrences} occurrences)`
        );
      });
      sections.push('');
    }

    // Add suggested actions
    if (memoryContext.suggestedActions && memoryContext.suggestedActions.length > 0) {
      sections.push('### Suggested Actions');
      memoryContext.suggestedActions.forEach((action) => {
        sections.push(`- ${action}`);
      });
      sections.push('');
    }

    sections.push('---');
    sections.push('Use the above context to provide informed, personalized responses.');

    return sections.join('\n');
  }

  // --------------------------------------------------------------------------
  // Health Check
  // --------------------------------------------------------------------------

  async checkHealth(): Promise<HealthStatus> {
    const health: HealthStatus = {
      neural: { available: false },
      webllm: { available: false },
      gemini: { available: false },
    };

    // Check Neural Service
    try {
      const response = await fetch(
        `${this.config.neuralServiceUrl}/health`,
        {
          method: 'GET',
          headers: {
            'X-API-Key': NEURAL_SERVICE_API_KEY,
          },
          signal: AbortSignal.timeout(5000),
        }
      );

      if (response.ok) {
        const data = await response.json();
        health.neural = {
          available: data.status === 'healthy',
          modelLoaded: data.llm_available || data.multi_llm_available,
          model: 'llama-3.2-3b-instruct',
        };
      }
    } catch (error) {
      health.neural.error = error instanceof Error ? error.message : String(error);
    }

    // Check WebLLM
    try {
      const isReady = webLLMEngine.isReady();
      const currentModel = webLLMEngine.getCurrentModel();
      health.webllm = {
        available: isReady,
        model: currentModel?.displayName,
      };
    } catch (error) {
      health.webllm.error = error instanceof Error ? error.message : String(error);
    }

    // Check Gemini (simple ping)
    try {
      // We can't easily test Gemini without making a real request
      // Just mark as potentially available
      health.gemini = {
        available: true, // Assume available if endpoint is configured
      };
    } catch (error) {
      health.gemini.error = error instanceof Error ? error.message : String(error);
    }

    return health;
  }

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const neuralLLMClient = new NeuralLLMClient();
