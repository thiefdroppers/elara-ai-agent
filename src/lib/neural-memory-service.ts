/**
 * Neural Memory Service - Active E-BRAIN Integration for Elara AI Agent
 *
 * This service provides a comprehensive neural tethering layer that maximizes
 * E-BRAIN's bio-inspired memory capabilities for the Elara AI Agent.
 *
 * Bio-Inspired Features Utilized:
 * - STDP (Spike-Timing-Dependent Plasticity): Temporal cause-effect learning
 * - Hebbian Learning: "Neurons that fire together, wire together"
 * - Autonomous Learning: Web/LLM knowledge acquisition for unknown queries
 * - Memory Types: Episodic, Semantic, Procedural, Working, Learned
 * - Synaptic Strengthening: Access patterns reinforce important memories
 * - Decay Mechanisms: Unused memories naturally fade
 *
 * Architecture:
 * ```
 *                      ┌─────────────────────────────┐
 *                      │    Neural Memory Service    │
 *                      │  (Active Brain Interface)   │
 *                      └─────────────┬───────────────┘
 *                                    │
 *        ┌───────────────────────────┼───────────────────────────┐
 *        │                           │                           │
 *        ▼                           ▼                           ▼
 * ┌──────────────┐          ┌──────────────┐          ┌──────────────┐
 * │   Episodic   │          │   Semantic   │          │  Procedural  │
 * │   Memory     │          │   Memory     │          │   Memory     │
 * │ (Events/     │          │ (Facts/      │          │ (How-to/     │
 * │  Scans)      │          │  Patterns)   │          │  Procedures) │
 * └──────────────┘          └──────────────┘          └──────────────┘
 *        │                           │                           │
 *        └───────────────────────────┼───────────────────────────┘
 *                                    │
 *                      ┌─────────────▼───────────────┐
 *                      │         E-BRAIN API         │
 *                      │   (STDP + Hebbian + Auto)   │
 *                      └─────────────────────────────┘
 * ```
 *
 * @author Claude Code (Elara Platform)
 * @version 2.0.0
 * @license MIT
 */

import {
  EBrainClient,
  EBrainConfig,
  Memory,
  MemoryType,
  SearchMemoriesResponse,
  StoreMemoryRequest,
} from './ebrain-client';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Scan result to be stored in memory
 */
export interface ScanMemory {
  url: string;
  verdict: 'safe' | 'suspicious' | 'dangerous' | 'phishing';
  riskLevel: string; // A-F
  confidence: number;
  threatTypes?: string[];
  scanType: 'edge' | 'hybrid' | 'deep';
  latencyMs: number;
  userFeedback?: 'confirmed' | 'disputed' | null;
}

/**
 * Conversation turn for episodic memory
 */
export interface ConversationMemory {
  userMessage: string;
  assistantResponse: string;
  intent: string;
  userMood: 'neutral' | 'concerned' | 'curious' | 'frustrated';
  entities?: Record<string, any>;
  actionTaken?: string;
}

/**
 * Threat pattern for semantic memory
 */
export interface ThreatPattern {
  patternType: 'domain' | 'url_structure' | 'content' | 'behavioral';
  signature: string;
  indicators: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  occurrences: number;
}

/**
 * User behavior profile
 */
export interface UserBehaviorProfile {
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  scanFrequency: number;
  preferredScanType: 'edge' | 'hybrid' | 'deep';
  whitelistedDomains: string[];
  blacklistedDomains: string[];
  commonIntents: string[];
  expertiseLevel: 'novice' | 'intermediate' | 'expert';
}

/**
 * Memory retrieval context for response generation
 */
export interface MemoryContext {
  relevantMemories: Memory[];
  similarities: number[];
  userProfile?: UserBehaviorProfile;
  recentScans?: ScanMemory[];
  threatPatterns?: ThreatPattern[];
  insufficientData: boolean;
  suggestedActions?: string[];
}

/**
 * Performance metrics from neural memory operations
 */
export interface NeuralMemoryMetrics {
  totalMemories: number;
  memoriesByType: Record<string, number>;
  avgRetrievalLatency: number;
  avgStorageLatency: number;
  cacheHitRate: number;
  learningEvents24h: number;
  synapticConnections: number;
  hebbianAssociations: number;
  isHealthy: boolean;
}

