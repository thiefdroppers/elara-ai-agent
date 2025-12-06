/**
 * Elara AI Agent - Prompt Registry Types
 *
 * Enterprise-grade type definitions for the System Prompt Registry
 * with TOON (Token-Oriented Object Notation) support.
 */

// =============================================================================
// ENUMS
// =============================================================================

export enum PromptCategory {
  SECURITY_SCAN = 'SECURITY_SCAN',
  THREAT_INTEL = 'THREAT_INTEL',
  IMAGE_ANALYSIS = 'IMAGE_ANALYSIS',
  SENTIMENT = 'SENTIMENT',
  USER_MANAGEMENT = 'USER_MANAGEMENT',
  EDUCATION = 'EDUCATION',
  WEB_SEARCH = 'WEB_SEARCH',
  SYNTHESIS = 'SYNTHESIS',
  WORKFLOW = 'WORKFLOW',
  ADMIN = 'ADMIN',
}

export enum ToolExecutionStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  TIMEOUT = 'TIMEOUT',
  CANCELLED = 'CANCELLED',
}

export enum CacheLevel {
  L1_MEMORY = 'L1_MEMORY',
  L2_INDEXEDDB = 'L2_INDEXEDDB',
  L3_BACKEND = 'L3_BACKEND',
}

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  description: string;
  enum?: string[];
  items?: { type: string };
}

export interface ToolSchema {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export interface IntentPattern {
  patterns: RegExp[];
  keywords: string[];
  confidence: number;
  requiresLLM?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  category: PromptCategory;

  // OpenAI-compatible schema
  schema: ToolSchema;

  // TOON-encoded schema (40% fewer tokens)
  toonSchema: string;

  // API endpoints
  endpoints: Record<string, string>;

  // Intent classification
  intentPatterns: IntentPattern;

  // Response format
  responseSchema?: Record<string, string>;

  // Pre-generated prompts
  explanationPrompt?: string;
  staticExplanations?: Record<string, string>;
}

// =============================================================================
// WORKFLOW DEFINITIONS
// =============================================================================

export interface WorkflowStep {
  id: string;
  tool: string;
  params?: Record<string, any>;
  parallel: boolean;
  depends?: string[];
  after?: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  category: PromptCategory;
  steps: WorkflowStep[];
  systemPrompt: string;
  responseTemplate?: string;
  estimatedLatency?: number;
}

// =============================================================================
// INTENT CLASSIFICATION
// =============================================================================

export interface IntentClassification {
  intent: string;
  confidence: number;
  entities: Record<string, any>;
  requiresLLM: boolean;
  toolId?: string;
  workflowId?: string;
}

export interface IntentRule {
  intent: string;
  priority: number;
  patterns?: RegExp[];
  keywords?: string[];
  entityExtractors?: Record<string, RegExp>;
  requiresLLM?: boolean;
}

// =============================================================================
// PROMPT COMPOSITION
// =============================================================================

export interface PromptCompositionConfig {
  intent: string;
  entities: Record<string, any>;
  style: 'concise' | 'detailed' | 'technical';
  includeTools?: string[];
  maxTokens?: number;
}

export interface ComposedPrompt {
  systemPrompt: string;
  userPrompt: string;
  tools?: ToolSchema[];
  tokenEstimate: number;
  format: 'json' | 'toon';
}

// =============================================================================
// CACHING
// =============================================================================

export interface CachedPrompt {
  toolId: string;
  prompt: ToolDefinition;
  cachedAt: number;
  accessCount: number;
  ttl: number;
  source: CacheLevel;
}

export interface CacheConfig {
  l1MaxSize: number;      // Memory cache size
  l1TTL: number;          // Memory TTL (ms)
  l2TTL: number;          // IndexedDB TTL (ms)
  preloadTools: string[]; // Tools to preload on init
}

// =============================================================================
// TOOL EXECUTION
// =============================================================================

export interface ToolCall {
  id: string;
  tool: string;
  params: Record<string, any>;
  status: ToolExecutionStatus;
  startedAt?: number;
  completedAt?: number;
  result?: any;
  error?: string;
}

export interface ToolExecutionPlan {
  id: string;
  parallel: ToolCall[];
  sequential: ToolCall[];
}

export interface ToolExecutionResult {
  callId: string;
  tool: string;
  status: ToolExecutionStatus;
  result?: any;
  error?: string;
  latency: number;
  retryCount: number;
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

export interface RetryPolicy {
  maxRetries: number;
  backoff: 'constant' | 'linear' | 'exponential';
  baseDelayMs: number;
  maxDelayMs: number;
  retryableErrors: string[];
}

export interface CircuitBreakerConfig {
  threshold: number;       // Failures before open
  resetTimeout: number;    // ms before half-open
  monitorWindow: number;   // Time window for failure count
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  lastFailure?: number;
  lastSuccess?: number;
}

// =============================================================================
// SYNTHESIS
// =============================================================================

export interface SynthesisInput {
  results: Record<string, ToolExecutionResult>;
  weights?: Record<string, number>;
  prompt?: string;
}

export interface SynthesisOutput {
  verdict: string;
  confidence: number;
  summary: string;
  details: Record<string, any>;
  recommendations: string[];
}

// =============================================================================
// REGISTRY API
// =============================================================================

export interface PromptRegistryAPI {
  // Tool operations
  getTool(toolId: string): Promise<ToolDefinition | null>;
  getAllTools(): Promise<ToolDefinition[]>;
  getToolsByCategory(category: PromptCategory): Promise<ToolDefinition[]>;

  // Workflow operations
  getWorkflow(workflowId: string): Promise<WorkflowDefinition | null>;
  getAllWorkflows(): Promise<WorkflowDefinition[]>;

  // Intent classification
  classifyIntent(message: string): IntentClassification;

  // Prompt composition
  composePrompt(config: PromptCompositionConfig): ComposedPrompt;

  // Cache management
  preloadCache(): Promise<void>;
  clearCache(level?: CacheLevel): Promise<void>;
  getCacheStats(): { l1: number; l2: number; hits: number; misses: number };
}

// =============================================================================
// TOOL EXECUTOR API
// =============================================================================

export interface ToolExecutorAPI {
  // Single tool execution
  execute(tool: string, params: Record<string, any>): Promise<ToolExecutionResult>;

  // Workflow execution
  executeWorkflow(workflowId: string, params: Record<string, any>): Promise<ToolExecutionResult[]>;

  // Plan execution
  executePlan(plan: ToolExecutionPlan): Promise<ToolExecutionResult[]>;

  // Status
  getStatus(callId: string): ToolExecutionStatus;
  cancel(callId: string): Promise<boolean>;
}

// =============================================================================
// TOON ENCODER API
// =============================================================================

export interface ToonEncoderAPI {
  encode(data: any): string;
  decode(toon: string): any;
  encodeToolSchema(schema: ToolSchema): string;
  encodeToolResult(result: any, schema?: Record<string, string>): string;
  getTokenEstimate(content: string): number;
}
