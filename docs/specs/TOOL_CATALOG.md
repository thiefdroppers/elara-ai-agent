# Elara AI Agent - Complete Tool Catalog

**Version**: 1.0.0
**Date**: 2025-12-06
**Total Tools**: 15 (11 Core + 4 Workflows)

---

## Tool Categories

| Category | Tools | Description |
|----------|-------|-------------|
| SECURITY_SCAN | 3 | URL scanning (edge, hybrid, deep) |
| THREAT_INTEL | 3 | TI database operations |
| IMAGE_ANALYSIS | 1 | Deepfake, phishing, OCR |
| SENTIMENT | 1 | Text manipulation detection |
| USER_MANAGEMENT | 3 | Profile, whitelist, blacklist |
| EDUCATION | 1 | Security concept explanations |
| WEB_SEARCH | 1 | External web research |
| SYNTHESIS | 1 | Result combination |
| WORKFLOW | 4 | Multi-tool templates |

---

## Core Tools (11)

### 1. scan_url

**Category**: SECURITY_SCAN
**Requires LLM**: No (for execution), Yes (for explanation)
**Latency**: Edge <100ms, Hybrid 1-3s, Deep 10-30s

```typescript
const SCAN_URL_TOOL = {
  name: 'scan_url',
  description: 'Scan a URL for phishing, malware, and security threats using ML models',
  category: 'SECURITY_SCAN',

  schema: {
    type: 'function',
    function: {
      name: 'scan_url',
      description: 'Scan URL for threats',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to scan (must include http:// or https://)'
          },
          scan_type: {
            type: 'string',
            enum: ['auto', 'edge', 'hybrid', 'deep'],
            description: 'auto=smart routing, edge=fast, hybrid=TI enriched, deep=comprehensive'
          }
        },
        required: ['url']
      }
    }
  },

  // TOON-encoded schema (40% fewer tokens)
  toonSchema: `scan_url{url:str!,scan_type:enum[auto/edge/hybrid/deep]}`,

  // Endpoints
  endpoints: {
    edge: 'chrome.runtime.sendMessage (offscreen)',
    hybrid: 'POST /api/v2/scanner/hybrid',
    deep: 'POST /api/v2/scan/uri'
  },

  // Intent patterns (for zero-LLM classification)
  intentPatterns: {
    patterns: [
      /https?:\/\/[^\s]+/,
      /^(?:is\s+)?(?:this\s+)?(?:url\s+)?(?:safe|dangerous|malicious|phishing)/i,
      /^scan\s+/i,
      /^check\s+/i
    ],
    keywords: ['scan', 'check', 'safe', 'dangerous', 'malicious', 'phishing', 'analyze url'],
    confidence: 0.95
  },

  // Response format
  responseSchema: {
    verdict: 'SAFE | SUSPICIOUS | DANGEROUS | UNKNOWN',
    riskScore: 'number (0.0-1.0)',
    riskLevel: 'A | B | C | D | E | F',
    confidence: 'number (0.0-1.0)',
    threatType: 'string | null',
    indicators: 'array<{type, value, severity, description}>',
    reasoning: 'array<string>',
    scanType: 'edge | hybrid | deep',
    latency: 'number (ms)'
  },

  // Pre-generated explanation prompt
  explanationPrompt: `
URL scan complete. Summarize results:
- Verdict: {verdict}
- Risk: {riskLevel} ({riskScore}%)
- Threat: {threatType}
- Key indicators: {indicators}

Explain in 2-3 sentences. Be direct about danger level.
If DANGEROUS, warn strongly. If SAFE, confirm briefly.
Include 1 actionable recommendation.`
};
```

---

### 2. search_threat_intelligence

**Category**: THREAT_INTEL
**Requires LLM**: No
**Latency**: <100ms

