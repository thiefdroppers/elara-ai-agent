/**
 * Elara Edge Engine - Feature Extractor
 *
 * Progressive URL feature extraction with three tiers:
 * - Tier 1: Lexical features only (instant, no network)
 * - Tier 2: + DOM analysis (requires page access)
 * - Tier 3: + Network metadata (certificate, redirects)
 */

import type {
  URLFeatures,
  LexicalFeatures,
  DOMFeatures,
  NetworkFeatures,
  TICacheHit,
} from '@/types';
import { tiCache } from '@background/ti-cache';
import { cloudTIClient } from './cloud-ti-client';

// ============================================================================
// CONFIGURATION
// ============================================================================

// High-risk TLDs (commonly used in phishing)
const HIGH_RISK_TLDS: Record<string, number> = {
  'tk': 0.9,
  'ml': 0.85,
  'ga': 0.85,
  'cf': 0.85,
  'gq': 0.85,
  'xyz': 0.7,
  'top': 0.7,
  'work': 0.65,
  'click': 0.65,
  'link': 0.6,
  'info': 0.5,
  'online': 0.55,
  'site': 0.5,
  'website': 0.5,
};

// Trusted TLDs (usually legitimate)
const TRUSTED_TLDS: Set<string> = new Set([
  'gov', 'edu', 'mil', 'int',
]);

// Suspicious keywords in URLs
const SUSPICIOUS_KEYWORDS = [
  'login', 'signin', 'sign-in', 'account', 'password', 'verify',
  'secure', 'update', 'confirm', 'banking', 'paypal', 'amazon',
  'apple', 'microsoft', 'google', 'facebook', 'instagram', 'netflix',
  'wallet', 'crypto', 'bitcoin', 'support', 'suspended', 'locked',
  'urgent', 'alert', 'warning', 'expire', 'limit', 'unusual',
];

// Brand names for brand impersonation detection
const BRAND_NAMES = [
  'paypal', 'amazon', 'apple', 'microsoft', 'google', 'facebook',
  'instagram', 'netflix', 'linkedin', 'twitter', 'spotify', 'dropbox',
  'adobe', 'chase', 'wellsfargo', 'bankofamerica', 'citibank', 'usaa',
];

// ============================================================================
// FEATURE EXTRACTOR CLASS
// ============================================================================

export class FeatureExtractor {
  // --------------------------------------------------------------------------
  // Main Extraction Method
  // --------------------------------------------------------------------------

  async extract(
    url: string,
    tier: 1 | 2 | 3 = 1,
    tabId?: number
  ): Promise<URLFeatures> {
    const startTime = performance.now();

    // Always extract lexical features (instant)
    const lexical = this.extractLexical(url);

    // Check TI cache
    const tiHit = await this.checkTICache(url);

    let dom: DOMFeatures | undefined;
    let network: NetworkFeatures | undefined;

    // Tier 2: Add DOM features if we have tab access
    if (tier >= 2 && tabId !== undefined) {
      try {
        dom = await this.extractDOM(tabId);
      } catch (error) {
        console.warn('[FeatureExtractor] DOM extraction failed:', error);
      }
    }

    // Tier 3: Add network features
    if (tier >= 3) {
      try {
        network = await this.extractNetwork(url);
      } catch (error) {
        console.warn('[FeatureExtractor] Network extraction failed:', error);
      }
    }

    const extractionLatency = performance.now() - startTime;

    return {
      url,
      lexical,
      dom,
      network,
      tiHit: tiHit ?? undefined,
      extractionTier: tier,
      extractionLatency,
    };
  }

  // --------------------------------------------------------------------------
  // Tier 1: Lexical Feature Extraction
  // --------------------------------------------------------------------------

  extractLexical(url: string): LexicalFeatures {
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(url);
    } catch {
      // Invalid URL - return high-risk features
      return this.getInvalidURLFeatures(url);
    }

