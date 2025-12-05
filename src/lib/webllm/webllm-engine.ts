/**
 * Elara AI Agent - WebLLM Engine
 *
 * Main interface to WebLLM for in-browser LLM inference.
 * Handles model loading, initialization, and inference execution.
 *
 * NOTE: WebLLM is currently a placeholder for MVP implementation.
 * In production, this would integrate with @mlc-ai/web-llm package.
 */

import type { ChatMessage } from '@/types';
import {
  AVAILABLE_MODELS,
  SYSTEM_PROMPT,
  GENERATION_CONFIGS,
  type ModelConfig,
  type GenerationConfig,
  detectDeviceCapabilities,
  type DeviceCapabilities,
} from './model-config';
import { ContextManager, createSystemMessage } from './context-manager';
import {
  StreamingHandler,
  performanceMonitor,
  type StreamCallback,
  type StreamMetrics,
} from './streaming-handler';

// ============================================================================
// TYPES
// ============================================================================

export interface WebLLMEngineConfig {
  modelId?: string;
  backend?: 'webgpu' | 'wasm';
  verbose?: boolean;
}

export interface GenerateOptions {
  stream?: boolean;
  onStream?: StreamCallback;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
}

export interface GenerateResult {
  content: string;
  metrics: StreamMetrics;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export type EngineState =
  | 'uninitialized'
  | 'initializing'
  | 'loading-model'
  | 'ready'
  | 'generating'
  | 'error';

// ============================================================================
// WEBLLM ENGINE CLASS
// ============================================================================

export class WebLLMEngine {
  private state: EngineState = 'uninitialized';
  private currentModel: ModelConfig | null = null;
  private contextManager: ContextManager;
  private conversationHistory: ChatMessage[] = [];
  private deviceCapabilities: DeviceCapabilities | null = null;

  // WebLLM engine instance (would be actual WebLLM in production)
  private engine: any = null;

  constructor(config: WebLLMEngineConfig = {}) {
    this.contextManager = new ContextManager();

    if (config.verbose) {
      console.log('[WebLLMEngine] Initialized with config:', config);
    }
  }

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  /**
   * Initialize WebLLM engine and detect device capabilities
   */
  async initialize(): Promise<void> {
    if (this.state !== 'uninitialized') {
      console.warn('[WebLLMEngine] Already initialized');
      return;
    }

    this.setState('initializing');

    try {
      // Detect device capabilities
      this.deviceCapabilities = await detectDeviceCapabilities();
      console.log('[WebLLMEngine] Device capabilities:', this.deviceCapabilities);

      // TODO: Initialize actual WebLLM engine
      // this.engine = await CreateMLCEngine(modelId, { ...options });

      this.setState('ready');
      console.log('[WebLLMEngine] Initialization complete');
    } catch (error) {
      console.error('[WebLLMEngine] Initialization failed:', error);
      this.setState('error');
      throw error;
    }
  }

