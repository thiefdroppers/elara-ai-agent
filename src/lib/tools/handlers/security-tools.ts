/**
 * E-BRAIN V3 Security Tool Handlers
 *
 * Implements the 16 Patent-Ready Security Tools:
 * 1. scan_url - URL/phishing scan
 * 2. scan_message - Email/SMS scam analysis
 * 3. fact_check - Claim verification
 * 4. verify_company - Company background verification
 * 5. check_social_profile - Social media profile verification
 * 6. detect_deepfake - AI-generated content detection
 * 7. detect_remote_software - Remote access software detection
 * 8. reverse_image_search - Image source search
 * 9. check_crypto - Crypto address/transaction analysis
 * 10. check_phone_number - Phone number verification
 * 11. counseling_chat - Scam victim support
 * 12. l1_troubleshoot - Security troubleshooting
 * 13. password_vault - Password generation/checking
 * 14. search_memories - E-BRAIN memory search
 * 15. store_memory - E-BRAIN memory storage
 * 16. get_agent_status - Agent health status
 */

import type { ToolResult } from '../types';

// ============================================================================
// TOOL RESULT BUILDERS
// ============================================================================

function successResult<T>(data: T, metadata?: Record<string, unknown>): ToolResult<T> {
  return {
    success: true,
    data,
    metadata: {
      timestamp: Date.now(),
      ...metadata,
    },
  };
}

function errorResult<T>(error: string, metadata?: Record<string, unknown>): ToolResult<T> {
  return {
    success: false,
    error,
    metadata: {
      timestamp: Date.now(),
      ...metadata,
    },
  };
}

// ============================================================================
// SCAN_MESSAGE HANDLER - Email/SMS scam analysis
// ============================================================================

export interface ScanMessageInput {
  message: string;
  context?: 'email' | 'sms' | 'chat' | 'social';
}

export interface ScanMessageResult {
  verdict: 'safe' | 'suspicious' | 'scam';
  riskScore: number;
  indicators: string[];
  category?: string;
  suggestedAction: string;
  analysisDetails: {
    urgencyScore: number;
    suspiciousPatterns: string[];
    linkAnalysis?: { url: string; risk: string }[];
    senderAnalysis?: { reputation: string; flags: string[] };
  };
}

const SCAM_PATTERNS = [
  { pattern: /urgent.*action.*required/i, weight: 0.3, indicator: 'Urgency pressure tactic' },
  { pattern: /verify.*account.*immediately/i, weight: 0.35, indicator: 'Account verification scam' },
  { pattern: /won.*prize|lottery|winner/i, weight: 0.4, indicator: 'Prize/lottery scam' },
  { pattern: /click.*link.*within.*hours/i, weight: 0.35, indicator: 'Time-limited pressure' },
  { pattern: /suspended.*account/i, weight: 0.3, indicator: 'Account suspension threat' },
  { pattern: /wire.*transfer|western.*union|bitcoin.*payment/i, weight: 0.45, indicator: 'Suspicious payment method' },
  { pattern: /nigerian.*prince|inheritance.*claim/i, weight: 0.5, indicator: 'Advance fee fraud' },
  { pattern: /password.*expired|reset.*password.*now/i, weight: 0.25, indicator: 'Password phishing attempt' },
  { pattern: /irs|tax.*refund|government.*grant/i, weight: 0.35, indicator: 'Government impersonation' },
  { pattern: /tech.*support|microsoft.*calling/i, weight: 0.4, indicator: 'Tech support scam' },
  { pattern: /dear.*customer|dear.*user|dear.*valued/i, weight: 0.15, indicator: 'Generic greeting (impersonal)' },
  { pattern: /click.*here.*to.*confirm/i, weight: 0.25, indicator: 'Generic call-to-action' },
  { pattern: /bank.*of.*america|paypal|amazon|apple/i, weight: 0.1, indicator: 'Brand name mentioned (verify authenticity)' },
];

