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
        return this.scanURL(parameters);

      case 'search_threat_intelligence':
        return this.searchTI(parameters);

      case 'analyze_image':
        return this.analyzeImage(parameters);

      case 'analyze_sentiment':
        return this.analyzeSentiment(parameters);

      case 'lookup_indicators':
        return this.lookupIndicators(parameters);

      case 'get_user_profile':
        return this.getUserProfile();

      case 'add_to_whitelist':
        return this.addToWhitelist(parameters);

      case 'add_to_blacklist':
        return this.addToBlacklist(parameters);

      case 'sync_threat_intelligence':
        return this.syncTI(parameters);

      case 'explain_security_concept':
        return this.explainConcept(parameters);

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
