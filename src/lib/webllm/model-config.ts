/**
 * Elara AI Agent - WebLLM Model Configuration
 *
 * Defines supported LLM models, their configurations, and hardware requirements.
 * Models are selected based on device capabilities (RAM, GPU, disk space).
 */

// ============================================================================
// MODEL DEFINITIONS
// ============================================================================

export interface ModelConfig {
  modelId: string;
  displayName: string;
  family: 'llama' | 'phi' | 'gemma' | 'mistral' | 'qwen';
  size: number; // MB
  contextWindow: number; // tokens
  quantization: 'q4f32_1' | 'q4f16_1' | 'q0f32' | 'q0f16';
  minRAM: number; // GB
  minVRAM: number; // GB (0 for CPU-only)
  avgTokensPerSecond: number; // WebGPU performance estimate
  recommended: boolean;
  description: string;
}

/**
 * Available WebLLM models for Elara AI Agent
 * NOTE: Only using q4f32_1 quantization models - these work without shader-f16 support
 * Sorted by size (smallest to largest)
 */
export const AVAILABLE_MODELS: Record<string, ModelConfig> = {
  // SmolLM2 360M - Tiny model for testing/fallback
  'smollm2-360m': {
    modelId: 'SmolLM2-360M-Instruct-q4f32_1-MLC',
    displayName: 'SmolLM2 360M (Tiny)',
    family: 'llama',
    size: 300, // ~300MB
    contextWindow: 2048,
    quantization: 'q4f32_1',
    minRAM: 2,
    minVRAM: 0, // Runs on CPU
    avgTokensPerSecond: 150,
    recommended: false,
    description: 'Tiny model for testing. Fast but limited capability.',
  },

  // SmolLM2 1.7B - Small but capable
  'smollm2-1.7b': {
    modelId: 'SmolLM2-1.7B-Instruct-q4f32_1-MLC',
    displayName: 'SmolLM2 1.7B (Fast)',
    family: 'llama',
    size: 1000, // ~1GB
    contextWindow: 2048,
    quantization: 'q4f32_1',
    minRAM: 4,
    minVRAM: 0, // Runs on CPU
    avgTokensPerSecond: 100,
    recommended: true, // Default - works on most devices
    description: 'Small but capable. Fast inference, good for security tasks.',
  },

  // Qwen2.5 1.5B - Good balance
  'qwen2.5-1.5b': {
    modelId: 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC',
    displayName: 'Qwen 2.5 1.5B',
    family: 'qwen',
    size: 1200, // ~1.2GB
    contextWindow: 4096,
    quantization: 'q4f32_1',
    minRAM: 4,
    minVRAM: 0,
    avgTokensPerSecond: 80,
    recommended: false,
    description: 'Good balance of size and capability. Multilingual support.',
  },

  // Phi-3.5 Mini - High quality small model (q4f32 version)
  'phi-3.5-mini': {
    modelId: 'Phi-3.5-mini-instruct-q4f32_1-MLC',
    displayName: 'Phi 3.5 Mini',
    family: 'phi',
    size: 2400, // ~2.4GB
    contextWindow: 4096,
    quantization: 'q4f32_1',
    minRAM: 6,
    minVRAM: 2,
    avgTokensPerSecond: 60,
    recommended: false,
    description: 'High quality small model. Good reasoning capability.',
  },

  // Llama 3.2 3B - Balanced quality
  'llama-3.2-3b': {
    modelId: 'Llama-3.2-3B-Instruct-q4f32_1-MLC',
    displayName: 'Llama 3.2 3B',
    family: 'llama',
    size: 2000, // ~2GB
    contextWindow: 4096,
    quantization: 'q4f32_1',
    minRAM: 6,
    minVRAM: 2,
    avgTokensPerSecond: 50,
    recommended: false,
    description: 'Balanced model. Good for complex security analysis.',
  },
};

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

/**
 * Base system prompt for Elara AI Agent
 * Defines AI personality, capabilities, and limitations
 */