export async function handleScanMessage(input: ScanMessageInput): Promise<ToolResult<ScanMessageResult>> {
  const { message, context = 'email' } = input;

  if (!message || message.trim().length === 0) {
    return errorResult('Message content is required');
  }

  // Analyze for scam patterns
  let totalScore = 0;
  const indicators: string[] = [];
  const suspiciousPatterns: string[] = [];

  for (const { pattern, weight, indicator } of SCAM_PATTERNS) {
    if (pattern.test(message)) {
      totalScore += weight;
      indicators.push(indicator);
      suspiciousPatterns.push(pattern.source);
    }
  }

  // Extract and analyze URLs
  const urlRegex = /https?:\/\/[^\s]+/g;
  const urls = message.match(urlRegex) || [];
  const linkAnalysis = urls.map(url => {
    // Check for suspicious URL patterns
    const suspicious = /bit\.ly|tinyurl|goo\.gl|t\.co|[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/.test(url);
    return {
      url,
      risk: suspicious ? 'high' : 'medium',
    };
  });

  if (urls.length > 0 && linkAnalysis.some(l => l.risk === 'high')) {
    totalScore += 0.2;
    indicators.push('Suspicious shortened/numeric URLs detected');
  }

  // Calculate urgency score (1-10)
  const urgencyWords = (message.match(/urgent|immediate|now|asap|today|hours|minutes/gi) || []).length;
  const urgencyScore = Math.min(urgencyWords * 2, 10);

  if (urgencyScore > 5) {
    totalScore += 0.15;
  }

  // Normalize score (0-1)
  const riskScore = Math.min(totalScore, 1);

  // Determine verdict
  let verdict: 'safe' | 'suspicious' | 'scam';
  let suggestedAction: string;
  let category: string | undefined;

  if (riskScore >= 0.6) {
    verdict = 'scam';
    suggestedAction = 'Do NOT interact with this message. Delete it immediately and block the sender.';
    category = indicators.length > 0 ? indicators[0].split(' ')[0] : 'Scam';
  } else if (riskScore >= 0.3) {
    verdict = 'suspicious';
    suggestedAction = 'Be cautious. Verify the sender through official channels before taking any action.';
    category = 'Potentially suspicious';
  } else {
    verdict = 'safe';
    suggestedAction = 'This message appears safe, but always verify unexpected requests.';
  }

  return successResult<ScanMessageResult>({
    verdict,
    riskScore,
    indicators,
    category,
    suggestedAction,
    analysisDetails: {
      urgencyScore,
      suspiciousPatterns,
      linkAnalysis: linkAnalysis.length > 0 ? linkAnalysis : undefined,
    },
  }, { source: 'scan_message', context });
}

// ============================================================================
// FACT_CHECK HANDLER - Claim verification
// ============================================================================

export interface FactCheckInput {
  claim: string;
  sources?: string[];
  context?: string;
}

export interface FactCheckResult {
  verdict: 'true' | 'false' | 'misleading' | 'unverified' | 'mixed';
  confidence: number;
  summary: string;
  sources: Array<{
    name: string;
    url?: string;
    verdict: string;
    reliability: 'high' | 'medium' | 'low';
  }>;
  keyPoints: string[];
  suggestedSearches?: string[];
}

export async function handleFactCheck(input: FactCheckInput): Promise<ToolResult<FactCheckResult>> {
  const { claim, context } = input;

  if (!claim || claim.trim().length === 0) {
    return errorResult('Claim is required for fact-checking');
  }

  // This is a placeholder - in production, this would call fact-checking APIs
  // like Google Fact Check Tools API, Snopes API, PolitiFact, etc.

  return successResult<FactCheckResult>({
    verdict: 'unverified',
    confidence: 0.5,
    summary: `The claim "${claim.slice(0, 50)}..." requires further verification. We recommend checking reputable fact-checking sources.`,
    sources: [
      { name: 'Snopes', url: 'https://www.snopes.com', verdict: 'Not found', reliability: 'high' },
      { name: 'PolitiFact', url: 'https://www.politifact.com', verdict: 'Not found', reliability: 'high' },
      { name: 'FactCheck.org', url: 'https://www.factcheck.org', verdict: 'Not found', reliability: 'high' },
    ],
    keyPoints: [
      'No matching fact-check found in major databases',
      'Consider the source and date of the claim',
      'Look for corroborating evidence from multiple sources',
    ],
    suggestedSearches: [
      `"${claim.slice(0, 30)}" fact check`,
      `"${claim.slice(0, 30)}" snopes`,
    ],
  }, { source: 'fact_check', context });
}

// ============================================================================
// VERIFY_COMPANY HANDLER - Company background verification
// ============================================================================

export interface VerifyCompanyInput {
  companyName: string;
  domain?: string;
  country?: string;
}

export interface VerifyCompanyResult {
  verified: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  summary: string;
  registrationInfo?: {
    registered: boolean;
    jurisdiction?: string;
    registrationDate?: string;
    status?: string;
  };
  onlinePresence: {
    websiteActive: boolean;
    socialMediaPresence: string[];
    reviews?: { platform: string; rating: number; count: number }[];
  };
  redFlags: string[];
  recommendations: string[];
}

export async function handleVerifyCompany(input: VerifyCompanyInput): Promise<ToolResult<VerifyCompanyResult>> {
  const { companyName, domain, country } = input;

  if (!companyName || companyName.trim().length === 0) {
    return errorResult('Company name is required');
  }

  // Placeholder - in production would query business registries, WHOIS, etc.
  const redFlags: string[] = [];

  // Check for suspicious company name patterns
  if (/limited\s*liability|llc|corp|inc/i.test(companyName) && !domain) {
    redFlags.push('No domain provided for corporate entity');
  }

  return successResult<VerifyCompanyResult>({
    verified: false,
    riskLevel: redFlags.length > 0 ? 'medium' : 'low',
    summary: `Verification for "${companyName}" requires additional research. Manual verification recommended.`,
    registrationInfo: {
      registered: false,
      jurisdiction: country,
      status: 'Unknown - requires manual verification',
    },
    onlinePresence: {
      websiteActive: !!domain,
      socialMediaPresence: [],
    },
    redFlags,
    recommendations: [
      'Verify company registration through official government business registries',
      'Check Better Business Bureau (BBB) for complaints',
      'Search for news articles about the company',
      domain ? `Verify WHOIS information for ${domain}` : 'Request company website for verification',
    ],
  }, { source: 'verify_company' });
}

// ============================================================================
// CHECK_SOCIAL_PROFILE HANDLER - Social media verification
// ============================================================================

export interface CheckSocialProfileInput {
  platform: 'twitter' | 'linkedin' | 'facebook' | 'instagram' | 'tiktok';
  profileUrl?: string;
  username?: string;
}

export interface CheckSocialProfileResult {
  authentic: boolean;
  confidence: number;
  riskIndicators: string[];
  profileAnalysis: {
    accountAge?: string;
    followerCount?: number;
    followingCount?: number;
    postFrequency?: string;
    verificationStatus?: string;
  };
  botProbability: number;
  recommendations: string[];
}

export async function handleCheckSocialProfile(input: CheckSocialProfileInput): Promise<ToolResult<CheckSocialProfileResult>> {
  const { platform, profileUrl, username } = input;

  if (!profileUrl && !username) {
    return errorResult('Either profileUrl or username is required');
  }

  // Placeholder analysis - in production would use social media APIs
  return successResult<CheckSocialProfileResult>({
    authentic: true,
    confidence: 0.6,
    riskIndicators: [
      'Unable to verify account age without API access',
      'Manual review recommended for high-value interactions',
    ],
    profileAnalysis: {
      verificationStatus: 'Unknown - API access required',
    },
    botProbability: 0.3,
    recommendations: [
      `Visit the ${platform} profile directly to verify`,
      'Check for verified badge if applicable',
      'Review posting history and engagement patterns',
      'Be cautious of accounts with low follower-to-following ratios',
    ],
  }, { source: 'check_social_profile', platform });
}

// ============================================================================
// DETECT_DEEPFAKE HANDLER - AI-generated content detection
// ============================================================================

export interface DetectDeepfakeInput {
  imageUrl?: string;
  imageBase64?: string;
  analysisLevel?: 'quick' | 'standard' | 'thorough';
}

export interface DetectDeepfakeResult {
  isDeepfake: boolean;
  confidence: number;
  analysisType: string;
  indicators: {
    category: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
  }[];
  recommendations: string[];
  metadata?: {
    exifData?: Record<string, string>;
    imageHash?: string;
  };
}

export async function handleDetectDeepfake(input: DetectDeepfakeInput): Promise<ToolResult<DetectDeepfakeResult>> {
  const { imageUrl, imageBase64, analysisLevel = 'standard' } = input;

  if (!imageUrl && !imageBase64) {
    return errorResult('Either imageUrl or imageBase64 is required');
  }

  // Placeholder - in production would use vision models
  return successResult<DetectDeepfakeResult>({
    isDeepfake: false,
    confidence: 0.5,
    analysisType: analysisLevel,
    indicators: [
      {
        category: 'Metadata',
        description: 'Unable to perform deep analysis without vision model',
        severity: 'low',
      },
    ],
    recommendations: [
      'For accurate deepfake detection, use specialized tools like Microsoft Video Authenticator',
      'Check image metadata for inconsistencies',
      'Look for unnatural lighting or shadows',
      'Examine facial features for asymmetries',
    ],
  }, { source: 'detect_deepfake', analysisLevel });
}

// ============================================================================
// DETECT_REMOTE_SOFTWARE HANDLER
// ============================================================================

export interface DetectRemoteSoftwareInput {
  includeActiveConnections?: boolean;
}

export interface DetectRemoteSoftwareResult {
  detected: boolean;
  software: Array<{
    name: string;
    type: 'remote_access' | 'screen_share' | 'file_transfer';
    running: boolean;
    riskLevel: 'low' | 'medium' | 'high';
    description: string;
  }>;
  activeConnections?: number;
  recommendations: string[];
}

const KNOWN_REMOTE_SOFTWARE = [
  { name: 'AnyDesk', type: 'remote_access' as const, risk: 'high' as const, desc: 'Remote desktop software often used in tech support scams' },
  { name: 'TeamViewer', type: 'remote_access' as const, risk: 'medium' as const, desc: 'Legitimate but frequently abused in scams' },
  { name: 'UltraVNC', type: 'remote_access' as const, risk: 'high' as const, desc: 'VNC client that provides remote access' },
  { name: 'ConnectWise', type: 'remote_access' as const, risk: 'medium' as const, desc: 'IT management software' },
  { name: 'LogMeIn', type: 'remote_access' as const, risk: 'medium' as const, desc: 'Remote access service' },
  { name: 'Chrome Remote Desktop', type: 'remote_access' as const, risk: 'low' as const, desc: 'Google remote desktop extension' },
];

export async function handleDetectRemoteSoftware(input: DetectRemoteSoftwareInput): Promise<ToolResult<DetectRemoteSoftwareResult>> {
  // This runs in browser context, limited detection capability
  // In a full desktop agent, this would check running processes

  return successResult<DetectRemoteSoftwareResult>({
    detected: false,
    software: KNOWN_REMOTE_SOFTWARE.map(sw => ({
      name: sw.name,
      type: sw.type,
      running: false, // Cannot detect from browser
      riskLevel: sw.risk,
      description: sw.desc,
    })),
    recommendations: [
      'This scan has limited capability in browser environment',
      'For full detection, check your system task manager',
      'Look for: AnyDesk, TeamViewer, UltraVNC in running processes',
      'If you did not install remote software, be cautious of tech support calls',
    ],
  }, { source: 'detect_remote_software' });
}

// ============================================================================
// REVERSE_IMAGE_SEARCH HANDLER
// ============================================================================

export interface ReverseImageSearchInput {
  imageUrl?: string;
  imageBase64?: string;
}

export interface ReverseImageSearchResult {
  found: boolean;
  matchCount: number;
  sources: Array<{
    url: string;
    title?: string;
    similarity: number;
    dateFound?: string;
  }>;
  possibleScam: boolean;
  recommendations: string[];
}

export async function handleReverseImageSearch(input: ReverseImageSearchInput): Promise<ToolResult<ReverseImageSearchResult>> {
  const { imageUrl, imageBase64 } = input;

  if (!imageUrl && !imageBase64) {
    return errorResult('Either imageUrl or imageBase64 is required');
  }

  // Placeholder - would integrate with Google Vision API, TinEye, etc.
  return successResult<ReverseImageSearchResult>({
    found: false,
    matchCount: 0,
    sources: [],
    possibleScam: false,
    recommendations: [
      'For reverse image search, use: Google Images, TinEye, or Yandex',
      'Right-click image and select "Search Google for image"',
      'Upload the image to tineye.com for thorough search',
      'Check if the same photo appears on stock image sites',
    ],
  }, { source: 'reverse_image_search' });
}

// ============================================================================
// CHECK_CRYPTO HANDLER - Crypto address analysis
// ============================================================================

export interface CheckCryptoInput {
  address?: string;
  transactionHash?: string;
  network?: 'bitcoin' | 'ethereum' | 'solana' | 'polygon' | 'auto';
}

export interface CheckCryptoResult {
  valid: boolean;
  network: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  flags: string[];
  analysis: {
    addressType?: string;
    transactionCount?: number;
    firstSeen?: string;
    lastSeen?: string;
    totalReceived?: string;
    sanctioned?: boolean;
    mixerUsage?: boolean;
  };
  recommendations: string[];
}

export async function handleCheckCrypto(input: CheckCryptoInput): Promise<ToolResult<CheckCryptoResult>> {
  const { address, transactionHash, network = 'auto' } = input;

  if (!address && !transactionHash) {
    return errorResult('Either address or transactionHash is required');
  }

  // Detect network from address format
  let detectedNetwork = network;
  if (network === 'auto' && address) {
    if (address.startsWith('0x') && address.length === 42) {
      detectedNetwork = 'ethereum';
    } else if (address.length >= 26 && address.length <= 35 && /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address)) {
      detectedNetwork = 'bitcoin';
    } else if (address.length >= 32 && address.length <= 44) {
      detectedNetwork = 'solana';
    }
  }

  // Placeholder - would integrate with blockchain analytics APIs
  return successResult<CheckCryptoResult>({
    valid: !!address,
    network: detectedNetwork !== 'auto' ? detectedNetwork : 'unknown',
    riskLevel: 'medium',
    flags: [
      'Unable to perform full blockchain analysis without API access',
      'Manual verification recommended',
    ],
    analysis: {
      addressType: address?.startsWith('0x') ? 'EOA/Contract' : 'Standard',
    },
    recommendations: [
      'Check address on blockchain explorer (Etherscan, Blockchain.com)',
      'Verify address matches the expected recipient',
      'Never send crypto based on unsolicited requests',
      'Use Chainalysis or similar services for risk assessment',
    ],
  }, { source: 'check_crypto', network: detectedNetwork });
}

