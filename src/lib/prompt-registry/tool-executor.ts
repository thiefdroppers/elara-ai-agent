/**
 * Elara AI Agent - Tool Execution Engine
 *
 * Enterprise-grade tool executor with:
 * - Parallel and sequential execution
 * - Exponential backoff retry
 * - Circuit breaker pattern
 * - Timeout handling
 * - Result synthesis
 */

import {
  ToolExecutionStatus,
} from './types';
import type {
  ToolCall,
  ToolExecutionPlan,
  ToolExecutionResult,
  RetryPolicy,
  CircuitBreakerConfig,
  CircuitBreakerState,
  SynthesisInput,
  SynthesisOutput,
} from './types';
import { toonEncoder } from './toon-encoder';

// =============================================================================
// CONFIGURATION
// =============================================================================

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  backoff: 'exponential',
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  retryableErrors: [
    'TIMEOUT',
    'NETWORK_ERROR',
    'RATE_LIMITED',
    '503',
    '502',
    '504',
    'ECONNRESET',
    'ETIMEDOUT',
  ],
};

const DEFAULT_CIRCUIT_BREAKER: CircuitBreakerConfig = {
  threshold: 5,        // 5 failures to open
  resetTimeout: 30000, // 30 seconds to half-open
  monitorWindow: 60000, // 1 minute window
};

const DEFAULT_TIMEOUT_MS = 30000;  // 30 seconds

// =============================================================================
// TOOL EXECUTOR CLASS
// =============================================================================

export class ToolExecutor {
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private retryPolicy: RetryPolicy;
  private circuitBreakerConfig: CircuitBreakerConfig;

  // Tool implementation registry (injected)
  private toolHandlers: Map<string, (params: any) => Promise<any>> = new Map();

  constructor(
    retryPolicy: Partial<RetryPolicy> = {},
    circuitBreakerConfig: Partial<CircuitBreakerConfig> = {}
  ) {
    this.retryPolicy = { ...DEFAULT_RETRY_POLICY, ...retryPolicy };
    this.circuitBreakerConfig = { ...DEFAULT_CIRCUIT_BREAKER, ...circuitBreakerConfig };
  }

  /**
   * Register a tool handler
   */
  registerTool(toolId: string, handler: (params: any) => Promise<any>): void {
    this.toolHandlers.set(toolId, handler);
  }

  /**
   * Execute a single tool with retry and circuit breaker
   */
  async execute(tool: string, params: Record<string, any>): Promise<ToolExecutionResult> {
    const callId = this.generateCallId();
    const startTime = Date.now();

    // Check circuit breaker
    if (this.isCircuitOpen(tool)) {
      return this.createResult(callId, tool, ToolExecutionStatus.FAILED, null, 'Circuit breaker open', startTime, 0);
    }

    let lastError: string | undefined;
    let retryCount = 0;

    while (retryCount <= this.retryPolicy.maxRetries) {
      try {
        const result = await this.executeWithTimeout(tool, params);

        // Success - reset circuit breaker
        this.recordSuccess(tool);

        return this.createResult(callId, tool, ToolExecutionStatus.SUCCESS, result, undefined, startTime, retryCount);
      } catch (error) {
        lastError = this.getErrorMessage(error);

        // Check if retryable
        if (!this.isRetryableError(lastError) || retryCount >= this.retryPolicy.maxRetries) {
          this.recordFailure(tool);
          return this.createResult(callId, tool, ToolExecutionStatus.FAILED, null, lastError, startTime, retryCount);
        }

        // Wait before retry (exponential backoff)
        const delay = this.calculateBackoff(retryCount);
        await this.sleep(delay);
        retryCount++;
      }
    }

    return this.createResult(callId, tool, ToolExecutionStatus.FAILED, null, lastError || 'Max retries exceeded', startTime, retryCount);
  }

