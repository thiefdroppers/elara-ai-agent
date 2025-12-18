/**
 * Elara AI Agent - Enterprise Agent Management Service
 *
 * Centralized service for managing all agent updates from E-BRAIN:
 * - Configuration updates (persona, thresholds, endpoints)
 * - Policy updates (guardrails, permissions, rate limits)
 * - Model updates (MobileBERT, ensemble weights, patterns)
 * - Security updates (API key rotation, blocklists)
 * - Emergency controls (kill switch, forced updates)
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────┐
 * │                    E-BRAIN (Cloud Run)                       │
 * │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
 * │  │   Config    │ │   Model     │ │   Policy    │           │
 * │  │  Registry   │ │  Registry   │ │   Engine    │           │
 * │  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘           │
 * │         └───────────────┼───────────────┘                   │
 * │                         │                                   │
 * │              WebSocket + REST APIs                          │
 * └─────────────────────────┬───────────────────────────────────┘
 *                           │
 *              ┌────────────┴────────────┐
 *              │  AgentManagementService │ ← This Service
 *              │  ├─ ConfigManager       │
 *              │  ├─ ModelManager        │
 *              │  ├─ PolicyManager       │
 *              │  ├─ SecurityManager     │
 *              │  └─ TelemetryReporter   │
 *              └────────────┬────────────┘
 *                           │
 *              ┌────────────┴────────────┐
 *              │   AI Agent Extension    │
 *              │  (Chrome Web Store)     │
 *              └─────────────────────────┘
 *
 * @module agent-management-service
 * @version 1.0.0
 */

import { EBRAIN_CONFIG } from '../platform-config';

// ============================================================================
// TYPES - UPDATE CATEGORIES
// ============================================================================

export type UpdateCategory =
  | 'config'      // Persona, thresholds, endpoints, feature flags
  | 'policy'      // Guardrails, permissions, rate limits
  | 'model'       // ML models, weights, patterns
  | 'security'    // API keys, blocklists, patches
  | 'emergency';  // Kill switch, forced actions

export type UpdatePriority = 'critical' | 'high' | 'normal' | 'low';

export type UpdateStatus = 'pending' | 'downloading' | 'applying' | 'applied' | 'failed' | 'rolled_back';

// ============================================================================
// TYPES - CONFIGURATION
// ============================================================================

export interface AgentConfig {
  version: number;
  updatedAt: string;

  // Persona settings
  persona: {
    activeType: string;
    traitOverrides: Record<string, any>;
    guardrailOverrides: Record<string, any>;
  };

  // Feature flags
  features: {
    enableEdgeML: boolean;
    enableHybridScanning: boolean;
    enableLearning: boolean;
    enableEmotionalDistress: boolean;
    enableCrisisResources: boolean;
    enableTelemetry: boolean;
    experimentFlags: Record<string, boolean>;
  };

  // Thresholds
  thresholds: {
    edgeScanConfidence: number;
    hybridTriggerThreshold: number;
    deepScanTriggerThreshold: number;
    memoryRetrievalMinSimilarity: number;
    learningConsolidationInterval: number;
  };

  // Endpoints (can be updated for failover)
  endpoints: {
    aiNucleus: string;
    aiNucleusDomain?: string;
    eBrain: string;
    fallback: string;
  };

  // Rate limits
  rateLimits: {
    scansPerMinute: number;
    llmRequestsPerMinute: number;
    memoryOpsPerMinute: number;
  };
}

// ============================================================================
// TYPES - POLICIES
// ============================================================================

export interface AgentPolicy {
  version: number;
  updatedAt: string;

  // Content guardrails
  guardrails: {
    strictness: 'strict' | 'moderate' | 'relaxed';
    blockedTopics: string[];
    allowedTopics: string[];
    blockPersonalAdvice: {
      medical: boolean;
      legal: boolean;
      financial: boolean;
    };
  };

  // Permissions
  permissions: {
    canScanUrls: boolean;
    canScanMessages: boolean;
    canAccessMemory: boolean;
    canLearn: boolean;
    canReportTelemetry: boolean;
    allowedTools: string[];
  };

  // Org-wide overrides
  orgPolicy?: {
    enforceGuardrails: boolean;
    minStrictness: string;
    requiredFeatures: string[];
  };
}

// ============================================================================
// TYPES - MODELS
// ============================================================================

export interface ModelManifest {
  version: string;
  updatedAt: string;
  models: ModelInfo[];
}

export interface ModelInfo {
  id: string;
  name: string;
  version: string;
  type: 'onnx' | 'tflite' | 'weights' | 'patterns';
  size: number;
  checksum: string;
  downloadUrl: string;
  enabled: boolean;
  priority: number;
  config: Record<string, any>;
}

export interface ModelUpdate {
  modelId: string;
  fromVersion: string;
  toVersion: string;
  downloadUrl: string;
  checksum: string;
  size: number;
  releaseNotes: string;
  breaking: boolean;
  rollbackUrl?: string;
}

// ============================================================================
// TYPES - SECURITY
// ============================================================================