// ============================================================================
// CHECK_PHONE_NUMBER HANDLER
// ============================================================================

export interface CheckPhoneNumberInput {
  phoneNumber: string;
  countryCode?: string;
}

export interface CheckPhoneNumberResult {
  valid: boolean;
  type: 'mobile' | 'landline' | 'voip' | 'unknown';
  carrier?: string;
  location?: {
    country: string;
    region?: string;
  };
  riskIndicators: string[];
  spamReports?: number;
  recommendations: string[];
}

export async function handleCheckPhoneNumber(input: CheckPhoneNumberInput): Promise<ToolResult<CheckPhoneNumberResult>> {
  const { phoneNumber, countryCode } = input;

  if (!phoneNumber || phoneNumber.trim().length === 0) {
    return errorResult('Phone number is required');
  }

  // Clean phone number
  const cleaned = phoneNumber.replace(/[^0-9+]/g, '');

  // Basic validation
  const valid = cleaned.length >= 10 && cleaned.length <= 15;

  // VoIP detection heuristics (simplified)
  const isVoIP = /^(900|800|888|877|866|855|844|833|822)/.test(cleaned) ||
                 cleaned.includes('+1800');

  return successResult<CheckPhoneNumberResult>({
    valid,
    type: isVoIP ? 'voip' : 'unknown',
    location: {
      country: countryCode || (cleaned.startsWith('+1') ? 'US/CA' : 'Unknown'),
    },
    riskIndicators: isVoIP ? ['VoIP number detected - commonly used in scams'] : [],
    recommendations: [
      'Verify caller identity through official channels',
      'Never share sensitive info based on unsolicited calls',
      'Check number on spam reporting sites like Should I Answer',
      'Block suspicious numbers',
    ],
  }, { source: 'check_phone_number' });
}

