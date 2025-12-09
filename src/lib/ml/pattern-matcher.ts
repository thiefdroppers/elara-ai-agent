/**
 * Elara Edge Engine - Pattern Matcher
 *
 * Local pattern matching engine ported from Scanner V2.
 * Provides deterministic phishing detection without ML models.
 *
 * Accuracy: ~85-92% on known phishing patterns
 * Speed: <50ms for full analysis
 */

// ============================================================================
// THREAT PATTERNS DATABASE
// ============================================================================

interface ThreatPattern {
  name: string;
  category: 'crypto' | 'banking' | 'ecommerce' | 'enterprise' | 'social' | 'streaming' | 'iplogger';
  brands: string[];
  actions: string[];
  techniques?: string[];
  baseRisk: number;
  minMatches: number;
}

const THREAT_PATTERNS: ThreatPattern[] = [
  // CRYPTO/WEB3 PHISHING (40.8% of crypto incidents)
  {
    name: 'crypto_wallet',
    category: 'crypto',
    brands: ['metamask', 'trustwallet', 'coinbase', 'ledger', 'phantom', 'exodus', 'trezor', 'binance', 'kraken', 'crypto', 'bitcoin', 'ethereum', 'wallet', 'defi', 'nft', 'opensea', 'uniswap'],
    actions: ['claim', 'airdrop', 'mint', 'stake', 'swap', 'connect', 'verify', 'unlock', 'seed', 'phrase', 'recovery', 'import'],
    techniques: ['dapp', 'web3', 'bridge', 'liquidity'],
    baseRisk: 0.75,
    minMatches: 2,
  },

  // BANKING/FINANCE (27.7% of all phishing)
  {
    name: 'banking',
    category: 'banking',
    brands: ['chase', 'paypal', 'venmo', 'wellsfargo', 'citibank', 'capitalone', 'bankofamerica', 'usbank', 'pnc', 'td', 'hsbc', 'barclays', 'santander', 'cashapp', 'zelle'],
    actions: ['login', 'verify', 'confirm', 'suspended', 'locked', 'urgent', 'update', 'secure', 'authenticate', 'reactivate'],
    baseRisk: 0.70,
    minMatches: 2,
  },

  // ECOMMERCE (5.6% of attacks)
  {
    name: 'ecommerce',
    category: 'ecommerce',
    brands: ['amazon', 'ebay', 'walmart', 'alibaba', 'shopify', 'etsy', 'bestbuy', 'target', 'costco', 'homedepot', 'lowes'],
    actions: ['order', 'delivery', 'refund', 'payment', 'track', 'shipping', 'invoice', 'receipt', 'cancel'],
    baseRisk: 0.60,
    minMatches: 2,
  },

  // ENTERPRISE/MICROSOFT 365/GOOGLE WORKSPACE (17.7% of attacks)
  {
    name: 'enterprise',
    category: 'enterprise',
    brands: ['microsoft', 'office365', 'google', 'gmail', 'teams', 'outlook', 'onedrive', 'sharepoint', 'azure', 'dropbox', 'slack', 'zoom', 'webex'],
    actions: ['login', 'sso', 'mfa', 'expired', 'reset', 'password', 'authenticate', 'verify', 'quota', 'storage'],
    baseRisk: 0.65,
    minMatches: 2,
  },

  // SOCIAL MEDIA
  {
    name: 'social',
    category: 'social',
    brands: ['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok', 'snapchat', 'whatsapp', 'telegram', 'discord', 'reddit', 'youtube'],
    actions: ['login', 'verify', 'suspended', 'appeal', 'recover', 'unlock', 'security', 'checkpoint'],
    baseRisk: 0.55,
    minMatches: 2,
  },

  // STREAMING
  {
    name: 'streaming',
    category: 'streaming',
    brands: ['netflix', 'disney', 'disneyplus', 'hulu', 'hbo', 'hbomax', 'prime', 'paramount', 'spotify', 'apple'],
    actions: ['login', 'verify', 'billing', 'payment', 'subscription', 'renew', 'cancel', 'update'],
    baseRisk: 0.50,
    minMatches: 2,
  },

  // IP LOGGERS (CRITICAL)
  {
    name: 'iplogger',
    category: 'iplogger',
    brands: ['iplogger', 'grabify', 'blasze', 'yip', 'ezstat', 'ipgrabber', '2no.co', 'iplogger.org', 'grabify.link'],
    actions: [],
    baseRisk: 0.85,
    minMatches: 1,
  },
];