export interface SecurityUpdate {
  version: number;
  updatedAt: string;

  // Credential rotation
  credentials?: {
    apiKey?: string;
    rotateAt?: string;
  };

  // Blocklists
  blocklists?: {
    domains: string[];
    ips: string[];
    patterns: string[];
  };

  // Security patches
  patches?: SecurityPatch[];
}

export interface SecurityPatch {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  action: 'block_feature' | 'update_config' | 'force_update';
  params: Record<string, any>;
}

// ============================================================================
// TYPES - EMERGENCY
// ============================================================================

export interface EmergencyCommand {
  type: 'kill_switch' | 'force_update' | 'disable_feature' | 'clear_cache' | 'reset_config';
  reason: string;
  issuedAt: string;
  expiresAt?: string;
  params?: Record<string, any>;
}

// ============================================================================
// TYPES - UPDATE ENVELOPE
// ============================================================================

export interface UpdateEnvelope {
  id: string;
  category: UpdateCategory;
  priority: UpdatePriority;
  version: number;
  timestamp: string;
  payload: AgentConfig | AgentPolicy | ModelUpdate | SecurityUpdate | EmergencyCommand;
  signature?: string;
  requiresRestart: boolean;
  rollbackVersion?: number;
}

export interface UpdateCheckResponse {
  hasUpdates: boolean;
  updates: UpdateEnvelope[];
  serverTime: string;
  nextCheckIn: number; // ms until next recommended check
}

// ============================================================================
// TYPES - TELEMETRY
// ============================================================================

export interface AgentTelemetry {
  agentId: string;
  timestamp: string;
  sessionId: string;

  // Version info
  versions: {
    extension: string;
    configVersion: number;
    policyVersion: number;
    modelVersions: Record<string, string>;
  };

  // Health metrics
  health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastError?: string;
    uptime: number;
    memoryUsage: number;
  };

  // Performance metrics
  performance: {
    scansTotal: number;
    scansEdge: number;
    scansHybrid: number;
    scansDeep: number;
    avgLatencyMs: number;
    p99LatencyMs: number;
    llmRequestsTotal: number;
    cacheHitRate: number;
  };

  // Model metrics
  models: {
    predictionsTotal: number;
    avgConfidence: number;
    lowConfidenceCount: number;
    errorCount: number;
  };

  // Learning metrics
  learning: {
    memoriesStored: number;
    memoriesRetrieved: number;
    hebbianUpdates: number;
    stdpUpdates: number;
  };
}

// ============================================================================
// TYPES - SERVICE OPTIONS
// ============================================================================

export interface AgentManagementOptions {
  agentId: string;
  organizationId?: string;

  // Polling configuration
  pollingIntervalMs?: number;
  enablePolling?: boolean;

  // WebSocket configuration
  enableWebSocket?: boolean;
  webSocketReconnectMs?: number;

  // Update handling
  autoApplyUpdates?: boolean;
  requireUserConsent?: boolean;

  // Telemetry
  enableTelemetry?: boolean;
  telemetryIntervalMs?: number;

  // Callbacks
  onConfigUpdate?: (config: AgentConfig) => void;
  onPolicyUpdate?: (policy: AgentPolicy) => void;
  onModelUpdate?: (update: ModelUpdate) => void;
  onSecurityUpdate?: (update: SecurityUpdate) => void;
  onEmergencyCommand?: (command: EmergencyCommand) => void;
  onError?: (error: Error, category: UpdateCategory) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_POLLING_INTERVAL = 60000; // 1 minute
const DEFAULT_TELEMETRY_INTERVAL = 300000; // 5 minutes
const DEFAULT_WEBSOCKET_RECONNECT = 5000; // 5 seconds
const STORAGE_KEYS = {
  config: 'elara_agent_config',
  policy: 'elara_agent_policy',
  modelManifest: 'elara_model_manifest',
  credentials: 'elara_credentials',
  lastSync: 'elara_last_sync',
  sessionId: 'elara_session_id',
};

// E-BRAIN Agent Management API endpoints
const MANAGEMENT_ENDPOINTS = {
  // Check for all updates
  checkUpdates: '/api/v1/agents/updates/check',
  // Category-specific endpoints
  config: '/api/v1/agents/config',
  policy: '/api/v1/agents/policy',
  models: '/api/v1/agents/models',
  security: '/api/v1/agents/security',
  // Actions
  applyUpdate: '/api/v1/agents/updates/apply',
  rollback: '/api/v1/agents/updates/rollback',
  acknowledge: '/api/v1/agents/updates/acknowledge',
  // Telemetry
  telemetry: '/api/v1/agents/telemetry',
  heartbeat: '/api/v1/agents/heartbeat',
  // WebSocket
  webSocket: '/ws/agents',
};

// ============================================================================
// AGENT MANAGEMENT SERVICE
// ============================================================================

export class AgentManagementService {
  private options: Required<AgentManagementOptions>;
  private sessionId: string;

  // Current state
  private currentConfig: AgentConfig | null = null;
  private currentPolicy: AgentPolicy | null = null;
  private currentModels: ModelManifest | null = null;