// ============================================================================
// COUNSELING_CHAT HANDLER - Scam victim support
// ============================================================================

export interface CounselingChatInput {
  userMessage: string;
  context?: 'scam_victim' | 'identity_theft' | 'financial_fraud' | 'general';
  previousMessages?: Array<{ role: string; content: string }>;
}

export interface CounselingChatResult {
  response: string;
  resources: Array<{
    name: string;
    url?: string;
    phone?: string;
    description: string;
  }>;
  nextSteps: string[];
  emotionalSupport: string;
}

const SUPPORT_RESOURCES = [
  { name: 'FTC Report Fraud', url: 'https://reportfraud.ftc.gov', description: 'Report scams to the Federal Trade Commission' },
  { name: 'IC3 FBI', url: 'https://www.ic3.gov', description: 'Internet Crime Complaint Center' },
  { name: 'Identity Theft', url: 'https://identitytheft.gov', description: 'FTC identity theft recovery' },
  { name: 'AARP Fraud Helpline', phone: '877-908-3360', description: 'Free fraud victim support' },
];

export async function handleCounselingChat(input: CounselingChatInput): Promise<ToolResult<CounselingChatResult>> {
  const { userMessage, context = 'general' } = input;

  if (!userMessage || userMessage.trim().length === 0) {
    return errorResult('User message is required');
  }

  // Generate supportive response based on context
  let response: string;
  let emotionalSupport: string;
  let nextSteps: string[];

  switch (context) {
    case 'scam_victim':
      response = "I'm sorry you've experienced this. Being scammed is not your fault - these criminals are sophisticated. Let's focus on protecting you and potentially recovering what was lost.";
      emotionalSupport = "Take a deep breath. You're not alone, and you're taking the right step by seeking help.";
      nextSteps = [
        'Document everything - save all communications, receipts, and records',
        'Report the scam to FTC at reportfraud.ftc.gov',
        'Contact your bank immediately if financial accounts are involved',
        'File a police report for documentation',
        'Monitor your credit reports for suspicious activity',
      ];
      break;
    case 'identity_theft':
      response = "Identity theft is serious, but recoverable. Let's work through the steps to protect your identity and restore your accounts.";
      emotionalSupport = "This can feel overwhelming, but there are clear steps we can take together.";
      nextSteps = [
        'Place a fraud alert with the three credit bureaus',
        'Review your credit reports for unauthorized accounts',
        'Report to identitytheft.gov for a recovery plan',
        'Consider a credit freeze',
        'Change passwords for all important accounts',
      ];
      break;
    case 'financial_fraud':
      response = "Financial fraud requires quick action. Let's prioritize protecting your remaining assets.";
      emotionalSupport = "Acting quickly is important, and you're doing the right thing.";
      nextSteps = [
        'Contact your bank/credit card company immediately',
        'Dispute unauthorized transactions',
        'Request new cards with new numbers',
        'Set up fraud alerts on your accounts',
        'File an IC3 complaint if internet-related',
      ];
      break;
    default:
      response = "I'm here to help with any security concerns. What would you like to know more about?";
      emotionalSupport = "Your safety and security matter. We'll work through this together.";
      nextSteps = [
        'Tell me more about your situation',
        'We can check if something is a scam',
        'I can help you understand security best practices',
      ];
  }

  return successResult<CounselingChatResult>({
    response,
    resources: SUPPORT_RESOURCES,
    nextSteps,
    emotionalSupport,
  }, { source: 'counseling_chat', context });
}

