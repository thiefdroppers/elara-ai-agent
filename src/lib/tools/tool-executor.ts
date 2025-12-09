/**
 * Elara AI Agent - Tool Executor
 *
 * Executes security tools based on LLM function calls.
 * Routes to appropriate tool implementations with validation.
 */

import type {
  ToolName,
  ToolInputMap,
  ToolResultMap,
  ToolResult,
} from './types';

// ============================================================================
// TOOL HANDLERS
// ============================================================================

type ToolHandler<T extends ToolName> = (
  input: ToolInputMap[T]
) => Promise<ToolResult<ToolResultMap[T]>>;

const toolHandlers: Partial<Record<ToolName, ToolHandler<ToolName>>> = {};

/**
 * Register a tool handler
 */
export function registerToolHandler<T extends ToolName>(
  name: T,
  handler: ToolHandler<T>
): void {
  toolHandlers[name] = handler as ToolHandler<ToolName>;
}

/**
 * Check if a tool is registered
 */
export function isToolRegistered(name: string): name is ToolName {
  return name in toolHandlers;
}

/**
 * Get all registered tool names
 */
export function getRegisteredTools(): ToolName[] {
  return Object.keys(toolHandlers) as ToolName[];
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolExecutionResult<T = unknown> {
  callId: string;
  name: string;
  success: boolean;
  result?: T;
  error?: string;
  latencyMs: number;
}

/**
 * Execute a single tool call
 */
export async function executeTool<T extends ToolName>(
  name: T,
  input: ToolInputMap[T]
): Promise<ToolResult<ToolResultMap[T]>> {
  const startTime = performance.now();

  const handler = toolHandlers[name];
  if (!handler) {
    return {
      success: false,
      error: `Tool not registered: ${name}`,
      metadata: {
        latencyMs: performance.now() - startTime,
        source: 'tool-executor',
      },
    };
  }

  try {
    const result = await handler(input);
    return {
      ...result,
      metadata: {
        ...result.metadata,
        latencyMs: performance.now() - startTime,
        source: name,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      metadata: {
        latencyMs: performance.now() - startTime,
        source: name,
      },
    };
  }
}

/**
 * Execute multiple tool calls (potentially in parallel)
 */
export async function executeToolCalls(
  calls: ToolCall[],
  options: { parallel?: boolean; maxConcurrency?: number } = {}
): Promise<ToolExecutionResult[]> {
  const { parallel = true, maxConcurrency = 5 } = options;

  if (parallel) {
    // Execute in parallel with concurrency limit
    const results: ToolExecutionResult[] = [];
    const batches = chunkArray(calls, maxConcurrency);

    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(async (call) => {
          const startTime = performance.now();

          if (!isToolRegistered(call.name)) {
            return {
              callId: call.id,
              name: call.name,
              success: false,
              error: `Unknown tool: ${call.name}`,
              latencyMs: performance.now() - startTime,
            };
          }

          const result = await executeTool(
            call.name as ToolName,
            call.arguments as ToolInputMap[ToolName]
          );

          return {
            callId: call.id,
            name: call.name,
            success: result.success,
            result: result.data,
            error: result.error,
            latencyMs: performance.now() - startTime,
          };
        })
      );

      results.push(...batchResults);
    }

    return results;
  } else {
    // Execute sequentially
    const results: ToolExecutionResult[] = [];

    for (const call of calls) {
      const startTime = performance.now();

      if (!isToolRegistered(call.name)) {
        results.push({
          callId: call.id,
          name: call.name,
          success: false,
          error: `Unknown tool: ${call.name}`,
          latencyMs: performance.now() - startTime,
        });
        continue;
      }

      const result = await executeTool(
        call.name as ToolName,
        call.arguments as ToolInputMap[ToolName]
      );

      results.push({
        callId: call.id,
        name: call.name,
        success: result.success,
        result: result.data,
        error: result.error,
        latencyMs: performance.now() - startTime,
      });
    }

    return results;
  }
}

/**
 * Parse tool calls from LLM response
 */
export function parseToolCalls(
  response: string | { tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> }
): ToolCall[] {
  // If response is an object with tool_calls array (OpenAI format)
  if (typeof response === 'object' && response.tool_calls) {
    return response.tool_calls.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    }));
  }

  // If response is a string, try to extract JSON tool calls
  if (typeof response === 'string') {
    // Look for <tool_call> tags or JSON blocks
    const toolCallRegex = /<tool_call>\s*({[\s\S]*?})\s*<\/tool_call>/g;
    const calls: ToolCall[] = [];

    let match;
    while ((match = toolCallRegex.exec(response)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        calls.push({
          id: crypto.randomUUID(),
          name: parsed.name,
          arguments: parsed.arguments || {},
        });
      } catch (e) {
        console.warn('Failed to parse tool call:', match[1]);
      }
    }

    // Also try to find raw JSON function calls
    const jsonRegex = /\{\s*"name"\s*:\s*"([^"]+)"\s*,\s*"arguments"\s*:\s*(\{[^}]+\})\s*\}/g;
    while ((match = jsonRegex.exec(response)) !== null) {
      try {
        calls.push({
          id: crypto.randomUUID(),
          name: match[1],
          arguments: JSON.parse(match[2]),
        });
      } catch (e) {
        console.warn('Failed to parse JSON function call');
      }
    }

    return calls;
  }

  return [];
}

// ============================================================================
// UTILITIES
// ============================================================================

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// ============================================================================
// EXPORT CLASS VERSION
// ============================================================================

export class ToolExecutor {
  private handlers = new Map<ToolName, ToolHandler<ToolName>>();

  register<T extends ToolName>(name: T, handler: ToolHandler<T>): void {
    this.handlers.set(name, handler as ToolHandler<ToolName>);
  }

  async execute<T extends ToolName>(
    name: T,
    input: ToolInputMap[T]
  ): Promise<ToolResult<ToolResultMap[T]>> {
    const handler = this.handlers.get(name);
    if (!handler) {
      return {
        success: false,
        error: `Tool not registered: ${name}`,
      };
    }

    const startTime = performance.now();
    try {
      const result = await handler(input);
      return {
        ...result,
        metadata: {
          ...result.metadata,
          latencyMs: performance.now() - startTime,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: { latencyMs: performance.now() - startTime, source: name },
      };
    }
  }

  getRegisteredTools(): ToolName[] {
    return Array.from(this.handlers.keys());
  }
}
