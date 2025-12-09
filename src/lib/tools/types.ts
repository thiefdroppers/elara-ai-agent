/**
 * Elara AI Agent - Security Tools Type Definitions
 *
 * OpenAI-compatible tool definitions for Elara's 16+ security features.
 * Used by the LLM for function calling.
 */

// ============================================================================
// CORE TYPES
// ============================================================================

export type ToolResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    latencyMs: number;
    source: string;
    cached?: boolean;
  };
};

export type ToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, ParameterDefinition>;
      required: string[];
    };
  };
};

export type ParameterDefinition = {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: string[];
  items?: { type: string };
  default?: unknown;
};

// ============================================================================
// SCAN TOOLS
// ============================================================================

export interface ScanUrlInput {
  url: string;
  scanType?: 'edge' | 'hybrid' | 'deep';
  includeScreenshot?: boolean;
}

export interface ScanUrlResult {
  url: string;
  verdict: 'safe' | 'suspicious' | 'dangerous' | 'phishing';
  riskLevel: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  confidence: number;
  threatTypes: string[];
  scanType: string;
  latencyMs: number;
  details?: {
    domainAge?: number;
    hasSSL?: boolean;
    redirectCount?: number;
    suspiciousPatterns?: string[];
  };
}

export interface ScanMessageInput {
  message: string;
  context?: 'email' | 'sms' | 'chat' | 'social';
}

export interface ScanMessageResult {
  verdict: 'legitimate' | 'suspicious' | 'scam';
  confidence: number;
  indicators: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  suggestedAction: string;
  extractedUrls?: string[];
  extractedEntities?: {
    phoneNumbers?: string[];
    emails?: string[];
    organizations?: string[];
  };
}

// ============================================================================
// FACT CHECK & VERIFICATION
// ============================================================================

export interface FactCheckInput {
  claim: string;
  sources?: string[];
  context?: string;
}

export interface FactCheckResult {
  verdict: 'true' | 'false' | 'misleading' | 'unverifiable';
  confidence: number;
  explanation: string;
  sources: Array<{
    url: string;
    title: string;
    reliability: 'high' | 'medium' | 'low';
  }>;
  relatedClaims?: string[];
}

export interface VerifyCompanyInput {
  companyName: string;
  domain?: string;
  country?: string;
}

export interface VerifyCompanyResult {
  verified: boolean;
  confidence: number;
  companyInfo?: {
    legalName: string;
    registrationNumber?: string;
    foundedDate?: string;
    headquarters?: string;
    industry?: string;
    employees?: string;
    website?: string;
  };
  redFlags: string[];
  sources: string[];
}

export interface CheckSocialProfileInput {
  platform: 'twitter' | 'linkedin' | 'facebook' | 'instagram' | 'tiktok';
  profileUrl?: string;
  username?: string;
}

export interface CheckSocialProfileResult {
  authentic: boolean;
  confidence: number;
  profileInfo: {
    username: string;
    displayName?: string;
    followers?: number;
    accountAge?: string;
    verifiedBadge?: boolean;
  };
  riskIndicators: string[];
  recommendation: string;
}

// ============================================================================
// DETECTION TOOLS
// ============================================================================

export interface DetectDeepfakeInput {
  imageUrl?: string;
  imageBase64?: string;
  analysisLevel?: 'quick' | 'standard' | 'thorough';
}

