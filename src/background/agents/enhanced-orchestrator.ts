/**
 * Elara AI Agent - Enhanced Orchestrator with WebLLM & Function Calling
 *
 * Integrates:
 * - WebLLM for conversational AI
 * - Function/tool calling for platform integration
 * - Multi-agent routing
 * - Streaming responses
 */

import { webLLMEngine } from '@/lib/webllm/webllm-engine';
import { functionRouter, AVAILABLE_FUNCTIONS } from './function-router';
import { createLogger } from '@/lib/logging/trace-logger';
import { performanceMonitor, MetricNames } from '@/lib/logging/performance-monitor';
import { debugStore } from '@/lib/logging/debug-store';
import { SYSTEM_PROMPT, TASK_PROMPTS } from '@/lib/webllm/model-config';
import type {
  ChatMessage,
  IntentClassification,
  Intent,
  OrchestratorState,
} from '@/types';
import type { StreamCallback } from '@/lib/webllm/streaming-handler';

const logger = createLogger('EnhancedOrchestrator');

// ============================================================================
// ENHANCED ORCHESTRATOR CLASS
// ============================================================================

export class EnhancedOrchestrator {
  private state: OrchestratorState = {
    state: 'idle',
    progress: 0,
  };

  private conversationHistory: ChatMessage[] = [];

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  async initialize(): Promise<void> {
    logger.info('Initializing Enhanced Orchestrator');

    try {
      // Check if WebLLM is already ready (loaded by service worker)
      const llmState = webLLMEngine.getState();

      if (llmState !== 'ready' || !webLLMEngine.isReady()) {
        throw new Error('WebLLM not ready - model must be loaded first');
      }

      // Update system health
      const llmHealth: 'uninitialized' | 'initializing' | 'ready' | 'error' = 'ready';

      debugStore.updateHealth({
        llmEngine: llmHealth,
        edgeEngine: 'ready',
        cloudAPI: 'healthy',
      });

      logger.info('Enhanced Orchestrator initialized successfully');
      logger.info(`Using model: ${webLLMEngine.getCurrentModel()?.displayName}`);
    } catch (error) {
      logger.error('Initialization failed', error as Error);
      debugStore.updateHealth({ llmEngine: 'error' });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // Main Entry Point
  // --------------------------------------------------------------------------

  async processMessage(
    content: string,
    options: { stream?: boolean; onStream?: StreamCallback } = {}
  ): Promise<ChatMessage> {
    const correlationId = logger.trace('Processing user message', { content });
    const endTimer = performanceMonitor.startTimer(MetricNames.AGENT_TOTAL_LATENCY);

    try {
      this.setState({ state: 'planning', progress: 10 });

      // Add user message to history
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: Date.now(),
      };
      this.conversationHistory.push(userMessage);

      // Step 1: Classify intent using LLM or keyword matching
      const intent = await this.classifyIntent(content);
      logger.info('Intent classified', { intent: intent.intent, confidence: intent.confidence });

      this.setState({ state: 'executing', progress: 30, currentTask: intent.intent });

      // Step 2: Check if intent requires function calling
      const requiresFunctionCall = this.requiresFunctionCall(intent);

      if (requiresFunctionCall) {
        // Execute function and generate response
        return await this.handleFunctionCall(intent, options);
      } else {
        // Pure conversational response (no function call)
        return await this.handleConversation(content, options);
      }
    } catch (error) {
      logger.error('Message processing failed', error as Error);
      this.setState({ state: 'error', error: String(error) });

      return {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `I encountered an error: ${error instanceof Error ? error.message : String(error)}. Please try again.`,
        timestamp: Date.now(),
        metadata: { error: String(error) },
      };
    } finally {
      endTimer();
      this.setState({ state: 'idle', progress: 0 });
    }
  }

  // --------------------------------------------------------------------------
  // Intent Classification
  // --------------------------------------------------------------------------

  /**
   * Classify user intent using keyword matching + optional LLM classification
   */
  private async classifyIntent(message: string): Promise<IntentClassification> {
    const endTimer = performanceMonitor.startTimer(MetricNames.AGENT_INTENT_CLASSIFICATION);

    try {
      // For MVP: Use keyword-based classification
      // TODO: Use LLM for more accurate intent classification

      const lowerMessage = message.toLowerCase();

      // URL patterns
      const urlPattern = /https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}/gi;
      const urls = message.match(urlPattern);

      // Deep scan
      if (/(deep|full|comprehensive)\s*(scan|analysis)/.test(lowerMessage) && urls) {
        return {
          intent: 'scan_url',
          confidence: 0.95,
          entities: { url: urls[0], scan_type: 'deep' },
          requiredFamilies: ['scan_url'],
        };
      }

      // URL scan
      if (urls && /(scan|check|safe|dangerous|phishing|analyze)/.test(lowerMessage)) {
        return {
          intent: 'scan_url',
          confidence: 0.98,
          entities: { url: urls[0], scan_type: 'auto' },
          requiredFamilies: ['scan_url'],
        };
      }

      // Image analysis
      if (/(screenshot|image|photo|picture)/.test(lowerMessage) && /(analyze|check|scan)/.test(lowerMessage)) {
        return {
          intent: 'deepfake',
          confidence: 0.85,
          entities: {},
          requiredFamilies: ['analyze_image'],
        };
      }

      // TI search
      if (/(search|lookup|find|check)\s*(threat|intelligence|ti|ioc|indicator)/.test(lowerMessage)) {
        return {
          intent: 'general_chat',
          confidence: 0.90,
          entities: {},
          requiredFamilies: ['search_threat_intelligence'],
        };
      }

      // Whitelist/Blacklist
      if (/(add|put)\s*(to)?\s*(whitelist|blacklist)/.test(lowerMessage)) {
        const isWhitelist = /whitelist/.test(lowerMessage);
        return {
          intent: 'general_chat',
          confidence: 0.92,
          entities: { action: isWhitelist ? 'whitelist' : 'blacklist' },
          requiredFamilies: [isWhitelist ? 'add_to_whitelist' : 'add_to_blacklist'],
        };
      }

      // Explain security concepts
      if (/(what\s+is|explain|tell\s+me\s+about)\s+(phishing|typosquatting|deepfake|malware|ransomware)/.test(lowerMessage)) {
        return {
          intent: 'explain',
          confidence: 0.88,
          entities: {},
          requiredFamilies: ['explain_security_concept'],
        };
      }

      // General conversation
      return {
        intent: 'general_chat',
        confidence: 0.50,
        entities: {},
      };
    } finally {
      endTimer();
    }
  }

