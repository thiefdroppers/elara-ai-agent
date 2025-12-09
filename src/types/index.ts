/**
 * Elara Edge Engine - Type Definitions
 */

// ============================================================================
// SCAN TYPES
// ============================================================================

export type ScanMode = 'edge' | 'hybrid' | 'deep';
export type RiskLevel = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export type Verdict = 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS' | 'UNKNOWN';
export type Decision = 'ALLOW' | 'WARN' | 'BLOCK';

export interface ScanContext {
  tabId?: number;
  frameId?: number;
  triggeredBy: 'navigation' | 'manual' | 'api' | 'content-script';
  privacyMode?: 'normal' | 'strict';
  timestamp?: number;
}

export interface ScanResult {
  url: string;
  verdict: Verdict;
  riskScore: number;          // 0-100
  riskLevel: RiskLevel;
  confidence: number;         // 0-1
  confidenceInterval: [number, number];
  decision: Decision;
  reasoning: string[];
  models: ModelPredictions;
  source: ScanMode;
  latency: number;            // ms
  timestamp: string;
  cached?: boolean;
}

// ============================================================================
// FEATURE TYPES
// ============================================================================

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
  tlsVersion?: string;
  certificateIssuer?: string;
  certificateAge?: number;
  mixedContent: boolean;
  responseTime: number;
  statusCode: number;
}

export interface TICacheHit {
  isBlacklisted: boolean;
  isWhitelisted: boolean;
  source: string;
  lastSeen: Date;
  confidence: number;
  severity?: string; // HIGH, MEDIUM, LOW for blacklisted entries
}

export interface URLFeatures {
  url: string;
  lexical: LexicalFeatures;
  dom?: DOMFeatures;
  network?: NetworkFeatures;
  tiHit?: TICacheHit;
  extractionTier: 1 | 2 | 3;
  extractionLatency: number;
}

// ============================================================================
// MODEL TYPES
// ============================================================================

export interface ModelPrediction {
  probability: number;    // 0-1 (phishing probability)
  confidence: number;     // 0-1 (prediction confidence)
  latency: number;        // ms
}

export interface ModelPredictions {
  // Primary models (MobileBERT + pirocheto ensemble)
  mobilebert?: ModelPrediction;
  pirocheto?: ModelPrediction;
  // Legacy models (XGBoost/LightGBM - DEPRECATED, DO NOT USE)
  xgboost?: ModelPrediction;
  lightgbm?: ModelPrediction;
  // Other legacy models (not currently used)
  distilbert?: ModelPrediction;
  lexical?: ModelPrediction;
  tfidf?: ModelPrediction;
}

export interface EdgePrediction {
  probability: number;
  confidence: number;
  severity?: string; // HIGH, MEDIUM, LOW for blacklisted entries
  models: ModelPredictions;
  reasoning: string[];
  latency: number;
}

export interface EnsembleWeights {
  // Primary models (MobileBERT + pirocheto ensemble)
  mobilebert?: number;
  pirocheto?: number;
  // Legacy weights (XGBoost/LightGBM - DEPRECATED, DO NOT USE)
  xgboost?: number;
  lightgbm?: number;
  // Other legacy weights
  distilbert?: number;
  lexical?: number;
  tfidf?: number;
}

// ============================================================================
// ROUTING TYPES
// ============================================================================

export interface RoutingDecision {
  mode: ScanMode;
  reason: string;
  shouldCache: boolean;
  priority: 'low' | 'medium' | 'high';
}

export interface ConfidenceThresholds {
  high: number;     // Edge-only threshold
  medium: number;   // Hybrid threshold
}

// ============================================================================
// CLOUD API TYPES
// ============================================================================

export interface HybridRequest {
  url: string;
  edgePrediction: EdgePrediction;
  features: URLFeatures;
}

export interface HybridResponse {
  edge: EdgePrediction;
  cloud: {
    tiData: TIData;
    externalAPIs?: ExternalAPIResults;
    cloudModels?: ModelPredictions;
  };
  fused: FusedPrediction;
}

export interface TIData {
  blacklistHits: number;
  whitelistHits: number;
  sources: string[];
  domainAge?: number;
  registrar?: string;
}

export interface ExternalAPIResults {
  virustotal?: {
    positives: number;
    total: number;
    scanDate: string;
  };
  googleSafeBrowsing?: {
    matches: string[];
    threatTypes: string[];
  };
}

export interface FusedPrediction {
  probability: number;
  confidence: number;
  severity?: string; // HIGH, MEDIUM, LOW for blacklisted entries
  riskLevel: RiskLevel;
  decision: Decision;
  reasoning: string[];
  latency: {
    edge: number;
    cloud: number;
    total: number;
  };
}

export interface DeepScanResult {
  url: string;
  verdict: Verdict;
  riskScore: number;
  riskLevel: RiskLevel;
  confidence: number;
  severity?: string; // HIGH, MEDIUM, LOW for blacklisted entries
  confidenceInterval: [number, number];
  decision: Decision;
  reasoning: string[];
  models: Record<string, { probability: number; confidence: number; latency: number }>;
  source: ScanMode;
  latency: number;
  timestamp: string;

  // Scanner V2 Extended Data (optional - populated on deep scan)
  scannerV2Data?: ScannerV2Data;

  // Legacy fields (deprecated)
  evidence?: Evidence;
  tiMatches?: TIMatch[];
  summary?: string;
}

