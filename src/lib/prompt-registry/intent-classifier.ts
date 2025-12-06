/**
 * Elara AI Agent - Intent Classifier
 *
 * Zero-LLM classification for 80% of requests.
 * Uses pattern matching, keyword detection, and entity extraction
 * to route user messages to the correct tools.
 */

import type { IntentClassification, IntentRule } from './types';

// =============================================================================
// URL PATTERN
// =============================================================================

const URL_PATTERN = /https?:\/\/[^\s<>"{}|\\^`\[\]]+|www\.[^\s<>"{}|\\^`\[\]]+|[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?(?:\/[^\s<>"{}|\\^`\[\]]*)?/gi;

// =============================================================================
// INTENT RULES (Priority Order)
// =============================================================================

const INTENT_RULES: IntentRule[] = [
  // === Highest Priority: Explicit Actions ===
  {
    intent: 'add_to_whitelist',
    priority: 100,
    patterns: [
      /whitelist\s+/i,
      /add\s+.+\s+to\s+(?:my\s+)?whitelist/i,
      /trust\s+(?:this\s+)?(?:domain|site)/i,
      /mark\s+.+\s+(?:as\s+)?safe/i,
    ],
    keywords: ['whitelist', 'add to whitelist', 'trust domain', 'mark safe', 'always safe'],
    entityExtractors: {
      domain: /(?:whitelist|trust|add|mark)\s+([a-zA-Z0-9][-a-zA-Z0-9.]*\.[a-zA-Z]{2,})/i,
    },
  },
  {
    intent: 'add_to_blacklist',
    priority: 100,
    patterns: [
      /blacklist\s+/i,
      /block\s+(?:this\s+)?(?:domain|site)/i,
      /add\s+.+\s+to\s+(?:my\s+)?blacklist/i,
      /mark\s+.+\s+(?:as\s+)?dangerous/i,
    ],
    keywords: ['blacklist', 'block domain', 'block this', 'add to blacklist', 'always block'],
    entityExtractors: {
      domain: /(?:blacklist|block|ban)\s+([a-zA-Z0-9][-a-zA-Z0-9.]*\.[a-zA-Z]{2,})/i,
    },
  },

  // === High Priority: Scan Requests ===
  {
    intent: 'deep_scan',
    priority: 95,
    patterns: [
      /deep\s+scan/i,
      /full\s+(?:scan|analysis)/i,
      /comprehensive\s+(?:scan|check|analysis)/i,
      /thorough\s+(?:scan|check)/i,
      /detailed\s+(?:scan|analysis)/i,
    ],
    keywords: ['deep scan', 'full scan', 'comprehensive', 'thorough', 'detailed analysis'],
    entityExtractors: {
      url: URL_PATTERN,
    },
  },
  {
    intent: 'scan_url',
    priority: 90,
    patterns: [
      URL_PATTERN,  // Any URL triggers scan intent
      /^(?:is\s+)?(?:this\s+)?(?:url\s+)?(?:safe|dangerous|malicious|phishing|legitimate)/i,
      /^scan\s+/i,
      /^check\s+(?:this\s+)?(?:url|link|site|website)/i,
      /^analyze\s+(?:this\s+)?(?:url|link)/i,
      /^is\s+.+\s+safe/i,
      /can\s+(?:i|you)\s+trust\s+/i,
    ],
    keywords: ['scan', 'check', 'safe', 'dangerous', 'malicious', 'phishing', 'is it safe', 'analyze url', 'check url', 'verify url', 'trust'],
    entityExtractors: {
      url: URL_PATTERN,
    },
  },

  // === Threat Intelligence ===
  {
    intent: 'search_ti',
    priority: 85,
    patterns: [
      /search\s+(?:ti|threat\s+intelligence)/i,
      /lookup\s+(?:in\s+)?(?:ti|database)/i,
      /is\s+.+\s+(?:known|in\s+(?:the\s+)?database)/i,
      /find\s+(?:threat|indicator)/i,
      /check\s+(?:ti|threat\s+intelligence)\s+(?:for|database)/i,
    ],
    keywords: ['search ti', 'lookup', 'threat intelligence', 'ti database', 'known threat', 'in database', 'find indicator'],
    entityExtractors: {
      indicator: /(?:lookup|search|find|check)\s+([^\s]+)/i,
    },
  },
  {
    intent: 'bulk_lookup',
    priority: 80,
    patterns: [
      /check\s+(?:these|multiple|all|several)/i,
      /bulk\s+(?:lookup|check|scan)/i,
      /scan\s+(?:these|all|multiple)/i,
    ],
    keywords: ['check these', 'multiple urls', 'bulk lookup', 'all these', 'several links'],
  },
  {
    intent: 'sync_ti',
    priority: 75,
    patterns: [
      /sync\s+(?:ti|threat\s+intelligence)/i,
      /update\s+(?:ti|threat)\s+database/i,
      /refresh\s+(?:threats?|database)/i,
    ],
    keywords: ['sync ti', 'update database', 'refresh threats', 'sync threat intelligence'],
  },

  // === Image Analysis ===
  {
    intent: 'analyze_image',
    priority: 82,
    patterns: [
      /(?:is\s+this|analyze)\s+(?:image|photo|picture|screenshot)/i,
      /deepfake/i,
      /fake\s+(?:image|photo|video)/i,
      /real\s+or\s+fake/i,
      /ai\s+generated/i,
      /manipulated\s+(?:image|photo)/i,
      /ocr|extract\s+text/i,
    ],
    keywords: ['deepfake', 'fake image', 'real or fake', 'analyze image', 'screenshot', 'ocr', 'extract text', 'is this real', 'manipulated'],
    entityExtractors: {
      analysisType: /(?:deepfake|ocr|phishing|general)/i,
    },
  },

  // === Sentiment Analysis ===
  {
    intent: 'analyze_sentiment',
    priority: 78,
    patterns: [
      /analyze\s+(?:this\s+)?(?:text|message|email)/i,
      /is\s+this\s+(?:a\s+)?(?:scam|phishing)\s*(?:email|message)?/i,
      /check\s+(?:this\s+)?(?:email|message)/i,
      /suspicious\s+(?:email|message|text)/i,
      /manipulation\s+(?:in|detected)/i,
    ],
    keywords: ['analyze text', 'check email', 'is this scam', 'phishing email', 'suspicious message', 'scam message'],
    entityExtractors: {
      text: /.+/,  // Capture full message
    },
  },

  // === User Management ===
  {
    intent: 'get_user_profile',
    priority: 70,
    patterns: [
      /(?:my|show)\s+(?:profile|whitelist|blacklist)/i,
      /what\s+(?:domains|sites)\s+(?:are|have\s+i)/i,
      /list\s+(?:my\s+)?(?:whitelisted|blacklisted)/i,
      /show\s+(?:my\s+)?(?:settings|preferences)/i,
    ],
    keywords: ['my profile', 'my whitelist', 'my blacklist', 'show profile', 'list domains', 'my settings'],
  },

  // === Education (Requires LLM) ===
  {
    intent: 'explain',
    priority: 50,
    patterns: [
      /^what\s+is\s+(?:a\s+)?/i,
      /^explain\s+/i,
      /^tell\s+me\s+about\s+/i,
      /^how\s+does\s+.+\s+work/i,
      /^what\s+are\s+/i,
      /^define\s+/i,
    ],
    keywords: ['what is', 'explain', 'tell me about', 'how does', 'define', 'meaning of'],
    requiresLLM: true,
    entityExtractors: {
      concept: /(?:what\s+is|explain|tell\s+me\s+about|define)\s+(?:a\s+)?([a-zA-Z\s]+)/i,
    },
  },

  // === General Help ===
  {
    intent: 'help',
    priority: 40,
    patterns: [
      /^help/i,
      /what\s+can\s+you\s+do/i,
      /how\s+(?:do\s+i|can\s+i)\s+use/i,
      /show\s+(?:me\s+)?(?:commands|options)/i,
    ],
    keywords: ['help', 'what can you do', 'how to use', 'options', 'commands'],
  },

  // === Greetings ===
  {
    intent: 'greeting',
    priority: 30,
    patterns: [
      /^(?:hi|hello|hey|greetings|good\s+(?:morning|afternoon|evening))/i,
      /^howdy/i,
      /^sup/i,
    ],
    keywords: ['hi', 'hello', 'hey', 'greetings'],
  },

  // === General Chat (Fallback - Requires LLM) ===
  {
    intent: 'general_chat',
    priority: 0,
    patterns: [],
    keywords: [],
    requiresLLM: true,
  },
];