  // Update tracking
  private pendingUpdates: Map<string, UpdateEnvelope> = new Map();
  private appliedUpdates: Map<string, UpdateEnvelope> = new Map();

  // Timers
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private telemetryTimer: ReturnType<typeof setInterval> | null = null;

  // WebSocket
  private webSocket: WebSocket | null = null;
  private wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;

  // State
  private isInitialized = false;
  private isConnected = false;
  private lastSyncTime = 0;

  // Metrics for telemetry
  private metrics = {
    scansTotal: 0,
    scansEdge: 0,
    scansHybrid: 0,
    scansDeep: 0,
    totalLatencyMs: 0,
    llmRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    predictions: 0,
    totalConfidence: 0,
    lowConfidence: 0,
    modelErrors: 0,
    memoriesStored: 0,
    memoriesRetrieved: 0,
    hebbianUpdates: 0,
    stdpUpdates: 0,
  };

  constructor(options: AgentManagementOptions) {
    this.sessionId = crypto.randomUUID();
    this.options = {
      organizationId: 'default',
      pollingIntervalMs: DEFAULT_POLLING_INTERVAL,
      enablePolling: true,
      enableWebSocket: true,
      webSocketReconnectMs: DEFAULT_WEBSOCKET_RECONNECT,
      autoApplyUpdates: true,
      requireUserConsent: false,
      enableTelemetry: true,
      telemetryIntervalMs: DEFAULT_TELEMETRY_INTERVAL,
      onConfigUpdate: () => {},
      onPolicyUpdate: () => {},
      onModelUpdate: () => {},
      onSecurityUpdate: () => {},
      onEmergencyCommand: () => {},
      onError: (err) => console.error('[AgentManagement] Error:', err),
      ...options,
    };

    console.log('[AgentManagement] Service created for agent:', this.options.agentId);
  }

  // --------------------------------------------------------------------------
  // INITIALIZATION
  // --------------------------------------------------------------------------

  async initialize(): Promise<void> {
    console.log('[AgentManagement] Initializing...');

    try {
      // Load cached state
      await this.loadCachedState();

      // Fetch fresh state from E-BRAIN
      await this.fullSync();

      // Start polling
      if (this.options.enablePolling) {
        this.startPolling();
      }

      // Connect WebSocket for real-time updates
      if (this.options.enableWebSocket) {
        this.connectWebSocket();
      }

      // Start telemetry reporting
      if (this.options.enableTelemetry) {
        this.startTelemetryReporting();
      }

      this.isInitialized = true;
      console.log('[AgentManagement] Initialization complete');
    } catch (error) {
      console.error('[AgentManagement] Initialization failed:', error);
      // Continue with cached state if available
      if (!this.currentConfig) {
        this.currentConfig = this.getDefaultConfig();
      }
      if (!this.currentPolicy) {
        this.currentPolicy = this.getDefaultPolicy();
      }
    }
  }

  async shutdown(): Promise<void> {
    console.log('[AgentManagement] Shutting down...');
    this.stopPolling();
    this.stopTelemetryReporting();
    this.disconnectWebSocket();
    await this.reportTelemetry(); // Final telemetry report
    this.isInitialized = false;
  }

  // --------------------------------------------------------------------------
  // SYNC OPERATIONS
  // --------------------------------------------------------------------------

