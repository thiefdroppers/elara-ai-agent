/**
 * AI Nucleus Multimodal Client
 *
 * Comprehensive client for AI Nucleus multi-LLM inference service:
 * - Tier 1 (Chat): Llama-3.2-3B-Instruct - Fast conversations
 * - Tier 2 (Reasoning): DeepSeek-R1-Distill-Qwen-7B - Complex analysis, math
 * - Tier 3 (Vision): Qwen2.5-VL-3B-Instruct - Image analysis, screenshots
 *
 * Features:
 * - Smart routing via /smart-chat endpoint
 * - Direct tier access for explicit control
 * - Deepfake detection
 * - Screenshot/phishing analysis
 * - Integrated with E-BRAIN memory for context
 */

import { AI_NUCLEUS_CONFIG } from '../platform-config';

// ============================================================================
// TYPES
// ============================================================================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface SmartChatRequest {
  messages: ChatMessage[];
  images?: string[]; // Base64 or URLs (triggers Tier 3 auto-routing)
  max_tokens?: number;
  temperature?: number;
  tier_override?: 'chat' | 'reasoning' | 'vision'; // Force specific tier
}

export interface SmartChatResponse {
  content: string;
  thinking?: string; // Chain-of-thought for reasoning tier
  tier_used: string;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  inference_time_ms: number;
}

export interface ReasoningRequest {
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  enable_cot?: boolean; // Enable chain-of-thought
  stop?: string[];
}

export interface ReasoningResponse {
  content: string;
  thinking?: string;
  finish_reason: string;
  usage: Record<string, number>;
  inference_time_ms: number;
  model: string;
}

export interface VisionRequest {
  image: string; // Base64 or URL
  prompt?: string;
  max_tokens?: number;
  temperature?: number;
}

export interface VisionResponse {
  content: string;
  usage: Record<string, number>;
  inference_time_ms: number;
  model: string;
}

export interface DeepfakeRequest {
  image: string; // Base64 or URL
}

export interface DeepfakeResponse {
  verdict: 'authentic' | 'manipulated' | 'uncertain';
  confidence: string;
  analysis: string;
  model: string;
  inference_time_ms: number;
}

export interface ScreenshotAnalysisRequest {
  image: string; // Base64 screenshot
}

export interface ScreenshotAnalysisResponse {
  risk_level: 'safe' | 'suspicious' | 'dangerous';
  analysis: string;
  model: string;
  inference_time_ms: number;
}

// Audio Analysis Types
export interface AudioTranscribeRequest {
  audio_base64: string;
  filename?: string;
  language?: string;
}

export interface AudioTranscribeResponse {
  text: string;
  language: string;
  duration: number;
  confidence: number;
  inference_time_ms: number;
}

export interface AudioScamRequest {
  audio_base64?: string;
  transcript?: string;
}

export interface AudioScamResponse {
  transcription: string;
  is_scam_probability: number;
  scam_type: string | null;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_indicators: string[];
  recommendation: string;
  inference_time_ms: number;
}

// Social Profile Analysis Types
export interface SocialProfileRequest {
  username: string;
  bio?: string;
  deep_scan?: boolean;
}

export interface SocialProfileResponse {
  username: string;
  platforms_found: number;
  fake_probability: number;
  profile_type: 'legitimate' | 'suspicious' | 'fake' | 'bot' | 'scam';
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_indicators: string[];
  recommendations: string[];
  inference_time_ms: number;
}

export interface SocialQuickCheckResponse {
  username: string;
  risk: 'low' | 'medium' | 'high';
  platforms_found: number;
  suspicious_pattern: boolean;
  indicators: string[];
  inference_time_ms: number;
}

// ============================================================================
// AI NUCLEUS MULTIMODAL CLIENT
// ============================================================================

export class AINucleusMultimodalClient {
  private readonly baseURL: string;
  private readonly apiKey: string;
  private readonly timeout: number;