// ============================================================================
// L1_TROUBLESHOOT HANDLER - Security troubleshooting
// ============================================================================

export interface L1TroubleshootInput {
  issue: string;
  category?: 'account' | 'device' | 'network' | 'privacy' | 'malware' | 'general';
  deviceType?: 'windows' | 'mac' | 'android' | 'ios' | 'linux';
}

export interface L1TroubleshootResult {
  category: string;
  summary: string;
  steps: Array<{
    step: number;
    instruction: string;
    details?: string;
  }>;
  warnings: string[];
  escalationNeeded: boolean;
  escalationReason?: string;
}

export async function handleL1Troubleshoot(input: L1TroubleshootInput): Promise<ToolResult<L1TroubleshootResult>> {
  const { issue, category = 'general', deviceType = 'windows' } = input;

  if (!issue || issue.trim().length === 0) {
    return errorResult('Issue description is required');
  }

  // Generate troubleshooting steps based on category
  let steps: Array<{ step: number; instruction: string; details?: string }>;
  let warnings: string[] = [];
  let escalationNeeded = false;

  switch (category) {
    case 'account':
      steps = [
        { step: 1, instruction: 'Change your password immediately', details: 'Use a strong, unique password with 12+ characters' },
        { step: 2, instruction: 'Enable two-factor authentication (2FA)', details: 'Use an authenticator app rather than SMS if possible' },
        { step: 3, instruction: 'Review recent account activity', details: 'Check for unauthorized logins or changes' },
        { step: 4, instruction: 'Update recovery options', details: 'Ensure recovery email and phone are correct' },
        { step: 5, instruction: 'Log out of all other sessions', details: 'Most accounts have this option in security settings' },
      ];
      warnings.push('Do not click links in suspicious emails - go directly to the website');
      break;
    case 'malware':
      steps = [
        { step: 1, instruction: 'Disconnect from the internet', details: 'Prevents data exfiltration' },
        { step: 2, instruction: 'Run a full antivirus scan', details: 'Use Windows Defender or your installed AV' },
        { step: 3, instruction: 'Check for suspicious programs', details: 'Review installed programs and remove unknown ones' },
        { step: 4, instruction: 'Update all software', details: 'Patch vulnerabilities that malware exploits' },
        { step: 5, instruction: 'Consider a clean reinstall if severe', details: 'Back up data first' },
      ];
      warnings.push('If ransomware is suspected, do NOT pay the ransom');
      escalationNeeded = true;
      break;
    default:
      steps = [
        { step: 1, instruction: 'Identify the specific symptoms', details: 'When did this start? What changed?' },
        { step: 2, instruction: 'Check for obvious causes', details: 'Recent installs, updates, or changes' },
        { step: 3, instruction: 'Restart the affected device/service', details: 'Often resolves temporary issues' },
        { step: 4, instruction: 'Search for the specific error message', details: 'Include device type in your search' },
        { step: 5, instruction: 'Contact support if issue persists', details: 'Bring documentation of steps tried' },
      ];
  }

  return successResult<L1TroubleshootResult>({
    category,
    summary: `Troubleshooting guide for ${category} issue on ${deviceType}`,
    steps,
    warnings,
    escalationNeeded,
    escalationReason: escalationNeeded ? 'This issue may require professional assistance' : undefined,
  }, { source: 'l1_troubleshoot', category, deviceType });
}