// ============================================================================
// SUSPICIOUS TLDs
// ============================================================================

const SUSPICIOUS_TLDS: Record<string, number> = {
  // Free registrars (highest risk)
  'tk': 0.90, 'ml': 0.85, 'ga': 0.85, 'cf': 0.85, 'gq': 0.85,
  // Generic high-risk
  'xyz': 0.70, 'top': 0.70, 'work': 0.65, 'click': 0.65, 'link': 0.60,
  'info': 0.50, 'online': 0.55, 'site': 0.50, 'website': 0.50, 'space': 0.45,
  'live': 0.50, 'tech': 0.45, 'store': 0.40, 'club': 0.45, 'buzz': 0.50,
  'bid': 0.55, 'loan': 0.60, 'download': 0.55, 'racing': 0.50, 'party': 0.45,
  'pw': 0.80, 'ws': 0.60, 'cc': 0.35,
};

// ============================================================================
// HOSTING PLATFORM MULTIPLIERS
// ============================================================================

const HOSTING_MULTIPLIERS: Record<string, number> = {
  'pages.dev': 1.8,      // Cloudflare Pages (257% abuse increase)
  'workers.dev': 1.6,    // Cloudflare Workers
  'netlify.app': 1.5,    // Netlify
  'vercel.app': 1.5,     // Vercel
  'github.io': 1.4,      // GitHub Pages
  'herokuapp.com': 1.3,  // Heroku
  'web.app': 1.3,        // Firebase
  'firebaseapp.com': 1.3,
  'glitch.me': 1.3,
  'replit.co': 1.2,
  'surge.sh': 1.2,
};

// ============================================================================
// URL SHORTENERS
// ============================================================================

const URL_SHORTENERS = [
  'bit.ly', 'goo.gl', 'tinyurl.com', 'ow.ly', 't.co',
  'short.link', 'is.gd', 'buff.ly', 'tiny.cc', 'cutt.ly',
  'rb.gy', 'shorturl.at', 'adf.ly', 'bit.do',
];

// ============================================================================
// SENSITIVE KEYWORDS
// ============================================================================

const SENSITIVE_KEYWORDS = [
  'login', 'signin', 'sign-in', 'log-in', 'verify', 'secure', 'account',
  'update', 'confirm', 'banking', 'password', 'suspended', 'locked',
  'urgent', 'alert', 'authenticate', 'validation', 'webscr', 'billing',
  'payment', 'credential', 'security', 'authorize', 'expire', 'limited',
];

// ============================================================================
// HOMOGLYPH MAPPINGS (used in detectHomoglyphs regex patterns)
// ============================================================================

// Mapping for reference: 0→o, 1→l, 3→e, 4→a, 5→s, @→a, $→s, !→i

// ============================================================================
// PATTERN MATCHER CLASS
// ============================================================================

export interface PatternMatchResult {
  score: number;           // 0-1 risk score
  confidence: number;      // 0-1 confidence
  matches: PatternMatch[];
  flags: string[];
  reasoning: string[];
}

export interface PatternMatch {
  pattern: string;
  category: string;
  tokens: string[];
  risk: number;
}

export class PatternMatcher {
  // --------------------------------------------------------------------------
  // Main Analysis Method
  // --------------------------------------------------------------------------