  constructor(config?: { baseURL?: string; apiKey?: string; timeout?: number }) {
    this.baseURL = config?.baseURL ?? AI_NUCLEUS_CONFIG.baseURL;
    this.apiKey = config?.apiKey ?? AI_NUCLEUS_CONFIG.apiKey;
    this.timeout = config?.timeout ?? AI_NUCLEUS_CONFIG.timeout;
  }

  // --------------------------------------------------------------------------
  // SMART CHAT (Auto-Routes to Appropriate Tier)
  // --------------------------------------------------------------------------

  /**
   * Smart chat that auto-routes to the best model tier based on:
   * - Tier 1 (chat): Simple conversations
   * - Tier 2 (reasoning): Complex analysis, math, coding
   * - Tier 3 (vision): Images, screenshots, deepfake detection
   */
  async smartChat(request: SmartChatRequest): Promise<SmartChatResponse> {
    const url = `${this.baseURL}${AI_NUCLEUS_CONFIG.endpoints.smartChat}`;

    const response = await this.fetch<SmartChatResponse>(url, {
      method: 'POST',
      body: JSON.stringify({
        messages: request.messages,
        images: request.images,
        max_tokens: request.max_tokens ?? 1024,
        temperature: request.temperature ?? 0.7,
        tier_override: request.tier_override,
      }),
    });

    console.log(`[AINucleus] Smart chat used ${response.tier_used} (${response.model})`);
    return response;
  }

  // --------------------------------------------------------------------------
  // TIER 2: REASONING (DeepSeek-R1)
  // --------------------------------------------------------------------------

  /**
   * Complex reasoning with chain-of-thought support.
   * Use for: Math, analysis, coding, multi-step problems.
   */
  async reason(request: ReasoningRequest): Promise<ReasoningResponse> {
    const url = `${this.baseURL}${AI_NUCLEUS_CONFIG.endpoints.reason}`;

    const response = await this.fetch<ReasoningResponse>(url, {
      method: 'POST',
      body: JSON.stringify({
        messages: request.messages,
        max_tokens: request.max_tokens ?? 2048,
        temperature: request.temperature ?? 0.6,
        enable_cot: request.enable_cot ?? true,
        stop: request.stop,
      }),
    });

    if (response.thinking) {
      console.log('[AINucleus] Reasoning with chain-of-thought');
    }
    return response;
  }

  // --------------------------------------------------------------------------
  // TIER 3: VISION (Qwen2.5-VL)
  // --------------------------------------------------------------------------

  /**
   * Analyze an image with a custom prompt.
   * Supports base64 images or URLs.
   */
  async analyzeImage(request: VisionRequest): Promise<VisionResponse> {
    const url = `${this.baseURL}${AI_NUCLEUS_CONFIG.endpoints.visionAnalyze}`;

    return this.fetch<VisionResponse>(url, {
      method: 'POST',
      body: JSON.stringify({
        image: request.image,
        prompt: request.prompt ?? 'Describe this image in detail.',
        max_tokens: request.max_tokens ?? 1024,
        temperature: request.temperature ?? 0.7,
      }),
    });
  }

  /**
   * Detect if an image is a deepfake or has been manipulated.
   */
  async detectDeepfake(image: string): Promise<DeepfakeResponse> {
    const url = `${this.baseURL}${AI_NUCLEUS_CONFIG.endpoints.visionDeepfake}`;

    return this.fetch<DeepfakeResponse>(url, {
      method: 'POST',
      body: JSON.stringify({ image }),
    });
  }

  /**
   * Analyze a screenshot for phishing indicators.
   */
  async analyzeScreenshot(image: string): Promise<ScreenshotAnalysisResponse> {
    const url = `${this.baseURL}${AI_NUCLEUS_CONFIG.endpoints.visionScreenshot}`;

    return this.fetch<ScreenshotAnalysisResponse>(url, {
      method: 'POST',
      body: JSON.stringify({ image }),
    });
  }

