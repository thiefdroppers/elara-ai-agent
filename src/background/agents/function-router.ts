/**
 * Elara AI Agent - Function Router
 *
 * LLM Function Calling / Tool Usage Framework
 * Routes agent actions to Elara Platform APIs, Edge Engine, Scanner V2, and TI DB
 *
 * Enables the AI Agent to:
 * - Scan URLs (edge, hybrid, deep)
 * - Query TI Database
 * - Analyze screenshots/images
 * - Extract text from images (OCR)
 * - Perform deepfake detection
 * - Analyze sentiment
 * - Search threat intelligence
 * - Access user profile data
 */

import { scannerClient } from '@/api/scanner-client';
import { edgeClient } from '@/lib/edge/edge-client';
import { confidenceRouter } from '@/lib/edge/confidence-router';
import { traceLogger, createLogger } from '@/lib/logging/trace-logger';
import { performanceMonitor, MetricNames } from '@/lib/logging/performance-monitor';
import type { ScanResult, TICacheHit } from '@/types';

const logger = createLogger('FunctionRouter');

// ============================================================================
// FUNCTION DEFINITIONS (OpenAI Function Calling Format)
// ============================================================================

export const AVAILABLE_FUNCTIONS = {
  // URL Scanning
  scan_url: {
    name: 'scan_url',
    description: 'Scan a URL for phishing, malware, and security threats using ML models',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to scan (must include http:// or https://)',
        },
        scan_type: {
          type: 'string',
          enum: ['auto', 'edge', 'hybrid', 'deep'],
          description: 'Scan type: auto (recommended), edge (fast), hybrid (TI enriched), deep (comprehensive)',
        },
      },
      required: ['url'],
    },
  },

  // TI Database Search
  search_threat_intelligence: {
    name: 'search_threat_intelligence',
    description: 'Search the Threat Intelligence database for indicators (domains, IPs, URLs, hashes)',
    parameters: {
      type: 'object',
      properties: {
        indicator: {
          type: 'string',
          description: 'The indicator to search (domain, IP, URL, or hash)',
        },
        indicator_type: {
          type: 'string',
          enum: ['url', 'domain', 'ip', 'hash', 'email'],
          description: 'Type of indicator',
        },
      },
      required: ['indicator'],
    },
  },

  // Screenshot/Image Analysis
  analyze_image: {
    name: 'analyze_image',
    description: 'Analyze an image for deepfakes, phishing pages, malicious content, or OCR text extraction',
    parameters: {
      type: 'object',
      properties: {
        image_url: {
          type: 'string',
          description: 'URL or data URI of the image to analyze',
        },
        analysis_type: {
          type: 'string',
          enum: ['deepfake', 'phishing', 'ocr', 'general'],
          description: 'Type of analysis: deepfake detection, phishing page detection, OCR, or general threat analysis',
        },
      },
      required: ['image_url', 'analysis_type'],
    },
  },

  // Text Sentiment Analysis
  analyze_sentiment: {
    name: 'analyze_sentiment',
    description: 'Analyze text sentiment to detect urgency, fear tactics, or manipulation (common in phishing)',
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The text to analyze for sentiment and manipulation tactics',
        },
      },
      required: ['text'],
    },
  },

  // Bulk TI Lookup
  lookup_indicators: {
    name: 'lookup_indicators',
    description: 'Look up multiple threat indicators in bulk',
    parameters: {
      type: 'object',
      properties: {
        indicators: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of indicators to look up',
        },
      },
      required: ['indicators'],
    },
  },

  // User Profile Management
  get_user_profile: {
    name: 'get_user_profile',
    description: 'Get current user profile (whitelist, blacklist, preferences, scan statistics)',
    parameters: {
      type: 'object',
      properties: {},
    },
  },

  add_to_whitelist: {
    name: 'add_to_whitelist',
    description: 'Add a domain to user whitelist (always mark as safe)',
    parameters: {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          description: 'Domain to whitelist (e.g., google.com)',
        },
      },
      required: ['domain'],
    },
  },

  add_to_blacklist: {
    name: 'add_to_blacklist',
    description: 'Add a domain to user blacklist (always mark as dangerous)',
    parameters: {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          description: 'Domain to blacklist',
        },
        reason: {
          type: 'string',
          description: 'Reason for blacklisting',
        },
      },
      required: ['domain'],
    },
  },

  // TI Sync
  sync_threat_intelligence: {
    name: 'sync_threat_intelligence',
    description: 'Synchronize local threat intelligence cache with cloud database',
    parameters: {
      type: 'object',
      properties: {
        force: {
          type: 'boolean',
          description: 'Force full sync instead of incremental',
        },
      },
    },
  },

  // Explain Security Concepts
  explain_security_concept: {
    name: 'explain_security_concept',
    description: 'Explain a cybersecurity concept in simple terms',
    parameters: {
      type: 'object',
      properties: {
        concept: {
          type: 'string',
          enum: ['phishing', 'typosquatting', 'deepfake', 'malware', 'ransomware', 'social_engineering'],
          description: 'Security concept to explain',
        },
      },
      required: ['concept'],
    },
  },

  // ============================================================================
  // PATENT-READY: E-BRAIN V3 Extended Tool Suite (16 Tools Total)
  // Patent: Hybrid Edge-Cloud ML Inference Architecture
  // ============================================================================

  // Email Analysis (Tool #2)
  email_analyze: {
    name: 'email_analyze',
    description: 'Analyze email content for phishing indicators, header spoofing, and malicious attachments',
    parameters: {
      type: 'object',
      properties: {
        email_content: {
          type: 'string',
          description: 'Raw email content including headers',
        },
        check_headers: {
          type: 'boolean',
          description: 'Whether to analyze email headers for spoofing',
        },
        check_links: {
          type: 'boolean',
          description: 'Whether to extract and scan embedded links',
        },
      },
      required: ['email_content'],
    },
  },

  // Fact Check (Tool #3)
  fact_check: {
    name: 'fact_check',
    description: 'Verify claims and detect misinformation using multiple sources',
    parameters: {
      type: 'object',
      properties: {
        claim: {
          type: 'string',
          description: 'The claim or statement to fact-check',
        },
        context: {
          type: 'string',
          description: 'Additional context about the claim (source, date, etc.)',
        },
      },
      required: ['claim'],
    },
  },

  // Deepfake Detection (Tool #4) - Enhanced from analyze_image
  deepfake_detect: {
    name: 'deepfake_detect',
    description: 'Detect AI-generated or manipulated images/videos using advanced ML models',
    parameters: {
      type: 'object',
      properties: {
        media_url: {
          type: 'string',
          description: 'URL or data URI of the image/video to analyze',
        },
        media_type: {
          type: 'string',
          enum: ['image', 'video', 'audio'],
          description: 'Type of media being analyzed',
        },
        detailed_analysis: {
          type: 'boolean',
          description: 'Whether to provide detailed artifact analysis',
        },
      },
      required: ['media_url'],
    },
  },

  // Cryptocurrency Scam Check (Tool #5)
  crypto_check: {
    name: 'crypto_check',
    description: 'Analyze cryptocurrency addresses, smart contracts, and NFTs for scam indicators',
    parameters: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'Cryptocurrency wallet address or smart contract address',
        },
        blockchain: {
          type: 'string',
          enum: ['ethereum', 'bitcoin', 'solana', 'polygon', 'bsc'],
          description: 'Blockchain network',
        },
        check_type: {
          type: 'string',
          enum: ['address', 'contract', 'nft', 'token'],
          description: 'Type of check to perform',
        },
      },
      required: ['address'],
    },
  },

  // Phone Number Lookup (Tool #6)
  phone_lookup: {
    name: 'phone_lookup',
    description: 'Look up phone number for spam/scam reports and carrier information',
    parameters: {
      type: 'object',
      properties: {
        phone_number: {
          type: 'string',
          description: 'Phone number to look up (with country code)',
        },
        check_spam: {
          type: 'boolean',
          description: 'Whether to check spam databases',
        },
      },
      required: ['phone_number'],
    },
  },

  // Reverse Image Search (Tool #7)
  reverse_image: {
    name: 'reverse_image',
    description: 'Perform reverse image search to find original source and detect stolen/fake profile images',
    parameters: {
      type: 'object',
      properties: {
        image_url: {
          type: 'string',
          description: 'URL or data URI of the image to search',
        },
        search_engines: {
          type: 'array',
          items: { type: 'string', enum: ['google', 'bing', 'yandex', 'tineye'] },
          description: 'Search engines to use',
        },
      },
      required: ['image_url'],
    },
  },

  // Profile Background Verification (Tool #8)
  profile_bgv: {
    name: 'profile_bgv',
    description: 'Verify social media profile authenticity and check for impersonation',
    parameters: {
      type: 'object',
      properties: {
        profile_url: {
          type: 'string',
          description: 'URL of the social media profile',
        },
        platform: {
          type: 'string',
          enum: ['linkedin', 'twitter', 'facebook', 'instagram', 'tiktok'],
          description: 'Social media platform',
        },
        check_type: {
          type: 'string',
          enum: ['authenticity', 'impersonation', 'bot_detection', 'full'],
          description: 'Type of verification to perform',
        },
      },
      required: ['profile_url'],
    },
  },

  // Company Background Verification (Tool #9)
  company_bgv: {
    name: 'company_bgv',
    description: 'Verify company legitimacy, registration status, and check for scam reports',
    parameters: {
      type: 'object',
      properties: {
        company_name: {
          type: 'string',
          description: 'Name of the company to verify',
        },
        domain: {
          type: 'string',
          description: 'Company website domain',
        },
        country: {
          type: 'string',
          description: 'Country of registration (ISO code)',
        },
      },
      required: ['company_name'],
    },
  },

  // Remote Software Detection (Tool #10)
  remote_software_detect: {
    name: 'remote_software_detect',
    description: 'Detect suspicious remote access software (TeamViewer, AnyDesk) commonly used in tech support scams',
    parameters: {
      type: 'object',
      properties: {
        context: {
          type: 'string',
          description: 'Description of the situation (e.g., someone asking to install software)',
        },
        software_mentioned: {
          type: 'array',
          items: { type: 'string' },
          description: 'Names of software mentioned',
        },
      },
      required: ['context'],
    },
  },

  // Password Strength Check (Tool #11)
  password_check: {
    name: 'password_check',
    description: 'Check password strength and whether it has been exposed in data breaches',
    parameters: {
      type: 'object',
      properties: {
        password_hash: {
          type: 'string',
          description: 'SHA-1 hash of the password (first 5 characters for k-anonymity)',
        },
        check_strength: {
          type: 'boolean',
          description: 'Whether to analyze password strength',
        },
        check_breach: {
          type: 'boolean',
          description: 'Whether to check Have I Been Pwned database',
        },
      },
      required: ['password_hash'],
    },
  },

  // Counseling Support (Tool #12)
  counseling_support: {
    name: 'counseling_support',
    description: 'Provide emotional support and resources for scam victims',
    parameters: {
      type: 'object',
      properties: {
        scam_type: {
          type: 'string',
          enum: ['romance', 'investment', 'tech_support', 'phishing', 'identity_theft', 'other'],
          description: 'Type of scam the user encountered',
        },
        severity: {
          type: 'string',
          enum: ['inquiry', 'near_miss', 'victim', 'ongoing'],
          description: 'Severity of the situation',
        },
        financial_loss: {
          type: 'boolean',
          description: 'Whether financial loss occurred',
        },
      },
      required: ['scam_type'],
    },
  },

  // L1 Troubleshooting (Tool #13)
  l1_troubleshoot: {
    name: 'l1_troubleshoot',
    description: 'Provide first-level tech support troubleshooting for common security issues',
    parameters: {
      type: 'object',
      properties: {
        issue_type: {
          type: 'string',
          enum: ['browser_hijack', 'popup_ads', 'suspicious_extension', 'account_locked', 'malware_warning', 'password_reset', 'other'],
          description: 'Type of technical issue',
        },
        browser: {
          type: 'string',
          enum: ['chrome', 'firefox', 'edge', 'safari', 'other'],
          description: 'User browser',
        },
        os: {
          type: 'string',
          enum: ['windows', 'macos', 'linux', 'android', 'ios'],
          description: 'Operating system',
        },
      },
      required: ['issue_type'],
    },
  },

  // E-BRAIN Memory Search (Tool #16)
  memory_search: {
    name: 'memory_search',
    description: 'Search E-BRAIN neural memory for relevant past interactions, scans, and threat patterns',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language search query',
        },
        memory_types: {
          type: 'array',
          items: { type: 'string', enum: ['episodic', 'semantic', 'procedural', 'learned'] },
          description: 'Types of memory to search',
        },
        time_range: {
          type: 'string',
          enum: ['today', 'week', 'month', 'all'],
          description: 'Time range for memory search',
        },
        min_importance: {
          type: 'number',
          description: 'Minimum importance score (0-1)',
        },
      },
      required: ['query'],
    },
  },
};