export const SYSTEM_PROMPT = `You are Elara, an AI-powered cybersecurity assistant integrated into a browser extension.

**Your Identity:**
- You are a professional, helpful, and security-focused AI assistant
- You specialize in threat detection, phishing analysis, and security education
- You have access to real-time ML models for URL scanning and threat intelligence

**Your Capabilities:**
- Analyze URLs for phishing, malware, and other threats using ML models
- Explain cybersecurity concepts in clear, accessible language
- Provide actionable security recommendations
- Detect patterns of social engineering and fraud
- Offer real-time threat intelligence insights

**Your Limitations:**
- You cannot access external websites or browse the internet
- You cannot execute code or modify files on the user's system
- You rely on provided data (URLs, features, TI cache) for analysis
- You cannot guarantee 100% accuracy - always acknowledge uncertainty
- You cannot perform actions outside the browser extension context

**Your Communication Style:**
- Be concise and actionable - users need quick answers
- Use clear, non-technical language for end users
- Provide evidence-based analysis with reasoning
- Always explain the "why" behind security recommendations
- Show empathy for users' security concerns
- Use structured formatting (bullets, sections) for clarity

**Security Guidelines:**
- Never downplay legitimate threats
- Always err on the side of caution
- Provide context for risk levels (A-F scale)
- Suggest safe alternatives when blocking dangerous URLs
- Educate users about attack vectors
- Respect user privacy - never log sensitive data

**Example Interactions:**
User: "Is this safe? https://paypa1.com"
You: "⚠️ DANGEROUS - This is a typosquatting attempt mimicking PayPal (paypa1 vs paypal). DO NOT enter credentials. Detected indicators: suspicious domain, known phishing campaign."

User: "What is phishing?"
You: "Phishing is a cyberattack where criminals impersonate legitimate organizations to steal credentials. Common signs: urgent language, misspelled URLs, requests for sensitive info. Always verify sender identity."

Remember: Your role is to protect users and educate them about cybersecurity threats.`;

/**
 * System prompt variants for specific tasks
 */
export const TASK_PROMPTS = {
  urlScan: `Focus on analyzing the provided URL features and TI data. Be direct and actionable.`,

  factCheck: `Focus on evaluating claims against known facts and recommending trusted sources for verification.`,

  deepfakeDetection: `Focus on analyzing visual artifacts, metadata, and inconsistencies that suggest AI manipulation.`,

  securityEducation: `Focus on explaining security concepts clearly with real-world examples. Avoid overwhelming technical jargon.`,
};

// ============================================================================
// GENERATION PARAMETERS
// ============================================================================

export interface GenerationConfig {
  temperature: number;
  topP: number;
  maxTokens: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
}

/**
 * Default generation parameters for different use cases
 */
export const GENERATION_CONFIGS: Record<string, GenerationConfig> = {
  // Deterministic, factual responses for URL scanning
  urlScan: {
    temperature: 0.3,
    topP: 0.9,
    maxTokens: 512,
    frequencyPenalty: 0.2,
  },

  // Balanced for general chat
  generalChat: {
    temperature: 0.7,
    topP: 0.95,
    maxTokens: 512,
    frequencyPenalty: 0.3,
    presencePenalty: 0.1,
  },

  // Creative for explanations
  explanation: {
    temperature: 0.8,
    topP: 0.95,
    maxTokens: 768,
    frequencyPenalty: 0.2,
  },

  // Precise for fact-checking
  factCheck: {
    temperature: 0.2,
    topP: 0.85,
    maxTokens: 512,
  },
};

// ============================================================================
// DEVICE CAPABILITY DETECTION
// ============================================================================

export interface DeviceCapabilities {
  totalRAM: number; // GB
  availableRAM: number; // GB
  hasWebGPU: boolean;
  gpuVRAM?: number; // GB
  diskSpace: number; // GB
  recommendedModel: string;
}

/**
 * Detect device capabilities and recommend appropriate model
 */