```typescript
const SEARCH_TI_TOOL = {
  name: 'search_threat_intelligence',
  description: 'Search the Threat Intelligence database for indicators',
  category: 'THREAT_INTEL',

  schema: {
    type: 'function',
    function: {
      name: 'search_threat_intelligence',
      parameters: {
        type: 'object',
        properties: {
          indicator: {
            type: 'string',
            description: 'Domain, IP, URL, or hash to search'
          },
          indicator_type: {
            type: 'string',
            enum: ['url', 'domain', 'ip', 'hash', 'email'],
            description: 'Type of indicator (optional, auto-detected)'
          }
        },
        required: ['indicator']
      }
    }
  },

  toonSchema: `search_ti{indicator:str!,type:enum[url/domain/ip/hash/email]}`,

  endpoints: {
    lookup: 'GET /api/v2/ti/lookup/{indicator}'
  },

  intentPatterns: {
    patterns: [
      /search\s+(?:ti|threat\s+intelligence)/i,
      /lookup\s+(?:in\s+)?(?:ti|database)/i,
      /is\s+.+\s+(?:known|in\s+database)/i
    ],
    keywords: ['search ti', 'lookup', 'find threat', 'known threat', 'in database'],
    confidence: 0.90
  },

  responseSchema: {
    found: 'boolean',
    indicator: 'string',
    verdict: 'SAFE | MALICIOUS | UNKNOWN',
    source: 'string (PhishTank, OpenPhish, etc.)',
    severity: 'LOW | MEDIUM | HIGH | CRITICAL',
    firstSeen: 'timestamp',
    lastUpdated: 'timestamp',
    tags: 'array<string>'
  },

  explanationPrompt: `
TI lookup for: {indicator}
Found: {found}
Verdict: {verdict}
Source: {source}

Brief 1-sentence summary of TI status.`
};
```

---

### 3. analyze_image

**Category**: IMAGE_ANALYSIS
**Requires LLM**: No (for analysis), Yes (for explanation)
**Latency**: 3-5s

```typescript
const ANALYZE_IMAGE_TOOL = {
  name: 'analyze_image',
  description: 'Analyze images for deepfakes, phishing pages, or text extraction',
  category: 'IMAGE_ANALYSIS',

  schema: {
    type: 'function',
    function: {
      name: 'analyze_image',
      parameters: {
        type: 'object',
        properties: {
          image_url: {
            type: 'string',
            description: 'URL or data URI of the image'
          },
          analysis_type: {
            type: 'string',
            enum: ['deepfake', 'phishing', 'ocr', 'general'],
            description: 'Type of analysis to perform'
          }
        },
        required: ['image_url', 'analysis_type']
      }
    }
  },

  toonSchema: `analyze_image{image_url:str!,analysis_type:enum[deepfake/phishing/ocr/general]!}`,

  endpoints: {
    analyze: 'POST /api/v2/scanner/analyze-image'
  },

  intentPatterns: {
    patterns: [
      /(?:is\s+this|analyze)\s+(?:image|photo|picture|screenshot)/i,
      /deepfake/i,
      /fake\s+(?:image|photo)/i,
      /ocr|extract\s+text/i
    ],
    keywords: ['deepfake', 'fake image', 'real or fake', 'analyze image', 'screenshot', 'ocr'],
    confidence: 0.85
  },

  responseSchema: {
    analysisType: 'string',
    isManipulated: 'boolean',
    confidence: 'number',
    findings: 'array<{type, description, severity}>',
    extractedText: 'string | null',
    metadata: 'object'
  }
};
```

---

### 4. analyze_sentiment

**Category**: SENTIMENT
**Requires LLM**: No
**Latency**: 1-2s

```typescript
const ANALYZE_SENTIMENT_TOOL = {
  name: 'analyze_sentiment',
  description: 'Analyze text for phishing indicators (urgency, fear, manipulation)',
  category: 'SENTIMENT',

  schema: {
    type: 'function',
    function: {
      name: 'analyze_sentiment',
      parameters: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'Text to analyze for manipulation tactics'
          }
        },
        required: ['text']
      }
    }
  },

  toonSchema: `analyze_sentiment{text:str!}`,

  endpoints: {
    analyze: 'POST /api/v2/scanner/analyze-sentiment'
  },

  intentPatterns: {
    patterns: [
      /analyze\s+(?:this\s+)?(?:text|message|email)/i,
      /is\s+this\s+(?:a\s+)?(?:scam|phishing)/i,
      /check\s+(?:this\s+)?(?:email|message)/i
    ],
    keywords: ['analyze text', 'check email', 'is this scam', 'phishing email', 'suspicious message'],
    confidence: 0.88
  },

  responseSchema: {
    overallScore: 'number (0-100)',
    isPhishing: 'boolean',
    tactics: 'array<{tactic, severity, examples}>',
    urgencyLevel: 'LOW | MEDIUM | HIGH',
    manipulationIndicators: 'array<string>'
  }
};
```

