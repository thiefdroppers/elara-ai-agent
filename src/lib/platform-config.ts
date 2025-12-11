/**
 * Elara Platform Configuration - Centralized Service Endpoints
 *
 * SINGLE SOURCE OF TRUTH for all backend service URLs and API keys.
 * Update endpoints here - all services inherit from this config.
 *
 * Production Services:
 * - AI Nucleus (GKE): GPU-accelerated multimodal inference (Llama, Vision, Reasoning)
 * - E-BRAIN (Cloud Run): Bio-inspired memory with STDP/Hebbian learning
 * - Valkey (GKE): In-memory vector store for semantic search
 */

// ============================================================================
// AI NUCLEUS - Multimodal LLM Service (GKE T4 GPU)
// ============================================================================

export const AI_NUCLEUS_CONFIG = {
  // External LoadBalancer IP (for Chrome Extension access)
  baseURL: 'http://34.187.212.33:8200',
  // Internal cluster URL (for K8s-to-K8s communication)
  internalURL: 'http://ai-nucleus.ai-nucleus.svc:8200',
  apiKey: 'elara_nucleus_2025_secure_key',
  timeout: 60000, // 60s for GPU inference
  maxRetries: 2,

  // Endpoints
  endpoints: {
    health: '/health',
    chat: '/api/v1/chat', // Llama-3.2-3B (Tier 1)
    complete: '/api/v1/complete',
    embeddings: '/api/v1/embeddings',
    embeddingsSingle: '/api/v1/embeddings/single',
    // Multi-LLM Endpoints
    smartChat: '/api/v1/api/v1/smart-chat', // Auto-routes to appropriate tier
    reason: '/api/v1/api/v1/reason', // DeepSeek-R1 (Tier 2)
    visionAnalyze: '/api/v1/api/v1/vision/analyze', // Qwen2.5-VL (Tier 3)
    visionDeepfake: '/api/v1/api/v1/vision/deepfake',
    visionScreenshot: '/api/v1/api/v1/vision/screenshot',
    visionHealth: '/api/v1/api/v1/vision/health',
    // Audio Endpoints (Whisper)
    audioTranscribe: '/api/v1/api/v1/audio/transcribe',
    audioScamDetect: '/api/v1/api/v1/audio/scam-detect',
    audioHealth: '/api/v1/api/v1/audio/health',
    // Social Profile Analysis (Sherlock)
    socialAnalyze: '/api/v1/api/v1/social/analyze',
    socialQuickCheck: '/api/v1/api/v1/social/quick-check',
    socialHealth: '/api/v1/api/v1/social/health',
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
  baseURL: 'https://e-brain-dashboard-122460113662.us-west1.run.app',
  apiKey: 'ebrain_ak_elara_ai_agent_v2_1733531443',
  agentId: 'elara_ai_agent_v2',
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
  },
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
  fallback: FALLBACK_CONFIG,
} as const;

export default PLATFORM_CONFIG;