  /**
   * Execute a workflow (multiple tools with dependencies)
   */
  async executeWorkflow(
    workflowId: string,
    plan: ToolExecutionPlan,
    params: Record<string, any>
  ): Promise<ToolExecutionResult[]> {
    const results: ToolExecutionResult[] = [];
    const resultMap: Map<string, any> = new Map();

    // Execute parallel tools first
    if (plan.parallel.length > 0) {
      const parallelResults = await Promise.allSettled(
        plan.parallel.map(call => this.execute(call.tool, { ...params, ...call.params }))
      );

      for (let i = 0; i < parallelResults.length; i++) {
        const settled = parallelResults[i];
        const call = plan.parallel[i];

        if (settled.status === 'fulfilled') {
          results.push(settled.value);
          resultMap.set(call.id, settled.value.result);
        } else {
          results.push(this.createResult(
            call.id,
            call.tool,
            ToolExecutionStatus.FAILED,
            null,
            settled.reason?.message || 'Unknown error',
            Date.now(),
            0
          ));
        }
      }
    }

    // Execute sequential tools (with access to previous results)
    for (const call of plan.sequential) {
      // Inject results from dependencies
      const enrichedParams = { ...params, ...call.params };

      if (call.params?.depends) {
        enrichedParams._previousResults = {};
        for (const depId of call.params.depends) {
          enrichedParams._previousResults[depId] = resultMap.get(depId);
        }
      }

      const result = await this.execute(call.tool, enrichedParams);
      results.push(result);
      resultMap.set(call.id, result.result);
    }

    return results;
  }

  /**
   * Execute tools in parallel
   */
  async executeParallel(
    tools: Array<{ tool: string; params: Record<string, any> }>
  ): Promise<ToolExecutionResult[]> {
    const promises = tools.map(t => this.execute(t.tool, t.params));
    const settled = await Promise.allSettled(promises);

    return settled.map((s, i) => {
      if (s.status === 'fulfilled') {
        return s.value;
      }
      return this.createResult(
        this.generateCallId(),
        tools[i].tool,
        ToolExecutionStatus.FAILED,
        null,
        s.reason?.message || 'Execution failed',
        Date.now(),
        0
      );
    });
  }

  /**
   * Synthesize results from multiple tools
   */
  synthesize(input: SynthesisInput): SynthesisOutput {
    const { results, weights } = input;

    // Default weights: equal distribution
    const defaultWeight = 1 / Object.keys(results).length;

    let overallScore = 0;
    let totalWeight = 0;
    const details: Record<string, any> = {};
    const recommendations: string[] = [];

    for (const [toolId, result] of Object.entries(results)) {
      if (result.status !== 'SUCCESS' || !result.result) {
        continue;
      }

      const weight = weights?.[toolId] ?? defaultWeight;
      totalWeight += weight;

      // Extract score from result
      const score = result.result.riskScore ?? result.result.confidence ?? 0.5;
      overallScore += score * weight;

      details[toolId] = {
        status: result.status,
        score,
        latency: result.latency,
        summary: result.result.verdict || result.result.found || 'completed',
      };

      // Collect recommendations
      if (result.result.reasoning) {
        recommendations.push(...result.result.reasoning.slice(0, 2));
      }
    }

    // Normalize score
    if (totalWeight > 0) {
      overallScore /= totalWeight;
    }

    // Determine verdict
    let verdict = 'UNKNOWN';
    if (overallScore >= 0.85) {
      verdict = 'DANGEROUS';
    } else if (overallScore >= 0.55) {
      verdict = 'SUSPICIOUS';
    } else if (overallScore < 0.3) {
      verdict = 'SAFE';
    }

    return {
      verdict,
      confidence: Math.min(totalWeight, 1),
      summary: this.generateSummary(verdict, overallScore, details),
      details,
      recommendations: [...new Set(recommendations)].slice(0, 5),
    };
  }

  /**
   * Format results as TOON (token-efficient)
   */
  formatResultAsToon(result: ToolExecutionResult): string {
    if (!result.result) {
      return `error: ${result.error || 'No result'}`;
    }
    return toonEncoder.encodeToolResult(result.result);
  }

  // ===========================================================================
  // CIRCUIT BREAKER
  // ===========================================================================

  private isCircuitOpen(tool: string): boolean {
    const state = this.circuitBreakers.get(tool);
    if (!state) return false;

    if (state.state === 'open') {
      // Check if we should try half-open
      const elapsed = Date.now() - (state.lastFailure || 0);
      if (elapsed >= this.circuitBreakerConfig.resetTimeout) {
        state.state = 'half-open';
        return false;
      }
      return true;
    }

    return false;
  }