---

### 5. lookup_indicators

**Category**: THREAT_INTEL
**Requires LLM**: No
**Latency**: 1-3s (depending on count)

```typescript
const LOOKUP_INDICATORS_TOOL = {
  name: 'lookup_indicators',
  description: 'Bulk lookup multiple threat indicators',
  category: 'THREAT_INTEL',

  schema: {
    type: 'function',
    function: {
      name: 'lookup_indicators',
      parameters: {
        type: 'object',
        properties: {
          indicators: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of indicators to look up'
          }
        },
        required: ['indicators']
      }
    }
  },

  toonSchema: `lookup_indicators{indicators:str[]!}`,

  endpoints: {
    bulk: 'POST /api/v2/ti/bulk-lookup'
  },

  intentPatterns: {
    patterns: [
      /check\s+(?:these|multiple|all)/i,
      /bulk\s+(?:lookup|check|scan)/i
    ],
    keywords: ['check these', 'multiple urls', 'bulk lookup', 'all these'],
    confidence: 0.85
  }
};
```

---

### 6. get_user_profile

**Category**: USER_MANAGEMENT
**Requires LLM**: No
**Latency**: <100ms

```typescript
const GET_USER_PROFILE_TOOL = {
  name: 'get_user_profile',
  description: 'Get user profile including whitelist, blacklist, and preferences',
  category: 'USER_MANAGEMENT',

  schema: {
    type: 'function',
    function: {
      name: 'get_user_profile',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },

  toonSchema: `get_user_profile{}`,

  endpoints: {
    profile: 'GET /api/v2/profile'
  },

  intentPatterns: {
    patterns: [
      /(?:my|show)\s+(?:profile|whitelist|blacklist)/i,
      /what\s+(?:domains|sites)\s+(?:are|have\s+i)/i
    ],
    keywords: ['my profile', 'my whitelist', 'my blacklist', 'show profile'],
    confidence: 0.92
  }
};
```

---

### 7. add_to_whitelist

**Category**: USER_MANAGEMENT
**Requires LLM**: No
**Latency**: <100ms

```typescript
const ADD_TO_WHITELIST_TOOL = {
  name: 'add_to_whitelist',
  description: 'Add a domain to user whitelist (always safe)',
  category: 'USER_MANAGEMENT',

  schema: {
    type: 'function',
    function: {
      name: 'add_to_whitelist',
      parameters: {
        type: 'object',
        properties: {
          domain: {
            type: 'string',
            description: 'Domain to whitelist (e.g., google.com)'
          }
        },
        required: ['domain']
      }
    }
  },

  toonSchema: `add_to_whitelist{domain:str!}`,

  endpoints: {
    add: 'POST /api/v2/profile/whitelist'
  },

  intentPatterns: {
    patterns: [
      /whitelist\s+/i,
      /add\s+.+\s+to\s+(?:my\s+)?whitelist/i,
      /trust\s+(?:this\s+)?domain/i
    ],
    keywords: ['whitelist', 'add to whitelist', 'trust domain', 'mark safe'],
    confidence: 0.95
  }
};
```

---

### 8. add_to_blacklist

**Category**: USER_MANAGEMENT
**Requires LLM**: No
**Latency**: <100ms

```typescript
const ADD_TO_BLACKLIST_TOOL = {
  name: 'add_to_blacklist',
  description: 'Add a domain to user blacklist (always dangerous)',
  category: 'USER_MANAGEMENT',

  schema: {
    type: 'function',
    function: {
      name: 'add_to_blacklist',
      parameters: {
        type: 'object',
        properties: {
          domain: {
            type: 'string',
            description: 'Domain to blacklist'
          },
          reason: {
            type: 'string',
            description: 'Reason for blacklisting'
          }
        },
        required: ['domain']
      }
    }
  },

  toonSchema: `add_to_blacklist{domain:str!,reason:str}`,

  intentPatterns: {
    patterns: [
      /blacklist\s+/i,
      /block\s+(?:this\s+)?(?:domain|site)/i,
      /add\s+.+\s+to\s+(?:my\s+)?blacklist/i
    ],
    keywords: ['blacklist', 'block domain', 'add to blacklist', 'block this'],
    confidence: 0.95
  }
};
```