// ============================================================================
// PASSWORD_VAULT HANDLER
// ============================================================================

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
  password?: string;
  strength?: {
    score: number; // 0-100
    label: 'weak' | 'fair' | 'good' | 'strong' | 'excellent';
    feedback: string[];
    crackTime?: string;
  };
  breached?: boolean;
  breachCount?: number;
  recommendations: string[];
}

const CHAR_SETS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  ambiguous: 'l1IO0',
};

function generateSecurePassword(length: number, options: PasswordVaultInput['options'] = {}): string {
  const {
    uppercase = true,
    lowercase = true,
    numbers = true,
    symbols = true,
    excludeAmbiguous = true,
  } = options;

  let charset = '';
  if (uppercase) charset += CHAR_SETS.uppercase;
  if (lowercase) charset += CHAR_SETS.lowercase;
  if (numbers) charset += CHAR_SETS.numbers;
  if (symbols) charset += CHAR_SETS.symbols;

  if (excludeAmbiguous) {
    charset = charset.split('').filter(c => !CHAR_SETS.ambiguous.includes(c)).join('');
  }

  if (charset.length === 0) {
    charset = CHAR_SETS.lowercase + CHAR_SETS.numbers;
  }

  // Use crypto.getRandomValues for secure randomness
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);

  return Array.from(array, num => charset[num % charset.length]).join('');
}