/**
 * Neural Memory Service Configuration
 */
export interface NeuralMemoryConfig extends EBrainConfig {
  // Memory importance weights
  scanImportanceBase: number; // Base importance for scans (0.6)
  conversationImportanceBase: number; // Base importance for conversations (0.4)
  threatPatternImportanceBase: number; // Base importance for patterns (0.8)

  // Context retrieval settings
  maxContextMemories: number; // Max memories to retrieve for context (10)
  minSimilarityThreshold: number; // Min similarity for relevant memories (0.5)
  contextCacheTTL: number; // Context cache TTL in ms (60000)

  // Learning settings
  enableAutonomousLearning: boolean; // Enable web/LLM learning (true)
  enableHebbianLearning: boolean; // Enable co-activation learning (true)
  enableSTDPLearning: boolean; // Enable temporal learning (true)

  // Memory lifecycle
  workingMemoryTTL: number; // Working memory TTL in ms (300000 = 5 min)
  enableDecay: boolean; // Enable memory decay (true)
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: Partial<NeuralMemoryConfig> = {
  scanImportanceBase: 0.6,
  conversationImportanceBase: 0.4,
  threatPatternImportanceBase: 0.8,
  maxContextMemories: 10,
  minSimilarityThreshold: 0.5,
  contextCacheTTL: 60000,
  enableAutonomousLearning: true,
  enableHebbianLearning: true,
  enableSTDPLearning: true,
  workingMemoryTTL: 300000,
  enableDecay: true,
};

// ============================================================================
// NEURAL MEMORY SERVICE
// ============================================================================

/**
 * Neural Memory Service - Active E-BRAIN Integration
 *
 * Provides intelligent memory management with bio-inspired learning:
 * - Automatic importance calculation based on context
 * - Hebbian co-activation tracking
 * - STDP temporal relationship learning
 * - Contextual memory retrieval
 * - User behavior profiling
 * - Threat pattern recognition
 */
export class NeuralMemoryService {
  private client: EBrainClient;
  private config: NeuralMemoryConfig;
  private initialized: boolean = false;

  // Working memory (short-term, in-memory cache)
  private workingMemory: Map<string, { data: any; expiry: number }> = new Map();

  // Co-activation tracking for Hebbian learning
  private recentlyAccessedMemories: Array<{ id: string; timestamp: number }> = [];
  private readonly COACTIVATION_WINDOW_MS = 5000; // 5 second window

