/**
 * Elara AI Agent - Tool Definitions for LLM Function Calling
 *
 * OpenAI-compatible tool definitions for all 16 security features.
 * These definitions are passed to the LLM to enable function calling.
 */

import type { ToolDefinition } from './types';

// ============================================================================
// SCAN TOOLS
// ============================================================================

export const SCAN_URL_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'scan_url',
    description:
      'Scan a URL for phishing, malware, and other security threats. Uses multi-tier analysis (edge ML, cloud TI, deep scan).',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to scan for threats',
        },
        scanType: {
          type: 'string',
          description: 'Scan depth: edge (fast, <100ms), hybrid (with TI), deep (full analysis)',
          enum: ['edge', 'hybrid', 'deep'],
          default: 'hybrid',
        },
        includeScreenshot: {
          type: 'boolean',
          description: 'Whether to capture and analyze a screenshot of the page',
          default: false,
        },
      },
      required: ['url'],
    },
  },
};

export const SCAN_MESSAGE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'scan_message',
    description:
      'Analyze a text message (email, SMS, chat) for scam indicators, phishing attempts, and social engineering.',
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The message content to analyze',
        },
        context: {
          type: 'string',
          description: 'The context where the message was received',
          enum: ['email', 'sms', 'chat', 'social'],
        },
      },
      required: ['message'],
    },
  },
};

// ============================================================================
// VERIFICATION TOOLS
// ============================================================================

export const FACT_CHECK_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'fact_check',
    description:
      'Verify the truthfulness of a claim using multiple sources. Returns verdict with confidence and source citations.',
    parameters: {
      type: 'object',
      properties: {
        claim: {
          type: 'string',
          description: 'The claim or statement to fact-check',
        },
        sources: {
          type: 'array',
          description: 'Optional URLs to check as sources',
          items: { type: 'string' },
        },
        context: {
          type: 'string',
          description: 'Additional context about the claim',
        },
      },
      required: ['claim'],
    },
  },
};

export const VERIFY_COMPANY_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'verify_company',
    description:
      'Perform background verification on a company. Checks registration, legitimacy, and red flags.',
    parameters: {
      type: 'object',
      properties: {
        companyName: {
          type: 'string',
          description: 'The company name to verify',
        },
        domain: {
          type: 'string',
          description: 'Company website domain (optional)',
        },
        country: {
          type: 'string',
          description: 'Country of registration (optional)',
        },
      },
      required: ['companyName'],
    },
  },
};

export const CHECK_SOCIAL_PROFILE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'check_social_profile',
    description:
      'Verify authenticity of a social media profile. Detects fake accounts, bots, and impersonation.',
    parameters: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          description: 'Social media platform',
          enum: ['twitter', 'linkedin', 'facebook', 'instagram', 'tiktok'],
        },
        profileUrl: {
          type: 'string',
          description: 'URL of the profile to check',
        },
        username: {
          type: 'string',
          description: 'Username (if URL not provided)',
        },
      },
      required: ['platform'],
    },
  },
};

// ============================================================================
// DETECTION TOOLS
// ============================================================================

export const DETECT_DEEPFAKE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'detect_deepfake',
    description:
      'Analyze an image for signs of AI manipulation, deepfakes, or digital tampering.',
    parameters: {
      type: 'object',
      properties: {
        imageUrl: {
          type: 'string',
          description: 'URL of the image to analyze',
        },
        imageBase64: {
          type: 'string',
          description: 'Base64-encoded image data (if URL not provided)',
        },
        analysisLevel: {
          type: 'string',
          description: 'Depth of analysis',
          enum: ['quick', 'standard', 'thorough'],
          default: 'standard',
        },
      },
      required: [],
    },
  },
};

export const DETECT_REMOTE_SOFTWARE_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'detect_remote_software',
    description:
      'Detect active remote access software (AnyDesk, TeamViewer, etc.) that scammers use to take control.',
    parameters: {
      type: 'object',
      properties: {
        includeActiveConnections: {
          type: 'boolean',
          description: 'Include active connection details',
          default: true,
        },
      },
      required: [],
    },
  },
};

export const REVERSE_IMAGE_SEARCH_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'reverse_image_search',
    description:
      'Search for other occurrences of an image online. Useful for detecting catfishing and stolen photos.',
    parameters: {
      type: 'object',
      properties: {
        imageUrl: {
          type: 'string',
          description: 'URL of the image to search',
        },
        imageBase64: {
          type: 'string',
          description: 'Base64-encoded image data',
        },
      },
      required: [],
    },
  },
};

// ============================================================================
// CRYPTO & PHONE TOOLS
// ============================================================================

export const CHECK_CRYPTO_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'check_crypto',
    description:
      'Analyze a cryptocurrency address or transaction for fraud indicators, sanctions, and mixer usage.',
    parameters: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'Cryptocurrency wallet address',
        },
        transactionHash: {
          type: 'string',
          description: 'Transaction hash (optional)',
        },
        network: {
          type: 'string',
          description: 'Blockchain network',
          enum: ['bitcoin', 'ethereum', 'solana', 'polygon', 'auto'],
          default: 'auto',
        },
      },
      required: [],
    },
  },
};

export const CHECK_PHONE_NUMBER_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'check_phone_number',
    description:
      'Validate and analyze a phone number. Checks for VoIP, spam reports, and fraud indicators.',
    parameters: {
      type: 'object',
      properties: {
        phoneNumber: {
          type: 'string',
          description: 'Phone number to check',
        },
        countryCode: {
          type: 'string',
          description: 'ISO country code (optional)',
        },
      },
      required: ['phoneNumber'],
    },
  },
};