  private recordSuccess(tool: string): void {
    const state = this.circuitBreakers.get(tool);
    if (state) {
      state.state = 'closed';
      state.failures = 0;
      state.lastSuccess = Date.now();
    }
  }

  private recordFailure(tool: string): void {
    let state = this.circuitBreakers.get(tool);

    if (!state) {
      state = { state: 'closed', failures: 0 };
      this.circuitBreakers.set(tool, state);
    }

    state.failures++;
    state.lastFailure = Date.now();

    if (state.failures >= this.circuitBreakerConfig.threshold) {
      state.state = 'open';
      console.warn(`[ToolExecutor] Circuit breaker OPEN for tool: ${tool}`);
    }
  }

  // ===========================================================================
  // RETRY LOGIC
  // ===========================================================================

  private isRetryableError(error: string): boolean {
    return this.retryPolicy.retryableErrors.some(e =>
      error.toUpperCase().includes(e.toUpperCase())
    );
  }

  private calculateBackoff(retryCount: number): number {
    const { backoff, baseDelayMs, maxDelayMs } = this.retryPolicy;

    let delay: number;

    switch (backoff) {
      case 'constant':
        delay = baseDelayMs;
        break;
      case 'linear':
        delay = baseDelayMs * (retryCount + 1);
        break;
      case 'exponential':
      default:
        delay = baseDelayMs * Math.pow(2, retryCount);
        break;
    }

    // Add jitter (10% randomness)
    const jitter = delay * 0.1 * Math.random();
    delay += jitter;

    return Math.min(delay, maxDelayMs);
  }

  // ===========================================================================
  // EXECUTION HELPERS
  // ===========================================================================

  private async executeWithTimeout(tool: string, params: Record<string, any>): Promise<any> {
    const handler = this.toolHandlers.get(tool);

    if (!handler) {
      throw new Error(`Unknown tool: ${tool}`);
    }

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT')), DEFAULT_TIMEOUT_MS);
    });

    return Promise.race([
      handler(params),
      timeoutPromise,
    ]);
  }

  private createResult(
    callId: string,
    tool: string,
    status: ToolExecutionStatus,
    result: any,
    error: string | undefined,
    startTime: number,
    retryCount: number
  ): ToolExecutionResult {
    return {
      callId,
      tool,
      status,
      result,
      error,
      latency: Date.now() - startTime,
      retryCount,
    };
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  private generateCallId(): string {
    return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateSummary(verdict: string, score: number, details: Record<string, any>): string {
    const toolCount = Object.keys(details).length;
    const successCount = Object.values(details).filter(d => d.status === 'SUCCESS').length;

    return `Analysis complete. Verdict: ${verdict} (${(score * 100).toFixed(1)}% risk). ` +
           `${successCount}/${toolCount} tools executed successfully.`;
  }

  // ===========================================================================
  // STATISTICS
  // ===========================================================================

  getCircuitBreakerStatus(): Record<string, CircuitBreakerState> {
    const status: Record<string, CircuitBreakerState> = {};
    for (const [tool, state] of this.circuitBreakers) {
      status[tool] = { ...state };
    }
    return status;
  }

  resetCircuitBreaker(tool: string): void {
    this.circuitBreakers.delete(tool);
  }

  resetAllCircuitBreakers(): void {
    this.circuitBreakers.clear();
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const toolExecutor = new ToolExecutor();

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Create a tool execution plan from workflow steps
 */
export function createExecutionPlan(
  steps: Array<{
    id: string;
    tool: string;
    params?: Record<string, any>;
    parallel: boolean;
    depends?: string[];
  }>
): ToolExecutionPlan {
  const parallel: ToolCall[] = [];
  const sequential: ToolCall[] = [];

  for (const step of steps) {
    const call: ToolCall = {
      id: step.id,
      tool: step.tool,
      params: step.params || {},
      status: ToolExecutionStatus.PENDING,
    };

    if (step.parallel && !step.depends?.length) {
      parallel.push(call);
    } else {
      sequential.push({ ...call, params: { ...call.params, depends: step.depends } });
    }
  }

  return {
    id: `plan_${Date.now()}`,
    parallel,
    sequential,
  };
}