  /**
   * Check if intent requires function/tool calling
   */
  private requiresFunctionCall(intent: IntentClassification): boolean {
    return !!(intent.requiredFamilies && intent.requiredFamilies.length > 0);
  }

  // --------------------------------------------------------------------------
  // Function Calling Handler
  // --------------------------------------------------------------------------

  /**
   * Handle intents that require function/tool calling
   */
  private async handleFunctionCall(
    intent: IntentClassification,
    options: { stream?: boolean; onStream?: StreamCallback }
  ): Promise<ChatMessage> {
    logger.info('Handling function call', { intent: intent.intent, functions: intent.requiredFamilies });

    const functionName = intent.requiredFamilies![0];
    const parameters = intent.entities;

    try {
      // Execute the function
      const functionResult = await functionRouter.executeFunction(functionName, parameters);

      debugStore.addAgentInfo({
        functionCalled: functionName,
        parameters,
        resultType: typeof functionResult,
      });

      // Generate LLM response explaining the function result
      const systemPromptWithContext = `${SYSTEM_PROMPT}

**Function Executed**: ${functionName}
**Function Result**:
${JSON.stringify(functionResult, null, 2)}

Explain the result to the user in a clear, helpful manner. If it's a scan result, interpret the risk level and provide actionable recommendations.`;

      const response = await webLLMEngine.generate(
        [
          { id: crypto.randomUUID(), role: 'system', content: systemPromptWithContext, timestamp: Date.now() },
          ...this.conversationHistory,
        ],
        {
          stream: options.stream,
          onStream: options.onStream,
          temperature: 0.7,
          maxTokens: 512,
        }
      );

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.content,
        timestamp: Date.now(),
        metadata: {
          intent: intent.intent,
          functionCalled: functionName,
          functionResult,
        },
      };

      this.conversationHistory.push(assistantMessage);
      return assistantMessage;
    } catch (error) {
      logger.error('Function execution failed', error as Error);

      // Generate error response
      return {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `I encountered an error while executing "${functionName}": ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now(),
        metadata: { error: String(error) },
      };
    }
  }

  /**
   * Handle pure conversational responses (no function calling)
   */
  private async handleConversation(
    content: string,
    options: { stream?: boolean; onStream?: StreamCallback }
  ): Promise<ChatMessage> {
    logger.info('Handling conversation');

    const endTimer = performanceMonitor.startTimer(MetricNames.AGENT_RESPONSE_GENERATION);

    try {
      const response = await webLLMEngine.generate(this.conversationHistory, {
        stream: options.stream,
        onStream: options.onStream,
        temperature: 0.7,
        maxTokens: 512,
      });

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.content,
        timestamp: Date.now(),
        metadata: {
          tokensGenerated: response.metrics.tokensGenerated,
          latency: response.metrics.totalLatency,
        },
      };

      this.conversationHistory.push(assistantMessage);

      debugStore.addLLMInfo({
        firstTokenLatency: response.metrics.firstTokenLatency,
        totalLatency: response.metrics.totalLatency,
        tokensPerSecond: response.metrics.averageTokensPerSecond,
      });

      return assistantMessage;
    } finally {
      endTimer();
    }
  }

  // --------------------------------------------------------------------------
  // Available Functions (for LLM awareness)
  // --------------------------------------------------------------------------

  /**
   * Get function definitions for LLM function calling
   */
  getFunctionDefinitions(): any[] {
    return Object.values(AVAILABLE_FUNCTIONS);
  }

  /**
   * Format function definitions as context for LLM
   */
  getAvailableToolsContext(): string {
    const tools = Object.values(AVAILABLE_FUNCTIONS).map(
      (func) => `- **${func.name}**: ${func.description}`
    );

    return `**Available Tools**:\n${tools.join('\n')}`;
  }

  // --------------------------------------------------------------------------
  // Conversation Management
  // --------------------------------------------------------------------------

  /**
   * Reset conversation history
   */
  resetConversation(): void {
    this.conversationHistory = [];
    logger.info('Conversation reset');
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): ChatMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * Get orchestrator state
   */
  getState(): OrchestratorState {
    return { ...this.state };
  }

  /**
   * Update orchestrator state
   */
  private setState(updates: Partial<OrchestratorState>): void {
    this.state = { ...this.state, ...updates };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const enhancedOrchestrator = new EnhancedOrchestrator();
