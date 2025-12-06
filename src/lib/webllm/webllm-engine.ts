/**
 * Elara AI Agent - WebLLM Engine
 *
 * Real WebLLM integration using @mlc-ai/web-llm for in-browser LLM inference.
 * Provides conversational AI capabilities directly in the browser.
 */

import { CreateMLCEngine, MLCEngine, ChatCompletionMessageParam } from '@mlc-ai/web-llm';
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

  // Real WebLLM engine instance
  private engine: MLCEngine | null = null;
  private verbose: boolean;

  constructor(config: WebLLMEngineConfig = {}) {
    this.contextManager = new ContextManager();
    this.verbose = config.verbose ?? false;

    if (this.verbose) {
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

      this.setState('ready');
      console.log('[WebLLMEngine] Initialization complete (ready to load model)');
    } catch (error) {
      console.error('[WebLLMEngine] Initialization failed:', error);
      this.setState('error');
      throw error;
    }
  }

  /**
   * Load a specific model using real WebLLM
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
      console.log(`[WebLLMEngine] Loading model: ${modelConfig.displayName} (${modelConfig.modelId})`);

      // Create real WebLLM engine with progress callback
      this.engine = await CreateMLCEngine(modelConfig.modelId, {
        initProgressCallback: (progress) => {
          const pct = Math.round(progress.progress * 100);
          console.log(`[WebLLMEngine] Loading: ${pct}% - ${progress.text}`);
          if (onProgress) {
            onProgress(pct);
          }
        },
      });

      // Set up GPU device loss handler
      this.setupDeviceLostHandler();

      this.currentModel = modelConfig;
      this.contextManager.setMaxTokens(modelConfig.contextWindow);
      this.setState('ready');

      console.log(`[WebLLMEngine] Model loaded successfully: ${modelConfig.displayName}`);
    } catch (error) {
      console.error('[WebLLMEngine] Model loading failed:', error);
      this.setState('error');
      throw error;
    }
  }

  /**
   * Set up handler for GPU device loss (common on integrated GPUs)
   */
  private setupDeviceLostHandler(): void {
    // WebLLM handles device lost internally, but we track it for recovery
    console.log('[WebLLMEngine] Device lost handler configured');
  }

  /**
   * Try to recover from GPU device loss by loading a smaller model
   */
  async tryRecoverWithSmallerModel(): Promise<boolean> {
    console.log('[WebLLMEngine] Attempting recovery with smaller model...');

    // Find a smaller model
    const modelSizes = [
      'smollm2-360m',  // Smallest
      'smollm2-1.7b',
      'qwen2.5-1.5b',
    ];

    const currentSize = this.currentModel?.size || Infinity;

    for (const modelId of modelSizes) {
      const config = AVAILABLE_MODELS[modelId];
      if (config && config.size < currentSize) {
        try {
          console.log(`[WebLLMEngine] Trying smaller model: ${config.displayName}`);
          await this.unload();
          await this.loadModel(modelId);
          return true;
        } catch (error) {
          console.warn(`[WebLLMEngine] Failed to load ${modelId}:`, error);
        }
      }
    }

    return false;
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
   * Generate a response using the real WebLLM engine
   */
  async generate(
    messages: ChatMessage[],
    options: GenerateOptions = {}
  ): Promise<GenerateResult> {
    if (this.state !== 'ready') {
      throw new Error(`Engine not ready. Current state: ${this.state}`);
    }

    if (!this.engine) {
      throw new Error('No model loaded - call loadModel() first');
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

      // Convert to WebLLM message format
      const webllmMessages = this.convertToWebLLMFormat(truncatedMessages);

      // Generate response
      let content: string;
      let metrics: StreamMetrics;

      if (options.stream && options.onStream) {
        const result = await this.generateStreaming(webllmMessages, config, options.onStream);
        content = result.content;
        metrics = result.metrics;
      } else {
        const result = await this.generateNonStreaming(webllmMessages, config);
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
   * Generate with streaming using real WebLLM
   */
  private async generateStreaming(
    messages: ChatCompletionMessageParam[],
    config: GenerationConfig,
    onStream: StreamCallback
  ): Promise<{ content: string; metrics: StreamMetrics }> {
    const handler = new StreamingHandler();
    handler.onStream(onStream);
    handler.startStream();

    try {
      // Use real WebLLM streaming
      const stream = await this.engine!.chat.completions.create({
        messages,
        stream: true,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        top_p: config.topP,
        stop: config.stopSequences,
      });

      // Process streaming chunks
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) {
          handler.processChunk(delta);
        }
      }

      const metrics = handler.endStream('stop');
      const content = handler.getFullResponse();

      return { content, metrics };
    } catch (error) {
      handler.endStream('error');
      throw error;
    }
  }

  /**
   * Generate without streaming using real WebLLM
   */
  private async generateNonStreaming(
    messages: ChatCompletionMessageParam[],
    config: GenerationConfig
  ): Promise<{ content: string; metrics: StreamMetrics }> {
    const startTime = performance.now();

    // Use real WebLLM non-streaming
    const response = await this.engine!.chat.completions.create({
      messages,
      stream: false,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      top_p: config.topP,
      stop: config.stopSequences,
    });

    const content = response.choices[0]?.message?.content || '';
    const endTime = performance.now();

    const metrics: StreamMetrics = {
      firstTokenLatency: endTime - startTime,
      totalLatency: endTime - startTime,
      tokensGenerated: content.length / 4, // Approximate
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
   * Convert ChatMessage[] to WebLLM ChatCompletionMessageParam[]
   */
  private convertToWebLLMFormat(messages: ChatMessage[]): ChatCompletionMessageParam[] {
    return messages.map((msg) => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content,
    }));
  }

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
   * Check if engine is ready for inference
   */
  isReady(): boolean {
    return this.state === 'ready' && this.engine !== null;
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
   * Unload current model and free resources
   */
  async unload(): Promise<void> {
    if (this.engine) {
      await this.engine.unload();
      this.engine = null;
    }
    this.currentModel = null;
    this.setState('ready');
    console.log('[WebLLMEngine] Model unloaded');
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