  /**
   * Load a specific model
   */
  async loadModel(modelId: string, onProgress?: (progress: number) => void): Promise<void> {
    const modelConfig = AVAILABLE_MODELS[modelId];
    if (!modelConfig) {
      throw new Error(`Unknown model: ${modelId}`);
    }

    // Check device compatibility
    if (this.deviceCapabilities && !this.canRunModel(modelId)) {
      throw new Error(
        `Model ${modelConfig.displayName} requires at least ${modelConfig.minRAM}GB RAM and ${modelConfig.minVRAM}GB VRAM`
      );
    }

    this.setState('loading-model');

    try {
      console.log(`[WebLLMEngine] Loading model: ${modelConfig.displayName}`);

      // TODO: Load actual WebLLM model
      // await this.engine.reload(modelConfig.modelId, {
      //   temperature: 0.7,
      //   top_p: 0.95,
      // });

      // Simulate progress for MVP
      if (onProgress) {
        for (let i = 0; i <= 100; i += 10) {
          onProgress(i);
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      this.currentModel = modelConfig;
      this.contextManager.setMaxTokens(modelConfig.contextWindow);
      this.setState('ready');

      console.log(`[WebLLMEngine] Model loaded: ${modelConfig.displayName}`);
    } catch (error) {
      console.error('[WebLLMEngine] Model loading failed:', error);
      this.setState('error');
      throw error;
    }
  }

  /**
   * Load recommended model based on device capabilities
   */
  async loadRecommendedModel(onProgress?: (progress: number) => void): Promise<void> {
    if (!this.deviceCapabilities) {
      await this.initialize();
    }

    const recommendedModelId = this.deviceCapabilities!.recommendedModel;
    await this.loadModel(recommendedModelId, onProgress);
  }

  // --------------------------------------------------------------------------
  // Inference
  // --------------------------------------------------------------------------

  /**
   * Generate a response using the LLM
   */
  async generate(
    messages: ChatMessage[],
    options: GenerateOptions = {}
  ): Promise<GenerateResult> {
    if (this.state !== 'ready') {
      throw new Error(`Engine not ready. Current state: ${this.state}`);
    }

    if (!this.currentModel) {
      throw new Error('No model loaded');
    }

    this.setState('generating');

    try {
      // Ensure system prompt is included
      const messagesWithSystem = this.ensureSystemPrompt(messages);

      // Truncate to fit context window
      const truncatedMessages = this.contextManager.truncate(messagesWithSystem, {
        preserveRecent: 4,
      });

      // Get generation config
      const config = this.getGenerationConfig(options);

      // Generate response
      let content: string;
      let metrics: StreamMetrics;

      if (options.stream && options.onStream) {
        const result = await this.generateStreaming(truncatedMessages, config, options.onStream);
        content = result.content;
        metrics = result.metrics;
      } else {
        const result = await this.generateNonStreaming(truncatedMessages, config);
        content = result.content;
        metrics = result.metrics;
      }

      // Record performance metrics
      performanceMonitor.recordMetrics(metrics);

      this.setState('ready');

      return {
        content,
        metrics,
        usage: {
          promptTokens: truncatedMessages.reduce((sum, msg) => sum + msg.content.length, 0) / 4,
          completionTokens: metrics.tokensGenerated,
          totalTokens: truncatedMessages.reduce((sum, msg) => sum + msg.content.length, 0) / 4 + metrics.tokensGenerated,
        },
      };
    } catch (error) {
      console.error('[WebLLMEngine] Generation failed:', error);
      this.setState('ready');
      throw error;
    }
  }

  /**
   * Generate with streaming
   */
  private async generateStreaming(
    messages: ChatMessage[],
    config: GenerationConfig,
    onStream: StreamCallback
  ): Promise<{ content: string; metrics: StreamMetrics }> {
    const handler = new StreamingHandler();
    handler.onStream(onStream);
    handler.startStream();

    // TODO: Actual WebLLM streaming
    // const stream = await this.engine.chat.completions.create({
    //   messages: this.convertToWebLLMFormat(messages),
    //   stream: true,
    //   temperature: config.temperature,
    //   max_tokens: config.maxTokens,
    //   top_p: config.topP,
    // });
    //
    // for await (const chunk of stream) {
    //   const delta = chunk.choices[0]?.delta?.content || '';
    //   if (delta) {
    //     handler.processChunk(delta);
    //   }
    // }

    // MVP Simulation: Generate mock response with streaming
    const mockResponse = this.generateMockResponse(messages);
    for (let i = 0; i < mockResponse.length; i += 3) {
      const chunk = mockResponse.slice(i, i + 3);
      handler.processChunk(chunk);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    const metrics = handler.endStream('stop');
    const content = handler.getFullResponse();

    return { content, metrics };
  }

  /**
   * Generate without streaming
   */
  private async generateNonStreaming(
    messages: ChatMessage[],
    config: GenerationConfig
  ): Promise<{ content: string; metrics: StreamMetrics }> {
    const startTime = performance.now();

    // TODO: Actual WebLLM non-streaming
    // const response = await this.engine.chat.completions.create({
    //   messages: this.convertToWebLLMFormat(messages),
    //   stream: false,
    //   temperature: config.temperature,
    //   max_tokens: config.maxTokens,
    //   top_p: config.topP,
    // });
    // const content = response.choices[0].message.content;

    // MVP Simulation
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const content = this.generateMockResponse(messages);
    const endTime = performance.now();

    const metrics: StreamMetrics = {
      firstTokenLatency: 500,
      totalLatency: endTime - startTime,
      tokensGenerated: content.length / 4,
      averageTokensPerSecond: (content.length / 4) / ((endTime - startTime) / 1000),
    };

    return { content, metrics };
  }

  // --------------------------------------------------------------------------
  // Chat Interface
  // --------------------------------------------------------------------------

  /**
   * Send a chat message and get a response
   */
  async chat(userMessage: string, options: GenerateOptions = {}): Promise<ChatMessage> {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    };

    this.conversationHistory.push(userMsg);

    const result = await this.generate(this.conversationHistory, options);

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: result.content,
      timestamp: Date.now(),
      metadata: {
        processing: false,
      },
    };

    this.conversationHistory.push(assistantMsg);

    return assistantMsg;
  }

  /**
   * Reset conversation history
   */
  resetConversation(): void {
    this.conversationHistory = [];
  }

  /**
   * Get current conversation history
   */
  getConversationHistory(): ChatMessage[] {
    return [...this.conversationHistory];
  }

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  /**
   * Ensure system prompt is included in messages
   */
  private ensureSystemPrompt(messages: ChatMessage[]): ChatMessage[] {
    const hasSystemPrompt = messages.length > 0 && messages[0].role === 'system';

    if (!hasSystemPrompt) {
      return [createSystemMessage(SYSTEM_PROMPT), ...messages];
    }

    return messages;
  }

  /**
   * Get generation config based on options and defaults
   */
  private getGenerationConfig(options: GenerateOptions): GenerationConfig {
    const baseConfig = GENERATION_CONFIGS.generalChat;

    return {
      ...baseConfig,
      temperature: options.temperature ?? baseConfig.temperature,
      maxTokens: options.maxTokens ?? baseConfig.maxTokens,
      stopSequences: options.stopSequences ?? baseConfig.stopSequences,
    };
  }

  /**
   * Generate mock response for MVP (will be replaced with actual WebLLM)
   */
  private generateMockResponse(messages: ChatMessage[]): string {
    const lastMessage = messages[messages.length - 1];
    const content = lastMessage?.content.toLowerCase() || '';

    // Simple keyword-based mock responses
    if (content.includes('hello') || content.includes('hi')) {
      return "Hello! I'm Elara, your AI security assistant. I can help you scan URLs, check for threats, and answer security questions. How can I help you today?";
    }

    if (content.includes('http')) {
      return "I've analyzed the URL you provided. Based on my ML models, this appears to be a legitimate website with no known threats. However, always exercise caution when entering sensitive information.";
    }

    if (content.includes('phishing')) {
      return "Phishing is a type of cyber attack where criminals impersonate legitimate organizations to steal sensitive information like passwords and credit card numbers. Common signs include urgent language, misspelled URLs, and requests for personal information. Always verify the sender before clicking links.";
    }

    return "I understand you're asking about cybersecurity. Could you provide more details so I can give you a more specific answer? I can help with URL scanning, threat analysis, security concepts, and more.";
  }

  /**
   * Check if current device can run a specific model
   */
  canRunModel(modelId: string): boolean {
    if (!this.deviceCapabilities) return false;

    const model = AVAILABLE_MODELS[modelId];
    if (!model) return false;

    const hasRAM = this.deviceCapabilities.totalRAM >= model.minRAM;
    const hasDisk = this.deviceCapabilities.diskSpace >= model.size / 1024;
    const hasVRAM =
      model.minVRAM === 0 ||
      (this.deviceCapabilities.gpuVRAM && this.deviceCapabilities.gpuVRAM >= model.minVRAM);

    return hasRAM && hasDisk && hasVRAM;
  }

  /**
   * Get compatible models for current device
   */
  getCompatibleModels(): ModelConfig[] {
    if (!this.deviceCapabilities) return [];

    return Object.entries(AVAILABLE_MODELS)
      .filter(([modelId]) => this.canRunModel(modelId))
      .map(([, config]) => config);
  }

  /**
   * Get current state
   */
  getState(): EngineState {
    return this.state;
  }

  /**
   * Get current model
   */
  getCurrentModel(): ModelConfig | null {
    return this.currentModel;
  }

  /**
   * Get device capabilities
   */
  getDeviceCapabilities(): DeviceCapabilities | null {
    return this.deviceCapabilities;
  }

  /**
   * Update internal state
   */
  private setState(state: EngineState): void {
    this.state = state;
    console.log(`[WebLLMEngine] State: ${state}`);
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const webLLMEngine = new WebLLMEngine({ verbose: true });
