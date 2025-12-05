/**
 * Elara AI Agent - Type Definitions
 */

// ============================================================================
// CHAT TYPES
// ============================================================================

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  intent?: Intent;
  scanResult?: ScanResult;
  threatCard?: ThreatCard;
  processing?: boolean;
  error?: string;
  functionCalled?: string;
  functionResult?: any;
  tokensGenerated?: number;
  latency?: number;
}

// ============================================================================
// INTENT TYPES
// ============================================================================

export type Intent =
  | 'scan_url'
  | 'deep_scan'
  | 'fact_check'
  | 'deepfake'
  | 'explain'
  | 'general_chat';

export interface IntentClassification {
  intent: Intent;
  confidence: number;
  entities: Record<string, string>;
  requiredFamilies?: string[];
}

// ============================================================================
// SCAN TYPES
// ============================================================================

export type Verdict = 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS' | 'UNKNOWN';
export type RiskLevel = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export type Decision = 'ALLOW' | 'WARN' | 'BLOCK';

export interface ScanResult {
  url: string;
  verdict: Verdict;
  riskLevel: RiskLevel;
  riskScore: number;
  confidence: number;
  threatType?: string;
  indicators: ThreatIndicator[];
  reasoning: string[];
  tiMatch?: TICacheHit;
  scanType: 'edge' | 'hybrid' | 'deep';
  latency: number;
  timestamp: number;
}

export interface ThreatIndicator {
  type: string;
  value: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export interface ThreatCard {
  verdict: Verdict;
  riskLevel: RiskLevel;
  riskScore: number;
  threatType?: string;
  indicators: ThreatIndicator[];
  recommendation: string;
}

// ============================================================================
// FEATURE TYPES
// ============================================================================

export interface URLFeatures {
  url: string;
  lexical: LexicalFeatures;
  dom?: DOMFeatures;
  network?: NetworkFeatures;
  tiHit?: TICacheHit;
  extractionTier: 1 | 2 | 3;
  extractionLatency: number;
}

export interface LexicalFeatures {
  url: string;
  length: number;
  entropy: number;
  digitRatio: number;
  symbolRatio: number;
  letterRatio: number;
  nGrams: string[];
  suspiciousKeywords: number;
  hasIPAddress: boolean;
  hasPort: boolean;
  isHTTPS: boolean;
  subdomainCount: number;
  pathDepth: number;
  queryParamCount: number;
  fragmentLength: number;
  tld: string;
  tldRisk: number;
}

export interface DOMFeatures {
  formCount: number;
  formTargetExternal: boolean;
  inputPasswordCount: number;
  scriptCount: number;
  externalScriptCount: number;
  obfuscatedScripts: boolean;
  iframeCount: number;
  hiddenIframeCount: number;
  externalDomains: string[];
  hasLoginForm: boolean;
  hasSocialLogin: boolean;
  metaRefresh: boolean;
  popupCount: number;
}

export interface NetworkFeatures {
  redirectCount: number;
  finalUrl: string;
  tlsValid: boolean;
  mixedContent: boolean;
  responseTime: number;
  statusCode: number;
  certificateAge?: number;
}

// ============================================================================
// TI CACHE TYPES
// ============================================================================

export interface TICacheHit {
  isBlacklisted: boolean;
  isWhitelisted: boolean;
  source: string;
  severity?: string;
  confidence?: number;
  lastUpdated?: number;
}

// ============================================================================
// ML TYPES
// ============================================================================

export interface EdgePrediction {
  probability: number;
  confidence: number;
  models: ModelPredictions;
  reasoning: string[];
  latency: number;
}

export interface ModelPredictions {
  mobilebert?: ModelPrediction;
  pirocheto?: ModelPrediction;
  lexical?: ModelPrediction;
  xgboost?: ModelPrediction;
  lightgbm?: ModelPrediction;
}

export interface ModelPrediction {
  probability: number;
  confidence: number;
  latency: number;
}

export interface EnsembleWeights {
  mobilebert: number;
  pirocheto: number;
  xgboost?: number;
  lightgbm?: number;
}

// ============================================================================
// AGENT TYPES
// ============================================================================

export type AgentState = 'idle' | 'planning' | 'executing' | 'validating' | 'complete' | 'error';

export interface OrchestratorState {
  state: AgentState;
  currentTask?: string;
  progress: number;
  error?: string;
}

export interface AgentAction {
  type: string;
  payload: unknown;
  agentId: string;
  timestamp: number;
}

// ============================================================================
// API TYPES
// ============================================================================

export interface HybridScanRequest {
  url: string;
  features?: Partial<URLFeatures>;
  options?: {
    includeWhois?: boolean;
    includeScreenshot?: boolean;
    maxRedirects?: number;
  };
}

export interface HybridScanResponse {
  requestId: string;
  timestamp: number;
  result: ScanResult;
  processingTimeMs: number;
}

export interface DeepScanRequest {
  url: string;
  depth?: 'standard' | 'comprehensive';
}

export interface DeepScanResponse {
  requestId: string;
  timestamp: number;
  result: ScanResult;
  processingTimeMs: number;
  modelResults?: Record<string, unknown>;
}

export interface TISyncResponse {
  timestamp: number;
  updates: TIUpdate[];
  nextSyncAfter?: number;
}

export interface TIUpdate {
  type: 'add' | 'remove' | 'update';
  category: 'whitelist' | 'blacklist';
  value: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// MESSAGE TYPES
// ============================================================================

export type MessageType =
  | 'CHAT_MESSAGE'
  | 'SCAN_URL'
  | 'DEEP_SCAN'
  | 'GET_CURRENT_TAB'
  | 'SET_AUTH_TOKEN'
  | 'STORE_SECURE'
  | 'GET_SECURE'
  | 'ORCHESTRATOR_STATE'
  | 'AUTO_SCAN';

export interface ExtensionMessage {
  type: MessageType;
  payload?: unknown;
}

export interface ExtensionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