export interface DetectDeepfakeResult {
  verdict: 'authentic' | 'likely_manipulated' | 'deepfake';
  confidence: number;
  analysis: string;
  indicators: Array<{
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  techniquesDetected?: string[];
}

export interface DetectRemoteSoftwareInput {
  // Uses browser extension APIs - no direct input needed
  includeActiveConnections?: boolean;
}

export interface DetectRemoteSoftwareResult {
  detected: boolean;
  activeSoftware: Array<{
    name: string;
    type: 'remote_access' | 'screen_share' | 'vnc' | 'rdp';
    riskLevel: 'low' | 'medium' | 'high';
    description: string;
  }>;
  recommendation: string;
  totalRiskScore: number;
}

export interface ReverseImageSearchInput {
  imageUrl?: string;
  imageBase64?: string;
}

export interface ReverseImageSearchResult {
  matches: Array<{
    url: string;
    similarity: number;
    source: string;
    title?: string;
    uploadDate?: string;
  }>;
  originalSource?: {
    url: string;
    date: string;
    confidence: number;
  };
  stockPhoto: boolean;
  recommendation: string;
}

// ============================================================================
// CRYPTO & FINANCIAL
// ============================================================================

export interface CheckCryptoInput {
  address?: string;
  transactionHash?: string;
  network?: 'bitcoin' | 'ethereum' | 'solana' | 'polygon' | 'auto';
}

export interface CheckCryptoResult {
  valid: boolean;
  network: string;
  addressInfo?: {
    balance?: string;
    transactionCount?: number;
    firstSeen?: string;
    lastSeen?: string;
  };
  riskAssessment: {
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    flags: string[];
    sanctioned: boolean;
    mixerUsed: boolean;
    associatedScams?: string[];
  };
  recommendation: string;
}

export interface CheckPhoneNumberInput {
  phoneNumber: string;
  countryCode?: string;
}

export interface CheckPhoneNumberResult {
  valid: boolean;
  formatted: string;
  country: string;
  carrier?: string;
  lineType: 'mobile' | 'landline' | 'voip' | 'toll_free' | 'unknown';
  riskIndicators: string[];
  spamReports?: number;
  recommendation: string;
}

// ============================================================================
// ASSISTANCE TOOLS
// ============================================================================

export interface CounselingChatInput {
  userMessage: string;
  context?: 'scam_victim' | 'identity_theft' | 'financial_fraud' | 'general';
  previousMessages?: Array<{ role: string; content: string }>;
}

export interface CounselingChatResult {
  response: string;
  resourceLinks: Array<{
    title: string;
    url: string;
    type: 'report' | 'support' | 'recovery' | 'prevention';
  }>;
  suggestedActions: string[];
  escalationNeeded: boolean;
  followUpQuestions?: string[];
}

export interface L1TroubleshootInput {
  issue: string;
  category?: 'account' | 'device' | 'network' | 'privacy' | 'malware' | 'general';
  deviceType?: 'windows' | 'mac' | 'android' | 'ios' | 'linux';
}

export interface L1TroubleshootResult {
  diagnosis: string;
  steps: Array<{
    stepNumber: number;
    instruction: string;
    screenshot?: string;
    warningLevel?: 'info' | 'caution' | 'danger';
  }>;
  estimatedTime: string;
  difficulty: 'easy' | 'medium' | 'advanced';
  professionalHelpNeeded: boolean;
  additionalResources?: string[];
}

export interface PasswordVaultInput {
  action: 'generate' | 'check_strength' | 'check_breach';
  password?: string;
  length?: number;
  options?: {
    uppercase?: boolean;
    lowercase?: boolean;
    numbers?: boolean;
    symbols?: boolean;
    excludeAmbiguous?: boolean;
  };
}

export interface PasswordVaultResult {
  action: string;
  generatedPassword?: string;
  strength?: {
    score: number;
    level: 'very_weak' | 'weak' | 'fair' | 'strong' | 'very_strong';
    feedback: string[];
    crackTime: string;
  };
  breachStatus?: {
    breached: boolean;
    breachCount?: number;
    recommendation: string;
  };
}

// ============================================================================
// MEMORY TOOLS (E-BRAIN Integration)
// ============================================================================

export interface SearchMemoriesInput {
  query: string;
  memoryTypes?: Array<'episodic' | 'semantic' | 'procedural' | 'working' | 'learned'>;
  limit?: number;
  minSimilarity?: number;
}

export interface SearchMemoriesResult {
  memories: Array<{
    id: string;
    type: string;
    content: string;
    importance: number;
    similarity: number;
    timestamp: number;
  }>;
  totalFound: number;
  suggestedActions?: string[];
}

export interface StoreMemoryInput {
  content: string;
  memoryType: 'episodic' | 'semantic' | 'procedural' | 'learned';
  importance?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface StoreMemoryResult {
  stored: boolean;
  memoryId: string;
  learningTriggered: boolean;
}

// ============================================================================
// TOOL REGISTRY
// ============================================================================

export type ToolName =
  | 'scan_url'
  | 'scan_message'
  | 'fact_check'
  | 'counseling_chat'
  | 'check_crypto'
  | 'detect_remote_software'
  | 'password_vault'
  | 'l1_troubleshoot'
  | 'check_social_profile'
  | 'verify_company'
  | 'detect_deepfake'
  | 'reverse_image_search'
  | 'check_phone_number'
  | 'search_memories'
  | 'store_memory'
  | 'get_agent_status';

export type ToolInputMap = {
  scan_url: ScanUrlInput;
  scan_message: ScanMessageInput;
  fact_check: FactCheckInput;
  counseling_chat: CounselingChatInput;
  check_crypto: CheckCryptoInput;
  detect_remote_software: DetectRemoteSoftwareInput;
  password_vault: PasswordVaultInput;
  l1_troubleshoot: L1TroubleshootInput;
  check_social_profile: CheckSocialProfileInput;
  verify_company: VerifyCompanyInput;
  detect_deepfake: DetectDeepfakeInput;
  reverse_image_search: ReverseImageSearchInput;
  check_phone_number: CheckPhoneNumberInput;
  search_memories: SearchMemoriesInput;
  store_memory: StoreMemoryInput;
  get_agent_status: Record<string, never>;
};

export type ToolResultMap = {
  scan_url: ScanUrlResult;
  scan_message: ScanMessageResult;
  fact_check: FactCheckResult;
  counseling_chat: CounselingChatResult;
  check_crypto: CheckCryptoResult;
  detect_remote_software: DetectRemoteSoftwareResult;
  password_vault: PasswordVaultResult;
  l1_troubleshoot: L1TroubleshootResult;
  check_social_profile: CheckSocialProfileResult;
  verify_company: VerifyCompanyResult;
  detect_deepfake: DetectDeepfakeResult;
  reverse_image_search: ReverseImageSearchResult;
  check_phone_number: CheckPhoneNumberResult;
  search_memories: SearchMemoriesResult;
  store_memory: StoreMemoryResult;
  get_agent_status: { status: string; metrics: Record<string, unknown> };
};