  analyze(url: string): PatternMatchResult {
    const matches: PatternMatch[] = [];
    const flags: string[] = [];
    const reasoning: string[] = [];
    let maxRisk = 0;

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return {
        score: 0.5,
        confidence: 0.3,
        matches: [],
        flags: ['invalid_url'],
        reasoning: ['Could not parse URL'],
      };
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    const fullUrl = url.toLowerCase();

    // 1. Check threat patterns
    const patternResult = this.checkThreatPatterns(fullUrl, hostname);
    matches.push(...patternResult.matches);
    maxRisk = Math.max(maxRisk, patternResult.maxRisk);
    reasoning.push(...patternResult.reasoning);

    // 2. Check suspicious TLD
    const tld = this.extractTLD(hostname);
    if (SUSPICIOUS_TLDS[tld]) {
      const tldRisk = SUSPICIOUS_TLDS[tld];
      maxRisk = Math.max(maxRisk, tldRisk * 0.5);
      flags.push('suspicious_tld');
      reasoning.push(`High-risk TLD: .${tld} (${(tldRisk * 100).toFixed(0)}% base risk)`);
    }

    // 3. Check hosting platform multiplier
    let multiplier = 1;
    for (const [platform, mult] of Object.entries(HOSTING_MULTIPLIERS)) {
      if (hostname.endsWith(platform)) {
        multiplier = mult;
        flags.push('free_hosting');
        reasoning.push(`Hosted on ${platform} (${mult}x risk multiplier)`);
        break;
      }
    }

    // 4. Check URL shortener
    for (const shortener of URL_SHORTENERS) {
      if (hostname.includes(shortener)) {
        maxRisk = Math.max(maxRisk, 0.5);
        flags.push('url_shortener');
        reasoning.push(`URL shortener detected: ${shortener}`);
        break;
      }
    }

    // 5. Check for IP address
    if (this.isIPAddress(hostname)) {
      maxRisk = Math.max(maxRisk, 0.7);
      flags.push('ip_address');
      reasoning.push('Uses IP address instead of domain');
    }

    // 6. Check for brand impersonation
    const brandResult = this.detectBrandImpersonation(hostname, fullUrl);
    if (brandResult.detected) {
      maxRisk = Math.max(maxRisk, brandResult.risk);
      flags.push('brand_impersonation');
      reasoning.push(...brandResult.reasoning);
    }

    // 7. Check for typosquatting
    const typoResult = this.detectTyposquatting(hostname);
    if (typoResult.detected) {
      maxRisk = Math.max(maxRisk, typoResult.risk);
      flags.push('typosquatting');
      reasoning.push(...typoResult.reasoning);
    }

    // 8. Check for homoglyphs
    const homoglyphResult = this.detectHomoglyphs(hostname);
    if (homoglyphResult.detected) {
      maxRisk = Math.max(maxRisk, homoglyphResult.risk);
      flags.push('homoglyph');
      reasoning.push(...homoglyphResult.reasoning);
    }

    // 9. Check credential stuffing pattern (brand.com@evil.tk)
    if (fullUrl.includes('@') && !fullUrl.startsWith('mailto:')) {
      const atIndex = fullUrl.indexOf('@');
      const beforeAt = fullUrl.substring(0, atIndex);
      if (this.containsBrandName(beforeAt)) {
        maxRisk = Math.max(maxRisk, 0.95);
        flags.push('credential_stuffing');
        reasoning.push('Credential stuffing pattern detected (brand@evil-domain)');
      }
    }

    // 10. Check sensitive keywords
    // REDUCED AGGRESSIVENESS: Legitimate sites like login.google.com have keywords
    // Only flag if 3+ keywords AND use lower base risk
    let keywordCount = 0;
    for (const keyword of SENSITIVE_KEYWORDS) {
      if (fullUrl.includes(keyword)) {
        keywordCount++;
      }
    }
    // Only add risk for 3+ keywords, and use much lower base risk
    // This prevents legitimate sites with single keywords like "login" from being flagged
    if (keywordCount >= 3) {
      // Even with 3+ keywords, cap the contribution at 0.25
      const keywordRisk = Math.min(0.10 + (keywordCount * 0.05), 0.25);
      maxRisk = Math.max(maxRisk, keywordRisk);
      flags.push('sensitive_keywords');
      reasoning.push(keywordCount + ' sensitive keyword(s) detected');
    }

    // Apply hosting multiplier
    const finalScore = Math.min(maxRisk * multiplier, 0.95);

    // Calculate confidence based on number of signals
    const signalCount = flags.length + matches.length;
    const confidence = Math.min(0.5 + (signalCount * 0.1), 0.95);

    return {
      score: finalScore,
      confidence,
      matches,
      flags,
      reasoning,
    };
  }