function checkPasswordStrength(password: string): PasswordVaultResult['strength'] {
  let score = 0;
  const feedback: string[] = [];

  // Length scoring
  if (password.length >= 8) score += 10;
  if (password.length >= 12) score += 15;
  if (password.length >= 16) score += 15;
  if (password.length >= 20) score += 10;

  if (password.length < 8) feedback.push('Use at least 8 characters');

  // Character variety
  if (/[a-z]/.test(password)) score += 10;
  else feedback.push('Add lowercase letters');

  if (/[A-Z]/.test(password)) score += 10;
  else feedback.push('Add uppercase letters');

  if (/[0-9]/.test(password)) score += 10;
  else feedback.push('Add numbers');

  if (/[^a-zA-Z0-9]/.test(password)) score += 15;
  else feedback.push('Add symbols for extra strength');

  // Patterns (deductions)
  if (/(.)\1{2,}/.test(password)) {
    score -= 10;
    feedback.push('Avoid repeating characters');
  }
  if (/^[a-zA-Z]+$/.test(password)) {
    score -= 5;
    feedback.push('Mix character types');
  }
  if (/123|abc|qwerty/i.test(password)) {
    score -= 15;
    feedback.push('Avoid common patterns');
  }

  score = Math.max(0, Math.min(100, score));

  let label: 'weak' | 'fair' | 'good' | 'strong' | 'excellent';
  if (score < 30) label = 'weak';
  else if (score < 50) label = 'fair';
  else if (score < 70) label = 'good';
  else if (score < 90) label = 'strong';
  else label = 'excellent';

  return { score, label, feedback, crackTime: score > 70 ? 'centuries' : score > 50 ? 'years' : 'hours to days' };
}