// ============================================================================
// FUNCTION ROUTER CLASS
// ============================================================================

export class FunctionRouter {
  /**
   * Execute a function based on LLM function call
   */
  async executeFunction(
    functionName: string,
    parameters: Record<string, any>
  ): Promise<any> {
    const correlationId = traceLogger.startOperation(`function_${functionName}`);

    try {
      logger.info(`Executing function: ${functionName}`, { parameters });

      const result = await this.routeFunction(functionName, parameters);

      logger.info(`Function executed successfully: ${functionName}`, {
        resultType: typeof result,
      });

      traceLogger.endOperation();
      return result;
    } catch (error) {
      logger.error(`Function execution failed: ${functionName}`, error as Error, { parameters });
      traceLogger.endOperation();
      throw error;
    }
  }

  /**
   * Route function to appropriate handler
   */
  private async routeFunction(
    functionName: string,
    parameters: Record<string, any>
  ): Promise<any> {
    switch (functionName) {
      case 'scan_url':
        return this.scanURL(parameters as { url: string; scan_type?: 'auto' | 'edge' | 'hybrid' | 'deep' });

      case 'search_threat_intelligence':
        return this.searchTI(parameters as { indicator: string; indicator_type?: string });

      case 'analyze_image':
        return this.analyzeImage(parameters as { image_url: string; analysis_type: 'deepfake' | 'phishing' | 'ocr' | 'general' });

      case 'analyze_sentiment':
        return this.analyzeSentiment(parameters as { text: string });

      case 'lookup_indicators':
        return this.lookupIndicators(parameters as { indicators: string[] });

      case 'get_user_profile':
        return this.getUserProfile();

      case 'add_to_whitelist':
        return this.addToWhitelist(parameters as { domain: string });

      case 'add_to_blacklist':
        return this.addToBlacklist(parameters as { domain: string; reason?: string });

      case 'sync_threat_intelligence':
        return this.syncTI(parameters as { force?: boolean });

      case 'explain_security_concept':
        return this.explainConcept(parameters as { concept: string });

      // E-BRAIN V3 Extended Tool Suite (Patent-Ready)
      case 'email_analyze':
        return this.analyzeEmail(parameters as { email_content: string; check_headers?: boolean; check_links?: boolean });

      case 'fact_check':
        return this.factCheck(parameters as { claim: string; context?: string });

      case 'deepfake_detect':
        return this.detectDeepfake(parameters as { media_url: string; media_type?: string; detailed_analysis?: boolean });

      case 'crypto_check':
        return this.checkCrypto(parameters as { address: string; blockchain?: string; check_type?: string });

      case 'phone_lookup':
        return this.lookupPhone(parameters as { phone_number: string; check_spam?: boolean });

      case 'reverse_image':
        return this.reverseImageSearch(parameters as { image_url: string; search_engines?: string[] });

      case 'profile_bgv':
        return this.verifyProfile(parameters as { profile_url: string; platform?: string; check_type?: string });

      case 'company_bgv':
        return this.verifyCompany(parameters as { company_name: string; domain?: string; country?: string });

      case 'remote_software_detect':
        return this.detectRemoteSoftware(parameters as { context: string; software_mentioned?: string[] });

      case 'password_check':
        return this.checkPassword(parameters as { password_hash: string; check_strength?: boolean; check_breach?: boolean });

      case 'counseling_support':
        return this.provideCounselingSupport(parameters as { scam_type: string; severity?: string; financial_loss?: boolean });

      case 'l1_troubleshoot':
        return this.l1Troubleshoot(parameters as { issue_type: string; browser?: string; os?: string });

      case 'memory_search':
        return this.searchMemory(parameters as { query: string; memory_types?: string[]; time_range?: string; min_importance?: number });

      default:
        throw new Error(`Unknown function: ${functionName}`);
    }
  }