---

### 9. sync_threat_intelligence

**Category**: THREAT_INTEL
**Requires LLM**: No
**Latency**: 5-30s

```typescript
const SYNC_TI_TOOL = {
  name: 'sync_threat_intelligence',
  description: 'Synchronize local TI cache with cloud database',
  category: 'THREAT_INTEL',

  schema: {
    type: 'function',
    function: {
      name: 'sync_threat_intelligence',
      parameters: {
        type: 'object',
        properties: {
          force: {
            type: 'boolean',
            description: 'Force full sync (vs incremental)'
          }
        }
      }
    }
  },

  toonSchema: `sync_ti{force:bool}`,

  endpoints: {
    sync: 'GET /api/v2/ti/federated-sync'
  },

  intentPatterns: {
    patterns: [
      /sync\s+(?:ti|threat\s+intelligence)/i,
      /update\s+(?:ti|threat)\s+database/i
    ],
    keywords: ['sync ti', 'update database', 'refresh threats'],
    confidence: 0.90
  }
};
```

---

### 10. explain_security_concept

**Category**: EDUCATION
**Requires LLM**: Yes
**Latency**: 1-3s

```typescript
const EXPLAIN_CONCEPT_TOOL = {
  name: 'explain_security_concept',
  description: 'Explain cybersecurity concepts in simple terms',
  category: 'EDUCATION',

  schema: {
    type: 'function',
    function: {
      name: 'explain_security_concept',
      parameters: {
        type: 'object',
        properties: {
          concept: {
            type: 'string',
            enum: ['phishing', 'typosquatting', 'deepfake', 'malware', 'ransomware', 'social_engineering', 'password_security', 'two_factor', 'vpn', 'encryption'],
            description: 'Security concept to explain'
          }
        },
        required: ['concept']
      }
    }
  },

  toonSchema: `explain_concept{concept:enum[phishing/typosquatting/deepfake/malware/ransomware/social_engineering/password_security/two_factor/vpn/encryption]!}`,

  intentPatterns: {
    patterns: [
      /what\s+is\s+(?:a\s+)?/i,
      /explain\s+/i,
      /tell\s+me\s+about\s+/i,
      /how\s+does\s+.+\s+work/i
    ],
    keywords: ['what is', 'explain', 'tell me about', 'how does', 'define'],
    confidence: 0.85,
    requiresLLM: true
  },

  // Pre-built explanations for common concepts
  staticExplanations: {
    phishing: `Phishing is a cyberattack where criminals pretend to be trusted entities (banks, companies, friends) to trick you into revealing sensitive information like passwords, credit card numbers, or personal data. They typically use fake emails, websites, or messages that look authentic.

**Red Flags:**
- Urgent language ("Act now!", "Account suspended!")
- Generic greetings ("Dear Customer")
- Suspicious sender addresses
- Links that don't match the claimed website
- Requests for sensitive information

**Protection Tips:**
1. Never click links in unexpected emails
2. Verify sender addresses carefully
3. Go directly to official websites
4. Enable two-factor authentication`,

    typosquatting: `Typosquatting (also called URL hijacking) is when attackers register domain names that are slight misspellings of popular websites to catch users who make typing errors.

**Examples:**
- gooogle.com (extra 'o')
- paypa1.com (number '1' instead of 'l')
- amazn.com (missing 'o')
- faceb00k.com (zeros instead of 'o's)

**Protection Tips:**
1. Use bookmarks for important sites
2. Check URLs carefully before entering credentials
3. Use a password manager (auto-fills only on correct domains)
4. Enable browser security warnings`
  }
};
```

---

### 11. web_search

**Category**: WEB_SEARCH
**Requires LLM**: No
**Latency**: 2-5s

```typescript
const WEB_SEARCH_TOOL = {
  name: 'web_search',
  description: 'Search the web for information about a URL or domain',
  category: 'WEB_SEARCH',

  schema: {
    type: 'function',
    function: {
      name: 'web_search',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query (e.g., "example.com reputation")'
          }
        },
        required: ['query']
      }
    }
  },

  toonSchema: `web_search{query:str!}`,

  endpoints: {
    search: 'POST /api/v2/ai/web-search'
  },

  intentPatterns: {
    patterns: [
      /search\s+(?:the\s+)?web\s+for/i,
      /google\s+/i,
      /find\s+(?:info|information)\s+about/i
    ],
    keywords: ['search web', 'google', 'find info', 'look up online'],
    confidence: 0.80
  }
};
```