    const hostname = parsedUrl.hostname;
    const pathname = parsedUrl.pathname;
    const fullUrl = parsedUrl.href;

    // Basic length metrics
    const length = fullUrl.length;

    // Character ratios
    const { digitRatio, symbolRatio, letterRatio } = this.calculateCharRatios(fullUrl);

    // Entropy calculation
    const entropy = this.calculateEntropy(fullUrl);

    // N-gram extraction
    const nGrams = this.extractNGrams(hostname, 3);

    // Suspicious keyword count
    const suspiciousKeywords = this.countSuspiciousKeywords(fullUrl.toLowerCase());

    // IP address detection
    const hasIPAddress = this.hasIPAddress(hostname);

    // Port detection
    const hasPort = parsedUrl.port !== '';

    // TLD extraction and risk scoring
    const tld = this.extractTLD(hostname);
    const tldRisk = this.getTLDRisk(tld);

    return {
      url: fullUrl,
      length,
      entropy,
      digitRatio,
      symbolRatio,
      letterRatio,
      nGrams,
      suspiciousKeywords,
      hasIPAddress,
      hasPort,
      isHTTPS: parsedUrl.protocol === 'https:',
      subdomainCount: this.countSubdomains(hostname),
      pathDepth: this.getPathDepth(pathname),
      queryParamCount: parsedUrl.searchParams.size,
      fragmentLength: parsedUrl.hash.length,
      tld,
      tldRisk,
    };
  }

  private calculateCharRatios(str: string): {
    digitRatio: number;
    symbolRatio: number;
    letterRatio: number;
  } {
    if (str.length === 0) {
      return { digitRatio: 0, symbolRatio: 0, letterRatio: 0 };
    }

    let digits = 0;
    let symbols = 0;
    let letters = 0;

    for (const char of str) {
      if (/\d/.test(char)) {
        digits++;
      } else if (/[a-zA-Z]/.test(char)) {
        letters++;
      } else {
        symbols++;
      }
    }

    const total = str.length;
    return {
      digitRatio: digits / total,
      symbolRatio: symbols / total,
      letterRatio: letters / total,
    };
  }

  private calculateEntropy(str: string): number {
    if (str.length === 0) return 0;

    const freq: Record<string, number> = {};
    for (const char of str) {
      freq[char] = (freq[char] || 0) + 1;
    }

    let entropy = 0;
    const len = str.length;

    for (const count of Object.values(freq)) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  private extractNGrams(str: string, n: number): string[] {
    const ngrams: string[] = [];
    const normalized = str.toLowerCase().replace(/[^a-z0-9]/g, '');

    for (let i = 0; i <= normalized.length - n; i++) {
      ngrams.push(normalized.substring(i, i + n));
    }

    return [...new Set(ngrams)].slice(0, 50); // Limit to 50 unique n-grams
  }

  private countSuspiciousKeywords(url: string): number {
    let count = 0;
    for (const keyword of SUSPICIOUS_KEYWORDS) {
      if (url.includes(keyword)) {
        count++;
      }
    }
    return count;
  }

  private hasIPAddress(hostname: string): boolean {
    // IPv4
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipv4Regex.test(hostname)) return true;

    // IPv6 (simplified)
    if (hostname.includes(':') && hostname.includes('[')) return true;

    // Decimal/Octal/Hex encoded IP
    const numericRegex = /^[\d.]+$/;
    if (numericRegex.test(hostname) && hostname.includes('.')) return true;

    return false;
  }

  private extractTLD(hostname: string): string {
    const parts = hostname.split('.');
    if (parts.length < 2) return '';

    // Handle common multi-part TLDs
    const lastTwo = parts.slice(-2).join('.');
    const multiPartTLDs = ['co.uk', 'com.au', 'co.nz', 'co.jp', 'com.br'];

    if (multiPartTLDs.includes(lastTwo) && parts.length > 2) {
      return lastTwo;
    }

    return parts[parts.length - 1];
  }

  private getTLDRisk(tld: string): number {
    if (TRUSTED_TLDS.has(tld)) {
      return 0.1;
    }
    return HIGH_RISK_TLDS[tld] ?? 0.3;
  }

  private countSubdomains(hostname: string): number {
    const parts = hostname.split('.');
    // Subtract 2 for domain and TLD
    return Math.max(0, parts.length - 2);
  }

  private getPathDepth(pathname: string): number {
    return pathname.split('/').filter(p => p.length > 0).length;
  }

  private getInvalidURLFeatures(url: string): LexicalFeatures {
    return {
      url,
      length: url.length,
      entropy: this.calculateEntropy(url),
      digitRatio: 0.5,
      symbolRatio: 0.5,
      letterRatio: 0,
      nGrams: [],
      suspiciousKeywords: 0,
      hasIPAddress: false,
      hasPort: false,
      isHTTPS: false,
      subdomainCount: 0,
      pathDepth: 0,
      queryParamCount: 0,
      fragmentLength: 0,
      tld: '',
      tldRisk: 1.0, // Max risk for invalid URLs
    };
  }

  // --------------------------------------------------------------------------
  // Tier 2: DOM Feature Extraction
  // --------------------------------------------------------------------------

  async extractDOM(tabId: number): Promise<DOMFeatures> {
    // Execute content script to extract DOM features
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractDOMFeatures,
    });

    if (!results || results.length === 0 || !results[0].result) {
      throw new Error('DOM extraction returned no results');
    }

    return results[0].result as DOMFeatures;
  }

  // --------------------------------------------------------------------------
  // Tier 3: Network Feature Extraction
  // --------------------------------------------------------------------------

  async extractNetwork(url: string): Promise<NetworkFeatures> {
    const startTime = performance.now();

    // Make a HEAD request to analyze response
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: controller.signal,
        mode: 'no-cors', // Needed for cross-origin
      });

      clearTimeout(timeoutId);

      const responseTime = performance.now() - startTime;

      // Count redirects (limited info due to CORS)
      const redirectCount = response.redirected ? 1 : 0;

      return {
        redirectCount,
        finalUrl: response.url || url,
        tlsValid: url.startsWith('https://'),
        mixedContent: false, // Would need page analysis
        responseTime,
        statusCode: response.status || 0,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      return {
        redirectCount: 0,
        finalUrl: url,
        tlsValid: url.startsWith('https://'),
        mixedContent: false,
        responseTime: performance.now() - startTime,
        statusCode: 0,
      };
    }
  }

  // --------------------------------------------------------------------------
  // TI Cache Check
  // --------------------------------------------------------------------------

  async checkTICache(url: string): Promise<TICacheHit | null> {
    try {
      // PRIORITY 1: Real-time cloud TI lookup (most accurate, has full TI DB)
      // Cloud TI client has built-in safety guards for known safe domains
      const cloudResult = await cloudTIClient.lookup(url);
      if (cloudResult) {
        console.log('[FeatureExtractor] Cloud TI hit:',
          cloudResult.isWhitelisted ? 'WHITELIST' :
          cloudResult.isBlacklisted ? 'BLACKLIST' : 'UNKNOWN',
          '- source:', cloudResult.source);
        return cloudResult;
      }

      // PRIORITY 2: Local TI cache (fallback if cloud is unreachable)
      const localResult = await tiCache.lookup(url);
      if (localResult) {
        console.log('[FeatureExtractor] Local TI cache hit');
        return localResult;
      }

      console.log('[FeatureExtractor] No TI hit for:', url);
      return null;
    } catch (error) {
      console.warn('[FeatureExtractor] TI lookup failed:', error);
      // Try local cache as last resort
      try {
        return await tiCache.lookup(url);
      } catch {
        return null;
      }
    }
  }

  // --------------------------------------------------------------------------
  // Feature Vector Generation
  // --------------------------------------------------------------------------

  toFeatureVector(features: URLFeatures): Float32Array {
    const vector: number[] = [];

    // Lexical features (17 features)
    const lex = features.lexical;
    vector.push(
      lex.length / 200,                    // Normalized length
      lex.entropy / 6,                     // Normalized entropy
      lex.digitRatio,
      lex.symbolRatio,
      lex.letterRatio,
      lex.suspiciousKeywords / 10,         // Normalized count
      lex.hasIPAddress ? 1 : 0,
      lex.hasPort ? 1 : 0,
      lex.isHTTPS ? 1 : 0,
      lex.subdomainCount / 5,              // Normalized
      lex.pathDepth / 10,                  // Normalized
      lex.queryParamCount / 10,            // Normalized
      lex.fragmentLength / 50,             // Normalized
      lex.tldRisk,
      this.hasBrandImpersonation(lex.url) ? 1 : 0,
      this.hasHomoglyph(lex.url) ? 1 : 0,
      this.hasExcessiveHyphens(lex.url) ? 1 : 0,
    );

    // DOM features (10 features, 0 if not available)
    if (features.dom) {
      const dom = features.dom;
      vector.push(
        dom.formCount / 5,
        dom.formTargetExternal ? 1 : 0,
        dom.inputPasswordCount / 3,
        dom.scriptCount / 20,
        dom.externalScriptCount / 10,
        dom.obfuscatedScripts ? 1 : 0,
        dom.iframeCount / 5,
        dom.hiddenIframeCount / 2,
        dom.hasLoginForm ? 1 : 0,
        dom.metaRefresh ? 1 : 0,
      );
    } else {
      vector.push(...new Array(10).fill(0));
    }

    // Network features (6 features, 0 if not available)
    if (features.network) {
      const net = features.network;
      vector.push(
        net.redirectCount / 5,
        net.tlsValid ? 1 : 0,
        net.mixedContent ? 1 : 0,
        net.responseTime / 5000,          // Normalized (5s max)
        (net.statusCode >= 200 && net.statusCode < 400) ? 1 : 0,
        net.certificateAge ? Math.min(net.certificateAge / 365, 1) : 0,
      );
    } else {
      vector.push(...new Array(6).fill(0));
    }

    // TI cache hit (2 features)
    if (features.tiHit) {
      vector.push(
        features.tiHit.isBlacklisted ? 1 : 0,
        features.tiHit.isWhitelisted ? 1 : 0,
      );
    } else {
      vector.push(0, 0);
    }

    return new Float32Array(vector);
  }

  // --------------------------------------------------------------------------
  // Additional Detection Helpers
  // --------------------------------------------------------------------------

  private hasBrandImpersonation(url: string): boolean {
    const lowerUrl = url.toLowerCase();

    for (const brand of BRAND_NAMES) {
      if (lowerUrl.includes(brand)) {
        // Check if it's the real domain
        try {
          const parsed = new URL(url);
          const hostname = parsed.hostname.toLowerCase();

          // Real domain check
          const realDomains = [
            `${brand}.com`,
            `www.${brand}.com`,
            `${brand}.co.uk`,
            `${brand}.net`,
          ];

          if (!realDomains.some(d => hostname === d || hostname.endsWith(`.${d}`))) {
            return true; // Brand in URL but not real domain
          }
        } catch {
          return true;
        }
      }
    }

    return false;
  }

  private hasHomoglyph(url: string): boolean {
    // Detect common lookalike characters
    const homoglyphs = /[а-яА-Я]|[οОоᴏ]|[іІ]|[еЕ]|[аАᴀ]/;
    return homoglyphs.test(url);
  }

  private hasExcessiveHyphens(url: string): boolean {
    try {
      const hostname = new URL(url).hostname;
      const hyphenCount = (hostname.match(/-/g) || []).length;
      return hyphenCount > 3;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// DOM EXTRACTION FUNCTION (Injected into page)
// ============================================================================

function extractDOMFeatures(): DOMFeatures {
  const forms = document.querySelectorAll('form');
  const scripts = document.querySelectorAll('script');
  const iframes = document.querySelectorAll('iframe');
  const inputs = document.querySelectorAll('input');

  // Check for external form targets
  let formTargetExternal = false;
  const currentHost = window.location.hostname;

  forms.forEach(form => {
    const action = form.getAttribute('action');
    if (action) {
      try {
        const actionUrl = new URL(action, window.location.href);
        if (actionUrl.hostname !== currentHost) {
          formTargetExternal = true;
        }
      } catch {
        // Invalid URL
      }
    }
  });

  // Count password inputs
  let inputPasswordCount = 0;
  inputs.forEach(input => {
    if (input.getAttribute('type') === 'password') {
      inputPasswordCount++;
    }
  });

  // Check for external scripts
  let externalScriptCount = 0;
  scripts.forEach(script => {
    const src = script.getAttribute('src');
    if (src) {
      try {
        const scriptUrl = new URL(src, window.location.href);
        if (scriptUrl.hostname !== currentHost) {
          externalScriptCount++;
        }
      } catch {
        // Invalid URL
      }
    }
  });

  // Detect obfuscated scripts
  let obfuscatedScripts = false;
  scripts.forEach(script => {
    const content = script.textContent || '';
    // Common obfuscation patterns
    if (
      content.includes('eval(') ||
      content.includes('\\x') ||
      content.includes('fromCharCode') ||
      /[a-zA-Z]+\s*=\s*['"][^'"]{100,}['"]/.test(content)
    ) {
      obfuscatedScripts = true;
    }
  });

  // Count hidden iframes
  let hiddenIframeCount = 0;
  iframes.forEach(iframe => {
    const style = window.getComputedStyle(iframe);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      parseInt(style.width) < 10 ||
      parseInt(style.height) < 10
    ) {
      hiddenIframeCount++;
    }
  });

  // Collect external domains
  const externalDomains: Set<string> = new Set();
  document.querySelectorAll('[src], [href]').forEach(el => {
    const url = el.getAttribute('src') || el.getAttribute('href');
    if (url) {
      try {
        const parsedUrl = new URL(url, window.location.href);
        if (parsedUrl.hostname !== currentHost) {
          externalDomains.add(parsedUrl.hostname);
        }
      } catch {
        // Invalid URL
      }
    }
  });

  // Detect login forms
  const hasLoginForm = !!document.querySelector(
    'form[action*="login"], form[action*="signin"], input[name*="username"], input[name*="email"][type="email"]'
  );

  // Detect social login buttons
  const hasSocialLogin = !!document.querySelector(
    '[class*="facebook"], [class*="google"], [class*="twitter"], ' +
    '[id*="facebook"], [id*="google"], [id*="twitter"], ' +
    'a[href*="oauth"], a[href*="facebook.com/login"], a[href*="accounts.google.com"]'
  );

  // Detect meta refresh
  const metaRefresh = !!document.querySelector('meta[http-equiv="refresh"]');

  // Count popups (rough estimate from onclick handlers)
  let popupCount = 0;
  document.querySelectorAll('[onclick]').forEach(el => {
    const onclick = el.getAttribute('onclick') || '';
    if (onclick.includes('open(') || onclick.includes('popup')) {
      popupCount++;
    }
  });

  return {
    formCount: forms.length,
    formTargetExternal,
    inputPasswordCount,
    scriptCount: scripts.length,
    externalScriptCount,
    obfuscatedScripts,
    iframeCount: iframes.length,
    hiddenIframeCount,
    externalDomains: Array.from(externalDomains).slice(0, 20),
    hasLoginForm,
    hasSocialLogin,
    metaRefresh,
    popupCount,
  };
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const featureExtractor = new FeatureExtractor();
