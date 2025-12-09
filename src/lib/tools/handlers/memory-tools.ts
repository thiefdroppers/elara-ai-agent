/**
 * E-BRAIN V3 Memory Tool Handlers
 *
 * Implements E-BRAIN memory operations:
 * - search_memories - Semantic search in E-BRAIN
 * - store_memory - Store new memory in E-BRAIN
 *
 * These handlers connect to the E-BRAIN Dashboard REST API.
 */

import type { ToolResult } from '../types';

// ============================================================================
// E-BRAIN CONFIGURATION
// ============================================================================

const EBRAIN_CONFIG = {
  baseURL: 'https://e-brain-dashboard-122460113662.us-west1.run.app',
  apiKey: 'ebrain_ak_elara_ai_agent_v2_1733531443',
  agentId: 'elara_ai_agent_v2',
};

// ============================================================================
// TYPES
// ============================================================================

export interface SearchMemoriesInput {
  query: string;
  memoryTypes?: string[];
  limit?: number;
  minSimilarity?: number;
}

export interface SearchMemoriesResult {
  memories: Array<{
    id: string;
    type: string;
    content: string;
    importance: number;
    similarity: number;
    createdAt: number;
    metadata?: Record<string, unknown>;
  }>;
  totalFound: number;
  searchTime: number;
}

export interface StoreMemoryInput {
  content: string;
  memoryType: 'episodic' | 'semantic' | 'procedural' | 'learned';
  importance?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface StoreMemoryResult {
  id: string;
  stored: boolean;
  memoryType: string;
  importance: number;
  embedding?: number[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function successResult<T>(data: T, metadata?: Record<string, unknown>): ToolResult<T> {
  return {
    success: true,
    data,
    metadata: {
      timestamp: Date.now(),
      ...metadata,
    },
  };
}

function errorResult<T>(error: string, metadata?: Record<string, unknown>): ToolResult<T> {
  return {
    success: false,
    error,
    metadata: {
      timestamp: Date.now(),
      ...metadata,
    },
  };
}

// ============================================================================
// SEARCH_MEMORIES HANDLER
// ============================================================================

export async function handleSearchMemories(
  input: SearchMemoriesInput
): Promise<ToolResult<SearchMemoriesResult>> {
  const { query, memoryTypes, limit = 10, minSimilarity = 0.5 } = input;

  if (!query || query.trim().length === 0) {
    return errorResult('Search query is required');
  }

  const startTime = performance.now();

  try {
    const response = await fetch(`${EBRAIN_CONFIG.baseURL}/api/v1/memories/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': EBRAIN_CONFIG.apiKey,
        'X-Agent-ID': EBRAIN_CONFIG.agentId,
      },
      body: JSON.stringify({
        query,
        memory_types: memoryTypes,
        limit,
        min_similarity: minSimilarity,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[MemoryTools] E-BRAIN search error:', response.status, errorText);
      return errorResult(`E-BRAIN search failed: ${response.status}`);
    }

    const data = await response.json();
    const searchTime = performance.now() - startTime;

    return successResult<SearchMemoriesResult>({
      memories: (data.memories || []).map((m: any) => ({
        id: m.id,
        type: m.memory_type || m.type,
        content: m.content,
        importance: m.importance || 0.5,
        similarity: m.similarity || m.score || 0,
        createdAt: m.created_at || m.createdAt || Date.now(),
        metadata: m.metadata,
      })),
      totalFound: data.total || data.memories?.length || 0,
      searchTime,
    }, { source: 'search_memories' });
  } catch (error) {
    console.error('[MemoryTools] E-BRAIN search error:', error);
    return errorResult(`E-BRAIN search error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ============================================================================
// STORE_MEMORY HANDLER
// ============================================================================

export async function handleStoreMemory(
  input: StoreMemoryInput
): Promise<ToolResult<StoreMemoryResult>> {
  const { content, memoryType, importance = 0.5, tags = [], metadata = {} } = input;

  if (!content || content.trim().length === 0) {
    return errorResult('Memory content is required');
  }

  if (!memoryType) {
    return errorResult('Memory type is required');
  }

  try {
    const response = await fetch(`${EBRAIN_CONFIG.baseURL}/api/v1/memories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': EBRAIN_CONFIG.apiKey,
        'X-Agent-ID': EBRAIN_CONFIG.agentId,
      },
      body: JSON.stringify({
        content,
        memory_type: memoryType,
        importance,
        tags,
        metadata: {
          ...metadata,
          source: 'elara_ai_agent',
          stored_at: new Date().toISOString(),
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[MemoryTools] E-BRAIN store error:', response.status, errorText);
      return errorResult(`E-BRAIN store failed: ${response.status}`);
    }

    const data = await response.json();

    return successResult<StoreMemoryResult>({
      id: data.id || data.memory_id || crypto.randomUUID(),
      stored: true,
      memoryType,
      importance,
    }, { source: 'store_memory' });
  } catch (error) {
    console.error('[MemoryTools] E-BRAIN store error:', error);
    return errorResult(`E-BRAIN store error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export const memoryToolHandlers = {
  search_memories: handleSearchMemories,
  store_memory: handleStoreMemory,
};