---

## Workflow Templates (4)

### 1. comprehensive_url_check

**Description**: Full URL safety analysis with parallel execution
**Tools Used**: scan_url, search_ti, web_search, synthesize
**Latency**: 3-5s (parallel execution)

```typescript
const COMPREHENSIVE_URL_CHECK_WORKFLOW = {
  id: 'comprehensive_url_check',
  name: 'Comprehensive URL Safety Check',
  description: 'Parallel scan with TI lookup and web research',
  category: 'WORKFLOW',

  steps: [
    {
      id: 'edge_scan',
      tool: 'scan_url',
      params: { scan_type: 'edge' },
      parallel: true
    },
    {
      id: 'ti_lookup',
      tool: 'search_threat_intelligence',
      params: {},  // indicator extracted from URL
      parallel: true
    },
    {
      id: 'web_research',
      tool: 'web_search',
      params: {},  // query = "{domain} reputation reviews"
      parallel: true
    },
    {
      id: 'synthesize',
      tool: 'synthesize_results',
      params: {},
      parallel: false,
      depends: ['edge_scan', 'ti_lookup', 'web_research']
    }
  ],

  systemPrompt: `
Combine results from edge ML scan, TI database, and web research.
Weights: Edge ML (40%), TI Database (40%), Web Research (20%)
Provide unified verdict (SAFE/SUSPICIOUS/DANGEROUS).
Explain key findings from each source.
Give confidence score and actionable recommendation.`,

  responseTemplate: `
## URL Safety Analysis: {url}

**Verdict**: {unified_verdict} ({confidence}% confidence)

### Edge ML Scan
- Risk Score: {edge.riskScore}
- Indicators: {edge.indicators}

### Threat Intelligence
- Database Status: {ti.found ? 'Found' : 'Not Found'}
- Source: {ti.source}

### Web Research
- Reputation: {web.summary}

**Recommendation**: {recommendation}
`
};
```

---

### 2. phishing_email_analysis

**Description**: Analyze email for phishing indicators
**Tools Used**: analyze_sentiment, search_ti (for links), web_search
**Latency**: 3-5s

```typescript
const PHISHING_EMAIL_WORKFLOW = {
  id: 'phishing_email_analysis',
  name: 'Phishing Email Analysis',
  description: 'Comprehensive email phishing detection',
  category: 'WORKFLOW',

  steps: [
    {
      id: 'sentiment',
      tool: 'analyze_sentiment',
      params: {},  // text = email body
      parallel: true
    },
    {
      id: 'link_check',
      tool: 'lookup_indicators',
      params: {},  // indicators = extracted URLs from email
      parallel: true
    },
    {
      id: 'sender_check',
      tool: 'search_threat_intelligence',
      params: {},  // indicator = sender domain
      parallel: true
    },
    {
      id: 'synthesize',
      tool: 'synthesize_results',
      params: {},
      parallel: false,
      depends: ['sentiment', 'link_check', 'sender_check']
    }
  ],

  systemPrompt: `
Analyze email for phishing:
1. Sentiment analysis for manipulation tactics
2. Check all links against TI database
3. Verify sender domain reputation

Provide phishing likelihood (0-100%).
List specific red flags found.
Give clear recommendation (delete, report, safe).`
};
```

---

### 3. deepfake_verification

**Description**: Verify if image/video is AI-generated
**Tools Used**: analyze_image (deepfake), web_search (reverse image)
**Latency**: 5-10s

```typescript
const DEEPFAKE_VERIFICATION_WORKFLOW = {
  id: 'deepfake_verification',
  name: 'Deepfake Verification',
  description: 'AI-generated media detection with web verification',
  category: 'WORKFLOW',

  steps: [
    {
      id: 'deepfake_analysis',
      tool: 'analyze_image',
      params: { analysis_type: 'deepfake' },
      parallel: true
    },
    {
      id: 'reverse_search',
      tool: 'web_search',
      params: {},  // reverse image search
      parallel: true
    },
    {
      id: 'synthesize',
      tool: 'synthesize_results',
      params: {},
      parallel: false,
      depends: ['deepfake_analysis', 'reverse_search']
    }
  ]
};
```