  // --------------------------------------------------------------------------
  // Threat Pattern Detection
  // --------------------------------------------------------------------------

  private checkThreatPatterns(url: string, _hostname: string): {
    matches: PatternMatch[];
    maxRisk: number;
    reasoning: string[];
  } {
    const matches: PatternMatch[] = [];
    const reasoning: string[] = [];
    let maxRisk = 0;

    for (const pattern of THREAT_PATTERNS) {
      const matchedTokens: string[] = [];

      // Check brand tokens
      for (const brand of pattern.brands) {
        if (url.includes(brand)) {
          matchedTokens.push(brand);
        }
      }

      // Check action tokens
      for (const action of pattern.actions) {
        if (url.includes(action)) {
          matchedTokens.push(action);
        }
      }

      // Check technique tokens
      if (pattern.techniques) {
        for (const technique of pattern.techniques) {
          if (url.includes(technique)) {
            matchedTokens.push(technique);
          }
        }
      }

      // Check if enough matches
      if (matchedTokens.length >= pattern.minMatches) {
        const risk = pattern.baseRisk + (matchedTokens.length - pattern.minMatches) * 0.05;
        matches.push({
          pattern: pattern.name,
          category: pattern.category,
          tokens: matchedTokens,
          risk: Math.min(risk, 0.95),
        });
        maxRisk = Math.max(maxRisk, risk);
        reasoning.push(`${pattern.category.toUpperCase()} pattern: ${matchedTokens.join(', ')}`);
      }
    }

    return { matches, maxRisk, reasoning };
  }

  // --------------------------------------------------------------------------
  // Brand Impersonation Detection
  // --------------------------------------------------------------------------

  private detectBrandImpersonation(hostname: string, url: string): {
    detected: boolean;
    risk: number;
    reasoning: string[];
  } {
    const reasoning: string[] = [];
    let detected = false;
    let risk = 0;

    const knownBrands = [
      'google', 'microsoft', 'apple', 'facebook', 'amazon', 'paypal',
      'netflix', 'instagram', 'twitter', 'linkedin', 'dropbox', 'chase',
      'wellsfargo', 'bankofamerica', 'citibank', 'coinbase', 'binance',
    ];

    const realDomains: Record<string, string[]> = {
      'google': ['google.com', 'google.co.uk', 'googleapis.com', 'gmail.com', 'youtube.com'],
      'microsoft': ['microsoft.com', 'live.com', 'outlook.com', 'office.com', 'azure.com'],
      'apple': ['apple.com', 'icloud.com'],
      'facebook': ['facebook.com', 'fb.com', 'meta.com'],
      'amazon': ['amazon.com', 'amazon.co.uk', 'aws.amazon.com'],
      'paypal': ['paypal.com'],
      'netflix': ['netflix.com'],
      'instagram': ['instagram.com'],
      'twitter': ['twitter.com', 'x.com'],
      'linkedin': ['linkedin.com'],
      'dropbox': ['dropbox.com', 'dropboxusercontent.com'],
      'chase': ['chase.com', 'jpmorganchase.com'],
      'wellsfargo': ['wellsfargo.com', 'wf.com'],
      'bankofamerica': ['bankofamerica.com', 'bofa.com', 'bofaml.com'],
      'citibank': ['citibank.com', 'citi.com'],
      'coinbase': ['coinbase.com', 'coinbase.io'],
      'binance': ['binance.com', 'binance.us'],
      'walmart': ['walmart.com'],
      'target': ['target.com'],
      'reddit': ['reddit.com', 'redd.it'],
    };

    for (const brand of knownBrands) {
      if (url.includes(brand) && !this.isRealDomain(hostname, brand, realDomains[brand] || [])) {
        detected = true;
        risk = Math.max(risk, 0.75);
        reasoning.push(`Brand impersonation: "${brand}" in URL but not on official domain`);
      }
    }

    return { detected, risk, reasoning };
  }