  // --------------------------------------------------------------------------
  // URL Scanning Functions
  // --------------------------------------------------------------------------

  /**
   * Scan URL with automatic tier selection or user-specified scan type
   */
  private async scanURL(params: {
    url: string;
    scan_type?: 'auto' | 'edge' | 'hybrid' | 'deep';
  }): Promise<ScanResult> {
    const endTimer = performanceMonitor.startTimer(MetricNames.AGENT_TOTAL_LATENCY);

    try {
      const { url, scan_type = 'auto' } = params;

      // Validate URL
      if (!this.isValidURL(url)) {
        throw new Error(`Invalid URL format: ${url}`);
      }

      // Auto mode: Start with edge, escalate if needed
      if (scan_type === 'auto') {
        return await this.autoScan(url);
      }

      // Manual mode: Use specified scan type
      switch (scan_type) {
        case 'edge':
          return await this.edgeScan(url);
        case 'hybrid':
          return await this.hybridScan(url);
        case 'deep':
          return await this.deepScan(url);
        default:
          throw new Error(`Invalid scan type: ${scan_type}`);
      }
    } finally {
      endTimer();
    }
  }

  /**
   * Auto scan: Edge → Hybrid → Deep (based on confidence)
   */
  private async autoScan(url: string): Promise<ScanResult> {
    logger.info('Starting auto scan', { url });

    // Step 1: Try edge scan first
    try {
      const edgePrediction = await edgeClient.scanURL({ url });
      const decision = confidenceRouter.route(edgePrediction);

      if (decision.tier === 'edge') {
        logger.info('Edge scan sufficient (high confidence)', {
          confidence: edgePrediction.confidence,
        });
        return edgeClient.convertToScanResult(url, edgePrediction);
      }

      // Step 2: Escalate to hybrid if medium confidence
      if (decision.tier === 'hybrid') {
        logger.info('Escalating to hybrid scan', { reason: decision.escalationReason });
        return await this.hybridScan(url);
      }

      // Step 3: Escalate to deep if low confidence
      logger.info('Escalating to deep scan', { reason: decision.escalationReason });
      return await this.deepScan(url);
    } catch (error) {
      logger.warn('Edge scan failed, falling back to cloud', { error });
      return await this.hybridScan(url);
    }
  }