// Scanner V2 Full Scan Response Data
export interface ScannerV2Data {
  scanId?: string;
  stage1?: Record<string, { probability: number; confidence: number; method?: string }>;
  stage2?: Record<string, { probability: number; confidence: number; method?: string }>;
  threatIntel?: {
    hits: number;
    verdict: string;
    sources?: Array<{ source: string; verdict: string; severity?: string }>;
  };
  granularChecks?: Array<{
    category: string;
    name: string;
    status: string;
    severity?: string;
    description?: string;
    points?: number;
    recommendation?: string;
  }>;
  categoryResults?: {
    totalPoints: number;
    totalPossible: number;
    riskFactor: number;
    categories?: Array<{
      categoryName: string;
      points: number;
      maxPoints: number;
      percentage: number;
    }>;
  };
  enhancedChecks?: {
    allFindings?: Array<{
      service: string;
      check: string;
      status: string;
      details?: string;
    }>;
  };
  evidenceSummary?: {
    domainAge?: number;
    tlsValid?: boolean;
    tiHits?: number;
    hasLoginForm?: boolean;
    autoDownload?: boolean;
  };
  aiSummary?: {
    explanation?: string;
    keyFindings?: string[];
    riskAssessment?: string;
    recommendedActions?: string[];
  };
  finalVerdict?: {
    verdict: string;
    trustScore: number;
    summary: string;
    recommendation: string;
    positiveHighlights?: string[];
    negativeHighlights?: string[];
    badges?: Array<{ type: string; icon: string; text: string }>;
  };
  decisionGraph?: Array<{
    stage: string;
    status: string;
    riskContribution: number;
  }>;
}

export interface Evidence {
  screenshot?: string;       // Base64
  html?: string;            // Sanitized HTML
  har?: object;             // HTTP Archive
  cookies?: string[];
  redirectChain: string[];
}

export interface TIMatch {
  source: string;
  type: 'blacklist' | 'whitelist';
  indicator: string;
  lastSeen: string;
  confidence: number;
  severity?: string; // HIGH, MEDIUM, LOW for blacklisted entries
}

// ============================================================================
// CACHE TYPES
// ============================================================================

export interface CacheEntry {
  url: string;
  urlHash: string;
  result: ScanResult;
  createdAt: number;
  expiresAt: number;
}

export interface TICacheEntry {
  hash: string;
  isBlacklisted: boolean;
  isWhitelisted: boolean;
  source: string;
  confidence: number;
  severity?: string; // HIGH, MEDIUM, LOW for blacklisted entries
  updatedAt: number;
}

export interface ModelCacheEntry {
  name: string;
  version: string;
  data: ArrayBuffer;
  checksum: string;
  cachedAt: number;
}

// ============================================================================
// SETTINGS TYPES
// ============================================================================

export interface UserSettings {
  privacyMode: 'normal' | 'strict';
  enableTelemetry: boolean;
  enableWebGPU: boolean;
  enableGeminiNano: boolean;
  autoScan: boolean;
  showWarnings: boolean;
  warningStyle: 'banner' | 'overlay' | 'popup';
  confidenceThresholds: ConfidenceThresholds;
}

export const DEFAULT_SETTINGS: UserSettings = {
  privacyMode: 'normal',
  enableTelemetry: true,
  enableWebGPU: true,
  enableGeminiNano: true,  // Enabled by default - Chrome's Built-in AI for borderline cases
  autoScan: true,
  showWarnings: true,
  warningStyle: 'banner',
  confidenceThresholds: {
    high: 0.90,
    medium: 0.70,
  },
};

// ============================================================================
// MESSAGE TYPES
// ============================================================================

export type MessageAction =
  | 'scanURL'
  | 'deepScan'      // Full Scanner V2 deep scan
  | 'getResult'
  | 'getHistory'
  | 'updateSettings'
  | 'getSettings'
  | 'clearCache'
  | 'syncTI'
  | 'extractFeatures'
  | 'getProfile'
  | 'saveProfile'
  | 'updateProfile'
  | 'addToWhitelist'
  | 'removeFromWhitelist'
  | 'addToBlacklist'
  | 'removeFromBlacklist'
  | 'clearProfile'
  | 'syncProfile'
  | 'preloadModels'        // Preload AI models (Start Elara AI button)
  | 'getAIStatus'          // Get AI model loading status
  | 'warningAcknowledged'  // User acknowledged warning banner
  | 'pageReady'            // Content script signals page is ready
  | 'scanResultUpdated';   // Service worker broadcasts scan result update

export interface Message<T = unknown> {
  action: MessageAction;
  payload?: T;
}

export interface ScanURLPayload {
  url: string;
  context: ScanContext;
}

export interface GetHistoryPayload {
  limit?: number;
  offset?: number;
}

export interface ExtractFeaturesPayload {
  url: string;
  tier: 1 | 2 | 3;
}

// ============================================================================
// WORKER TYPES
// ============================================================================

export type WorkerMessageType =
  | 'loadModel'
  | 'runInference'
  | 'modelLoaded'
  | 'inferenceResult'
  | 'error';

export interface WorkerMessage<T = unknown> {
  type: WorkerMessageType;
  id: string;
  payload?: T;
}

export interface LoadModelPayload {
  name: string;
  data: ArrayBuffer;
}

export interface RunInferencePayload {
  modelName: string;
  inputs: Record<string, Float32Array | BigInt64Array>;
}

export interface InferenceResultPayload {
  modelName: string;
  outputs: Record<string, Float32Array>;
  latency: number;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type AsyncResult<T, E = Error> = Promise<
  { success: true; data: T } | { success: false; error: E }
>;