---

### 4. threat_investigation

**Description**: Deep dive into a suspected threat
**Tools Used**: scan_url (deep), search_ti, web_search, analyze_image
**Latency**: 30-60s

```typescript
const THREAT_INVESTIGATION_WORKFLOW = {
  id: 'threat_investigation',
  name: 'Deep Threat Investigation',
  description: 'Comprehensive threat analysis for security teams',
  category: 'WORKFLOW',

  steps: [
    {
      id: 'deep_scan',
      tool: 'scan_url',
      params: { scan_type: 'deep' },
      parallel: false  // Run first, slowest
    },
    {
      id: 'ti_lookup',
      tool: 'search_threat_intelligence',
      params: {},
      parallel: true,
      after: 'deep_scan'
    },
    {
      id: 'related_iocs',
      tool: 'lookup_indicators',
      params: {},  // Related IOCs from deep scan
      parallel: true,
      after: 'deep_scan'
    },
    {
      id: 'screenshot_analysis',
      tool: 'analyze_image',
      params: { analysis_type: 'phishing' },
      parallel: true,
      after: 'deep_scan'
    },
    {
      id: 'synthesize',
      tool: 'synthesize_results',
      params: {},
      parallel: false,
      depends: ['deep_scan', 'ti_lookup', 'related_iocs', 'screenshot_analysis']
    }
  ],

  systemPrompt: `
Comprehensive threat investigation report:
1. Deep scan results with all model outputs
2. TI database matches and related indicators
3. Screenshot/DOM analysis findings
4. Attack vector and threat actor attribution (if available)
5. Recommended remediation steps
6. IOCs for blocking/monitoring

Format as a security analyst report.`
};
```

---

## Intent Classification Rules

```typescript
const INTENT_PRIORITY_ORDER = [
  // Highest priority - most specific patterns
  { intent: 'scan_url', priority: 100, patterns: [URL_REGEX] },
  { intent: 'add_to_whitelist', priority: 95, keywords: ['whitelist'] },
  { intent: 'add_to_blacklist', priority: 95, keywords: ['blacklist', 'block'] },
  { intent: 'deep_scan', priority: 90, keywords: ['deep scan', 'full scan'] },
  { intent: 'search_ti', priority: 85, keywords: ['search ti', 'lookup'] },
  { intent: 'analyze_image', priority: 80, keywords: ['deepfake', 'analyze image'] },
  { intent: 'analyze_sentiment', priority: 75, keywords: ['analyze text', 'check email'] },
  { intent: 'sync_ti', priority: 70, keywords: ['sync', 'update ti'] },
  { intent: 'get_user_profile', priority: 65, keywords: ['my profile', 'my whitelist'] },
  { intent: 'explain', priority: 50, patterns: [/what is/i, /explain/i] },
  { intent: 'general_chat', priority: 0, default: true }
];
```

---

## Tool Execution Summary

| Tool | API Endpoint | Auth | Rate Limit | Cache |
|------|-------------|------|------------|-------|
| scan_url (edge) | Local | No | 200/min | Yes |
| scan_url (hybrid) | /api/v2/scanner/hybrid | JWT | 10/min | Yes |
| scan_url (deep) | /api/v2/scan/uri | JWT | 5/min | Yes |
| search_ti | /api/v2/ti/lookup | JWT | 60/min | Yes |
| analyze_image | /api/v2/scanner/analyze-image | JWT | 10/min | No |
| analyze_sentiment | /api/v2/scanner/analyze-sentiment | JWT | 30/min | No |
| lookup_indicators | /api/v2/ti/bulk-lookup | JWT | 5/min | Yes |
| get_user_profile | /api/v2/profile | JWT | 30/min | Yes |
| add_to_whitelist | /api/v2/profile/whitelist | JWT | 10/min | - |
| add_to_blacklist | /api/v2/profile/blacklist | JWT | 10/min | - |
| sync_ti | /api/v2/ti/federated-sync | JWT | 1/5min | - |
| web_search | /api/v2/ai/web-search | JWT | 10/min | Yes |

---

**Document Version**: 1.0.0
**Total Tools**: 15 (11 Core + 4 Workflows)
**Coverage**: 100% Elara Platform APIs
