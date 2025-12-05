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
 * Sorted by size (smallest to largest)
 */
export const AVAILABLE_MODELS: Record<string, ModelConfig> = {
  // Gemma 2B - Lightest model for low-end devices
  'gemma-2-2b-q4': {
    modelId: 'Gemma-2-2b-it-q4f32_1-MLC',
    displayName: 'Gemma 2 2B (Fast)',
    family: 'gemma',
    size: 1500, // ~1.5GB
    contextWindow: 4096,
    quantization: 'q4f32_1',
    minRAM: 4,
    minVRAM: 0, // Runs on CPU
    avgTokensPerSecond: 80,
    recommended: false,
    description: 'Lightest model. Best for low-end devices. Good quality, fast inference.',
  },

  // Phi-3 Mini - Default recommended model (balanced)
  'phi-3-mini-q4': {
    modelId: 'Phi-3-mini-4k-instruct-q4f32_1-MLC',
    displayName: 'Phi 3 Mini (Recommended)',
    family: 'phi',
    size: 2300, // ~2.3GB
    contextWindow: 4096,
    quantization: 'q4f32_1',
    minRAM: 6,
    minVRAM: 2,
    avgTokensPerSecond: 60,
    recommended: true,
    description: 'Default model. Balanced speed and quality. Optimized for security tasks.',
  },

  // Mistral 7B - High quality alternative
  'mistral-7b-q4': {
    modelId: 'Mistral-7B-Instruct-v0.3-q4f16_1-MLC',
    displayName: 'Mistral 7B (High Quality)',
    family: 'mistral',
    size: 4000, // ~4GB
    contextWindow: 8192,
    quantization: 'q4f16_1',
    minRAM: 8,
    minVRAM: 4,
    avgTokensPerSecond: 45,
    recommended: false,
    description: 'High quality model. Excellent reasoning. Requires more resources.',
  },

  // Llama 3 8B - Best quality (largest)
  'llama-3-8b-q4': {
    modelId: 'Llama-3-8B-Instruct-q4f32_1-MLC',
    displayName: 'Llama 3 8B (Best Quality)',
    family: 'llama',
    size: 5000, // ~5GB
    contextWindow: 8192,
    quantization: 'q4f32_1',
    minRAM: 12,
    minVRAM: 6,
    avgTokensPerSecond: 40,
    recommended: false,
    description: 'Best quality model. Ideal for complex security analysis. Requires high-end hardware.',
  },

  // Qwen 2.5 7B - Alternative high-quality model
  'qwen-2.5-7b-q4': {
    modelId: 'Qwen2.5-7B-Instruct-q4f16_1-MLC',
    displayName: 'Qwen 2.5 7B',
    family: 'qwen',
    size: 4200, // ~4.2GB
    contextWindow: 8192,
    quantization: 'q4f16_1',
    minRAM: 8,
    minVRAM: 4,
    avgTokensPerSecond: 42,
    recommended: false,
    description: 'Qwen 2.5 model. Strong multilingual support and reasoning.',
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
  let recommendedModel = 'phi-3-mini-q4'; // Default

  if (totalRAM < 6 || diskSpace < 5) {
    recommendedModel = 'gemma-2-2b-q4'; // Low-end device
  } else if (totalRAM >= 12 && hasWebGPU && gpuVRAM && gpuVRAM >= 6) {
    recommendedModel = 'llama-3-8b-q4'; // High-end device
  } else if (totalRAM >= 8 && hasWebGPU) {
    recommendedModel = 'mistral-7b-q4'; // Mid-high device
  }

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
