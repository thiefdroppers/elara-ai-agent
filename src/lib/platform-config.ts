/**
 * Elara Platform Configuration - Centralized Service Endpoints
 *
 * SINGLE SOURCE OF TRUTH for all backend service URLs and API keys.
 * Update endpoints here - all services inherit from this config.
 *
 * SECURITY: API keys are loaded from Chrome storage or build-time env vars.
 * Never commit actual API keys to source control.
 *
 * Production Services:
 * - AI Nucleus (GKE): GPU-accelerated multimodal inference (Llama, Vision, Reasoning)
 * - E-BRAIN (Cloud Run): Bio-inspired memory with STDP/Hebbian learning
 * - Valkey (GKE): In-memory vector store for semantic search
 */

// ============================================================================
// SECURITY: Runtime API Key Configuration
// ============================================================================
// API keys should be injected at build time via DefinePlugin or loaded from
// Chrome storage API. These defaults are placeholders for development only.
// For production: Set ELARA_NUCLEUS_API_KEY and ELARA_EBRAIN_API_KEY env vars
// during the build process (vite.config.ts DefinePlugin).

const getEnvVar = (key: string, fallback: string): string => {
  // Check for build-time injected values (vite DefinePlugin)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const envValue = (import.meta.env as Record<string, string>)[key];
    if (envValue && envValue !== 'undefined') return envValue;
  }
  // Fallback for development (will be logged as warning)
  if (fallback.includes('_PLACEHOLDER_')) {
    console.warn(`[SECURITY] ${key} not configured - using development placeholder`);
  }
  return fallback;
};

// ============================================================================
// AI NUCLEUS - Multimodal LLM Service (GKE T4 GPU)
// ============================================================================

export const AI_NUCLEUS_CONFIG = {
  // HTTP endpoint via DNS (updated 2025-12-18)
  // DNS: enn.oelara.com -> 34.19.37.0 (LoadBalancer IP, no SSL yet)
  baseURL: 'http://enn.oelara.com:8200',
  // Fallback: Direct LoadBalancer IP
  fallbackURL: 'http://34.19.37.0:8200',
  // Internal cluster URL (for K8s-to-K8s communication)
  internalURL: 'http://ai-nucleus.ai-nucleus.svc:8200',
  // SECURITY: API key loaded from environment variable at build time
  apiKey: getEnvVar('VITE_NUCLEUS_API_KEY', process.env.NUCLEUS_API_KEY || 'NUCLEUS_API_KEY_PLACEHOLDER'),
  timeout: 120000, // 120s for GPU inference (increased for complex analysis)
  maxRetries: 3,

  // Endpoints
  endpoints: {
    health: '/health',
    chat: '/api/v1/chat', // Llama-3.2-3B (Tier 1)
    complete: '/api/v1/complete',
    embeddings: '/api/v1/embeddings',
    embeddingsSingle: '/api/v1/embeddings/single',

    // Smart Router (AI Nucleus Brain) - UNIFIED ENTRY POINT
    // Just send your query here - it handles all routing automatically
    smartAnalyze: '/api/v1/smart/analyze', // Universal analysis endpoint
    smartHealth: '/api/v1/smart/health',
    smartIntents: '/api/v1/smart/intents',

    // Multi-LLM Endpoints (legacy - prefer Smart Router)
    smartChat: '/api/v1/smart-chat', // Auto-routes to appropriate tier
    reason: '/api/v1/reason', // DeepSeek-R1 (Tier 2)
    visionAnalyze: '/api/v1/vision/analyze', // Qwen2.5-VL (Tier 3)
    visionDeepfake: '/api/v1/vision/deepfake',
    visionScreenshot: '/api/v1/vision/screenshot',
    visionHealth: '/api/v1/vision/health',
    // Hybrid Deepfake (ViT + VLM)
    hybridDeepfake: '/api/v1/deepfake/hybrid-detect',
    deepfakeHealth: '/api/v1/deepfake/health',
    // Audio Endpoints (Whisper)
    audioTranscribe: '/api/v1/audio/transcribe',
    audioScamDetect: '/api/v1/audio/scam-detect',
    audioHealth: '/api/v1/audio/health',
    // Social Profile Analysis (Sherlock)
    socialAnalyze: '/api/v1/social/analyze',
    socialQuickCheck: '/api/v1/social/quick-check',
    socialHealth: '/api/v1/social/health',
  },

  // Model Tiers
  models: {
    tier1: 'Llama-3.2-3B-Instruct', // Fast chat/completion
    tier2: 'DeepSeek-R1-Distill-Qwen-7B', // Complex reasoning
    tier3: 'Qwen2.5-VL-3B-Instruct', // Vision/multimodal
    audio: 'Whisper-medium', // Audio transcription
    social: 'Sherlock + ML', // Social profile analysis
  },
} as const;