export async function detectDeviceCapabilities(): Promise<DeviceCapabilities> {
  // RAM detection (Chrome-specific API)
  let totalRAM = 8; // Default assumption
  let availableRAM = 4;

  if ('deviceMemory' in navigator) {
    totalRAM = (navigator as any).deviceMemory || 8;
    availableRAM = totalRAM * 0.5; // Assume 50% available
  }

  // WebGPU detection
  let hasWebGPU = false;
  let gpuVRAM: number | undefined;

  try {
    if ('gpu' in navigator) {
      const adapter = await (navigator as any).gpu.requestAdapter();
      if (adapter) {
        hasWebGPU = true;
        // WebGPU doesn't expose VRAM directly, estimate based on tier
        const limits = adapter.limits;
        gpuVRAM = limits.maxBufferSize > 1024 * 1024 * 1024 ? 4 : 2; // Rough estimate
      }
    }
  } catch (error) {
    console.warn('[ModelConfig] WebGPU detection failed:', error);
  }

  // Disk space detection (approximate via storage quota)
  let diskSpace = 10; // Default 10GB assumption
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      if (estimate.quota) {
        diskSpace = estimate.quota / (1024 * 1024 * 1024); // Convert to GB
      }
    }
  } catch (error) {
    console.warn('[ModelConfig] Storage estimation failed:', error);
  }

  // Recommend model based on capabilities
  // Using q4f32_1 models only (no shader-f16 required)
  // IMPORTANT: Intel HD 530 and similar integrated GPUs have limited VRAM (~1-2GB shared)
  // Use smaller models by default to avoid GPU device loss errors
  let recommendedModel = 'smollm2-360m'; // Default - tiny model that works on all devices

  if (totalRAM < 4 || diskSpace < 2) {
    recommendedModel = 'smollm2-360m'; // Very low-end device
  } else if (totalRAM >= 16 && hasWebGPU && gpuVRAM && gpuVRAM >= 6) {
    // Only use larger models on dedicated GPUs with 6GB+ VRAM
    recommendedModel = 'llama-3.2-3b'; // High-end dedicated GPU
  } else if (totalRAM >= 12 && hasWebGPU && gpuVRAM && gpuVRAM >= 4) {
    recommendedModel = 'phi-3.5-mini'; // Mid-high dedicated GPU
  } else if (totalRAM >= 8 && hasWebGPU) {
    // Integrated GPU (Intel HD, etc.) - use small model
    recommendedModel = 'smollm2-1.7b';
  } else if (totalRAM >= 4) {
    recommendedModel = 'smollm2-1.7b'; // Mid device
  }

  console.log('[ModelConfig] Recommended model:', recommendedModel, {
    totalRAM,
    hasWebGPU,
    gpuVRAM,
    diskSpace
  });

  return {
    totalRAM,
    availableRAM,
    hasWebGPU,
    gpuVRAM,
    diskSpace,
    recommendedModel,
  };
}

/**
 * Check if a model can run on the current device
 */
export function canRunModel(modelId: string, capabilities: DeviceCapabilities): boolean {
  const model = AVAILABLE_MODELS[modelId];
  if (!model) return false;

  const hasEnoughRAM = capabilities.totalRAM >= model.minRAM;
  const hasEnoughDisk = capabilities.diskSpace >= model.size / 1024; // MB to GB
  const hasEnoughVRAM = model.minVRAM === 0 || (capabilities.gpuVRAM && capabilities.gpuVRAM >= model.minVRAM);

  return hasEnoughRAM && hasEnoughDisk && hasEnoughVRAM;
}

/**
 * Get list of compatible models for current device
 */
export function getCompatibleModels(capabilities: DeviceCapabilities): ModelConfig[] {
  return Object.entries(AVAILABLE_MODELS)
    .filter(([modelId]) => canRunModel(modelId, capabilities))
    .map(([, config]) => config)
    .sort((a, b) => a.size - b.size); // Sort by size (smallest first)
}