// =============================================================================
// INTENT CLASSIFIER CLASS
// =============================================================================

export class IntentClassifier {
  private rules: IntentRule[];

  constructor() {
    // Sort rules by priority (highest first)
    this.rules = [...INTENT_RULES].sort((a, b) => b.priority - a.priority);
  }

  /**
   * Classify user message intent with confidence scoring
   */
  classify(message: string): IntentClassification {
    const normalizedMessage = message.trim().toLowerCase();
    const originalMessage = message.trim();

    let bestMatch: IntentClassification = {
      intent: 'general_chat',
      confidence: 0.3,
      entities: {},
      requiresLLM: true,
    };

    for (const rule of this.rules) {
      const match = this.matchRule(originalMessage, normalizedMessage, rule);

      if (match && match.confidence > bestMatch.confidence) {
        bestMatch = match;

        // High confidence match - no need to continue
        if (match.confidence >= 0.95) {
          break;
        }
      }
    }

    // Map intent to tool ID
    bestMatch.toolId = this.getToolId(bestMatch.intent);

    return bestMatch;
  }

  /**
   * Match a single rule against the message
   */
  private matchRule(
    originalMessage: string,
    normalizedMessage: string,
    rule: IntentRule
  ): IntentClassification | null {
    let confidence = 0;
    let matchCount = 0;
    const entities: Record<string, any> = {};

    // Check patterns
    if (rule.patterns && rule.patterns.length > 0) {
      for (const pattern of rule.patterns) {
        const match = originalMessage.match(pattern);
        if (match) {
          matchCount++;
          confidence += 0.4;  // Pattern match is strong signal

          // Extract entities from pattern matches
          if (match[1]) {
            if (pattern.source.includes('url') || pattern === URL_PATTERN) {
              entities.url = match[0];
            }
          }
        }
      }
    }

    // Check keywords
    if (rule.keywords && rule.keywords.length > 0) {
      for (const keyword of rule.keywords) {
        if (normalizedMessage.includes(keyword.toLowerCase())) {
          matchCount++;
          confidence += 0.25;  // Keyword match is moderate signal
        }
      }
    }

    // Extract URL if present (for scan intents)
    if (!entities.url) {
      const urlMatch = originalMessage.match(URL_PATTERN);
      if (urlMatch) {
        entities.url = urlMatch[0];

        // URL presence boosts scan intent confidence
        if (rule.intent === 'scan_url' || rule.intent === 'deep_scan') {
          confidence += 0.3;
        }
      }
    }

    // Apply entity extractors
    if (rule.entityExtractors) {
      for (const [entityName, extractor] of Object.entries(rule.entityExtractors)) {
        if (entityName !== 'url' || !entities.url) {  // Don't overwrite URL
          const match = originalMessage.match(extractor);
          if (match && match[1]) {
            entities[entityName] = match[1].trim();
          } else if (match && match[0]) {
            entities[entityName] = match[0].trim();
          }
        }
      }
    }

    // Normalize confidence
    confidence = Math.min(confidence, 0.99);

    // Require at least one match
    if (matchCount === 0 && rule.priority > 0) {
      return null;
    }

    // Fallback rule (general_chat) always matches with low confidence
    if (rule.intent === 'general_chat') {
      return {
        intent: 'general_chat',
        confidence: 0.3,
        entities,
        requiresLLM: true,
      };
    }

    if (confidence > 0) {
      return {
        intent: rule.intent,
        confidence,
        entities,
        requiresLLM: rule.requiresLLM ?? false,
      };
    }

    return null;
  }