// ============================================================================
// E-BRAIN - Bio-Inspired Memory Platform (Cloud Run)
// ============================================================================

export const EBRAIN_CONFIG = {
  // HTTPS endpoint via Global LB (Google-managed SSL)
  // DNS: brain.oelara.com -> 34.117.231.245
  baseURL: 'https://brain.oelara.com',
  // Fallback: Direct Cloud Run URL
  fallbackURL: 'https://e-brain-dashboard-122460113662.us-west1.run.app',
  // SECURITY: API key loaded from environment variable at build time
  apiKey: getEnvVar('VITE_EBRAIN_API_KEY', process.env.EBRAIN_API_KEY || 'EBRAIN_API_KEY_PLACEHOLDER'),
  agentId: getEnvVar('VITE_EBRAIN_AGENT_ID', process.env.EBRAIN_AGENT_ID || 'elara_ai_agent_v2'),
  timeout: 10000,
  maxRetries: 3,

  // Endpoints
  endpoints: {
    health: '/api/v1/health',
    memories: '/api/v1/memories',
    memoriesSearch: '/api/v1/memories/search',
    agentOnboard: '/api/v1/agents/onboard',
    agentMemories: (agentId: string) => `/api/v1/agents/${agentId}/memories`,
    learning: '/api/v1/learning/metrics',

    // Agent Admin endpoints (Dashboard UI - require admin auth)
    adminPersona: '/api/v1/admin/agent/persona',
    adminPersonaTemplates: '/api/v1/admin/agent/persona/templates',
    adminPersonaGeneratePrompt: '/api/v1/admin/agent/persona/generate-prompt',
    adminKnowledgeEntries: '/api/v1/admin/agent/knowledge/entry',
    adminKnowledgeQA: '/api/v1/admin/agent/knowledge/qa',
    adminKnowledgeURL: '/api/v1/admin/agent/knowledge/url',
    adminActions: '/api/v1/admin/agent/actions',
    adminTriggers: '/api/v1/admin/agent/triggers',
    adminTools: '/api/v1/admin/agent/tools',
    adminStatus: '/api/v1/admin/agent/status',
    adminTrainingSession: '/api/v1/admin/agent/training/session',
    adminTrainingFeedback: '/api/v1/admin/agent/training/feedback',

    // Agent Sync endpoints (API Key Access - for AI Agent to fetch config)
    syncPersona: '/api/v1/admin/agent/sync/persona',
    syncKnowledge: '/api/v1/admin/agent/sync/knowledge',
    syncActions: '/api/v1/admin/agent/sync/actions',
    syncTriggers: '/api/v1/admin/agent/sync/triggers',
    syncTools: '/api/v1/admin/agent/sync/tools',
    syncAll: '/api/v1/admin/agent/sync/all',
  },
} as const;

// ============================================================================
// AGENT ORCHESTRATOR - Autonomous Browser Agent Service (GCE VM)
// ============================================================================

export const AGENT_ORCHESTRATOR_CONFIG = {
  // HTTPS endpoint via Global LB (Google-managed SSL)
  // DNS: agent.oelara.com -> 136.110.244.235
  baseURL: 'https://agent.oelara.com',
  timeout: 300000, // 5 minutes for autonomous tasks
  maxRetries: 2,

  // VNC Stream URL for live browser view (still HTTP for now)
  vncURL: 'http://136.117.113.106:6080',

  // Endpoints
  endpoints: {
    health: '/health',
    createTask: '/api/v1/tasks',
    getTask: (taskId: string) => `/api/v1/tasks/${taskId}`,
    cancelTask: (taskId: string) => `/api/v1/tasks/${taskId}`,
    taskStream: (taskId: string) => `/api/v1/tasks/${taskId}/stream`,
  },

  // WebSocket URL (WSS for secure)
  wsBaseURL: 'wss://agent.oelara.com',
} as const;

// ============================================================================
// FALLBACK SERVICES
// ============================================================================

export const FALLBACK_CONFIG = {
  gemini: {
    endpoint: 'https://dev-api.thiefdroppers.com/api/v2/ai/chat',
    timeout: 30000,
  },
} as const;

// ============================================================================
// COMBINED PLATFORM CONFIG
// ============================================================================

export const PLATFORM_CONFIG = {
  aiNucleus: AI_NUCLEUS_CONFIG,
  eBrain: EBRAIN_CONFIG,
  agentOrchestrator: AGENT_ORCHESTRATOR_CONFIG,
  fallback: FALLBACK_CONFIG,
} as const;

export default PLATFORM_CONFIG;