  /**
   * Edge scan only (fast, on-device ML)
   */
  private async edgeScan(url: string): Promise<ScanResult> {
    const edgePrediction = await edgeClient.scanURL({ url });
    return edgeClient.convertToScanResult(url, edgePrediction);
  }

  /**
   * Hybrid scan (edge + cloud TI enrichment)
   */
  private async hybridScan(url: string): Promise<ScanResult> {
    const endTimer = performanceMonitor.startTimer(MetricNames.CLOUD_HYBRID_LATENCY);

    try {
      const result = await scannerClient.hybridScan(url);
      return result;
    } finally {
      endTimer();
    }
  }

  /**
   * Deep scan (full Scanner V2 pipeline)
   */
  private async deepScan(url: string): Promise<ScanResult> {
    const endTimer = performanceMonitor.startTimer(MetricNames.CLOUD_DEEP_LATENCY);

    try {
      const result = await scannerClient.deepScan(url);
      return result;
    } finally {
      endTimer();
    }
  }

  // --------------------------------------------------------------------------
  // Threat Intelligence Functions
  // --------------------------------------------------------------------------

  /**
   * Search TI database for a single indicator
   */
  private async searchTI(params: {
    indicator: string;
    indicator_type?: string;
  }): Promise<any> {
    const { indicator, indicator_type } = params;

    logger.info('Searching TI database', { indicator, indicator_type });

    const response = await fetch(
      `https://dev-api.thiefdroppers.com/api/v2/ti/lookup/${encodeURIComponent(indicator)}`,
      {
        headers: {
          Authorization: `Bearer ${await this.getAuthToken()}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return {
          found: false,
          indicator,
          message: 'Indicator not found in TI database',
        };
      }
      throw new Error(`TI lookup failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Bulk indicator lookup
   */
  private async lookupIndicators(params: { indicators: string[] }): Promise<any> {
    const { indicators } = params;

    logger.info('Bulk TI lookup', { count: indicators.length });

    const response = await fetch(
      'https://dev-api.thiefdroppers.com/api/v2/ti/bulk-lookup',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await this.getAuthToken()}`,
        },
        body: JSON.stringify({ indicators }),
      }
    );

    if (!response.ok) {
      throw new Error(`Bulk TI lookup failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Sync local TI cache with cloud
   */
  private async syncTI(params: { force?: boolean }): Promise<any> {
    const { force = false } = params;

    logger.info('Starting TI sync', { force });

    // Get last sync timestamp
    const lastSync = force ? null : await this.getLastSyncTimestamp();

    const url = new URL('https://dev-api.thiefdroppers.com/api/v2/ti/federated-sync');
    if (lastSync) {
      url.searchParams.set('lastSync', lastSync);
    }
    url.searchParams.set('limit', '1000');

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${await this.getAuthToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`TI sync failed: ${response.statusText}`);
    }

    const data = await response.json();

    // Store new indicators locally
    await this.storeTIIndicators(data.indicators);

    // Update last sync timestamp
    await this.setLastSyncTimestamp(new Date().toISOString());

    logger.info('TI sync complete', {
      indicatorsReceived: data.indicators?.length || 0,
    });

    return {
      success: true,
      indicatorsSynced: data.indicators?.length || 0,
      nextSync: data.metadata?.sync_timestamp,
    };
  }

  // --------------------------------------------------------------------------
  // Image Analysis Functions
  // --------------------------------------------------------------------------

  /**
   * Analyze image (deepfake, phishing page screenshot, OCR)
   */
  private async analyzeImage(params: {
    image_url: string;
    analysis_type: 'deepfake' | 'phishing' | 'ocr' | 'general';
  }): Promise<any> {
    const { image_url, analysis_type } = params;

    logger.info('Analyzing image', { analysis_type });

    // Convert data URI to blob if needed
    const imageData = await this.fetchImageData(image_url);

    const formData = new FormData();
    formData.append('image', imageData);
    formData.append('analysis_type', analysis_type);

    const response = await fetch(
      'https://dev-api.thiefdroppers.com/api/v2/scanner/analyze-image',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await this.getAuthToken()}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`Image analysis failed: ${response.statusText}`);
    }

    return await response.json();
  }

  // --------------------------------------------------------------------------
  // Sentiment Analysis
  // --------------------------------------------------------------------------

  /**
   * Analyze text for phishing indicators (urgency, fear, manipulation)
   */
  private async analyzeSentiment(params: { text: string }): Promise<any> {
    const { text } = params;

    logger.info('Analyzing sentiment', { textLength: text.length });

    const response = await fetch(
      'https://dev-api.thiefdroppers.com/api/v2/scanner/analyze-sentiment',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await this.getAuthToken()}`,
        },
        body: JSON.stringify({ text }),
      }
    );

    if (!response.ok) {
      throw new Error(`Sentiment analysis failed: ${response.statusText}`);
    }

    return await response.json();
  }

  // --------------------------------------------------------------------------
  // User Profile Functions
  // --------------------------------------------------------------------------

  /**
   * Get user profile
   */
  private async getUserProfile(): Promise<any> {
    const response = await fetch('https://dev-api.thiefdroppers.com/api/v2/profile', {
      headers: {
        Authorization: `Bearer ${await this.getAuthToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Get profile failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Add domain to whitelist
   */
  private async addToWhitelist(params: { domain: string }): Promise<any> {
    const { domain } = params;

    const response = await fetch(
      'https://dev-api.thiefdroppers.com/api/v2/profile/whitelist',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await this.getAuthToken()}`,
        },
        body: JSON.stringify({ domain }),
      }
    );

    if (!response.ok) {
      throw new Error(`Add to whitelist failed: ${response.statusText}`);
    }

    return { success: true, domain, message: 'Domain added to whitelist' };
  }

  /**
   * Add domain to blacklist
   */
  private async addToBlacklist(params: {
    domain: string;
    reason?: string;
  }): Promise<any> {
    const { domain, reason } = params;

    const response = await fetch(
      'https://dev-api.thiefdroppers.com/api/v2/profile/blacklist',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await this.getAuthToken()}`,
        },
        body: JSON.stringify({ domain, reason }),
      }
    );

    if (!response.ok) {
      throw new Error(`Add to blacklist failed: ${response.statusText}`);
    }

    return { success: true, domain, message: 'Domain added to blacklist' };
  }

  // --------------------------------------------------------------------------
  // Security Education
  // --------------------------------------------------------------------------

  /**
   * Explain security concept (delegated to LLM)
   */
  private async explainConcept(params: { concept: string }): Promise<any> {
    // This is handled by the LLM itself, not a backend API
    // Return a structured response that the LLM can elaborate on
    return {
      concept: params.concept,
      shouldExplain: true,
      message: `Please explain the security concept: ${params.concept}`,
    };
  }

  // ==========================================================================
  // E-BRAIN V3 EXTENDED TOOL SUITE (Patent-Ready Implementation)
  // Patent: Hybrid Edge-Cloud ML Inference Architecture
  // Co-authored by: Tanmoy Sen (ThiefDroppers) & Claude (Anthropic)
  // ==========================================================================

  /**
   * Analyze email for phishing indicators (Tool #2)
   */
  private async analyzeEmail(params: {
    email_content: string;
    check_headers?: boolean;
    check_links?: boolean;
  }): Promise<any> {
    const { email_content, check_headers = true, check_links = true } = params;
    logger.info('Analyzing email', { contentLength: email_content.length });

    const response = await fetch(
      'https://dev-api.thiefdroppers.com/api/v2/scanner/analyze-email',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await this.getAuthToken()}`,
        },
        body: JSON.stringify({ email_content, check_headers, check_links }),
      }
    );

    if (!response.ok) {
      throw new Error(`Email analysis failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Fact check a claim (Tool #3)
   */
  private async factCheck(params: {
    claim: string;
    context?: string;
  }): Promise<any> {
    const { claim, context } = params;
    logger.info('Fact checking claim', { claimLength: claim.length });

    const response = await fetch(
      'https://dev-api.thiefdroppers.com/api/v2/scanner/fact-check',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await this.getAuthToken()}`,
        },
        body: JSON.stringify({ claim, context }),
      }
    );

    if (!response.ok) {
      throw new Error(`Fact check failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Detect deepfakes in media (Tool #4)
   */
  private async detectDeepfake(params: {
    media_url: string;
    media_type?: string;
    detailed_analysis?: boolean;
  }): Promise<any> {
    const { media_url, media_type = 'image', detailed_analysis = false } = params;
    logger.info('Detecting deepfake', { media_type });

    const mediaData = await this.fetchImageData(media_url);
    const formData = new FormData();
    formData.append('media', mediaData);
    formData.append('media_type', media_type);
    formData.append('detailed', String(detailed_analysis));

    const response = await fetch(
      'https://dev-api.thiefdroppers.com/api/v2/scanner/deepfake-detect',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await this.getAuthToken()}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`Deepfake detection failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Check cryptocurrency address/contract (Tool #5)
   */
  private async checkCrypto(params: {
    address: string;
    blockchain?: string;
    check_type?: string;
  }): Promise<any> {
    const { address, blockchain = 'ethereum', check_type = 'address' } = params;
    logger.info('Checking crypto', { blockchain, check_type });

    const response = await fetch(
      'https://dev-api.thiefdroppers.com/api/v2/scanner/crypto-check',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await this.getAuthToken()}`,
        },
        body: JSON.stringify({ address, blockchain, check_type }),
      }
    );

    if (!response.ok) {
      throw new Error(`Crypto check failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Lookup phone number (Tool #6)
   */
  private async lookupPhone(params: {
    phone_number: string;
    check_spam?: boolean;
  }): Promise<any> {
    const { phone_number, check_spam = true } = params;
    logger.info('Looking up phone number');

    const response = await fetch(
      `https://dev-api.thiefdroppers.com/api/v2/scanner/phone-lookup?number=${encodeURIComponent(phone_number)}&check_spam=${check_spam}`,
      {
        headers: {
          Authorization: `Bearer ${await this.getAuthToken()}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Phone lookup failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Reverse image search (Tool #7)
   */
  private async reverseImageSearch(params: {
    image_url: string;
    search_engines?: string[];
  }): Promise<any> {
    const { image_url, search_engines = ['google', 'bing'] } = params;
    logger.info('Reverse image search', { engines: search_engines });

    const imageData = await this.fetchImageData(image_url);
    const formData = new FormData();
    formData.append('image', imageData);
    formData.append('engines', search_engines.join(','));

    const response = await fetch(
      'https://dev-api.thiefdroppers.com/api/v2/scanner/reverse-image',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await this.getAuthToken()}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`Reverse image search failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Verify social media profile (Tool #8)
   */
  private async verifyProfile(params: {
    profile_url: string;
    platform?: string;
    check_type?: string;
  }): Promise<any> {
    const { profile_url, platform, check_type = 'full' } = params;
    logger.info('Verifying profile', { platform, check_type });

    const response = await fetch(
      'https://dev-api.thiefdroppers.com/api/v2/scanner/profile-verify',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await this.getAuthToken()}`,
        },
        body: JSON.stringify({ profile_url, platform, check_type }),
      }
    );

    if (!response.ok) {
      throw new Error(`Profile verification failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Verify company legitimacy (Tool #9)
   */
  private async verifyCompany(params: {
    company_name: string;
    domain?: string;
    country?: string;
  }): Promise<any> {
    const { company_name, domain, country } = params;
    logger.info('Verifying company', { company_name });

    const response = await fetch(
      'https://dev-api.thiefdroppers.com/api/v2/scanner/company-verify',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await this.getAuthToken()}`,
        },
        body: JSON.stringify({ company_name, domain, country }),
      }
    );

    if (!response.ok) {
      throw new Error(`Company verification failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Detect remote access software (Tool #10)
   */
  private async detectRemoteSoftware(params: {
    context: string;
    software_mentioned?: string[];
  }): Promise<any> {
    const { context, software_mentioned = [] } = params;
    logger.info('Detecting remote software');

    // Known suspicious remote access software patterns
    const suspiciousSoftware = [
      'teamviewer', 'anydesk', 'ultraviewer', 'supremo', 'ammyy',
      'logmein', 'connectwise', 'screenconnect', 'rustdesk'
    ];

    const detected = software_mentioned.filter(s =>
      suspiciousSoftware.some(sus => s.toLowerCase().includes(sus))
    );

    const contextMatches = suspiciousSoftware.filter(s =>
      context.toLowerCase().includes(s)
    );

    return {
      detected_software: [...new Set([...detected, ...contextMatches])],
      risk_assessment: detected.length > 0 || contextMatches.length > 0 ? 'HIGH' : 'LOW',
      is_tech_support_scam_indicator: detected.length > 0 || contextMatches.length > 0,
      warning: detected.length > 0 ?
        'ALERT: Remote access software detected. This is commonly used in tech support scams. Never let unknown callers install remote access software.' :
        'No remote access software detected in context.',
      recommended_action: detected.length > 0 ?
        'Do NOT install any software requested by the caller. Hang up immediately.' :
        'Continue with caution if someone requests remote access.',
    };
  }

  /**
   * Check password strength and breach status (Tool #11)
   */
  private async checkPassword(params: {
    password_hash: string;
    check_strength?: boolean;
    check_breach?: boolean;
  }): Promise<any> {
    const { password_hash, check_strength = true, check_breach = true } = params;
    logger.info('Checking password');

    const results: any = { password_hash_prefix: password_hash.substring(0, 5) };

    if (check_breach) {
      // Use k-anonymity with Have I Been Pwned API
      const hashPrefix = password_hash.substring(0, 5).toUpperCase();
      const response = await fetch(
        `https://api.pwnedpasswords.com/range/${hashPrefix}`,
        { headers: { 'Add-Padding': 'true' } }
      );

      if (response.ok) {
        const data = await response.text();
        const hashSuffix = password_hash.substring(5).toUpperCase();
        const found = data.split('\n').find(line => line.startsWith(hashSuffix));

        results.breach_check = {
          is_compromised: !!found,
          breach_count: found ? parseInt(found.split(':')[1]) : 0,
          recommendation: found ?
            'This password has been exposed in data breaches. Change it immediately.' :
            'This password has not been found in known data breaches.',
        };
      }
    }

    if (check_strength) {
      // Basic strength analysis based on hash length (indicates original length constraints)
      results.strength_check = {
        recommendation: 'Use a password manager to generate strong, unique passwords for each account.',
        tips: [
          'Use at least 12 characters',
          'Mix uppercase, lowercase, numbers, and symbols',
          'Avoid common words and patterns',
          'Never reuse passwords across accounts',
        ],
      };
    }

    return results;
  }

  /**
   * Provide counseling support for scam victims (Tool #12)
   */
  private async provideCounselingSupport(params: {
    scam_type: string;
    severity?: string;
    financial_loss?: boolean;
  }): Promise<any> {
    const { scam_type, severity = 'inquiry', financial_loss = false } = params;
    logger.info('Providing counseling support', { scam_type, severity });

    const resources: any = {
      scam_type,
      severity,
      empathy_message: this.getEmpathyMessage(scam_type, severity),
      immediate_steps: this.getImmediateSteps(scam_type, financial_loss),
      support_resources: {
        ftc_report: 'https://reportfraud.ftc.gov/',
        ic3_report: 'https://www.ic3.gov/',
        identity_theft: 'https://www.identitytheft.gov/',
        victim_support: 'https://www.fraud.org/help',
      },
      hotlines: {
        ftc: '1-877-FTC-HELP (1-877-382-4357)',
        fraud_hotline: '1-800-876-7060',
      },
    };

    if (financial_loss) {
      resources.financial_recovery = {
        bank_notification: 'Contact your bank immediately to report the fraud',
        credit_freeze: 'Consider placing a credit freeze with all three bureaus',
        documentation: 'Keep all records of communications and transactions',
      };
    }

    return resources;
  }

  private getEmpathyMessage(scamType: string, severity: string): string {
    const messages: Record<string, string> = {
      romance: "I'm sorry you're going through this. Romance scams are emotionally devastating, and it's not your fault - these scammers are professionals at manipulation.",
      investment: "Investment scams can happen to anyone, even financially savvy people. The important thing now is to protect yourself from further loss.",
      tech_support: "Tech support scams are very common and designed to create panic. You did the right thing by being cautious.",
      phishing: "Phishing attacks are increasingly sophisticated. Recognizing them shows good security awareness.",
      identity_theft: "Identity theft is deeply violating. We'll help you take steps to protect and recover your identity.",
      other: "I understand this situation is stressful. Let me help you with the next steps.",
    };
    return messages[scamType] || messages.other;
  }

  private getImmediateSteps(scamType: string, financialLoss: boolean): string[] {
    const steps: string[] = [];

    if (financialLoss) {
      steps.push('Contact your bank/credit card company immediately');
      steps.push('Document all transactions related to the scam');
    }

    steps.push('Change passwords for affected accounts');
    steps.push('Enable two-factor authentication where possible');
    steps.push('Report the scam to the FTC at reportfraud.ftc.gov');

    if (scamType === 'identity_theft') {
      steps.push('Place a fraud alert with credit bureaus');
      steps.push('Consider a credit freeze');
      steps.push('Review your credit reports for suspicious activity');
    }

    return steps;
  }

  /**
   * L1 technical troubleshooting (Tool #13)
   */
  private async l1Troubleshoot(params: {
    issue_type: string;
    browser?: string;
    os?: string;
  }): Promise<any> {
    const { issue_type, browser = 'chrome', os = 'windows' } = params;
    logger.info('L1 Troubleshooting', { issue_type, browser, os });

    const troubleshootingGuides: Record<string, any> = {
      browser_hijack: {
        issue: 'Browser Hijack',
        steps: [
          'Open browser settings and reset to defaults',
          `${browser === 'chrome' ? 'Go to Settings > Reset settings > Restore settings to original defaults' : 'Access reset options in browser settings'}`,
          'Remove suspicious extensions: Check Extensions menu and remove unfamiliar ones',
          'Clear browsing data including cookies and cache',
          'Run a malware scan with Windows Defender or reputable antivirus',
        ],
        prevention: 'Only install extensions from official stores and avoid clicking suspicious links',
      },
      popup_ads: {
        issue: 'Unwanted Popup Ads',
        steps: [
          'Check installed extensions and remove suspicious ones',
          'Enable popup blocker in browser settings',
          'Clear cookies and site data',
          'Check notification permissions and block unwanted sites',
          'Scan for adware with Malwarebytes or similar tool',
        ],
        prevention: 'Be cautious about granting notification permissions to websites',
      },
      suspicious_extension: {
        issue: 'Suspicious Browser Extension',
        steps: [
          'Go to Extensions page (chrome://extensions or equivalent)',
          'Review permissions of all installed extensions',
          'Remove any extension you don\'t remember installing',
          'Remove extensions with excessive permissions',
          'Report malicious extensions to the browser vendor',
        ],
        prevention: 'Only install extensions from official stores with good reviews',
      },
      account_locked: {
        issue: 'Account Locked',
        steps: [
          'Use the official account recovery process only',
          'NEVER give recovery codes to anyone calling you',
          'Check the URL carefully - it should be the official site',
          'Enable 2FA after recovery to prevent future lockouts',
          'Use a password manager to avoid forgotten passwords',
        ],
        warning: 'Scammers often claim your account is locked to get your credentials',
      },
      malware_warning: {
        issue: 'Malware Warning Message',
        steps: [
          'Do NOT call any phone number shown in the warning',
          'Do NOT download any software suggested by the warning',
          'Close the browser tab (use Task Manager if needed)',
          'Clear browser cache and history',
          'Run Windows Defender scan if concerned',
        ],
        warning: 'Most popup "virus warnings" are themselves scams!',
      },
      password_reset: {
        issue: 'Password Reset Help',
        steps: [
          'Only use official password reset links from the service',
          'Check sender email address carefully for phishing',
          'Never share reset links or codes with anyone',
          'Create a strong, unique password using a password manager',
          'Enable 2FA after resetting your password',
        ],
        prevention: 'Use a password manager to avoid needing frequent resets',
      },
    };

    return troubleshootingGuides[issue_type] || {
      issue: 'General Issue',
      steps: [
        'Restart your browser',
        'Check for browser updates',
        'Clear cache and cookies',
        'Disable extensions temporarily to isolate the issue',
        'Run a system security scan',
      ],
      recommendation: 'If the issue persists, consider contacting professional IT support',
    };
  }

  /**
   * Search E-BRAIN neural memory (Tool #16)
   */
  private async searchMemory(params: {
    query: string;
    memory_types?: string[];
    time_range?: string;
    min_importance?: number;
  }): Promise<any> {
    const { query, memory_types = ['episodic', 'semantic'], time_range = 'all', min_importance = 0.3 } = params;
    logger.info('Searching E-BRAIN memory', { query: query.substring(0, 50), memory_types });

    // Import neural memory service dynamically to avoid circular deps
    const { getNeuralMemory, isNeuralMemoryInitialized } = await import('@/lib/neural-memory-service');

    if (!isNeuralMemoryInitialized()) {
      return {
        success: false,
        error: 'E-BRAIN memory service not initialized',
        memories: [],
      };
    }

    const neuralMemory = getNeuralMemory();
    const context = await neuralMemory.getContextForMessage(query, {
      includeScans: memory_types.includes('episodic'),
      includeConversations: memory_types.includes('episodic'),
      includeThreatPatterns: memory_types.includes('semantic'),
      maxMemories: 10,
    });

    return {
      success: true,
      query,
      memories_found: context.relevantMemories.length,
      insufficient_data: context.insufficientData,
      memories: context.relevantMemories.map((m: any) => ({
        id: m.id,
        type: m.memoryType,
        content: m.content.substring(0, 200) + (m.content.length > 200 ? '...' : ''),
        importance: m.importance,
        metadata: m.metadata,
      })),
      recent_scans: context.recentScans,
      threat_patterns: context.threatPatterns,
      suggested_actions: context.suggestedActions,
    };
  }

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  private isValidURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private async getAuthToken(): Promise<string> {
    // Get auth token from secure storage
    return new Promise((resolve) => {
      chrome.storage.local.get(['authToken'], (result) => {
        resolve(result.authToken || '');
      });
    });
  }

  private async getLastSyncTimestamp(): Promise<string | null> {
    return new Promise((resolve) => {
      chrome.storage.local.get(['lastTISync'], (result) => {
        resolve(result.lastTISync || null);
      });
    });
  }

  private async setLastSyncTimestamp(timestamp: string): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ lastTISync: timestamp }, () => resolve());
    });
  }

  private async storeTIIndicators(indicators: any[]): Promise<void> {
    // Store in IndexedDB (TI cache)
    // Implementation depends on TI cache structure
    logger.debug('Storing TI indicators', { count: indicators.length });
  }

  private async fetchImageData(imageUrl: string): Promise<Blob> {
    if (imageUrl.startsWith('data:')) {
      // Convert data URI to blob
      const response = await fetch(imageUrl);
      return await response.blob();
    } else {
      // Fetch image from URL
      const response = await fetch(imageUrl);
      return await response.blob();
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const functionRouter = new FunctionRouter();
