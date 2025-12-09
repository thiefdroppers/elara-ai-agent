/**
 * E-BRAIN Client for Elara Edge Engine
 *
 * Connects the Chrome Extension to the E-BRAIN Memory Platform.
 * Enables:
 * - Memory storage from edge scans
 * - Memory retrieval for context-aware responses
 * - STDP and Hebbian learning triggers
 * - User profile synchronization
 *
 * @version 3.0.0 - E-BRAIN V3 Integration
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const EBRAIN_CONFIG = {
  // E-BRAIN Dashboard REST API (Cloud Run)
  baseURL: 'https://e-brain-dashboard-122460113662.us-west1.run.app',
  // Agent credentials
  apiKey: 'ebrain_ak_elara_edge_engine_1733693456',
  agentId: 'elara_edge_engine',
  // HTTP settings
  timeout: 10000,
  maxRetries: 2,
  retryDelay: 500,
  // Cache settings
  cacheTTL: 60000, // 1 minute
  maxCacheSize: 100,
};

// ============================================================================
// TYPES
// ============================================================================

export interface Memory {
  id: string;
  type: 'episodic' | 'semantic' | 'procedural' | 'learned';
  content: string;
  importance: number;
  embedding?: number[];
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt?: number;
}

export interface ScanMemory {
  url: string;
  domain: string;
  verdict: string;
  riskScore: number;
  threatTypes: string[];
  scanType: 'edge' | 'hybrid' | 'deep';
  features?: Record<string, number>;
  timestamp: number;
}

export interface MemorySearchResult {
  memories: Memory[];
  totalFound: number;
  searchTime: number;
}

export interface MemoryContext {
  relevantMemories: Memory[];
  recentScans: ScanMemory[];
  threatPatterns: Array<{
    pattern: string;
    confidence: number;
    occurrences: number;
  }>;
  userProfile?: {
    scanHistory: number;
    riskTolerance: string;
    preferredActions: string[];
  };
  insufficientData: boolean;
}

export interface EBrainHealthStatus {
  connected: boolean;
  memoryCount: number;
  lastSync?: number;
  apiVersion?: string;
  learningEnabled: boolean;
}

// ============================================================================
// CACHE
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class SimpleCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly ttl: number;
  private readonly maxSize: number;

  constructor(ttl: number, maxSize: number) {
    this.ttl = ttl;
    this.maxSize = maxSize;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key: string, data: T): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}

// ============================================================================
// E-BRAIN CLIENT CLASS
// ============================================================================

export class EBrainClient {
  private baseURL: string;
  private apiKey: string;
  private agentId: string;
  private timeout: number;
  private maxRetries: number;
  private retryDelay: number;
  private memoryCache: SimpleCache<MemorySearchResult>;
  private contextCache: SimpleCache<MemoryContext>;
  private initialized = false;
  private lastHealthCheck: EBrainHealthStatus | null = null;

  constructor(config: Partial<typeof EBRAIN_CONFIG> = {}) {
    const mergedConfig = { ...EBRAIN_CONFIG, ...config };
    this.baseURL = mergedConfig.baseURL;
    this.apiKey = mergedConfig.apiKey;
    this.agentId = mergedConfig.agentId;
    this.timeout = mergedConfig.timeout;
    this.maxRetries = mergedConfig.maxRetries;
    this.retryDelay = mergedConfig.retryDelay;
    this.memoryCache = new SimpleCache(mergedConfig.cacheTTL, mergedConfig.maxCacheSize);
    this.contextCache = new SimpleCache(mergedConfig.cacheTTL, mergedConfig.maxCacheSize);
  }

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  async initialize(): Promise<boolean> {
    try {
      // Register agent if needed
      await this.registerAgent();
      // Check health
      const health = await this.checkHealth();
      this.initialized = health.connected;
      console.log('[EBrainClient] Initialized:', health);
      return this.initialized;
    } catch (error) {
      console.error('[EBrainClient] Initialization failed:', error);
      return false;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  // --------------------------------------------------------------------------
  // Agent Registration
  // --------------------------------------------------------------------------

  private async registerAgent(): Promise<void> {
    try {
      const response = await this.request('/api/v1/agents/onboard', {
        method: 'POST',
        body: JSON.stringify({
          agent_id: this.agentId,
          agent_type: 'edge_engine',
          capabilities: [
            'url_scanning',
            'phishing_detection',
            'ml_inference',
            'threat_intelligence',
          ],
          metadata: {
            version: '3.0.0',
            platform: 'chrome_extension',
            registered_at: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok && response.status !== 409) {
        // 409 = already registered, which is fine
        console.warn('[EBrainClient] Agent registration response:', response.status);
      }
    } catch (error) {
      // Non-fatal - agent might already be registered
      console.warn('[EBrainClient] Agent registration:', error);
    }
  }

  // --------------------------------------------------------------------------
  // Health Check
  // --------------------------------------------------------------------------

  async checkHealth(): Promise<EBrainHealthStatus> {
    try {
      const response = await this.request('/api/v1/health', { method: 'GET' });

      if (response.ok) {
        const data = await response.json();
        this.lastHealthCheck = {
          connected: true,
          memoryCount: data.memory_count || 0,
          lastSync: Date.now(),
          apiVersion: data.version,
          learningEnabled: data.learning_enabled ?? true,
        };
      } else {
        this.lastHealthCheck = {
          connected: false,
          memoryCount: 0,
          learningEnabled: false,
        };
      }
    } catch (error) {
      this.lastHealthCheck = {
        connected: false,
        memoryCount: 0,
        learningEnabled: false,
      };
    }

    return this.lastHealthCheck;
  }

  getLastHealthCheck(): EBrainHealthStatus | null {
    return this.lastHealthCheck;
  }

  // --------------------------------------------------------------------------
  // Memory Storage
  // --------------------------------------------------------------------------

  /**
   * Store a memory in E-BRAIN
   */
  async storeMemory(
    content: string,
    type: Memory['type'],
    importance: number = 0.5,
    metadata: Record<string, unknown> = {}
  ): Promise<{ id: string; stored: boolean }> {
    try {
      const response = await this.request('/api/v1/memories', {
        method: 'POST',
        body: JSON.stringify({
          content,
          memory_type: type,
          importance,
          metadata: {
            ...metadata,
            source: this.agentId,
            stored_at: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Store failed: ${response.status}`);
      }

      const data = await response.json();
      return { id: data.id || data.memory_id, stored: true };
    } catch (error) {
      console.error('[EBrainClient] Store memory failed:', error);
      return { id: '', stored: false };
    }
  }

  /**
   * Store a scan result as episodic memory
   */
  async storeScanMemory(scan: ScanMemory): Promise<{ id: string; stored: boolean }> {
    const content = `URL scan: ${scan.url} | Verdict: ${scan.verdict} | Risk: ${scan.riskScore} | Threats: ${scan.threatTypes.join(', ')}`;

    return this.storeMemory(
      content,
      'episodic',
      this.calculateScanImportance(scan),
      {
        url: scan.url,
        domain: scan.domain,
        verdict: scan.verdict,
        riskScore: scan.riskScore,
        threatTypes: scan.threatTypes,
        scanType: scan.scanType,
        features: scan.features,
        scan_timestamp: scan.timestamp,
      }
    );
  }

  private calculateScanImportance(scan: ScanMemory): number {
    // Higher importance for dangerous/phishing verdicts
    let importance = 0.5;

    if (scan.verdict === 'phishing' || scan.verdict === 'dangerous') {
      importance = 0.9;
    } else if (scan.verdict === 'suspicious') {
      importance = 0.7;
    }

    // Boost for high risk scores
    if (scan.riskScore > 0.8) {
      importance = Math.min(importance + 0.1, 1.0);
    }

    return importance;
  }

  // --------------------------------------------------------------------------
  // Memory Search
  // --------------------------------------------------------------------------

  /**
   * Search E-BRAIN memories semantically
   */
  async searchMemories(
    query: string,
    options: {
      limit?: number;
      minSimilarity?: number;
      memoryTypes?: Memory['type'][];
    } = {}
  ): Promise<MemorySearchResult> {
    const { limit = 10, minSimilarity = 0.5, memoryTypes } = options;

    // Check cache first
    const cacheKey = `search:${query}:${limit}:${minSimilarity}:${memoryTypes?.join(',')}`;
    const cached = this.memoryCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const startTime = performance.now();

    try {
      const response = await this.request('/api/v1/memories/search', {
        method: 'POST',
        body: JSON.stringify({
          query,
          limit,
          min_similarity: minSimilarity,
          memory_types: memoryTypes,
        }),
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();
      const result: MemorySearchResult = {
        memories: (data.memories || []).map((m: any) => ({
          id: m.id,
          type: m.memory_type || m.type,
          content: m.content,
          importance: m.importance || 0.5,
          embedding: m.embedding,
          metadata: m.metadata,
          createdAt: m.created_at || m.createdAt || Date.now(),
        })),
        totalFound: data.total || data.memories?.length || 0,
        searchTime: performance.now() - startTime,
      };

      // Cache result
      this.memoryCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('[EBrainClient] Search memories failed:', error);
      return { memories: [], totalFound: 0, searchTime: performance.now() - startTime };
    }
  }

  // --------------------------------------------------------------------------
  // Context Retrieval
  // --------------------------------------------------------------------------

  /**
   * Get full memory context for a query (used for LLM enrichment)
   */
  async getContextForQuery(query: string): Promise<MemoryContext> {
    // Check cache
    const cacheKey = `context:${query}`;
    const cached = this.contextCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Fetch relevant memories
      const searchResult = await this.searchMemories(query, { limit: 5 });

      // Fetch recent scans (episodic memories about scans)
      const scanResult = await this.searchMemories('url scan verdict', {
        limit: 5,
        memoryTypes: ['episodic'],
      });

      // Extract scan memories
      const recentScans: ScanMemory[] = scanResult.memories
        .filter((m) => m.metadata?.url)
        .map((m) => ({
          url: m.metadata?.url as string,
          domain: m.metadata?.domain as string || '',
          verdict: m.metadata?.verdict as string || 'unknown',
          riskScore: (m.metadata?.riskScore as number) || 0,
          threatTypes: (m.metadata?.threatTypes as string[]) || [],
          scanType: (m.metadata?.scanType as ScanMemory['scanType']) || 'edge',
          timestamp: m.createdAt,
        }));

      // Build context
      const context: MemoryContext = {
        relevantMemories: searchResult.memories,
        recentScans,
        threatPatterns: this.extractThreatPatterns(searchResult.memories),
        insufficientData: searchResult.memories.length === 0,
      };

      // Cache context
      this.contextCache.set(cacheKey, context);
      return context;
    } catch (error) {
      console.error('[EBrainClient] Get context failed:', error);
      return {
        relevantMemories: [],
        recentScans: [],
        threatPatterns: [],
        insufficientData: true,
      };
    }
  }

  private extractThreatPatterns(
    memories: Memory[]
  ): MemoryContext['threatPatterns'] {
    // Simple pattern extraction - count threats mentioned
    const patternCounts = new Map<string, number>();

    for (const memory of memories) {
      const threats = memory.metadata?.threatTypes as string[] | undefined;
      if (threats) {
        for (const threat of threats) {
          patternCounts.set(threat, (patternCounts.get(threat) || 0) + 1);
        }
      }
    }

    return Array.from(patternCounts.entries())
      .map(([pattern, occurrences]) => ({
        pattern,
        confidence: Math.min(occurrences / 5, 1), // Max out at 5 occurrences
        occurrences,
      }))
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 5);
  }

  // --------------------------------------------------------------------------
  // Learning Triggers
  // --------------------------------------------------------------------------

  /**
   * Trigger STDP learning for temporal correlation
   */
  async triggerSTDPLearning(
    preMemoryId: string,
    postMemoryId: string,
    deltaT: number
  ): Promise<boolean> {
    try {
      const response = await this.request('/api/v1/learning/stdp', {
        method: 'POST',
        body: JSON.stringify({
          pre_memory_id: preMemoryId,
          post_memory_id: postMemoryId,
          delta_t_ms: deltaT,
        }),
      });

      return response.ok;
    } catch (error) {
      console.warn('[EBrainClient] STDP trigger failed:', error);
      return false;
    }
  }

  /**
   * Trigger Hebbian learning for co-activation
   */
  async triggerHebbianLearning(memoryIds: string[]): Promise<boolean> {
    if (memoryIds.length < 2) return false;

    try {
      const response = await this.request('/api/v1/learning/hebbian', {
        method: 'POST',
        body: JSON.stringify({
          memory_ids: memoryIds,
        }),
      });

      return response.ok;
    } catch (error) {
      console.warn('[EBrainClient] Hebbian trigger failed:', error);
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // HTTP Helper
  // --------------------------------------------------------------------------

  private async request(
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const url = `${this.baseURL}${path}`;

    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    headers.set('X-API-Key', this.apiKey);
    headers.set('X-Agent-ID', this.agentId);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          ...options,
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Retry on 5xx errors
        if (response.status >= 500 && attempt < this.maxRetries) {
          await this.delay(this.retryDelay * (attempt + 1));
          continue;
        }

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * (attempt + 1));
        }
      }
    }

    throw lastError || new Error('Request failed');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // --------------------------------------------------------------------------
  // Cache Management
  // --------------------------------------------------------------------------

  clearCache(): void {
    this.memoryCache.clear();
    this.contextCache.clear();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const ebrainClient = new EBrainClient();

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Initialize E-BRAIN client (call on extension startup)
 */
export async function initEBrain(): Promise<boolean> {
  return ebrainClient.initialize();
}

/**
 * Store a scan result in E-BRAIN
 */
export async function storeScanInEBrain(scan: ScanMemory): Promise<boolean> {
  const result = await ebrainClient.storeScanMemory(scan);
  return result.stored;
}

/**
 * Get context for a user query
 */
export async function getEBrainContext(query: string): Promise<MemoryContext> {
  return ebrainClient.getContextForQuery(query);
}

/**
 * Search E-BRAIN memories
 */
export async function searchEBrain(
  query: string,
  limit: number = 10
): Promise<Memory[]> {
  const result = await ebrainClient.searchMemories(query, { limit });
  return result.memories;
}