  private isRealDomain(hostname: string, _brand: string, realDomains: string[]): boolean {
    for (const domain of realDomains) {
      if (hostname === domain || hostname.endsWith(`.${domain}`)) {
        return true;
      }
    }
    return false;
  }

  private containsBrandName(text: string): boolean {
    const brands = ['google', 'microsoft', 'apple', 'paypal', 'amazon', 'facebook', 'netflix'];
    return brands.some(brand => text.includes(brand));
  }

  // --------------------------------------------------------------------------
  // Typosquatting Detection
  // --------------------------------------------------------------------------

  private detectTyposquatting(hostname: string): {
    detected: boolean;
    risk: number;
    reasoning: string[];
  } {
    const reasoning: string[] = [];
    let detected = false;
    let risk = 0;

    const popularDomains = [
      'google.com', 'facebook.com', 'amazon.com', 'microsoft.com',
      'apple.com', 'paypal.com', 'netflix.com', 'instagram.com',
    ];

    for (const domain of popularDomains) {
      const distance = this.levenshteinDistance(hostname, domain);
      if (distance > 0 && distance <= 2) {
        detected = true;
        risk = Math.max(risk, 0.85 - (distance * 0.1));
        reasoning.push(`Typosquatting: "${hostname}" is ${distance} char(s) away from "${domain}"`);
      }
    }

    return { detected, risk, reasoning };
  }

  private levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  // --------------------------------------------------------------------------
  // Homoglyph Detection
  // --------------------------------------------------------------------------

  private detectHomoglyphs(hostname: string): {
    detected: boolean;
    risk: number;
    reasoning: string[];
  } {
    const reasoning: string[] = [];
    let detected = false;
    let risk = 0;

    // Check for number substitutions
    const homoglyphPatterns = [
      { pattern: /g[o0]{2}gle/i, brand: 'google' },
      { pattern: /g[o0]ogle/i, brand: 'google' },
      { pattern: /paypa[l1]/i, brand: 'paypal' },
      { pattern: /amaz[o0]n/i, brand: 'amazon' },
      { pattern: /micr[o0]s[o0]ft/i, brand: 'microsoft' },
      { pattern: /fac[e3]b[o0][o0]k/i, brand: 'facebook' },
      { pattern: /app[l1][e3]/i, brand: 'apple' },
      { pattern: /n[e3]tf[l1]ix/i, brand: 'netflix' },
    ];

    for (const { pattern, brand } of homoglyphPatterns) {
      if (pattern.test(hostname)) {
        detected = true;
        risk = Math.max(risk, 0.85);
        reasoning.push(`Homoglyph attack: lookalike characters for "${brand}"`);
      }
    }

    // Check for Cyrillic characters
    if (/[\u0400-\u04FF]/.test(hostname)) {
      detected = true;
      risk = Math.max(risk, 0.90);
      reasoning.push('Cyrillic character substitution detected');
    }

    // Check for punycode (internationalized domain names)
    if (hostname.includes('xn--')) {
      detected = true;
      risk = Math.max(risk, 0.70);
      reasoning.push('Punycode/IDN domain detected');
    }

    return { detected, risk, reasoning };
  }

  // --------------------------------------------------------------------------
  // Helper Methods
  // --------------------------------------------------------------------------

  private extractTLD(hostname: string): string {
    const parts = hostname.split('.');
    if (parts.length < 2) return '';
    return parts[parts.length - 1];
  }

  private isIPAddress(hostname: string): boolean {
    // IPv4
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipv4Regex.test(hostname)) return true;

    // IPv6
    if (hostname.includes(':')) return true;

    // Decimal encoded IP
    if (/^\d{10,}$/.test(hostname)) return true;

    return false;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const patternMatcher = new PatternMatcher();