  async fullSync(): Promise<void> {
    console.log('[AgentManagement] Performing full sync with E-BRAIN...');

    const results = await Promise.allSettled([
      this.fetchConfig(),
      this.fetchPolicy(),
      this.fetchModels(),
      this.checkForUpdates(),
    ]);

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const categories = ['config', 'policy', 'models', 'updates'];
        console.error(`[AgentManagement] Failed to fetch ${categories[index]}:`, result.reason);
      }
    });

    this.lastSyncTime = Date.now();
    await this.saveToStorage(STORAGE_KEYS.lastSync, this.lastSyncTime);

    console.log('[AgentManagement] Full sync complete');
  }

  async checkForUpdates(): Promise<UpdateEnvelope[]> {
    try {
      const url = `${EBRAIN_CONFIG.baseURL}${MANAGEMENT_ENDPOINTS.checkUpdates}`;
      const response = await this.authenticatedFetch(url, {
        method: 'POST',
        body: JSON.stringify({
          agentId: this.options.agentId,
          organizationId: this.options.organizationId,
          currentVersions: {
            config: this.currentConfig?.version || 0,
            policy: this.currentPolicy?.version || 0,
            models: this.currentModels?.version || '0.0.0',
          },
          lastSyncTime: this.lastSyncTime,
        }),
      });

      if (!response.ok) {
        // Handle 403/404 gracefully - endpoint may not exist yet
        if (response.status === 403 || response.status === 404) {
          console.log('[AgentManagement] Update endpoint not available, skipping');
          return [];
        }
        throw new Error(`Update check failed: ${response.status}`);
      }

      const data: UpdateCheckResponse = await response.json();

      if (data.hasUpdates) {
        console.log('[AgentManagement] Found', data.updates.length, 'updates');
        await this.processUpdates(data.updates);
      }

      return data.updates;
    } catch (error) {
      console.error('[AgentManagement] Update check failed:', error);
      return [];
    }
  }

  // --------------------------------------------------------------------------
  // FETCH OPERATIONS
  // --------------------------------------------------------------------------

  private async fetchConfig(): Promise<AgentConfig | null> {
    try {
      const url = `${EBRAIN_CONFIG.baseURL}${MANAGEMENT_ENDPOINTS.config}/${this.options.agentId}`;
      const response = await this.authenticatedFetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          console.log('[AgentManagement] No config found, using defaults');
          return null;
        }
        throw new Error(`Config fetch failed: ${response.status}`);
      }

      const config: AgentConfig = await response.json();
      this.currentConfig = config;
      await this.saveToStorage(STORAGE_KEYS.config, config);
      this.options.onConfigUpdate(config);

      console.log('[AgentManagement] Config loaded, version:', config.version);
      return config;
    } catch (error) {
      this.options.onError(error instanceof Error ? error : new Error(String(error)), 'config');
      return null;
    }
  }

  private async fetchPolicy(): Promise<AgentPolicy | null> {
    try {
      const url = `${EBRAIN_CONFIG.baseURL}${MANAGEMENT_ENDPOINTS.policy}/${this.options.agentId}`;
      const response = await this.authenticatedFetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          console.log('[AgentManagement] No policy found, using defaults');
          return null;
        }
        throw new Error(`Policy fetch failed: ${response.status}`);
      }

      const policy: AgentPolicy = await response.json();
      this.currentPolicy = policy;
      await this.saveToStorage(STORAGE_KEYS.policy, policy);
      this.options.onPolicyUpdate(policy);

      console.log('[AgentManagement] Policy loaded, version:', policy.version);
      return policy;
    } catch (error) {
      this.options.onError(error instanceof Error ? error : new Error(String(error)), 'policy');
      return null;
    }
  }

  private async fetchModels(): Promise<ModelManifest | null> {
    try {
      const url = `${EBRAIN_CONFIG.baseURL}${MANAGEMENT_ENDPOINTS.models}/${this.options.agentId}`;
      const response = await this.authenticatedFetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Models fetch failed: ${response.status}`);
      }

      const manifest: ModelManifest = await response.json();
      this.currentModels = manifest;
      await this.saveToStorage(STORAGE_KEYS.modelManifest, manifest);

      console.log('[AgentManagement] Model manifest loaded, version:', manifest.version);
      return manifest;
    } catch (error) {
      this.options.onError(error instanceof Error ? error : new Error(String(error)), 'model');
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // UPDATE PROCESSING
  // --------------------------------------------------------------------------

  private async processUpdates(updates: UpdateEnvelope[]): Promise<void> {
    // Sort by priority (critical first)
    const priorityOrder: Record<UpdatePriority, number> = {
      critical: 0,
      high: 1,
      normal: 2,
      low: 3,
    };

    const sorted = updates.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    for (const update of sorted) {
      // Emergency commands are always processed immediately
      if (update.category === 'emergency') {
        await this.handleEmergencyCommand(update.payload as EmergencyCommand);
        continue;
      }

      // Check if auto-apply or needs consent
      if (this.options.autoApplyUpdates || update.priority === 'critical') {
        await this.applyUpdate(update);
      } else {
        this.pendingUpdates.set(update.id, update);
        console.log('[AgentManagement] Update pending consent:', update.id, update.category);
      }
    }
  }

  async applyUpdate(update: UpdateEnvelope): Promise<boolean> {
    console.log('[AgentManagement] Applying update:', update.id, update.category);

    try {
      switch (update.category) {
        case 'config':
          await this.applyConfigUpdate(update.payload as AgentConfig);
          break;
        case 'policy':
          await this.applyPolicyUpdate(update.payload as AgentPolicy);
          break;
        case 'model':
          await this.applyModelUpdate(update.payload as ModelUpdate);
          break;
        case 'security':
          await this.applySecurityUpdate(update.payload as SecurityUpdate);
          break;
        case 'emergency':
          await this.handleEmergencyCommand(update.payload as EmergencyCommand);
          break;
      }

      // Acknowledge update to E-BRAIN
      await this.acknowledgeUpdate(update.id, 'applied');

      this.appliedUpdates.set(update.id, update);
      this.pendingUpdates.delete(update.id);

      console.log('[AgentManagement] Update applied successfully:', update.id);
      return true;
    } catch (error) {
      console.error('[AgentManagement] Update failed:', update.id, error);
      await this.acknowledgeUpdate(update.id, 'failed');

      // Attempt rollback if available
      if (update.rollbackVersion) {
        console.log('[AgentManagement] Attempting rollback to version:', update.rollbackVersion);
        await this.rollbackUpdate(update);
      }

      return false;
    }
  }

  private async applyConfigUpdate(config: AgentConfig): Promise<void> {
    this.currentConfig = config;
    await this.saveToStorage(STORAGE_KEYS.config, config);
    this.options.onConfigUpdate(config);

    // Broadcast to extension components
    chrome.runtime.sendMessage({
      type: 'AGENT_CONFIG_UPDATED',
      config,
    }).catch(() => {});
  }

  private async applyPolicyUpdate(policy: AgentPolicy): Promise<void> {
    this.currentPolicy = policy;
    await this.saveToStorage(STORAGE_KEYS.policy, policy);
    this.options.onPolicyUpdate(policy);

    chrome.runtime.sendMessage({
      type: 'AGENT_POLICY_UPDATED',
      policy,
    }).catch(() => {});
  }

  private async applyModelUpdate(update: ModelUpdate): Promise<void> {
    console.log('[AgentManagement] Downloading model update:', update.modelId, update.toVersion);

    // Download model
    const modelBlob = await this.downloadModel(update.downloadUrl);

    // Verify checksum
    const checksum = await this.computeChecksum(modelBlob);
    if (checksum !== update.checksum) {
      throw new Error(`Model checksum mismatch: expected ${update.checksum}, got ${checksum}`);
    }

    // Store model in IndexedDB
    await this.storeModel(update.modelId, update.toVersion, modelBlob);

    // Update manifest
    if (this.currentModels) {
      const modelIndex = this.currentModels.models.findIndex((m) => m.id === update.modelId);
      if (modelIndex >= 0) {
        this.currentModels.models[modelIndex].version = update.toVersion;
      }
      await this.saveToStorage(STORAGE_KEYS.modelManifest, this.currentModels);
    }

    // Notify for hot-swap
    this.options.onModelUpdate(update);

    chrome.runtime.sendMessage({
      type: 'AGENT_MODEL_UPDATED',
      modelId: update.modelId,
      version: update.toVersion,
    }).catch(() => {});

    console.log('[AgentManagement] Model update complete:', update.modelId);
  }

  private async applySecurityUpdate(update: SecurityUpdate): Promise<void> {
    // Handle credential rotation
    if (update.credentials?.apiKey) {
      await this.rotateCredentials(update.credentials.apiKey);
    }

    // Handle blocklist updates
    if (update.blocklists) {
      await this.updateBlocklists(update.blocklists);
    }

    // Handle security patches
    if (update.patches) {
      for (const patch of update.patches) {
        await this.applySecurityPatch(patch);
      }
    }

    this.options.onSecurityUpdate(update);
  }

  private async handleEmergencyCommand(command: EmergencyCommand): Promise<void> {
    console.warn('[AgentManagement] EMERGENCY COMMAND:', command.type, command.reason);

    switch (command.type) {
      case 'kill_switch':
        // Disable all scanning
        if (this.currentConfig) {
          this.currentConfig.features.enableEdgeML = false;
          this.currentConfig.features.enableHybridScanning = false;
          await this.saveToStorage(STORAGE_KEYS.config, this.currentConfig);
        }
        break;

      case 'force_update':
        // Trigger immediate full sync
        await this.fullSync();
        break;

      case 'disable_feature':
        if (command.params?.feature && this.currentConfig) {
          (this.currentConfig.features as any)[command.params.feature] = false;
          await this.saveToStorage(STORAGE_KEYS.config, this.currentConfig);
        }
        break;

      case 'clear_cache':
        await chrome.storage.local.clear();
        break;

      case 'reset_config':
        this.currentConfig = this.getDefaultConfig();
        this.currentPolicy = this.getDefaultPolicy();
        await this.saveToStorage(STORAGE_KEYS.config, this.currentConfig);
        await this.saveToStorage(STORAGE_KEYS.policy, this.currentPolicy);
        break;
    }

    this.options.onEmergencyCommand(command);

    chrome.runtime.sendMessage({
      type: 'EMERGENCY_COMMAND',
      command,
    }).catch(() => {});
  }

  // --------------------------------------------------------------------------
  // ROLLBACK
  // --------------------------------------------------------------------------

  private async rollbackUpdate(update: UpdateEnvelope): Promise<void> {
    try {
      const url = `${EBRAIN_CONFIG.baseURL}${MANAGEMENT_ENDPOINTS.rollback}`;
      await this.authenticatedFetch(url, {
        method: 'POST',
        body: JSON.stringify({
          agentId: this.options.agentId,
          updateId: update.id,
          rollbackToVersion: update.rollbackVersion,
        }),
      });

      // Re-fetch the rolled-back version
      await this.fullSync();
    } catch (error) {
      console.error('[AgentManagement] Rollback failed:', error);
    }
  }

  private async acknowledgeUpdate(updateId: string, status: UpdateStatus): Promise<void> {
    try {
      const url = `${EBRAIN_CONFIG.baseURL}${MANAGEMENT_ENDPOINTS.acknowledge}`;
      await this.authenticatedFetch(url, {
        method: 'POST',
        body: JSON.stringify({
          agentId: this.options.agentId,
          updateId,
          status,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.warn('[AgentManagement] Failed to acknowledge update:', error);
    }
  }

  // --------------------------------------------------------------------------
  // POLLING
  // --------------------------------------------------------------------------

  private startPolling(): void {
    if (this.pollingTimer) return;

    console.log('[AgentManagement] Starting polling, interval:', this.options.pollingIntervalMs, 'ms');

    this.pollingTimer = setInterval(async () => {
      await this.checkForUpdates();
    }, this.options.pollingIntervalMs);
  }

  private stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  // --------------------------------------------------------------------------
  // WEBSOCKET (Real-time Push)
  // --------------------------------------------------------------------------

  private connectWebSocket(): void {
    const wsUrl = EBRAIN_CONFIG.baseURL
      .replace('https://', 'wss://')
      .replace('http://', 'ws://') +
      `${MANAGEMENT_ENDPOINTS.webSocket}/${this.options.agentId}`;

    console.log('[AgentManagement] Connecting WebSocket:', wsUrl);

    try {
      this.webSocket = new WebSocket(wsUrl);

      this.webSocket.onopen = () => {
        console.log('[AgentManagement] WebSocket connected');
        this.isConnected = true;

        // Send auth message
        this.webSocket?.send(JSON.stringify({
          type: 'auth',
          apiKey: EBRAIN_CONFIG.apiKey,
          agentId: this.options.agentId,
        }));
      };

      this.webSocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('[AgentManagement] Failed to parse WebSocket message:', error);
        }
      };

      this.webSocket.onclose = () => {
        console.log('[AgentManagement] WebSocket disconnected');
        this.isConnected = false;
        this.scheduleWebSocketReconnect();
      };

      this.webSocket.onerror = (error) => {
        console.error('[AgentManagement] WebSocket error:', error);
        this.isConnected = false;
      };
    } catch (error) {
      console.error('[AgentManagement] WebSocket connection failed:', error);
      this.scheduleWebSocketReconnect();
    }
  }

  private handleWebSocketMessage(message: any): void {
    console.log('[AgentManagement] WebSocket message:', message.type);

    switch (message.type) {
      case 'update':
        this.processUpdates([message.update as UpdateEnvelope]);
        break;

      case 'emergency':
        this.handleEmergencyCommand(message.command as EmergencyCommand);
        break;

      case 'sync':
        this.fullSync();
        break;

      case 'ping':
        this.webSocket?.send(JSON.stringify({ type: 'pong' }));
        break;
    }
  }

  private scheduleWebSocketReconnect(): void {
    if (this.wsReconnectTimer) return;

    this.wsReconnectTimer = setTimeout(() => {
      this.wsReconnectTimer = null;
      if (this.options.enableWebSocket && !this.isConnected) {
        this.connectWebSocket();
      }
    }, this.options.webSocketReconnectMs);
  }

  private disconnectWebSocket(): void {
    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }
    if (this.webSocket) {
      this.webSocket.close();
      this.webSocket = null;
    }
    this.isConnected = false;
  }

  // --------------------------------------------------------------------------
  // TELEMETRY
  // --------------------------------------------------------------------------

  private startTelemetryReporting(): void {
    if (this.telemetryTimer) return;

    this.telemetryTimer = setInterval(async () => {
      await this.reportTelemetry();
    }, this.options.telemetryIntervalMs);
  }

  private stopTelemetryReporting(): void {
    if (this.telemetryTimer) {
      clearInterval(this.telemetryTimer);
      this.telemetryTimer = null;
    }
  }

  private async reportTelemetry(): Promise<void> {
    if (!this.options.enableTelemetry) return;

    const telemetry: AgentTelemetry = {
      agentId: this.options.agentId,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      versions: {
        extension: chrome.runtime.getManifest().version,
        configVersion: this.currentConfig?.version || 0,
        policyVersion: this.currentPolicy?.version || 0,
        modelVersions: this.getModelVersions(),
      },
      health: {
        status: this.isConnected ? 'healthy' : 'degraded',
        uptime: Date.now() - this.lastSyncTime,
        memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
      },
      performance: {
        scansTotal: this.metrics.scansTotal,
        scansEdge: this.metrics.scansEdge,
        scansHybrid: this.metrics.scansHybrid,
        scansDeep: this.metrics.scansDeep,
        avgLatencyMs: this.metrics.scansTotal > 0
          ? this.metrics.totalLatencyMs / this.metrics.scansTotal
          : 0,
        p99LatencyMs: 0, // Would need histogram
        llmRequestsTotal: this.metrics.llmRequests,
        cacheHitRate: this.metrics.cacheHits + this.metrics.cacheMisses > 0
          ? this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)
          : 0,
      },
      models: {
        predictionsTotal: this.metrics.predictions,
        avgConfidence: this.metrics.predictions > 0
          ? this.metrics.totalConfidence / this.metrics.predictions
          : 0,
        lowConfidenceCount: this.metrics.lowConfidence,
        errorCount: this.metrics.modelErrors,
      },
      learning: {
        memoriesStored: this.metrics.memoriesStored,
        memoriesRetrieved: this.metrics.memoriesRetrieved,
        hebbianUpdates: this.metrics.hebbianUpdates,
        stdpUpdates: this.metrics.stdpUpdates,
      },
    };

    try {
      const url = `${EBRAIN_CONFIG.baseURL}${MANAGEMENT_ENDPOINTS.telemetry}`;
      await this.authenticatedFetch(url, {
        method: 'POST',
        body: JSON.stringify(telemetry),
      });
    } catch (error) {
      // Silent failure for telemetry
    }
  }

  // --------------------------------------------------------------------------
  // METRICS TRACKING (called by extension components)
  // --------------------------------------------------------------------------

  recordScan(type: 'edge' | 'hybrid' | 'deep', latencyMs: number): void {
    this.metrics.scansTotal++;
    this.metrics.totalLatencyMs += latencyMs;
    if (type === 'edge') this.metrics.scansEdge++;
    else if (type === 'hybrid') this.metrics.scansHybrid++;
    else this.metrics.scansDeep++;
  }

  recordPrediction(confidence: number): void {
    this.metrics.predictions++;
    this.metrics.totalConfidence += confidence;
    if (confidence < 0.7) this.metrics.lowConfidence++;
  }

  recordModelError(): void {
    this.metrics.modelErrors++;
  }

  recordLLMRequest(): void {
    this.metrics.llmRequests++;
  }

  recordCacheHit(): void {
    this.metrics.cacheHits++;
  }

  recordCacheMiss(): void {
    this.metrics.cacheMisses++;
  }

  recordMemoryStore(): void {
    this.metrics.memoriesStored++;
  }

  recordMemoryRetrieve(): void {
    this.metrics.memoriesRetrieved++;
  }

  recordHebbianUpdate(): void {
    this.metrics.hebbianUpdates++;
  }

  recordSTDPUpdate(): void {
    this.metrics.stdpUpdates++;
  }

  // --------------------------------------------------------------------------
  // HELPER METHODS
  // --------------------------------------------------------------------------

  private async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const apiKey = await this.getApiKey();

    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-Agent-ID': this.options.agentId,
        ...options.headers,
      },
      signal: AbortSignal.timeout(EBRAIN_CONFIG.timeout),
    });
  }

  private async getApiKey(): Promise<string> {
    // Try to get from secure storage first
    try {
      const data = await chrome.storage.local.get(STORAGE_KEYS.credentials);
      if (data[STORAGE_KEYS.credentials]?.apiKey) {
        return data[STORAGE_KEYS.credentials].apiKey;
      }
    } catch {}

    // Fall back to config
    return EBRAIN_CONFIG.apiKey;
  }

  private async rotateCredentials(newApiKey: string): Promise<void> {
    await chrome.storage.local.set({
      [STORAGE_KEYS.credentials]: {
        apiKey: newApiKey,
        rotatedAt: new Date().toISOString(),
      },
    });
    console.log('[AgentManagement] Credentials rotated');
  }

  private async updateBlocklists(blocklists: SecurityUpdate['blocklists']): Promise<void> {
    // Store blocklists for use by scanning components
    await chrome.storage.local.set({
      elara_blocklists: blocklists,
    });
  }

  private async applySecurityPatch(patch: SecurityPatch): Promise<void> {
    console.log('[AgentManagement] Applying security patch:', patch.id, patch.severity);

    switch (patch.action) {
      case 'block_feature':
        if (patch.params?.feature && this.currentConfig) {
          (this.currentConfig.features as any)[patch.params.feature] = false;
        }
        break;

      case 'update_config':
        if (patch.params && this.currentConfig) {
          Object.assign(this.currentConfig, patch.params);
        }
        break;

      case 'force_update':
        await this.fullSync();
        break;
    }
  }

  private async downloadModel(url: string): Promise<Blob> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Model download failed: ${response.status}`);
    }
    return response.blob();
  }

  private async computeChecksum(blob: Blob): Promise<string> {
    const buffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  private async storeModel(modelId: string, version: string, blob: Blob): Promise<void> {
    // Store in IndexedDB
    const db = await this.openModelDatabase();
    const tx = db.transaction('models', 'readwrite');
    const store = tx.objectStore('models');

    await new Promise<void>((resolve, reject) => {
      const request = store.put({
        id: modelId,
        version,
        blob,
        storedAt: new Date().toISOString(),
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    db.close();
  }

  private async openModelDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('elara-models', 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('models')) {
          db.createObjectStore('models', { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private getModelVersions(): Record<string, string> {
    if (!this.currentModels) return {};
    return Object.fromEntries(
      this.currentModels.models.map((m) => [m.id, m.version])
    );
  }

  private async loadCachedState(): Promise<void> {
    try {
      const data = await chrome.storage.local.get([
        STORAGE_KEYS.config,
        STORAGE_KEYS.policy,
        STORAGE_KEYS.modelManifest,
        STORAGE_KEYS.lastSync,
      ]);

      if (data[STORAGE_KEYS.config]) {
        this.currentConfig = data[STORAGE_KEYS.config];
      }
      if (data[STORAGE_KEYS.policy]) {
        this.currentPolicy = data[STORAGE_KEYS.policy];
      }
      if (data[STORAGE_KEYS.modelManifest]) {
        this.currentModels = data[STORAGE_KEYS.modelManifest];
      }
      if (data[STORAGE_KEYS.lastSync]) {
        this.lastSyncTime = data[STORAGE_KEYS.lastSync];
      }

      console.log('[AgentManagement] Cached state loaded');
    } catch (error) {
      console.warn('[AgentManagement] Failed to load cached state:', error);
    }
  }

  private async saveToStorage(key: string, value: any): Promise<void> {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (error) {
      console.warn('[AgentManagement] Failed to save to storage:', error);
    }
  }

  // --------------------------------------------------------------------------
  // DEFAULT VALUES
  // --------------------------------------------------------------------------

  private getDefaultConfig(): AgentConfig {
    return {
      version: 0,
      updatedAt: new Date().toISOString(),
      persona: {
        activeType: 'friendly',
        traitOverrides: {},
        guardrailOverrides: {},
      },
      features: {
        enableEdgeML: true,
        enableHybridScanning: true,
        enableLearning: true,
        enableEmotionalDistress: true,
        enableCrisisResources: true,
        enableTelemetry: true,
        experimentFlags: {},
      },
      thresholds: {
        edgeScanConfidence: 0.85,
        hybridTriggerThreshold: 0.7,
        deepScanTriggerThreshold: 0.5,
        memoryRetrievalMinSimilarity: 0.5,
        learningConsolidationInterval: 300000,
      },
      endpoints: {
        // Updated 2025-12-18: HTTP with port (no SSL on LoadBalancer yet)
        aiNucleus: 'http://34.19.37.0:8200',
        aiNucleusDomain: 'http://enn.oelara.com:8200',
        eBrain: 'https://e-brain-dashboard-122460113662.us-west1.run.app',
        fallback: 'https://dev-api.thiefdroppers.com',
      },
      rateLimits: {
        scansPerMinute: 60,
        llmRequestsPerMinute: 30,
        memoryOpsPerMinute: 100,
      },
    };
  }

  private getDefaultPolicy(): AgentPolicy {
    return {
      version: 0,
      updatedAt: new Date().toISOString(),
      guardrails: {
        strictness: 'moderate',
        blockedTopics: [
          'illegal activities',
          'hacking tutorials',
          'malware creation',
        ],
        allowedTopics: [
          'cybersecurity',
          'scam detection',
          'fraud prevention',
          'online safety',
        ],
        blockPersonalAdvice: {
          medical: true,
          legal: true,
          financial: true,
        },
      },
      permissions: {
        canScanUrls: true,
        canScanMessages: true,
        canAccessMemory: true,
        canLearn: true,
        canReportTelemetry: true,
        allowedTools: ['scan_url', 'scan_message', 'search_memories', 'fact_check'],
      },
    };
  }

  // --------------------------------------------------------------------------
  // PUBLIC GETTERS
  // --------------------------------------------------------------------------

  getConfig(): AgentConfig {
    return this.currentConfig || this.getDefaultConfig();
  }

  getPolicy(): AgentPolicy {
    return this.currentPolicy || this.getDefaultPolicy();
  }

  getModels(): ModelManifest | null {
    return this.currentModels;
  }

  getPendingUpdates(): UpdateEnvelope[] {
    return Array.from(this.pendingUpdates.values());
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  getConnectionStatus(): { polling: boolean; webSocket: boolean } {
    return {
      polling: this.pollingTimer !== null,
      webSocket: this.isConnected,
    };
  }
}

// ============================================================================
// SINGLETON FACTORY
// ============================================================================

let serviceInstance: AgentManagementService | null = null;

export function getAgentManagementService(options?: AgentManagementOptions): AgentManagementService {
  if (!serviceInstance && options) {
    serviceInstance = new AgentManagementService(options);
  }
  if (!serviceInstance) {
    throw new Error('AgentManagementService not initialized');
  }
  return serviceInstance;
}

export async function initializeAgentManagement(agentId: string): Promise<AgentManagementService> {
  const service = getAgentManagementService({
    agentId,
    organizationId: EBRAIN_CONFIG.agentId,
    pollingIntervalMs: 60000,
    enablePolling: true,
    enableWebSocket: true,
    autoApplyUpdates: true,
    enableTelemetry: true,
    onConfigUpdate: (config) => {
      console.log('[AgentManagement] Config updated:', config.version);
    },
    onPolicyUpdate: (policy) => {
      console.log('[AgentManagement] Policy updated:', policy.version);
    },
    onModelUpdate: (update) => {
      console.log('[AgentManagement] Model updated:', update.modelId, update.toVersion);
    },
    onSecurityUpdate: (update) => {
      console.log('[AgentManagement] Security update applied:', update.version);
    },
    onEmergencyCommand: (command) => {
      console.warn('[AgentManagement] Emergency command executed:', command.type);
    },
  });

  await service.initialize();
  return service;
}

export default AgentManagementService;
