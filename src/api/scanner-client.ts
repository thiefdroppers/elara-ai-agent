/**
 * Elara AI Agent - Scanner API Client
 *
 * Wired to Elara Platform at dev-api.thiefdroppers.com
 * Provides hybrid and deep scan capabilities with proper error handling.
 */

import { authClient } from './auth-client';
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

    const request: HybridScanRequest = {
      url,
      options: {
        includeWhois: true,
        maxRedirects: 5,
      },
    };

    try {
      const response = await this.fetchWithRetry<HybridScanResponse>(
        '/scanner/hybrid',
        {
          method: 'POST',
          body: JSON.stringify(request),
        }
      );

      return response.result;
    } catch (error) {
      console.warn('[ScannerClient] Hybrid scan failed, using edge fallback:', error);
      return this.performEdgeFallback(url);
    }
  }

  // --------------------------------------------------------------------------
  // Deep Scan (Full Scanner V2 Pipeline)
  // --------------------------------------------------------------------------

  async deepScan(url: string): Promise<ScanResult> {
    await this.initialize();

    const request: DeepScanRequest = {
      url,
      depth: 'comprehensive',
    };

    try {
      const response = await this.fetchWithRetry<DeepScanResponse>(
        '/scanner/deep',
        {
          method: 'POST',
          body: JSON.stringify(request),
        }
      );

      return response.result;
    } catch (error) {
      console.warn('[ScannerClient] Deep scan failed, using edge fallback:', error);
      return this.performEdgeFallback(url);
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