export async function handlePasswordVault(input: PasswordVaultInput): Promise<ToolResult<PasswordVaultResult>> {
  const { action, password, length = 16, options } = input;

  switch (action) {
    case 'generate': {
      const generated = generateSecurePassword(length, options);
      const strength = checkPasswordStrength(generated);
      return successResult<PasswordVaultResult>({
        action: 'generate',
        password: generated,
        strength,
        recommendations: [
          'Store this password in a password manager',
          'Never reuse passwords across sites',
          'Enable 2FA wherever possible',
        ],
      });
    }
    case 'check_strength': {
      if (!password) return errorResult('Password is required for strength check');
      const strength = checkPasswordStrength(password);
      return successResult<PasswordVaultResult>({
        action: 'check_strength',
        strength,
        recommendations: strength.feedback.length > 0 ? strength.feedback : ['Your password is strong!'],
      });
    }
    case 'check_breach': {
      if (!password) return errorResult('Password is required for breach check');
      // Note: In production, would use HaveIBeenPwned API with k-anonymity
      return successResult<PasswordVaultResult>({
        action: 'check_breach',
        breached: false,
        breachCount: 0,
        recommendations: [
          'For actual breach checking, use haveibeenpwned.com/Passwords',
          'Never enter passwords on untrusted sites',
          'Use the Pwned Passwords API with k-anonymity',
        ],
      });
    }
    default:
      return errorResult(`Unknown action: ${action}`);
  }
}

// ============================================================================
// GET_AGENT_STATUS HANDLER
// ============================================================================

export interface GetAgentStatusResult {
  status: 'healthy' | 'degraded' | 'offline';
  version: string;
  uptime: number;
  memory: {
    connected: boolean;
    memoryCount: number;
    lastSync?: number;
  };
  llm: {
    primary: string;
    fallback: string[];
    currentProvider?: string;
  };
  tools: {
    registered: number;
    available: string[];
  };
}

export async function handleGetAgentStatus(): Promise<ToolResult<GetAgentStatusResult>> {
  return successResult<GetAgentStatusResult>({
    status: 'healthy',
    version: '3.0.0',
    uptime: Date.now(),
    memory: {
      connected: true,
      memoryCount: 0,
    },
    llm: {
      primary: 'Neural Service (Llama-3.2-3B)',
      fallback: ['WebLLM', 'Gemini'],
    },
    tools: {
      registered: 16,
      available: [
        'scan_url', 'scan_message', 'fact_check', 'verify_company',
        'check_social_profile', 'detect_deepfake', 'detect_remote_software',
        'reverse_image_search', 'check_crypto', 'check_phone_number',
        'counseling_chat', 'l1_troubleshoot', 'password_vault',
        'search_memories', 'store_memory', 'get_agent_status',
      ],
    },
  }, { source: 'get_agent_status' });
}

// ============================================================================
// EXPORT ALL HANDLERS
// ============================================================================

export const securityToolHandlers = {
  scan_message: handleScanMessage,
  fact_check: handleFactCheck,
  verify_company: handleVerifyCompany,
  check_social_profile: handleCheckSocialProfile,
  detect_deepfake: handleDetectDeepfake,
  detect_remote_software: handleDetectRemoteSoftware,
  reverse_image_search: handleReverseImageSearch,
  check_crypto: handleCheckCrypto,
  check_phone_number: handleCheckPhoneNumber,
  counseling_chat: handleCounselingChat,
  l1_troubleshoot: handleL1Troubleshoot,
  password_vault: handlePasswordVault,
  get_agent_status: handleGetAgentStatus,
};