// ============================================================================
// ASSISTANCE TOOLS
// ============================================================================

export const COUNSELING_CHAT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'counseling_chat',
    description:
      'Provide empathetic counseling support for scam victims. Offers resources, next steps, and emotional support.',
    parameters: {
      type: 'object',
      properties: {
        userMessage: {
          type: 'string',
          description: 'User message to respond to',
        },
        context: {
          type: 'string',
          description: 'Type of incident',
          enum: ['scam_victim', 'identity_theft', 'financial_fraud', 'general'],
        },
        previousMessages: {
          type: 'array',
          description: 'Previous conversation history',
          items: { type: 'object' },
        },
      },
      required: ['userMessage'],
    },
  },
};

export const L1_TROUBLESHOOT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'l1_troubleshoot',
    description:
      'Provide step-by-step troubleshooting guidance for common security and device issues.',
    parameters: {
      type: 'object',
      properties: {
        issue: {
          type: 'string',
          description: 'Description of the issue',
        },
        category: {
          type: 'string',
          description: 'Issue category',
          enum: ['account', 'device', 'network', 'privacy', 'malware', 'general'],
        },
        deviceType: {
          type: 'string',
          description: 'User device type',
          enum: ['windows', 'mac', 'android', 'ios', 'linux'],
        },
      },
      required: ['issue'],
    },
  },
};

export const PASSWORD_VAULT_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'password_vault',
    description:
      'Generate secure passwords, check password strength, or verify if a password has been breached.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'Action to perform',
          enum: ['generate', 'check_strength', 'check_breach'],
        },
        password: {
          type: 'string',
          description: 'Password to check (for check_strength or check_breach)',
        },
        length: {
          type: 'number',
          description: 'Desired password length (for generate)',
          default: 16,
        },
        options: {
          type: 'object',
          description: 'Password generation options',
        },
      },
      required: ['action'],
    },
  },
};

// ============================================================================
// MEMORY TOOLS (E-BRAIN)
// ============================================================================

export const SEARCH_MEMORIES_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'search_memories',
    description:
      'Search E-BRAIN neural memory for relevant past experiences, patterns, and learned knowledge.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
        memoryTypes: {
          type: 'array',
          description: 'Types of memories to search',
          items: { type: 'string' },
        },
        limit: {
          type: 'number',
          description: 'Maximum results',
          default: 10,
        },
        minSimilarity: {
          type: 'number',
          description: 'Minimum similarity threshold (0-1)',
          default: 0.5,
        },
      },
      required: ['query'],
    },
  },
};

export const STORE_MEMORY_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'store_memory',
    description:
      'Store new information in E-BRAIN neural memory for future reference and learning.',
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'Memory content to store',
        },
        memoryType: {
          type: 'string',
          description: 'Type of memory',
          enum: ['episodic', 'semantic', 'procedural', 'learned'],
        },
        importance: {
          type: 'number',
          description: 'Importance score (0-1)',
          default: 0.5,
        },
        tags: {
          type: 'array',
          description: 'Tags for categorization',
          items: { type: 'string' },
        },
      },
      required: ['content', 'memoryType'],
    },
  },
};

export const GET_AGENT_STATUS_DEFINITION: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_agent_status',
    description:
      'Get current status of the Elara AI Agent, including memory metrics and health.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

// ============================================================================
// ALL TOOLS ARRAY
// ============================================================================

export const ALL_TOOL_DEFINITIONS: ToolDefinition[] = [
  SCAN_URL_DEFINITION,
  SCAN_MESSAGE_DEFINITION,
  FACT_CHECK_DEFINITION,
  VERIFY_COMPANY_DEFINITION,
  CHECK_SOCIAL_PROFILE_DEFINITION,
  DETECT_DEEPFAKE_DEFINITION,
  DETECT_REMOTE_SOFTWARE_DEFINITION,
  REVERSE_IMAGE_SEARCH_DEFINITION,
  CHECK_CRYPTO_DEFINITION,
  CHECK_PHONE_NUMBER_DEFINITION,
  COUNSELING_CHAT_DEFINITION,
  L1_TROUBLESHOOT_DEFINITION,
  PASSWORD_VAULT_DEFINITION,
  SEARCH_MEMORIES_DEFINITION,
  STORE_MEMORY_DEFINITION,
  GET_AGENT_STATUS_DEFINITION,
];

export const TOOL_DEFINITIONS_MAP: Record<string, ToolDefinition> = {
  scan_url: SCAN_URL_DEFINITION,
  scan_message: SCAN_MESSAGE_DEFINITION,
  fact_check: FACT_CHECK_DEFINITION,
  verify_company: VERIFY_COMPANY_DEFINITION,
  check_social_profile: CHECK_SOCIAL_PROFILE_DEFINITION,
  detect_deepfake: DETECT_DEEPFAKE_DEFINITION,
  detect_remote_software: DETECT_REMOTE_SOFTWARE_DEFINITION,
  reverse_image_search: REVERSE_IMAGE_SEARCH_DEFINITION,
  check_crypto: CHECK_CRYPTO_DEFINITION,
  check_phone_number: CHECK_PHONE_NUMBER_DEFINITION,
  counseling_chat: COUNSELING_CHAT_DEFINITION,
  l1_troubleshoot: L1_TROUBLESHOOT_DEFINITION,
  password_vault: PASSWORD_VAULT_DEFINITION,
  search_memories: SEARCH_MEMORIES_DEFINITION,
  store_memory: STORE_MEMORY_DEFINITION,
  get_agent_status: GET_AGENT_STATUS_DEFINITION,
};