  // Performance tracking
  private metrics = {
    storageOps: 0,
    retrievalOps: 0,
    totalStorageLatency: 0,
    totalRetrievalLatency: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  constructor(config: NeuralMemoryConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config } as NeuralMemoryConfig;
    this.client = new EBrainClient(config);
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  /**
   * Initialize the neural memory service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Verify E-BRAIN connection
      const health = await this.client.healthCheck();

      if (health.status !== 'healthy') {
        throw new Error(`E-BRAIN unhealthy: ${health.status}`);
      }

      this.initialized = true;
      this.log('info', 'Neural Memory Service initialized', {
        totalMemories: health.totalMemories,
        uptime: health.uptimeSeconds,
      });

      // Start working memory cleanup
      this.startWorkingMemoryCleanup();
    } catch (error) {
      this.log('error', 'Failed to initialize Neural Memory Service', { error });
      throw error;
    }
  }

  // ==========================================================================
  // SCAN MEMORY OPERATIONS
  // ==========================================================================

  /**
   * Store a URL scan result as episodic memory
   *
   * @param scan - Scan result to store
   * @returns Stored memory ID
   */
  async storeScanResult(scan: ScanMemory): Promise<string> {
    const startTime = performance.now();

    try {
      // Calculate importance based on verdict severity
      const importance = this.calculateScanImportance(scan);

      // Create rich content for semantic search
      const content = this.formatScanContent(scan);

      // Store as episodic memory
      const memory = await this.client.storeMemory({
        content,
        memoryType: MemoryType.EPISODIC,
        importance,
        metadata: {
          type: 'url_scan',
          url: scan.url,
          domain: this.extractDomain(scan.url),
          verdict: scan.verdict,
          riskLevel: scan.riskLevel,
          confidence: scan.confidence,
          threatTypes: scan.threatTypes || [],
          scanType: scan.scanType,
          latencyMs: scan.latencyMs,
          userFeedback: scan.userFeedback,
          timestamp: Date.now(),
        },
      });

      // Track for Hebbian co-activation
      this.trackMemoryAccess(memory.id);

      // If dangerous, also create semantic threat pattern
      if (scan.verdict === 'dangerous' || scan.verdict === 'phishing') {
        await this.learnThreatPattern(scan);
      }

      this.updateMetrics('storage', performance.now() - startTime);
      this.log('info', `Scan stored: ${scan.url} → ${scan.verdict}`, { id: memory.id });

      return memory.id;
    } catch (error) {
      this.log('error', 'Failed to store scan result', { error, url: scan.url });
      throw error;
    }
  }

  /**
   * Search for similar past scans
   *
   * @param url - URL to search for
   * @param limit - Max results
   * @returns Similar scan memories
   */
  async findSimilarScans(url: string, limit: number = 5): Promise<Memory[]> {
    const startTime = performance.now();

    try {
      const domain = this.extractDomain(url);
      const query = `URL scan ${domain} ${url}`;

      const result = await this.client.searchMemories({
        query,
        topK: limit,
        memoryTypes: [MemoryType.EPISODIC],
        minImportance: 0.3,
      });

      // Filter to only scan memories
      const scanMemories = result.memories.filter(
        (m) => m.metadata?.type === 'url_scan'
      );

      // Track co-activation for all retrieved memories
      scanMemories.forEach((m) => this.trackMemoryAccess(m.id));

      this.updateMetrics('retrieval', performance.now() - startTime);
      return scanMemories;
    } catch (error) {
      this.log('error', 'Failed to find similar scans', { error, url });
      return [];
    }
  }

  // ==========================================================================
  // CONVERSATION MEMORY OPERATIONS
  // ==========================================================================

  /**
   * Store a conversation turn as episodic memory
   *
   * @param conversation - Conversation turn to store
   * @returns Stored memory ID
   */
  async storeConversation(conversation: ConversationMemory): Promise<string> {
    const startTime = performance.now();

    try {
      // Calculate importance based on intent and mood
      const importance = this.calculateConversationImportance(conversation);

      // Create content optimized for semantic search
      const content = this.formatConversationContent(conversation);

      const memory = await this.client.storeMemory({
        content,
        memoryType: MemoryType.EPISODIC,
        importance,
        metadata: {
          type: 'conversation',
          intent: conversation.intent,
          userMood: conversation.userMood,
          entities: conversation.entities,
          actionTaken: conversation.actionTaken,
          timestamp: Date.now(),
        },
      });

      // Track for Hebbian learning
      this.trackMemoryAccess(memory.id);

      this.updateMetrics('storage', performance.now() - startTime);
      return memory.id;
    } catch (error) {
      this.log('error', 'Failed to store conversation', { error });
      throw error;
    }
  }

  /**
   * Retrieve context for a new user message
   *
   * This is the primary method for context-aware response generation.
   * It retrieves relevant memories and provides rich context.
   *
   * @param userMessage - Current user message
   * @param options - Retrieval options
   * @returns Memory context for response generation
   */
  async getContextForMessage(
    userMessage: string,
    options: {
      includeScans?: boolean;
      includeConversations?: boolean;
      includeThreatPatterns?: boolean;
      maxMemories?: number;
    } = {}
  ): Promise<MemoryContext> {
    const startTime = performance.now();

    const {
      includeScans = true,
      includeConversations = true,
      includeThreatPatterns = true,
      maxMemories = this.config.maxContextMemories,
    } = options;

    try {
      // Build memory type filter
      const memoryTypes: MemoryType[] = [];
      if (includeScans || includeConversations) {
        memoryTypes.push(MemoryType.EPISODIC);
      }
      if (includeThreatPatterns) {
        memoryTypes.push(MemoryType.SEMANTIC);
      }

      // Semantic search for relevant memories
      const result = await this.client.searchMemories({
        query: userMessage,
        topK: maxMemories,
        memoryTypes: memoryTypes.length > 0 ? memoryTypes : undefined,
      });

      // Track all retrieved memories for Hebbian learning
      result.memories.forEach((m) => this.trackMemoryAccess(m.id));

      // Build context object
      const context: MemoryContext = {
        relevantMemories: result.memories,
        similarities: result.similarities,
        insufficientData: result.insufficientData,
        suggestedActions: [],
      };

      // Extract recent scans from memories
      if (includeScans) {
        context.recentScans = result.memories
          .filter((m) => m.metadata?.type === 'url_scan')
          .slice(0, 5)
          .map((m) => ({
            url: m.metadata.url,
            verdict: m.metadata.verdict,
            riskLevel: m.metadata.riskLevel,
            confidence: m.metadata.confidence,
            threatTypes: m.metadata.threatTypes,
            scanType: m.metadata.scanType,
            latencyMs: m.metadata.latencyMs,
            userFeedback: m.metadata.userFeedback,
          }));
      }

      // Extract threat patterns
      if (includeThreatPatterns) {
        context.threatPatterns = result.memories
          .filter((m) => m.metadata?.type === 'threat_pattern')
          .map((m) => m.metadata as ThreatPattern);
      }

      // Generate suggested actions based on context
      context.suggestedActions = this.generateSuggestedActions(context);

      this.updateMetrics('retrieval', performance.now() - startTime);

      this.log('info', `Context retrieved: ${result.memories.length} memories`, {
        query: userMessage.substring(0, 50),
        insufficient: result.insufficientData,
      });

      return context;
    } catch (error) {
      this.log('error', 'Failed to get context', { error });
      return {
        relevantMemories: [],
        similarities: [],
        insufficientData: true,
        suggestedActions: [],
      };
    }
  }

  // ==========================================================================
  // THREAT PATTERN LEARNING (SEMANTIC MEMORY)
  // ==========================================================================

  /**
   * Learn a threat pattern from a dangerous scan
   *
   * @param scan - Dangerous scan result
   */
  private async learnThreatPattern(scan: ScanMemory): Promise<void> {
    try {
      const domain = this.extractDomain(scan.url);

      // Create threat pattern
      const pattern: ThreatPattern = {
        patternType: 'domain',
        signature: domain,
        indicators: [
          ...(scan.threatTypes || []),
          scan.verdict,
          `risk_${scan.riskLevel}`,
        ],
        severity: this.mapVerdictToSeverity(scan.verdict),
        confidence: scan.confidence,
        occurrences: 1,
      };

      // Check if pattern already exists
      const existing = await this.client.searchMemories({
        query: `threat pattern ${domain}`,
        topK: 1,
        memoryTypes: [MemoryType.SEMANTIC],
      });

      if (existing.memories.length > 0 && existing.similarities[0] > 0.9) {
        // Update existing pattern (increment occurrences)
        this.log('debug', 'Existing threat pattern found, reinforcing');
        // Note: E-BRAIN's STDP will automatically strengthen this connection
        return;
      }

      // Store new threat pattern
      const content = `Threat Pattern: ${domain} - ${scan.verdict} (${scan.threatTypes?.join(', ') || 'unknown'}) - Risk Level ${scan.riskLevel}`;

      await this.client.storeMemory({
        content,
        memoryType: MemoryType.SEMANTIC,
        importance: this.config.threatPatternImportanceBase,
        metadata: {
          type: 'threat_pattern',
          ...pattern,
        },
      });

      this.log('info', `Threat pattern learned: ${domain}`, { severity: pattern.severity });
    } catch (error) {
      this.log('error', 'Failed to learn threat pattern', { error });
    }
  }

  // ==========================================================================
  // USER BEHAVIOR PROFILING
  // ==========================================================================

  /**
   * Update user behavior profile based on actions
   *
   * @param action - User action (whitelist, blacklist, scan, etc.)
   * @param data - Action data
   */
  async updateUserProfile(
    action: 'whitelist' | 'blacklist' | 'scan' | 'feedback',
    data: Record<string, any>
  ): Promise<void> {
    try {
      // Get current profile or create new
      const profileResult = await this.client.searchMemories({
        query: 'user behavior profile preferences',
        topK: 1,
        memoryTypes: [MemoryType.SEMANTIC],
      });

      let profile: UserBehaviorProfile = {
        riskTolerance: 'moderate',
        scanFrequency: 0,
        preferredScanType: 'edge',
        whitelistedDomains: [],
        blacklistedDomains: [],
        commonIntents: [],
        expertiseLevel: 'intermediate',
      };

      // Update profile based on action
      if (profileResult.memories.length > 0) {
        const existing = profileResult.memories[0].metadata as UserBehaviorProfile;
        profile = { ...profile, ...existing };
      }

      switch (action) {
        case 'whitelist':
          if (!profile.whitelistedDomains.includes(data.domain)) {
            profile.whitelistedDomains.push(data.domain);
          }
          // Whitelisting indicates higher risk tolerance
          profile.riskTolerance = 'moderate';
          break;

        case 'blacklist':
          if (!profile.blacklistedDomains.includes(data.domain)) {
            profile.blacklistedDomains.push(data.domain);
          }
          // Blacklisting indicates conservative behavior
          profile.riskTolerance = 'conservative';
          break;

        case 'scan':
          profile.scanFrequency++;
          profile.preferredScanType = data.scanType || profile.preferredScanType;
          break;

        case 'feedback':
          // Adjust expertise based on feedback accuracy
          if (data.feedbackType === 'correct_false_positive') {
            profile.expertiseLevel = 'expert';
          }
          break;
      }

      // Store updated profile
      const content = `User Profile: Risk=${profile.riskTolerance}, Scans=${profile.scanFrequency}, Level=${profile.expertiseLevel}`;

      await this.client.storeMemory({
        content,
        memoryType: MemoryType.SEMANTIC,
        importance: 0.9, // High importance for user profile
        metadata: {
          type: 'user_profile',
          ...profile,
          lastUpdated: Date.now(),
        },
      });

      this.log('info', 'User profile updated', { action });
    } catch (error) {
      this.log('error', 'Failed to update user profile', { error });
    }
  }

  // ==========================================================================
  // WORKING MEMORY (SHORT-TERM)
  // ==========================================================================

  /**
   * Store data in working memory (fast, in-memory, auto-expires)
   *
   * @param key - Unique key
   * @param data - Data to store
   * @param ttl - Time to live in ms (default: 5 min)
   */
  setWorkingMemory(key: string, data: any, ttl?: number): void {
    const expiry = Date.now() + (ttl || this.config.workingMemoryTTL);
    this.workingMemory.set(key, { data, expiry });
    this.log('debug', `Working memory set: ${key}`, { ttl: ttl || this.config.workingMemoryTTL });
  }

  /**
   * Retrieve from working memory
   *
   * @param key - Unique key
   * @returns Stored data or null if expired/not found
   */
  getWorkingMemory<T>(key: string): T | null {
    const entry = this.workingMemory.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.workingMemory.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Start periodic cleanup of expired working memory
   */
  private startWorkingMemoryCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.workingMemory.entries()) {
        if (now > entry.expiry) {
          this.workingMemory.delete(key);
        }
      }
    }, 60000); // Cleanup every minute
  }

  // ==========================================================================
  // HEBBIAN LEARNING (CO-ACTIVATION TRACKING)
  // ==========================================================================

  /**
   * Track memory access for Hebbian co-activation learning
   *
   * When multiple memories are accessed within COACTIVATION_WINDOW_MS,
   * E-BRAIN's Hebbian learner will strengthen their associations.
   *
   * @param memoryId - Accessed memory ID
   */
  private trackMemoryAccess(memoryId: string): void {
    if (!this.config.enableHebbianLearning) return;

    const now = Date.now();

    // Clean old accesses outside window
    this.recentlyAccessedMemories = this.recentlyAccessedMemories.filter(
      (access) => now - access.timestamp < this.COACTIVATION_WINDOW_MS
    );

    // If there are recent accesses, log co-activation
    if (this.recentlyAccessedMemories.length > 0) {
      const coactivatedIds = this.recentlyAccessedMemories.map((a) => a.id);
      this.log('debug', 'Hebbian co-activation detected', {
        newId: memoryId,
        coactivated: coactivatedIds,
      });
      // Note: E-BRAIN backend handles actual Hebbian strengthening
    }

    // Add this access
    this.recentlyAccessedMemories.push({ id: memoryId, timestamp: now });
  }

  // ==========================================================================
  // KNOWLEDGE ACQUISITION (PROCEDURAL/LEARNED MEMORY)
  // ==========================================================================

  /**
   * Store procedural knowledge (how-to instructions)
   *
   * @param topic - Knowledge topic
   * @param content - Procedure/instructions
   * @param importance - Importance score (0-1)
   */
  async storeProceduralKnowledge(
    topic: string,
    content: string,
    importance: number = 0.7
  ): Promise<string> {
    const memory = await this.client.storeMemory({
      content: `How to ${topic}: ${content}`,
      memoryType: MemoryType.PROCEDURAL,
      importance,
      metadata: {
        type: 'procedure',
        topic,
        timestamp: Date.now(),
      },
    });

    this.log('info', `Procedural knowledge stored: ${topic}`, { id: memory.id });
    return memory.id;
  }

  /**
   * Query knowledge with autonomous learning fallback
   *
   * If E-BRAIN doesn't have sufficient knowledge, it will:
   * 1. Search the web (if SerpAPI configured)
   * 2. Synthesize answer using Neural Service LLM
   * 3. Store learned knowledge as LEARNED memory type
   *
   * @param query - Knowledge query
   * @returns Search results with potential learned knowledge
   */
  async queryKnowledge(query: string): Promise<SearchMemoriesResponse> {
    if (!this.config.enableAutonomousLearning) {
      return this.client.searchMemories({
        query,
        topK: 10,
        memoryTypes: [MemoryType.SEMANTIC, MemoryType.PROCEDURAL, MemoryType.LEARNED],
      });
    }

    // E-BRAIN's autonomous learner handles this automatically
    // The insufficientData flag triggers web search + LLM synthesis
    const result = await this.client.searchMemories({
      query,
      topK: 10,
      minImportance: 0.3,
    });

    if (result.insufficientData) {
      this.log('info', 'Insufficient data - autonomous learning may trigger', { query });
    }

    return result;
  }

  // ==========================================================================
  // METRICS & HEALTH
  // ==========================================================================

  /**
   * Get neural memory service metrics
   */
  async getMetrics(): Promise<NeuralMemoryMetrics> {
    const clientMetrics = this.client.getMetrics();

    return {
      totalMemories: 0, // Would need separate API call
      memoriesByType: {},
      avgRetrievalLatency:
        this.metrics.retrievalOps > 0
          ? this.metrics.totalRetrievalLatency / this.metrics.retrievalOps
          : 0,
      avgStorageLatency:
        this.metrics.storageOps > 0
          ? this.metrics.totalStorageLatency / this.metrics.storageOps
          : 0,
      cacheHitRate: parseFloat(clientMetrics.cacheHitRate),
      learningEvents24h: 0, // Would need separate API call
      synapticConnections: 0, // Would need separate API call
      hebbianAssociations: 0, // Would need separate API call
      isHealthy: clientMetrics.isHealthy,
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const health = await this.client.healthCheck();
      return health.status === 'healthy';
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Calculate importance score for scan based on verdict
   */
  private calculateScanImportance(scan: ScanMemory): number {
    const base = this.config.scanImportanceBase;

    switch (scan.verdict) {
      case 'phishing':
        return Math.min(1.0, base + 0.35); // 0.95
      case 'dangerous':
        return Math.min(1.0, base + 0.3); // 0.90
      case 'suspicious':
        return Math.min(1.0, base + 0.15); // 0.75
      case 'safe':
        return Math.max(0.3, base - 0.2); // 0.40
      default:
        return base;
    }
  }

  /**
   * Calculate importance score for conversation
   */
  private calculateConversationImportance(conv: ConversationMemory): number {
    const base = this.config.conversationImportanceBase;
    let modifier = 0;

    // Increase importance for security-related intents
    if (['scan_url', 'threat_intel', 'blacklist', 'whitelist'].includes(conv.intent)) {
      modifier += 0.2;
    }

    // Increase importance for concerned/frustrated users
    if (conv.userMood === 'concerned' || conv.userMood === 'frustrated') {
      modifier += 0.15;
    }

    // Increase if action was taken
    if (conv.actionTaken) {
      modifier += 0.1;
    }

    return Math.min(1.0, base + modifier);
  }

  /**
   * Format scan result as searchable content
   */
  private formatScanContent(scan: ScanMemory): string {
    const domain = this.extractDomain(scan.url);
    const threats = scan.threatTypes?.join(', ') || 'none detected';

    return `URL Scan: ${scan.url} (${domain}) - Verdict: ${scan.verdict} - Risk Level: ${scan.riskLevel} - Threats: ${threats} - Confidence: ${(scan.confidence * 100).toFixed(0)}% - Scan Type: ${scan.scanType}`;
  }

  /**
   * Format conversation as searchable content
   */
  private formatConversationContent(conv: ConversationMemory): string {
    return `Conversation - User (${conv.userMood}): "${conv.userMessage}" → Assistant: "${conv.assistantResponse.substring(0, 200)}${conv.assistantResponse.length > 200 ? '...' : ''}" [Intent: ${conv.intent}]`;
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      return urlObj.hostname;
    } catch {
      return url.split('/')[0];
    }
  }

  /**
   * Map verdict to severity
   */
  private mapVerdictToSeverity(
    verdict: string
  ): 'low' | 'medium' | 'high' | 'critical' {
    switch (verdict) {
      case 'phishing':
        return 'critical';
      case 'dangerous':
        return 'high';
      case 'suspicious':
        return 'medium';
      default:
        return 'low';
    }
  }

  /**
   * Generate suggested actions based on context
   */
  private generateSuggestedActions(context: MemoryContext): string[] {
    const actions: string[] = [];

    // If similar dangerous scans found, suggest caution
    if (context.recentScans?.some((s) => s.verdict === 'dangerous' || s.verdict === 'phishing')) {
      actions.push('exercise_caution');
    }

    // If threat patterns match, suggest blocking
    if (context.threatPatterns && context.threatPatterns.length > 0) {
      actions.push('consider_blocking');
    }

    // If insufficient data, suggest deeper scan
    if (context.insufficientData) {
      actions.push('suggest_deep_scan');
    }

    return actions;
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(type: 'storage' | 'retrieval', latency: number): void {
    if (type === 'storage') {
      this.metrics.storageOps++;
      this.metrics.totalStorageLatency += latency;
    } else {
      this.metrics.retrievalOps++;
      this.metrics.totalRetrievalLatency += latency;
    }
  }

  /**
   * Logger
   */
  private log(
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    data?: any
  ): void {
    const prefix = '[NeuralMemory]';

    if (level === 'error') {
      console.error(prefix, message, data ?? '');
    } else if (level === 'warn') {
      console.warn(prefix, message, data ?? '');
    } else if (level === 'debug' && this.config.debug) {
      console.log(prefix, message, data ?? '');
    } else if (level === 'info') {
      console.log(prefix, message, data ?? '');
    }
  }
}

// ============================================================================
// SINGLETON MANAGEMENT
// ============================================================================

let _neuralMemoryService: NeuralMemoryService | null = null;

/**
 * Initialize the Neural Memory Service singleton
 *
 * @param config - Configuration
 * @returns Initialized service
 */
export function initNeuralMemory(config: NeuralMemoryConfig): NeuralMemoryService {
  _neuralMemoryService = new NeuralMemoryService(config);
  return _neuralMemoryService;
}

/**
 * Get the Neural Memory Service singleton
 *
 * @returns Service instance
 * @throws If not initialized
 */
export function getNeuralMemory(): NeuralMemoryService {
  if (!_neuralMemoryService) {
    throw new Error('Neural Memory Service not initialized. Call initNeuralMemory() first.');
  }
  return _neuralMemoryService;
}

/**
 * Check if Neural Memory Service is initialized
 */
export function isNeuralMemoryInitialized(): boolean {
  return _neuralMemoryService !== null;
}
