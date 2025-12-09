/**
 * Elara AI Agent - LLM Module
 *
 * E-BRAIN V3 LLM Layer with:
 * - 3-tier fallback: Neural Service (GKE) -> WebLLM (browser) -> Gemini (cloud)
 * - Memory context injection from E-BRAIN
 * - System prompts with 16 tool definitions
 */

export {
  NeuralLLMClient,
  neuralLLMClient,
  type MemoryContext,
  type NeuralLLMClientConfig,
  type GenerateOptions,
  type GenerateResult,
  type HealthStatus,
} from './neural-llm-client';

// E-BRAIN V3 System Prompts
export {
  ELARA_BASE_PROMPT,
  V3_TOOL_DEFINITIONS_PROMPT,
  MEMORY_CONTEXT_TEMPLATE,
  ELARA_V3_SYSTEM_PROMPT,
  SCAN_SPECIALIST_PROMPT,
  COUNSELING_SPECIALIST_PROMPT,
  TROUBLESHOOT_SPECIALIST_PROMPT,
} from './system-prompts';