  /**
   * Map intent to tool ID
   */
  private getToolId(intent: string): string | undefined {
    const intentToTool: Record<string, string> = {
      scan_url: 'scan_url',
      deep_scan: 'scan_url',
      search_ti: 'search_threat_intelligence',
      bulk_lookup: 'lookup_indicators',
      sync_ti: 'sync_threat_intelligence',
      analyze_image: 'analyze_image',
      analyze_sentiment: 'analyze_sentiment',
      get_user_profile: 'get_user_profile',
      add_to_whitelist: 'add_to_whitelist',
      add_to_blacklist: 'add_to_blacklist',
      explain: 'explain_security_concept',
    };

    return intentToTool[intent];
  }

  /**
   * Extract all URLs from a message
   */
  extractURLs(message: string): string[] {
    const matches = message.match(URL_PATTERN) || [];
    return [...new Set(matches)];  // Deduplicate
  }

  /**
   * Normalize URL (add protocol if missing)
   */
  normalizeURL(url: string): string {
    if (!url.match(/^https?:\/\//i)) {
      return `https://${url}`;
    }
    return url;
  }

  /**
   * Check if message is a simple greeting
   */
  isGreeting(message: string): boolean {
    const greeting = /^(?:hi|hello|hey|greetings|howdy|sup|yo)[\s!?.]*$/i;
    return greeting.test(message.trim());
  }

  /**
   * Check if message is asking for help
   */
  isHelpRequest(message: string): boolean {
    const help = /^(?:help|what\s+can\s+you\s+do|\?+)[\s!?.]*$/i;
    return help.test(message.trim());
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const intentClassifier = new IntentClassifier();
