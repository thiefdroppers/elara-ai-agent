/**
 * Elara AI Agent - Scanner API Client
 *
 * ARCHITECTURE:
 * 1. First tries Edge Engine (local ML) for fast results
 * 2. Falls back to Backend API if Edge Engine unavailable
 *
 * Edge Engine: Local MobileBERT + pirocheto models (<100ms)
 * Backend API: Scanner V2 full pipeline (1-30s)
 */

import { authClient } from './auth-client';
import { edgeEngineClient, formatScanResultForChat } from './edge-engine-client';
import type {
  HybridScanRequest,
  HybridScanResponse,
  DeepScanRequest,
  DeepScanResponse,
  TISyncResponse,
  ScanResult,
  Verdict,
  RiskLevel,
} from '@/types';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE_URL = 'https://dev-api.thiefdroppers.com/api/v2';
const TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// ============================================================================
// SCANNER CLIENT CLASS
// ============================================================================

class ScannerClient {
  private isInitialized = false;

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize auth client
      await authClient.initialize();
      this.isInitialized = true;
      console.log('[ScannerClient] Initialized');
    } catch (error) {
      console.error('[ScannerClient] Initialization failed:', error);
      this.isInitialized = true; // Still mark as initialized
    }
  }

  // --------------------------------------------------------------------------
  // Hybrid Scan (Edge + TI Enrichment)
  // --------------------------------------------------------------------------

  async hybridScan(url: string): Promise<ScanResult> {
    await this.initialize();

    console.log('[ScannerClient] ========================================');
    console.log('[ScannerClient] HYBRID SCAN - Trying Edge Engine first');
    console.log('[ScannerClient] URL:', url);
    console.log('[ScannerClient] ========================================');

    // STEP 1: Try Edge Engine (local ML - fast)
    try {
      const edgeResult = await edgeEngineClient.quickScan(url);

      if (edgeResult) {
        console.log('[ScannerClient] EDGE ENGINE SUCCESS:', edgeResult.verdict, `(${edgeResult.riskScore}%)`);

        return {
          url: edgeResult.url,
          verdict: edgeResult.verdict as Verdict,
          riskLevel: edgeResult.riskLevel as RiskLevel,
          riskScore: edgeResult.riskScore / 100, // Normalize to 0-1
          confidence: edgeResult.confidence,
          threatType: edgeResult.verdict === 'DANGEROUS' ? 'phishing' : undefined,
          indicators: edgeResult.reasoning.map((r, i) => ({
            type: 'analysis',
            value: r,
            severity: edgeResult.riskLevel <= 'B' ? 'low' : edgeResult.riskLevel <= 'D' ? 'medium' : 'high',
            description: r,
          })),
          reasoning: edgeResult.reasoning,
          scanType: edgeResult.source === 'edge' ? 'edge' : 'hybrid',
          latency: edgeResult.latency,
          timestamp: Date.now(),
        };
      }
    } catch (edgeError) {
      console.warn('[ScannerClient] Edge Engine failed:', edgeError);
    }

    // STEP 2: Fallback to Backend TI Lookup API
    console.log('[ScannerClient] Falling back to Backend API: /ti/lookup');

    try {
      const response = await this.fetchWithRetry<any>(
        '/ti/lookup',
        {
          method: 'POST',
          body: JSON.stringify({ url }),
        }
      );

      if (response.success && response.data) {
        console.log('[ScannerClient] BACKEND TI LOOKUP SUCCESS');
        return this.convertTILookupToScanResult(url, response.data);
      }

      throw new Error('Invalid TI lookup response');
    } catch (error) {
      console.warn('[ScannerClient] Backend API also failed, using local fallback:', error);
      return this.performEdgeFallback(url);
    }
  }

  // --------------------------------------------------------------------------
  // Deep Scan (Full Scanner V2 Pipeline)
  // --------------------------------------------------------------------------

  async deepScan(url: string): Promise<ScanResult> {
    await this.initialize();

    console.log('[ScannerClient] ========================================');
    console.log('[ScannerClient] DEEP SCAN - Full Scanner V2 Pipeline');
    console.log('[ScannerClient] URL:', url);
    console.log('[ScannerClient] ========================================');

    // STEP 1: Try Edge Engine Deep Scan (calls Scanner V2 via cloud-client)
    try {
      console.log('[ScannerClient] Trying Edge Engine deepScan...');
      const edgeResult = await edgeEngineClient.deepScan(url);

      if (edgeResult) {
        console.log('[ScannerClient] EDGE ENGINE DEEP SCAN SUCCESS:', edgeResult.verdict);

        return {
          url: edgeResult.url,
          verdict: edgeResult.verdict as Verdict,
          riskLevel: edgeResult.riskLevel as RiskLevel,
          riskScore: edgeResult.riskScore / 100,
          confidence: edgeResult.confidence,
          threatType: edgeResult.verdict === 'DANGEROUS' ? 'phishing' : undefined,
          indicators: edgeResult.reasoning.map((r) => ({
            type: 'deep_analysis',
            value: r,
            severity: edgeResult.riskLevel <= 'B' ? 'low' : edgeResult.riskLevel <= 'D' ? 'medium' : 'critical',
            description: r,
          })),
          reasoning: edgeResult.reasoning,
          scanType: 'deep',
          latency: edgeResult.latency,
          timestamp: Date.now(),
        };
      }
    } catch (edgeError) {
      console.warn('[ScannerClient] Edge Engine deep scan failed:', edgeError);
    }

    // STEP 2: Direct Backend Scanner V2 API call
    console.log('[ScannerClient] Falling back to Backend API: /v2/scan/uri');

    try {
      const response = await this.fetchWithRetry<any>(
        '/v2/scan/uri',
        {
          method: 'POST',
          body: JSON.stringify({
            url,
            options: {
              scanMode: 'deep',
              skipScreenshot: false,
              skipTLS: false,
              skipWHOIS: false,
              skipStage2: false,
            },
          }),
        }
      );

      if (response.success && response.data) {
        console.log('[ScannerClient] BACKEND SCANNER V2 SUCCESS');
        return this.convertScannerV2ToScanResult(url, response.data);
      }

      throw new Error('Scanner V2 scan failed');
    } catch (error) {
      console.warn('[ScannerClient] Backend Scanner V2 also failed:', error);

      // STEP 3: Try legacy scanner endpoint
      try {
        console.log('[ScannerClient] Trying legacy endpoint: /v2/scanner/deep');
        const legacyResponse = await this.fetchWithRetry<any>(
          '/v2/scanner/deep',
          {
            method: 'POST',
            body: JSON.stringify({ url }),
          }
        );

        if (legacyResponse.success && legacyResponse.data) {
          console.log('[ScannerClient] LEGACY SCANNER SUCCESS');
          return this.convertScannerV2ToScanResult(url, legacyResponse.data);
        }
      } catch (legacyError) {
        console.warn('[ScannerClient] Legacy scanner also failed:', legacyError);
      }

      // Final fallback: local pattern analysis
      console.warn('[ScannerClient] All APIs failed, using local pattern analysis');
      return this.performEdgeFallback(url);
    }
  }

  /**
   * Convert TI lookup response to ScanResult format
   */
  private convertTILookupToScanResult(url: string, data: any): ScanResult {
    const startTime = performance.now();

    const domain = data.domain || new URL(url).hostname;
    const whitelist = data.whitelist;
    const blacklist = data.blacklist;
    const blacklistHits = data.blacklistHits || 0;
    const whitelistHits = data.whitelistHits || 0;

    let verdict: 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS' | 'UNKNOWN' = 'UNKNOWN';
    let riskScore = 0.5;
    let threatType: string | undefined;
    const indicators: ScanResult['indicators'] = [];
    const reasoning: string[] = [];

    if (whitelist) {
      verdict = 'SAFE';
      riskScore = 0.1;
      reasoning.push(`Whitelisted by ${whitelist.source}`);
      reasoning.push(`Confidence: ${whitelist.confidence}%`);
      if (whitelist.reason) {
        reasoning.push(whitelist.reason);
      }
      indicators.push({
        type: 'whitelist',
        value: domain,
        severity: 'low',
        description: `Whitelisted by ${whitelist.source}`,
      });
    } else if (blacklist) {
      verdict = 'DANGEROUS';
      riskScore = 0.9;
      threatType = blacklist.threatType || 'phishing';
      reasoning.push(`Blacklisted by ${blacklist.source}`);
      reasoning.push(`Threat Type: ${blacklist.threatType}`);
      reasoning.push(`Severity: ${blacklist.severity}`);
      reasoning.push(`Confidence: ${blacklist.confidence}%`);
      indicators.push({
        type: 'blacklist',
        value: domain,
        severity: 'critical',
        description: `Blacklisted - ${blacklist.threatType}`,
      });
    } else if (blacklistHits > 0 || whitelistHits > 0) {
      // Has some TI hits but not definitive
      if (blacklistHits > whitelistHits) {
        verdict = 'SUSPICIOUS';
        riskScore = 0.65;
        reasoning.push(`${blacklistHits} blacklist indicators found`);
      } else {
        verdict = 'SAFE';
        riskScore = 0.25;
        reasoning.push(`${whitelistHits} whitelist indicators found`);
      }
    }

    // Add source information
    const sources = data.sources || {};
    if (sources.tier1 && sources.tier1.length > 0) {
      reasoning.push(`Tier-1 sources checked: ${sources.tier1.length}`);
      sources.tier1.slice(0, 3).forEach((src: any) => {
        indicators.push({
          type: 'ti_source',
          value: src.name,
          severity: src.classification === 'blacklist' ? 'high' : 'low',
          description: `${src.name}: ${src.classification}`,
        });
      });
    }

    const latency = performance.now() - startTime;

    return {
      url,
      verdict,
      riskLevel: this.getRiskLevel(riskScore),
      riskScore,
      confidence: 0.85, // TI lookups have high confidence
      threatType,
      indicators,
      reasoning,
      scanType: 'hybrid',
      latency,
      timestamp: Date.now(),
    };
  }

  /**
   * Convert Scanner V2 response to ScanResult format
   */
  private convertScannerV2ToScanResult(url: string, data: any): ScanResult {
    const riskScore = data.riskScore || data.probability || 0.5;
    const verdict = data.decision === 'BLOCK' ? 'DANGEROUS' :
                    data.decision === 'WARN' ? 'SUSPICIOUS' :
                    data.isPhishing ? 'DANGEROUS' : 'SAFE';
    const riskLevel = data.riskLevel || this.getRiskLevel(riskScore);

    const indicators: ScanResult['indicators'] = [];
    const reasoning: string[] = [];

    // Add TI data
    const tiData = data.tiData || data.threatIntelligence || {};
    if (tiData.blacklistHits > 0) {
      reasoning.push(`${tiData.blacklistHits} threat intelligence blacklist hits`);
      if (tiData.hasDualTier1) {
        indicators.push({
          type: 'ti_critical',
          value: 'Dual Tier-1 blacklist',
          severity: 'critical',
          description: 'Multiple high-confidence threat sources flagged this URL',
        });
      }
    }

    // Add ML model consensus
    if (data.modelConsensus) {
      reasoning.push(`ML model agreement: ${data.modelConsensus.agreement}`);
    }

    // Add category results
    const categories = data.categoryResults || data.threatCategories || {};
    Object.entries(categories).forEach(([category, result]: [string, any]) => {
      const score = typeof result === 'object' ? result.score : result;
      if (score > 0.7) {
        indicators.push({
          type: 'threat_category',
          value: category,
          severity: 'high',
          description: `${category}: ${(score * 100).toFixed(1)}%`,
        });
      }
    });

    // Add summary
    if (data.summary || data.geminiSummary) {
      reasoning.push(data.summary || data.geminiSummary);
    }

    return {
      url,
      verdict,
      riskLevel,
      riskScore,
      confidence: data.confidenceInterval ? 0.95 : 0.85,
      threatType: data.isPhishing ? 'phishing' : undefined,
      indicators,
      reasoning,
      scanType: 'deep',
      latency: data.metadata?.scanDuration || 0,
      timestamp: Date.now(),
    };
  }

  // --------------------------------------------------------------------------
  // AI Chat (Uses Elara Platform's Gemini AI - fixed endpoint)
  // --------------------------------------------------------------------------

  async chat(message: string, context?: {
    systemPrompt?: string;
    availableTools?: string[];
    conversationId?: string;
    toolContext?: string;
  }): Promise<string> {
    await this.initialize();

    console.log('[ScannerClient] ========================================');
    console.log('[ScannerClient] CALLING GEMINI API: /ai/chat');
    console.log('[ScannerClient] Message:', message.substring(0, 100) + (message.length > 100 ? '...' : ''));
    console.log('[ScannerClient] ========================================');

    try {
      // Use the fixed /ai/chat endpoint with system prompt
      const response = await this.fetchWithRetry<any>(
        '/ai/chat',
        {
          method: 'POST',
          body: JSON.stringify({
            message,
            systemPrompt: context?.systemPrompt,
            context: {
              tools: context?.availableTools,
              conversationId: context?.conversationId,
            },
          }),
        }
      );

      if (response.success && response.data) {
        const result = response.data.response || response.data.message || response.data;
        console.log('[ScannerClient] GEMINI RESPONSE RECEIVED:', result.substring(0, 100) + (result.length > 100 ? '...' : ''));
        return result;
      }

      throw new Error('Invalid chat response');
    } catch (error) {
      console.error('[ScannerClient] AI Chat API FAILED:', error);
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // TI Sync
  // --------------------------------------------------------------------------

  async getFederatedSync(lastSync?: number): Promise<TISyncResponse> {
    await this.initialize();

    const params = lastSync ? `?since=${lastSync}` : '';

    try {
      return await this.fetchWithRetry<TISyncResponse>(
        `/ti/federated-sync${params}`,
        { method: 'GET' }
      );
    } catch (error) {
      console.warn('[ScannerClient] TI sync failed:', error);
      return { timestamp: Date.now(), updates: [] };
    }
  }

  // --------------------------------------------------------------------------
  // Search Threat Intelligence
  // --------------------------------------------------------------------------

  async searchThreatIntelligence(indicator: string): Promise<any> {
    await this.initialize();

    try {
      const response = await this.fetchWithRetry<any>(
        '/ti/lookup',
        {
          method: 'POST',
          body: JSON.stringify({ url: indicator }),
        }
      );

      if (response.success && response.data) {
        const data = response.data;
        return {
          found: !!(data.blacklist || data.whitelist),
          indicator,
          verdict: data.blacklist ? 'DANGEROUS' : data.whitelist ? 'SAFE' : 'UNKNOWN',
          source: data.blacklist?.source || data.whitelist?.source || 'Elara TI',
          severity: data.blacklist?.severity || 'low',
          firstSeen: data.blacklist?.firstSeen || data.whitelist?.firstSeen,
          blacklistHits: data.blacklistHits || 0,
          whitelistHits: data.whitelistHits || 0,
        };
      }

      return { found: false, indicator };
    } catch (error) {
      console.warn('[ScannerClient] TI search failed:', error);
      return { found: false, indicator, error: String(error) };
    }
  }

  // --------------------------------------------------------------------------
  // Image Analysis (Deepfake Detection)
  // --------------------------------------------------------------------------

  async analyzeImage(imageUrl: string, analysisType: string): Promise<any> {
    await this.initialize();

    try {
      const response = await this.fetchWithRetry<any>(
        '/ai/analyze-image',
        {
          method: 'POST',
          body: JSON.stringify({
            imageUrl,
            analysisType,
          }),
        }
      );

      if (response.success && response.data) {
        return response.data;
      }

      return { status: 'ANALYSIS_UNAVAILABLE', message: 'Image analysis service not available' };
    } catch (error) {
      console.warn('[ScannerClient] Image analysis failed:', error);
      return { status: 'ERROR', error: String(error) };
    }
  }

  // --------------------------------------------------------------------------
  // Sentiment Analysis (Phishing Email Detection)
  // --------------------------------------------------------------------------

  async analyzeSentiment(text: string): Promise<any> {
    await this.initialize();

    try {
      const response = await this.fetchWithRetry<any>(
        '/ai/analyze-sentiment',
        {
          method: 'POST',
          body: JSON.stringify({ text }),
        }
      );

      if (response.success && response.data) {
        return response.data;
      }

      // Fallback: basic analysis
      return this.performBasicSentimentAnalysis(text);
    } catch (error) {
      console.warn('[ScannerClient] Sentiment analysis failed:', error);
      return this.performBasicSentimentAnalysis(text);
    }
  }

  private performBasicSentimentAnalysis(text: string): any {
    const lowerText = text.toLowerCase();
    const urgencyWords = ['urgent', 'immediately', 'act now', 'expires', 'suspended', 'verify', 'confirm'];
    const suspiciousWords = ['password', 'credit card', 'social security', 'bank account', 'wire transfer'];
    const manipulationWords = ['limited time', 'special offer', 'you won', 'congratulations', 'claim now'];

    const urgencyScore = urgencyWords.filter(w => lowerText.includes(w)).length * 0.15;
    const suspiciousScore = suspiciousWords.filter(w => lowerText.includes(w)).length * 0.20;
    const manipulationScore = manipulationWords.filter(w => lowerText.includes(w)).length * 0.15;

    const totalScore = Math.min(1, urgencyScore + suspiciousScore + manipulationScore);

    return {
      score: totalScore,
      verdict: totalScore > 0.5 ? 'SUSPICIOUS' : 'CLEAN',
      indicators: {
        urgency: urgencyScore > 0,
        sensitiveRequests: suspiciousScore > 0,
        manipulation: manipulationScore > 0,
      },
      analysis: 'Basic pattern-based analysis',
    };
  }

  // --------------------------------------------------------------------------
  // User Profile Management
  // --------------------------------------------------------------------------

  async getUserProfile(): Promise<any> {
    await this.initialize();

    try {
      const response = await this.fetchWithRetry<any>(
        '/user/profile',
        { method: 'GET' }
      );

      if (response.success && response.data) {
        return response.data;
      }

      return { email: 'Anonymous', totalScans: 0, whitelist: [], blacklist: [] };
    } catch (error) {
      console.warn('[ScannerClient] Get profile failed:', error);
      return { email: 'Anonymous', totalScans: 0, whitelist: [], blacklist: [] };
    }
  }

  // --------------------------------------------------------------------------
  // Whitelist/Blacklist Management
  // --------------------------------------------------------------------------

  async addToWhitelist(domain: string): Promise<any> {
    await this.initialize();

    try {
      const response = await this.fetchWithRetry<any>(
        '/user/whitelist',
        {
          method: 'POST',
          body: JSON.stringify({ domain }),
        }
      );

      return response.success ? { success: true, domain } : { success: false, error: 'Failed to add' };
    } catch (error) {
      console.warn('[ScannerClient] Add to whitelist failed:', error);
      return { success: false, error: String(error) };
    }
  }

  async addToBlacklist(domain: string, reason?: string): Promise<any> {
    await this.initialize();

    try {
      const response = await this.fetchWithRetry<any>(
        '/user/blacklist',
        {
          method: 'POST',
          body: JSON.stringify({ domain, reason }),
        }
      );

      return response.success ? { success: true, domain } : { success: false, error: 'Failed to add' };
    } catch (error) {
      console.warn('[ScannerClient] Add to blacklist failed:', error);
      return { success: false, error: String(error) };
    }
  }

  // --------------------------------------------------------------------------
  // Sync Threat Intelligence
  // --------------------------------------------------------------------------

  async syncThreatIntelligence(force?: boolean): Promise<any> {
    await this.initialize();

    try {
      const response = await this.fetchWithRetry<any>(
        '/ti/sync',
        {
          method: 'POST',
          body: JSON.stringify({ force: force || false }),
        }
      );

      if (response.success && response.data) {
        return {
          success: true,
          message: response.data.message || 'Sync completed',
          newIndicators: response.data.newIndicators || 0,
          lastSync: response.data.lastSync || Date.now(),
        };
      }

      return { success: true, message: 'Sync completed', newIndicators: 0 };
    } catch (error) {
      console.warn('[ScannerClient] TI sync failed:', error);
      return { success: false, error: String(error) };
    }
  }

  // --------------------------------------------------------------------------
  // Web Search
  // --------------------------------------------------------------------------

  async webSearch(query: string): Promise<any> {
    await this.initialize();

    try {
      const response = await this.fetchWithRetry<any>(
        '/ai/search',
        {
          method: 'POST',
          body: JSON.stringify({ query }),
        }
      );

      if (response.success && response.data) {
        return response.data;
      }

      return { results: [], message: 'Web search not available' };
    } catch (error) {
      console.warn('[ScannerClient] Web search failed:', error);
      return { results: [], error: String(error) };
    }
  }

  // --------------------------------------------------------------------------
  // Edge Fallback (Local Analysis)
  // --------------------------------------------------------------------------

  private performEdgeFallback(url: string): ScanResult {
    const startTime = performance.now();

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch {
      return this.createErrorResult(url, 'Invalid URL format');
    }

    const indicators: ScanResult['indicators'] = [];
    let riskScore = 0;
    const reasoning: string[] = [];

    // Analyze URL patterns
    const hostname = parsedUrl.hostname.toLowerCase();

    // Check for IP address
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      indicators.push({
        type: 'ip_address',
        value: hostname,
        severity: 'high',
        description: 'URL uses IP address instead of domain name',
      });
      riskScore += 0.30;
      reasoning.push('Uses IP address instead of domain');
    }

    // =========================================================================
    // TYPOSQUATTING DETECTION - Critical for detecting kbb-vision.com type attacks
    // =========================================================================
    const knownBrands = [
      { domain: 'kbb.com', name: 'Kelley Blue Book' },
      { domain: 'paypal.com', name: 'PayPal' },
      { domain: 'amazon.com', name: 'Amazon' },
      { domain: 'microsoft.com', name: 'Microsoft' },
      { domain: 'google.com', name: 'Google' },
      { domain: 'apple.com', name: 'Apple' },
      { domain: 'facebook.com', name: 'Facebook' },
      { domain: 'netflix.com', name: 'Netflix' },
      { domain: 'chase.com', name: 'Chase Bank' },
      { domain: 'wellsfargo.com', name: 'Wells Fargo' },
      { domain: 'bankofamerica.com', name: 'Bank of America' },
    ];

    for (const brand of knownBrands) {
      const brandName = brand.domain.split('.')[0];
      // Check for brand name with hyphen or other separator (e.g., kbb-vision)
      if (hostname.includes(brandName) && hostname !== brand.domain && !hostname.endsWith(`.${brand.domain}`)) {
        indicators.push({
          type: 'typosquatting',
          value: hostname,
          severity: 'critical',
          description: `Possible typosquatting attempt on ${brand.name} (${brand.domain})`,
        });
        riskScore += 0.45;
        reasoning.push(`CRITICAL: Possible typosquatting attempt on ${brand.name}`);
        reasoning.push(`Legitimate domain: ${brand.domain}, Suspicious: ${hostname}`);
        break;
      }
    }

    // Check for suspicious TLD
    const tld = hostname.split('.').pop() || '';
    const riskyTLDs = ['tk', 'ml', 'ga', 'cf', 'gq', 'xyz', 'top', 'work', 'click', 'info', 'online', 'site', 'vip'];
    if (riskyTLDs.includes(tld)) {
      indicators.push({
        type: 'risky_tld',
        value: tld,
        severity: 'medium',
        description: `High-risk TLD: .${tld}`,
      });
      riskScore += 0.20;
      reasoning.push(`High-risk TLD: .${tld} (commonly used in phishing)`);
    }

    // Check for excessive subdomains
    const subdomainCount = hostname.split('.').length - 2;
    if (subdomainCount > 3) {
      indicators.push({
        type: 'excessive_subdomains',
        value: String(subdomainCount),
        severity: 'medium',
        description: `Excessive subdomains: ${subdomainCount}`,
      });
      riskScore += 0.15;
      reasoning.push(`${subdomainCount} subdomains detected (sign of subdomain abuse)`);
    }

    // Check for suspicious keywords
    const suspiciousKeywords = [
      'login', 'signin', 'account', 'verify', 'secure', 'update',
      'confirm', 'banking', 'paypal', 'amazon', 'microsoft', 'google',
      'password', 'wallet', 'auth', 'credential',
    ];
    const foundKeywords = suspiciousKeywords.filter(kw =>
      hostname.includes(kw) || parsedUrl.pathname.includes(kw)
    );
    if (foundKeywords.length > 0) {
      indicators.push({
        type: 'suspicious_keywords',
        value: foundKeywords.join(', '),
        severity: foundKeywords.length >= 2 ? 'high' : 'medium',
        description: `Suspicious keywords: ${foundKeywords.join(', ')}`,
      });
      riskScore += 0.15 * foundKeywords.length;
      reasoning.push(`Contains ${foundKeywords.length} suspicious keywords`);
    }

    // Check for hyphens (typosquatting indicator) - CRITICAL for kbb-vision detection
    const hyphenCount = (hostname.match(/-/g) || []).length;
    if (hyphenCount >= 1) {
      // Even one hyphen is suspicious for known brands
      const hasBrandName = knownBrands.some(brand => hostname.includes(brand.domain.split('.')[0]));
      if (hasBrandName && hyphenCount >= 1) {
        indicators.push({
          type: 'suspicious_hyphens',
          value: String(hyphenCount),
          severity: 'high',
          description: `Domain contains hyphen with brand name - likely typosquatting`,
        });
        riskScore += 0.30;
        reasoning.push(`Hyphenated brand name (common typosquatting technique)`);
      } else if (hyphenCount > 2) {
        indicators.push({
          type: 'excessive_hyphens',
          value: String(hyphenCount),
          severity: 'medium',
          description: `Excessive hyphens in domain: ${hyphenCount}`,
        });
        riskScore += 0.10;
        reasoning.push(`${hyphenCount} hyphens in domain`);
      }
    }

    // Check for numbers in domain (suspicious for brands)
    const digitCount = (hostname.match(/\d/g) || []).length;
    if (digitCount > 0) {
      const hasBrandName = knownBrands.some(brand => hostname.includes(brand.domain.split('.')[0]));
      if (hasBrandName) {
        indicators.push({
          type: 'suspicious_digits',
          value: String(digitCount),
          severity: 'medium',
          description: `Brand name with digits - possible typosquatting`,
        });
        riskScore += 0.15;
        reasoning.push(`Brand domain with numbers (suspicious pattern)`);
      }
    }

    // Check for HTTPS
    if (parsedUrl.protocol !== 'https:') {
      indicators.push({
        type: 'no_https',
        value: parsedUrl.protocol,
        severity: 'medium',
        description: 'Not using HTTPS',
      });
      riskScore += 0.15;
      reasoning.push('Not using HTTPS encryption');
    }

    // Check for long domain
    if (hostname.length > 40) {
      indicators.push({
        type: 'long_domain',
        value: String(hostname.length),
        severity: 'low',
        description: `Unusually long domain: ${hostname.length} characters`,
      });
      riskScore += 0.05;
      reasoning.push('Unusually long domain name');
    }

    // Check for known safe domains
    const safeDomains = [
      'google.com', 'microsoft.com', 'apple.com', 'amazon.com',
      'github.com', 'facebook.com', 'twitter.com', 'linkedin.com',
      'youtube.com', 'netflix.com', 'paypal.com', 'ebay.com',
    ];
    const isSafeDomain = safeDomains.some(safe =>
      hostname === safe || hostname.endsWith(`.${safe}`)
    );
    if (isSafeDomain) {
      riskScore = Math.max(0, riskScore - 0.5);
      reasoning.unshift('Known trusted domain');
    }

    // Clamp risk score
    riskScore = Math.min(1, Math.max(0, riskScore));

    // Determine verdict and risk level
    const verdict = this.getVerdict(riskScore);
    const riskLevel = this.getRiskLevel(riskScore);

    const latency = performance.now() - startTime;

    return {
      url,
      verdict,
      riskLevel,
      riskScore,
      confidence: 0.75, // Edge analysis has moderate confidence
      threatType: riskScore > 0.5 ? 'phishing' : undefined,
      indicators,
      reasoning,
      scanType: 'edge',
      latency,
      timestamp: Date.now(),
    };
  }

  private createErrorResult(url: string, error: string): ScanResult {
    return {
      url,
      verdict: 'UNKNOWN',
      riskLevel: 'C',
      riskScore: 0.5,
      confidence: 0,
      indicators: [],
      reasoning: [`Error: ${error}`],
      scanType: 'edge',
      latency: 0,
      timestamp: Date.now(),
    };
  }

  private getVerdict(riskScore: number): Verdict {
    if (riskScore >= 0.7) return 'DANGEROUS';
    if (riskScore >= 0.4) return 'SUSPICIOUS';
    if (riskScore >= 0.2) return 'UNKNOWN';
    return 'SAFE';
  }

  private getRiskLevel(riskScore: number): RiskLevel {
    if (riskScore >= 0.85) return 'F';
    if (riskScore >= 0.70) return 'E';
    if (riskScore >= 0.55) return 'D';
    if (riskScore >= 0.40) return 'C';
    if (riskScore >= 0.20) return 'B';
    return 'A';
  }

  // --------------------------------------------------------------------------
  // HTTP Client with Retry
  // --------------------------------------------------------------------------

  private async fetchWithRetry<T>(
    endpoint: string,
    options: RequestInit,
    retries = MAX_RETRIES
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    // Get valid auth token
    const token = await authClient.ensureValidToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...headers, ...(options.headers || {}) },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ScannerClient] API error ${response.status}:`, errorText);
        throw new Error(`API error ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (retries > 0 && !String(error).includes('abort')) {
        console.log(`[ScannerClient] Retrying... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`);
        await this.delay(RETRY_DELAY_MS * (MAX_RETRIES - retries + 1));
        return this.fetchWithRetry<T>(endpoint, options, retries - 1);
      }

      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const scannerClient = new ScannerClient();