  // --------------------------------------------------------------------------
  // AUDIO ANALYSIS (Whisper)
  // --------------------------------------------------------------------------

  /**
   * Transcribe audio using Whisper-medium.
   * GPU accelerated speech-to-text.
   */
  async transcribeAudio(request: AudioTranscribeRequest): Promise<AudioTranscribeResponse> {
    const url = `${this.baseURL}${AI_NUCLEUS_CONFIG.endpoints.audioTranscribe}`;

    return this.fetch<AudioTranscribeResponse>(url, {
      method: 'POST',
      body: JSON.stringify({
        audio_base64: request.audio_base64,
        filename: request.filename ?? 'audio.wav',
        language: request.language,
      }),
    });
  }

  /**
   * Detect scam calls using Whisper + ML classification.
   * Analyzes audio or text for scam indicators.
   */
  async detectScamCall(request: AudioScamRequest): Promise<AudioScamResponse> {
    const url = `${this.baseURL}${AI_NUCLEUS_CONFIG.endpoints.audioScamDetect}`;

    return this.fetch<AudioScamResponse>(url, {
      method: 'POST',
      body: JSON.stringify({
        audio_base64: request.audio_base64,
        transcript: request.transcript,
      }),
    });
  }

  // --------------------------------------------------------------------------
  // SOCIAL PROFILE ANALYSIS (Sherlock)
  // --------------------------------------------------------------------------

  /**
   * Full social profile analysis across 400+ platforms.
   * Detects fake profiles, bots, and scam accounts.
   */
  async analyzeSocialProfile(request: SocialProfileRequest): Promise<SocialProfileResponse> {
    const url = `${this.baseURL}${AI_NUCLEUS_CONFIG.endpoints.socialAnalyze}`;

    return this.fetch<SocialProfileResponse>(url, {
      method: 'POST',
      body: JSON.stringify({
        username: request.username,
        bio: request.bio,
        deep_scan: request.deep_scan ?? false,
      }),
    });
  }

  /**
   * Quick username reputation check.
   * Fast check for real-time use during conversations.
   */
  async quickCheckUsername(username: string): Promise<SocialQuickCheckResponse> {
    const url = `${this.baseURL}${AI_NUCLEUS_CONFIG.endpoints.socialQuickCheck}`;

    return this.fetch<SocialQuickCheckResponse>(url, {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
  }

  // --------------------------------------------------------------------------
  // HEALTH CHECK
  // --------------------------------------------------------------------------

  async healthCheck(): Promise<{
    status: string;
    llm_available: boolean;
    multi_llm_available: boolean;
    model_tiers: typeof AI_NUCLEUS_CONFIG.models;
  }> {
    const url = `${this.baseURL}${AI_NUCLEUS_CONFIG.endpoints.health}`;

    try {
      const response = await this.fetch<{
        status: string;
        llm_available: boolean;
        multi_llm_available: boolean;
      }>(url, { method: 'GET' });

      return {
        ...response,
        model_tiers: AI_NUCLEUS_CONFIG.models,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        llm_available: false,
        multi_llm_available: false,
        model_tiers: AI_NUCLEUS_CONFIG.models,
      };
    }
  }

  // --------------------------------------------------------------------------
  // HTTP CLIENT
  // --------------------------------------------------------------------------

  private async fetch<T>(url: string, options: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI Nucleus error (${response.status}): ${errorText}`);
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('AI Nucleus request timeout');
      }
      throw error;
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let _multimodalClient: AINucleusMultimodalClient | null = null;

export function getMultimodalClient(): AINucleusMultimodalClient {
  if (!_multimodalClient) {
    _multimodalClient = new AINucleusMultimodalClient();
  }
  return _multimodalClient;
}

export function resetMultimodalClient(): void {
  _multimodalClient = null;
}
