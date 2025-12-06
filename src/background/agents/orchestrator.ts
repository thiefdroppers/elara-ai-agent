/**
 * Elara AI Agent - Enhanced Orchestrator
 *
 * Enterprise-grade multi-agent coordinator with:
 * - Zero-LLM intent classification (80% of requests)
 * - TOON-encoded prompts for 40% token reduction
 * - Parallel tool execution with circuit breakers
 * - Intelligent routing to appropriate handlers
 * - Function/Tool calling via Gemini AI
 *
 * @version 2.0.0 - Enhanced with Prompt Registry
 */

import { scannerClient } from '@/api/scanner-client';
import { functionRouter, AVAILABLE_FUNCTIONS } from './function-router';
import {
  intentClassifier,
  toolExecutor,
  toonEncoder,
  createExecutionPlan,
  COMPRESSED_SYSTEM_PROMPT,
  MINIMAL_SYSTEM_PROMPT,
  STATIC_EXPLANATIONS,
  RESPONSE_TEMPLATES,
  WORKFLOW_TEMPLATES,
  TOOL_DEFINITIONS,
} from '@/lib/prompt-registry';
import type { IntentClassification as EnhancedIntentClassification, ToolExecutionResult } from '@/lib/prompt-registry/types';
import type {
  ChatMessage,
  IntentClassification,
  Intent,
  OrchestratorState,
  ScanResult,
  ThreatCard,
  RiskLevel,
} from '@/types';

// ============================================================================
// SYSTEM PROMPTS (Pre-generated, TOON-optimized)
// ============================================================================

/**
 * Primary system prompt - TOON-compressed (~50 tokens vs 500)
 * Used for most requests to minimize token usage
 */
const ELARA_SYSTEM_PROMPT = COMPRESSED_SYSTEM_PROMPT;

/**
 * Minimal prompt for simple tool execution (~20 tokens)
 */
const ELARA_MINIMAL_PROMPT = MINIMAL_SYSTEM_PROMPT;

// ============================================================================
// CONVERSATION MEMORY
// ============================================================================

interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  intent?: string;
  scanResult?: ScanResult;
}

interface ConversationContext {
  turns: ConversationTurn[];
  lastScannedUrl?: string;
  lastScanResult?: ScanResult;
  userMood: 'neutral' | 'concerned' | 'curious' | 'frustrated';
  sessionStart: number;
}

// ============================================================================
// CONVERSATIONAL SYSTEM PROMPT
// ============================================================================

const CONVERSATIONAL_SYSTEM_PROMPT = `You are Elara, a friendly and knowledgeable cybersecurity assistant. Your personality:

- Warm and approachable - you're a helpful friend, not a cold robot
- Empathetic - you understand users may be worried about security threats
- Educational - you explain things clearly without being condescending
- Proactive - you offer helpful follow-ups and suggestions
- Concise but thorough - give complete answers without unnecessary verbosity

When responding:
1. Acknowledge the user's concern or question naturally
2. Provide the key information they need
3. Offer a helpful follow-up or suggestion
4. Keep a conversational tone throughout

Remember context from previous messages in this conversation. If the user scanned a URL before, reference it naturally.`;

// ============================================================================
// ORCHESTRATOR CLASS
// ============================================================================

export class AgentOrchestrator {
  private state: OrchestratorState = {
    state: 'idle',
    progress: 0,
  };

  // Conversation memory for session context
  private conversationContext: ConversationContext = {
    turns: [],
    userMood: 'neutral',
    sessionStart: Date.now(),
  };

  // Request counter for analytics
  private requestStats = {
    total: 0,
    zeroLLM: 0,
    llmRequired: 0,
    toolExecutions: new Map<string, number>(),
  };

  constructor() {
    // Register tool handlers with the executor
    this.registerToolHandlers();
  }

  // --------------------------------------------------------------------------
  // Conversation Memory Management
  // --------------------------------------------------------------------------

  private addToConversation(turn: ConversationTurn): void {
    this.conversationContext.turns.push(turn);
    // Keep last 20 turns for context
    if (this.conversationContext.turns.length > 20) {
      this.conversationContext.turns = this.conversationContext.turns.slice(-20);
    }
  }

  private getConversationSummary(): string {
    const recent = this.conversationContext.turns.slice(-6);
    if (recent.length === 0) return '';

    let summary = 'Recent conversation:\n';
    recent.forEach(turn => {
      const prefix = turn.role === 'user' ? 'User' : 'Elara';
      const content = turn.content.substring(0, 150) + (turn.content.length > 150 ? '...' : '');
      summary += `${prefix}: ${content}\n`;
    });

    if (this.conversationContext.lastScannedUrl) {
      summary += `\nLast scanned URL: ${this.conversationContext.lastScannedUrl}`;
      if (this.conversationContext.lastScanResult) {
        summary += ` (Result: ${this.conversationContext.lastScanResult.verdict})`;
      }
    }

    return summary;
  }

  private detectUserMood(message: string): 'neutral' | 'concerned' | 'curious' | 'frustrated' {
    const lowerMsg = message.toLowerCase();

    if (lowerMsg.includes('help') || lowerMsg.includes('worried') || lowerMsg.includes('scared') ||
        lowerMsg.includes('is this safe') || lowerMsg.includes('am i safe')) {
      return 'concerned';
    }
    if (lowerMsg.includes('what') || lowerMsg.includes('how') || lowerMsg.includes('why') ||
        lowerMsg.includes('explain') || lowerMsg.includes('tell me')) {
      return 'curious';
    }
    if (lowerMsg.includes('not working') || lowerMsg.includes('wrong') || lowerMsg.includes('stupid') ||
        lowerMsg.includes('useless')) {
      return 'frustrated';
    }
    return 'neutral';
  }

  clearConversation(): void {
    this.conversationContext = {
      turns: [],
      userMood: 'neutral',
      sessionStart: Date.now(),
    };
  }

  // --------------------------------------------------------------------------
  // Tool Handler Registration
  // --------------------------------------------------------------------------

  private registerToolHandlers(): void {
    // scan_url handler
    toolExecutor.registerTool('scan_url', async (params: { url: string; scan_type?: string }) => {
      const scanType = params.scan_type || 'auto';
      if (scanType === 'deep') {
        return await scannerClient.deepScan(params.url);
      }
      return await scannerClient.hybridScan(params.url);
    });

    // search_threat_intelligence handler
    toolExecutor.registerTool('search_threat_intelligence', async (params: { indicator: string }) => {
      return await scannerClient.searchThreatIntelligence(params.indicator);
    });

    // analyze_image handler
    toolExecutor.registerTool('analyze_image', async (params: { image_url: string; analysis_type: string }) => {
      return await scannerClient.analyzeImage(params.image_url, params.analysis_type);
    });

    // analyze_sentiment handler
    toolExecutor.registerTool('analyze_sentiment', async (params: { text: string }) => {
      return await scannerClient.analyzeSentiment(params.text);
    });

    // get_user_profile handler
    toolExecutor.registerTool('get_user_profile', async () => {
      return await scannerClient.getUserProfile();
    });

    // add_to_whitelist handler
    toolExecutor.registerTool('add_to_whitelist', async (params: { domain: string }) => {
      return await scannerClient.addToWhitelist(params.domain);
    });

    // add_to_blacklist handler
    toolExecutor.registerTool('add_to_blacklist', async (params: { domain: string; reason?: string }) => {
      return await scannerClient.addToBlacklist(params.domain, params.reason);
    });

    // sync_threat_intelligence handler
    toolExecutor.registerTool('sync_threat_intelligence', async (params: { force?: boolean }) => {
      return await scannerClient.syncThreatIntelligence(params.force);
    });

    // explain_security_concept handler (requires LLM)
    toolExecutor.registerTool('explain_security_concept', async (params: { concept: string }) => {
      // Check static explanations first
      const staticExplanation = STATIC_EXPLANATIONS[params.concept.toLowerCase()];
      if (staticExplanation) {
        return { explanation: staticExplanation, source: 'static' };
      }
      // Fall back to LLM for unknown concepts
      const response = await scannerClient.chat(`Explain ${params.concept} in cybersecurity context`, {
        systemPrompt: ELARA_MINIMAL_PROMPT,
      });
      return { explanation: response, source: 'llm' };
    });

    // web_search handler
    toolExecutor.registerTool('web_search', async (params: { query: string }) => {
      return await scannerClient.webSearch(params.query);
    });
  }

  // --------------------------------------------------------------------------
  // State Management
  // --------------------------------------------------------------------------

  getState(): OrchestratorState {
    return { ...this.state };
  }

  private setState(updates: Partial<OrchestratorState>): void {
    this.state = { ...this.state, ...updates };
  }

  getStats(): typeof this.requestStats {
    return {
      ...this.requestStats,
      toolExecutions: new Map(this.requestStats.toolExecutions),
    };
  }

  // --------------------------------------------------------------------------
  // Main Entry Point
  // --------------------------------------------------------------------------

  async processMessage(content: string): Promise<ChatMessage> {
    const id = crypto.randomUUID();
    const timestamp = Date.now();
    this.requestStats.total++;

    // Add user message to conversation memory
    this.addToConversation({
      role: 'user',
      content,
      timestamp,
    });

    // Detect user mood for appropriate tone
    this.conversationContext.userMood = this.detectUserMood(content);

    try {
      this.setState({ state: 'planning', progress: 10 });

      // Step 1: Zero-LLM Intent Classification
      const classification = intentClassifier.classify(content);
      console.log('[Orchestrator] Intent classified:', {
        intent: classification.intent,
        confidence: classification.confidence,
        requiresLLM: classification.requiresLLM,
        toolId: classification.toolId,
        entities: classification.entities,
        mood: this.conversationContext.userMood,
        conversationLength: this.conversationContext.turns.length,
      });

      this.setState({ state: 'executing', progress: 30, currentTask: classification.intent });

      // Step 2: Route based on classification
      let response: ChatMessage;

      // Track zero-LLM vs LLM-required
      if (classification.requiresLLM) {
        this.requestStats.llmRequired++;
      } else {
        this.requestStats.zeroLLM++;
      }

      // High confidence, known tool - execute directly
      if (classification.confidence >= 0.7 && classification.toolId) {
        response = await this.executeToolDirectly(classification, content);
      }
      // Known intent handlers
      else {
        switch (classification.intent) {
          case 'scan_url':
            response = await this.handleUrlScan(classification.entities.url, content);
            break;
          case 'deep_scan':
            response = await this.handleDeepScan(classification.entities.url, content);
            break;
          case 'search_ti':
            response = await this.handleThreatIntelSearch(classification.entities.indicator || classification.entities.url, content);
            break;
          case 'analyze_image':
            response = await this.handleImageAnalysis(classification.entities, content);
            break;
          case 'analyze_sentiment':
            response = await this.handleSentimentAnalysis(content);
            break;
          case 'add_to_whitelist':
            response = await this.handleWhitelist(classification.entities.domain, content);
            break;
          case 'add_to_blacklist':
            response = await this.handleBlacklist(classification.entities.domain, content);
            break;
          case 'get_user_profile':
            response = await this.handleGetProfile();
            break;
          case 'sync_ti':
            response = await this.handleSyncTI();
            break;
          case 'explain':
            response = await this.handleExplain(classification.entities.concept || content);
            break;
          case 'help':
            response = this.handleHelp();
            break;
          case 'greeting':
            response = await this.handleGreeting();
            break;
          case 'general_chat':
          default:
            response = await this.handleGeneralChat(content, classification);
        }
      }

      // Add assistant response to conversation memory
      this.addToConversation({
        role: 'assistant',
        content: response.content,
        timestamp: Date.now(),
        intent: classification.intent,
        scanResult: response.metadata?.scanResult as ScanResult | undefined,
      });

      this.setState({ state: 'complete', progress: 100 });
      return response;

    } catch (error) {
      console.error('[Orchestrator] Error:', error);
      this.setState({ state: 'error', error: String(error) });

      const errorResponse = this.getConversationalErrorResponse(error);

      return {
        id,
        role: 'assistant',
        content: errorResponse,
        timestamp,
        metadata: { error: String(error) },
      };
    }
  }

  private getConversationalErrorResponse(error: unknown): string {
    const errorMsg = error instanceof Error ? error.message : String(error);

    if (errorMsg.includes('timeout')) {
      return `I'm sorry, the scan is taking longer than expected. This sometimes happens with complex websites. Would you like me to try again, or should I do a quick scan instead?`;
    }
    if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
      return `I'm having trouble connecting to my analysis servers right now. Let me try again in a moment. In the meantime, is there anything else I can help you with?`;
    }

    return `Oops! I ran into a small hiccup while processing that. Could you try rephrasing your request? If you were trying to scan a URL, make sure it's a valid web address starting with http:// or https://.`;
  }

  // --------------------------------------------------------------------------
  // Direct Tool Execution (Zero-LLM Path)
  // --------------------------------------------------------------------------

  private async executeToolDirectly(
    classification: EnhancedIntentClassification,
    originalMessage: string
  ): Promise<ChatMessage> {
    const toolId = classification.toolId!;
    const params = this.extractToolParams(classification, originalMessage);

    console.log(`[Orchestrator] Direct tool execution: ${toolId}`, params);

    // Track tool usage
    const currentCount = this.requestStats.toolExecutions.get(toolId) || 0;
    this.requestStats.toolExecutions.set(toolId, currentCount + 1);

    this.setState({ progress: 50, currentTask: `Executing ${toolId}...` });

    const result = await toolExecutor.execute(toolId, params);

    this.setState({ progress: 80 });

    // Format response based on result
    const content = this.formatToolResult(toolId, result);
    const toonResult = toonEncoder.encodeToolResult(result.result);

    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      content,
      timestamp: Date.now(),
      metadata: {
        intent: classification.intent as Intent,
        toolId,
        executionResult: result,
        toonEncoded: toonResult,
        zeroLLM: !classification.requiresLLM,
      },
    };
  }

  private extractToolParams(
    classification: EnhancedIntentClassification,
    _originalMessage: string
  ): Record<string, any> {
    const params: Record<string, any> = {};

    // Map entities to tool parameters
    if (classification.entities.url) {
      params.url = intentClassifier.normalizeURL(classification.entities.url);
    }
    if (classification.entities.domain) {
      params.domain = classification.entities.domain;
    }
    if (classification.entities.indicator) {
      params.indicator = classification.entities.indicator;
    }
    if (classification.entities.concept) {
      params.concept = classification.entities.concept;
    }
    if (classification.entities.text) {
      params.text = classification.entities.text;
    }
    if (classification.entities.analysisType) {
      params.analysis_type = classification.entities.analysisType;
    }

    // Set scan type for deep_scan intent
    if (classification.intent === 'deep_scan') {
      params.scan_type = 'deep';
    }

    return params;
  }

  private formatToolResult(toolId: string, result: ToolExecutionResult): string {
    if (result.status === 'FAILED') {
      return `**Tool Execution Failed**\n\n_Error: ${result.error}_\n\nPlease try again or rephrase your request.`;
    }

    const data = result.result;

    // Use response templates for scan results
    if (toolId === 'scan_url' && data) {
      if (data.verdict === 'SAFE' || data.riskLevel === 'A' || data.riskLevel === 'B') {
        return RESPONSE_TEMPLATES.scan_result_safe(data);
      } else if (data.verdict === 'DANGEROUS' || data.riskLevel === 'E' || data.riskLevel === 'F') {
        return RESPONSE_TEMPLATES.scan_result_dangerous(data);
      } else {
        return RESPONSE_TEMPLATES.scan_result_suspicious(data);
      }
    }

    // TI search results
    if (toolId === 'search_threat_intelligence' && data) {
      if (data.found) {
        return RESPONSE_TEMPLATES.ti_found(data);
      } else {
        return RESPONSE_TEMPLATES.ti_not_found(data.indicator || 'the indicator');
      }
    }

    // Default: format as structured response
    return this.formatGenericResult(toolId, data, result.latency);
  }

  private formatGenericResult(toolId: string, data: any, latency: number): string {
    if (!data) {
      return `**${toolId}** completed successfully.\n\n_Execution time: ${latency}ms_`;
    }

    let response = `**${toolId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}** Result\n\n`;

    // Format key fields
    if (data.verdict) response += `**Verdict:** ${data.verdict}\n`;
    if (data.status) response += `**Status:** ${data.status}\n`;
    if (data.message) response += `${data.message}\n`;
    if (data.explanation) response += `\n${data.explanation}\n`;

    response += `\n_Execution time: ${latency}ms_`;

    return response;
  }

  // --------------------------------------------------------------------------
  // URL Scan Handler (with conversation context)
  // --------------------------------------------------------------------------

  private async handleUrlScan(url: string, _message: string): Promise<ChatMessage> {
    if (!url) {
      return this.createErrorResponse('I need a URL to check. Just paste any link and I\'ll analyze it for you!');
    }

    this.setState({ progress: 50, currentTask: 'Scanning URL...' });

    const normalizedUrl = intentClassifier.normalizeURL(url);
    const scanResult = await scannerClient.hybridScan(normalizedUrl);

    // Store in conversation context
    this.conversationContext.lastScannedUrl = normalizedUrl;
    this.conversationContext.lastScanResult = scanResult;

    this.setState({ progress: 80 });

    const threatCard = this.createThreatCard(scanResult);
    const content = this.formatConversationalScanResponse(scanResult, 'quick');

    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      content,
      timestamp: Date.now(),
      metadata: {
        intent: 'scan_url',
        scanResult,
        threatCard,
        zeroLLM: true,
      },
    };
  }

  // --------------------------------------------------------------------------
  // Deep Scan Handler (with conversation context)
  // --------------------------------------------------------------------------

  private async handleDeepScan(url: string, _message: string): Promise<ChatMessage> {
    if (!url) {
      return this.createErrorResponse('I need a URL to analyze. Could you paste the link you\'d like me to check?');
    }

    this.setState({ progress: 30, currentTask: 'Running comprehensive analysis...' });

    const normalizedUrl = intentClassifier.normalizeURL(url);
    const scanResult = await scannerClient.deepScan(normalizedUrl);

    // Store in conversation context
    this.conversationContext.lastScannedUrl = normalizedUrl;
    this.conversationContext.lastScanResult = scanResult;

    this.setState({ progress: 90 });

    const threatCard = this.createThreatCard(scanResult);
    const content = this.formatConversationalScanResponse(scanResult, 'deep');

    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      content,
      timestamp: Date.now(),
      metadata: {
        intent: 'deep_scan',
        scanResult,
        threatCard,
        zeroLLM: true,
      },
    };
  }

  // --------------------------------------------------------------------------
  // Threat Intelligence Search Handler
  // --------------------------------------------------------------------------

  private async handleThreatIntelSearch(indicator: string, _message: string): Promise<ChatMessage> {
    if (!indicator) {
      return this.createErrorResponse('No indicator provided. Please specify a URL, domain, IP, or hash to search.');
    }

    this.setState({ progress: 50, currentTask: 'Searching threat intelligence...' });

    const result = await toolExecutor.execute('search_threat_intelligence', { indicator });

    this.setState({ progress: 90 });

    const content = result.status === 'SUCCESS'
      ? (result.result?.found
          ? RESPONSE_TEMPLATES.ti_found(result.result)
          : RESPONSE_TEMPLATES.ti_not_found(indicator))
      : `**TI Search Failed**\n\n_Error: ${result.error}_`;

    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      content,
      timestamp: Date.now(),
      metadata: {
        intent: 'search_ti',
        result: result.result,
        zeroLLM: true,
      },
    };
  }

  // --------------------------------------------------------------------------
  // Image Analysis Handler
  // --------------------------------------------------------------------------

  private async handleImageAnalysis(entities: Record<string, any>, _message: string): Promise<ChatMessage> {
    if (!entities.image_url) {
      return {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `**Image Analysis**

To analyze an image for deepfakes or manipulation, I need you to:

1. **Share the image URL** - Provide a direct link to the image
2. **Or describe what you want analyzed** - deepfake detection, OCR, phishing screenshot

**Supported analyses:**
- Deepfake detection (face manipulation)
- Phishing screenshot analysis
- OCR text extraction
- General image analysis

Please share the image you'd like me to analyze.`,
        timestamp: Date.now(),
        metadata: { intent: 'analyze_image', zeroLLM: true },
      };
    }

    this.setState({ progress: 50, currentTask: 'Analyzing image...' });

    const analysisType = entities.analysisType || 'general';
    const result = await toolExecutor.execute('analyze_image', {
      image_url: entities.image_url,
      analysis_type: analysisType,
    });

    this.setState({ progress: 90 });

    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: this.formatGenericResult('analyze_image', result.result, result.latency),
      timestamp: Date.now(),
      metadata: {
        intent: 'analyze_image',
        result: result.result,
        zeroLLM: true,
      },
    };
  }

  // --------------------------------------------------------------------------
  // Sentiment Analysis Handler
  // --------------------------------------------------------------------------

  private async handleSentimentAnalysis(message: string): Promise<ChatMessage> {
    // Extract text to analyze (remove intent keywords)
    const textToAnalyze = message
      .replace(/analyze\s+(this\s+)?(text|message|email)/gi, '')
      .replace(/is\s+this\s+(a\s+)?scam/gi, '')
      .replace(/check\s+(this\s+)?(email|message)/gi, '')
      .trim();

    if (!textToAnalyze || textToAnalyze.length < 10) {
      return {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `**Text/Email Analysis**

To analyze text for manipulation or phishing indicators, please:

1. **Paste the full text** - Email body, message, or suspicious content
2. **Provide context** - Where did you receive this?

I'll analyze it for:
- Urgency manipulation tactics
- Social engineering patterns
- Suspicious requests
- Phishing indicators

Please share the text you'd like me to analyze.`,
        timestamp: Date.now(),
        metadata: { intent: 'analyze_sentiment', zeroLLM: true },
      };
    }

    this.setState({ progress: 50, currentTask: 'Analyzing text...' });

    const result = await toolExecutor.execute('analyze_sentiment', { text: textToAnalyze });

    this.setState({ progress: 90 });

    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: this.formatGenericResult('analyze_sentiment', result.result, result.latency),
      timestamp: Date.now(),
      metadata: {
        intent: 'analyze_sentiment',
        result: result.result,
        zeroLLM: true,
      },
    };
  }

  // --------------------------------------------------------------------------
  // Whitelist/Blacklist Handlers
  // --------------------------------------------------------------------------

  private async handleWhitelist(domain: string, message: string): Promise<ChatMessage> {
    // Try to extract domain from message if not provided
    const targetDomain = domain || this.extractDomainFromMessage(message);

    if (!targetDomain) {
      return this.createErrorResponse('No domain specified. Please provide a domain to whitelist (e.g., "whitelist example.com").');
    }

    this.setState({ progress: 50, currentTask: 'Adding to whitelist...' });

    const result = await toolExecutor.execute('add_to_whitelist', { domain: targetDomain });

    this.setState({ progress: 90 });

    const content = result.status === 'SUCCESS'
      ? `**Domain Whitelisted**\n\n"${targetDomain}" has been added to your whitelist. Future scans will mark this domain as trusted.`
      : `**Whitelist Failed**\n\n_Error: ${result.error}_`;

    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      content,
      timestamp: Date.now(),
      metadata: {
        intent: 'add_to_whitelist',
        domain: targetDomain,
        result: result.result,
        zeroLLM: true,
      },
    };
  }

  private async handleBlacklist(domain: string, message: string): Promise<ChatMessage> {
    const targetDomain = domain || this.extractDomainFromMessage(message);

    if (!targetDomain) {
      return this.createErrorResponse('No domain specified. Please provide a domain to blacklist (e.g., "blacklist evil.com").');
    }

    this.setState({ progress: 50, currentTask: 'Adding to blacklist...' });

    const result = await toolExecutor.execute('add_to_blacklist', {
      domain: targetDomain,
      reason: 'User-reported as dangerous',
    });

    this.setState({ progress: 90 });

    const content = result.status === 'SUCCESS'
      ? `**Domain Blacklisted**\n\n"${targetDomain}" has been added to your blacklist. You'll be warned if you encounter this domain.`
      : `**Blacklist Failed**\n\n_Error: ${result.error}_`;

    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      content,
      timestamp: Date.now(),
      metadata: {
        intent: 'add_to_blacklist',
        domain: targetDomain,
        result: result.result,
        zeroLLM: true,
      },
    };
  }

  private extractDomainFromMessage(message: string): string | null {
    const domainPattern = /([a-zA-Z0-9][-a-zA-Z0-9]*\.)+[a-zA-Z]{2,}/;
    const match = message.match(domainPattern);
    return match ? match[0] : null;
  }

  // --------------------------------------------------------------------------
  // User Profile Handler
  // --------------------------------------------------------------------------

  private async handleGetProfile(): Promise<ChatMessage> {
    this.setState({ progress: 50, currentTask: 'Loading profile...' });

    const result = await toolExecutor.execute('get_user_profile', {});

    this.setState({ progress: 90 });

    if (result.status !== 'SUCCESS' || !result.result) {
      return this.createErrorResponse('Unable to load your profile. Please try again.');
    }

    const profile = result.result;
    const content = `**Your Elara Profile**

**Scan Statistics:**
- Total scans: ${profile.totalScans || 0}
- Threats blocked: ${profile.threatsBlocked || 0}
- Safe URLs: ${profile.safeUrls || 0}

**Whitelisted Domains:** ${profile.whitelist?.length || 0}
${profile.whitelist?.slice(0, 5).map((d: string) => `- ${d}`).join('\n') || '- None'}

**Blacklisted Domains:** ${profile.blacklist?.length || 0}
${profile.blacklist?.slice(0, 5).map((d: string) => `- ${d}`).join('\n') || '- None'}

**Account:** ${profile.email || 'Anonymous'}`;

    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      content,
      timestamp: Date.now(),
      metadata: {
        intent: 'get_user_profile',
        profile,
        zeroLLM: true,
      },
    };
  }

  // --------------------------------------------------------------------------
  // Sync TI Handler
  // --------------------------------------------------------------------------

  private async handleSyncTI(): Promise<ChatMessage> {
    this.setState({ progress: 30, currentTask: 'Syncing threat intelligence...' });

    const result = await toolExecutor.execute('sync_threat_intelligence', { force: false });

    this.setState({ progress: 90 });

    const content = result.status === 'SUCCESS'
      ? `**Threat Intelligence Updated**\n\n${result.result?.message || 'Database synchronized successfully.'}\n\n- New indicators: ${result.result?.newIndicators || 0}\n- Last sync: ${new Date().toLocaleString()}`
      : `**Sync Failed**\n\n_Error: ${result.error}_`;

    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      content,
      timestamp: Date.now(),
      metadata: {
        intent: 'sync_ti',
        result: result.result,
        zeroLLM: true,
      },
    };
  }

  // --------------------------------------------------------------------------
  // Explain Handler (Uses Static Content + LLM Fallback)
  // --------------------------------------------------------------------------

  private async handleExplain(conceptOrMessage: string): Promise<ChatMessage> {
    // Extract concept from message
    const concept = conceptOrMessage
      .toLowerCase()
      .replace(/^(what\s+is|explain|tell\s+me\s+about|define)\s+(a\s+)?/i, '')
      .replace(/\?+$/, '')
      .trim();

    // Check static explanations first (zero-LLM)
    const knownConcepts = ['phishing', 'typosquatting', 'deepfake', 'malware', 'ransomware', 'social_engineering'];
    const matchedConcept = knownConcepts.find(c => concept.includes(c.replace('_', ' ')) || concept.includes(c));

    if (matchedConcept && STATIC_EXPLANATIONS[matchedConcept]) {
      return {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: STATIC_EXPLANATIONS[matchedConcept],
        timestamp: Date.now(),
        metadata: {
          intent: 'explain',
          concept: matchedConcept,
          source: 'static',
          zeroLLM: true,
        },
      };
    }

    // Fall back to LLM for unknown concepts
    try {
      console.log('[Orchestrator] Using LLM for explanation:', concept);
      const aiResponse = await scannerClient.chat(
        `Explain "${concept}" in the context of cybersecurity. Be concise and provide practical advice.`,
        { systemPrompt: ELARA_MINIMAL_PROMPT }
      );

      return {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: aiResponse,
        timestamp: Date.now(),
        metadata: {
          intent: 'explain',
          concept,
          source: 'llm',
          zeroLLM: false,
        },
      };
    } catch (error) {
      console.warn('[Orchestrator] LLM failed for explain:', error);
      return {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `I can explain these cybersecurity concepts:

- **Phishing** - Credential theft attacks
- **Typosquatting** - Fake lookalike domains
- **Deepfakes** - AI-generated fake media
- **Malware** - Malicious software
- **Ransomware** - File encryption attacks
- **Social Engineering** - Human manipulation tactics

Try: "What is phishing?" or "Explain typosquatting"`,
        timestamp: Date.now(),
        metadata: { intent: 'explain', error: String(error) },
      };
    }
  }

  // --------------------------------------------------------------------------
  // Help Handler (Static Response)
  // --------------------------------------------------------------------------

  private handleHelp(): ChatMessage {
    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: RESPONSE_TEMPLATES.help,
      timestamp: Date.now(),
      metadata: { intent: 'help', zeroLLM: true },
    };
  }

  // --------------------------------------------------------------------------
  // Greeting Handler (Context-Aware)
  // --------------------------------------------------------------------------

  private async handleGreeting(): Promise<ChatMessage> {
    const isReturningUser = this.conversationContext.turns.length > 0;
    const hasRecentScan = !!this.conversationContext.lastScannedUrl;

    try {
      console.log('[Orchestrator] Generating contextual greeting...');

      // Build a contextual prompt
      let prompt = '';
      if (isReturningUser && hasRecentScan) {
        const lastResult = this.conversationContext.lastScanResult;
        prompt = `The user is greeting you again in an ongoing conversation. They previously scanned ${this.conversationContext.lastScannedUrl} which was ${lastResult?.verdict || 'analyzed'}. Give a brief, warm welcome back and ask if they'd like to scan another URL or have questions about the previous scan. Keep it natural and under 40 words.`;
      } else if (isReturningUser) {
        prompt = `The user is greeting you again in an ongoing conversation. Welcome them back warmly and ask how you can help. Keep it brief and friendly, under 30 words.`;
      } else {
        prompt = `This is a new conversation. Greet the user warmly as Elara, their cybersecurity assistant. Mention you can help scan URLs for threats and answer security questions. Be friendly, not robotic. Under 40 words.`;
      }

      const aiResponse = await scannerClient.chat(prompt, {
        systemPrompt: CONVERSATIONAL_SYSTEM_PROMPT,
      });

      return {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: aiResponse,
        timestamp: Date.now(),
        metadata: {
          intent: 'greeting',
          source: 'gemini',
          zeroLLM: false,
          isReturningUser,
        },
      };
    } catch (error) {
      console.warn('[Orchestrator] Gemini greeting failed, using contextual fallback:', error);

      // Contextual static fallback
      let fallbackGreeting = '';
      if (isReturningUser && hasRecentScan) {
        fallbackGreeting = `Welcome back! Still thinking about that ${this.conversationContext.lastScanResult?.verdict === 'DANGEROUS' ? 'suspicious' : ''} URL? I'm here if you have more questions or want to scan something else.`;
      } else if (isReturningUser) {
        fallbackGreeting = `Hey again! What can I help you with?`;
      } else {
        fallbackGreeting = `Hey there! I'm Elara, your security sidekick. Paste any URL and I'll check if it's safe, or ask me anything about staying secure online. What's on your mind?`;
      }

      return {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: fallbackGreeting,
        timestamp: Date.now(),
        metadata: { intent: 'greeting', zeroLLM: true, fallback: true },
      };
    }
  }

  // --------------------------------------------------------------------------
  // General Chat Handler (Context-Aware, LLM Required)
  // --------------------------------------------------------------------------

  private async handleGeneralChat(
    message: string,
    classification: EnhancedIntentClassification
  ): Promise<ChatMessage> {
    try {
      console.log('[Orchestrator] Using Cloud AI for conversational chat');

      // Build rich context for Gemini
      const conversationHistory = this.getConversationSummary();

      // Create a contextual prompt
      let contextualPrompt = message;
      if (conversationHistory) {
        contextualPrompt = `${conversationHistory}\n\nUser's current message: ${message}\n\nRespond naturally, referencing previous context if relevant. Be helpful and conversational.`;
      }

      // Add mood-based guidance
      let moodGuidance = '';
      switch (this.conversationContext.userMood) {
        case 'concerned':
          moodGuidance = 'The user seems worried. Be reassuring while providing accurate information.';
          break;
        case 'frustrated':
          moodGuidance = 'The user seems frustrated. Be extra patient and helpful.';
          break;
        case 'curious':
          moodGuidance = 'The user is curious and learning. Be educational and engaging.';
          break;
      }

      const systemPrompt = `${CONVERSATIONAL_SYSTEM_PROMPT}\n\n${moodGuidance}`;

      const aiResponse = await scannerClient.chat(contextualPrompt, {
        systemPrompt,
        availableTools: Object.keys(AVAILABLE_FUNCTIONS),
      });

      return {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: aiResponse,
        timestamp: Date.now(),
        metadata: {
          intent: 'general_chat',
          source: 'cloud_ai',
          classification,
          mood: this.conversationContext.userMood,
          zeroLLM: false,
        },
      };
    } catch (error) {
      console.warn('[Orchestrator] Cloud AI failed, using conversational fallback:', error);
      return this.handleGeneralChatFallback(message);
    }
  }

  private handleGeneralChatFallback(message: string): ChatMessage {
    const lowerMessage = message.toLowerCase();

    // Check for URLs that might have been missed
    const urls = intentClassifier.extractURLs(message);
    if (urls.length > 0) {
      return {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `I detected a URL in your message. Would you like me to scan it for safety?\n\n**URL detected:** ${urls[0]}\n\nJust say "scan it" or "is it safe?" and I'll analyze it for you.`,
        timestamp: Date.now(),
        metadata: { detectedUrl: urls[0] },
      };
    }

    // Default helpful response
    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `I'm Elara, your cybersecurity assistant. I can help you with:

**Quick Actions:**
- Paste any URL to check if it's safe
- Ask "What is phishing?" to learn about threats
- Say "help" to see all my capabilities

What would you like to do?`,
      timestamp: Date.now(),
      metadata: { intent: 'general_chat', fallback: true },
    };
  }

  // --------------------------------------------------------------------------
  // Utility Methods
  // --------------------------------------------------------------------------

  private createErrorResponse(message: string): ChatMessage {
    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `**Unable to Process Request**\n\n${message}`,
      timestamp: Date.now(),
      metadata: { error: true },
    };
  }

  // --------------------------------------------------------------------------
  // Response Formatting
  // --------------------------------------------------------------------------

  private createThreatCard(result: ScanResult): ThreatCard {
    return {
      verdict: result.verdict,
      riskLevel: result.riskLevel,
      riskScore: result.riskScore,
      threatType: result.threatType,
      indicators: result.indicators,
      recommendation: this.getRecommendation(result.verdict),
    };
  }

  private formatScanResponse(result: ScanResult): string {
    const riskPercent = Math.round(result.riskScore * 100);

    // Beautiful header with verdict
    const verdictHeader = this.getVerdictHeader(result.verdict, result.riskLevel);
    let response = verdictHeader;

    // Risk metrics box
    response += `\n**Risk Assessment**\n`;
    response += `| Metric | Value |\n`;
    response += `|--------|-------|\n`;
    response += `| Risk Level | **${result.riskLevel}** (${this.getRiskLevelName(result.riskLevel)}) |\n`;
    response += `| Risk Score | **${riskPercent}%** |\n`;
    response += `| Confidence | ${(result.confidence * 100).toFixed(0)}% |\n`;
    response += `| Scan Type | ${result.scanType} |\n\n`;

    // Threat type if dangerous
    if (result.threatType) {
      response += `**Threat Classification:** ${result.threatType.toUpperCase()}\n\n`;
    }

    // Analysis details
    if (result.reasoning && result.reasoning.length > 0) {
      response += `**Analysis Details**\n`;
      result.reasoning.slice(0, 6).forEach((reason, i) => {
        const icon = reason.toLowerCase().includes('safe') || reason.toLowerCase().includes('trusted') ? '✓' :
                    reason.toLowerCase().includes('suspicious') || reason.toLowerCase().includes('warning') ? '!' : '•';
        response += `${icon} ${reason}\n`;
      });
      response += '\n';
    }

    // Indicators if present
    if (result.indicators && result.indicators.length > 0) {
      response += `**Security Indicators**\n`;
      result.indicators.slice(0, 5).forEach(ind => {
        const severityIcon = ind.severity === 'critical' ? '🔴' :
                            ind.severity === 'high' ? '🟠' :
                            ind.severity === 'medium' ? '🟡' : '🟢';
        response += `${severityIcon} ${ind.description}\n`;
      });
      response += '\n';
    }

    // Recommendation
    response += `**Recommendation**\n`;
    response += `${this.getRecommendation(result.verdict)}\n\n`;

    // Footer
    response += `---\n`;
    response += `_Scan completed in ${result.latency?.toFixed(0) || '?'}ms via ${result.scanType}_`;

    return response;
  }

  private getVerdictHeader(verdict: string, riskLevel: string): string {
    switch (verdict) {
      case 'SAFE':
        return `## ✅ SAFE\n*This URL appears safe to visit*\n`;
      case 'SUSPICIOUS':
        return `## ⚠️ SUSPICIOUS\n*Exercise caution with this URL*\n`;
      case 'DANGEROUS':
        return `## 🚨 DANGEROUS\n*Do NOT visit this URL - threats detected*\n`;
      default:
        return `## ❓ UNKNOWN\n*Unable to determine safety*\n`;
    }
  }

  private getRiskLevelName(level: string): string {
    const names: Record<string, string> = {
      'A': 'Safe',
      'B': 'Low Risk',
      'C': 'Moderate',
      'D': 'Elevated',
      'E': 'High Risk',
      'F': 'Critical',
    };
    return names[level] || 'Unknown';
  }

  /**
   * Format a scan response in a conversational, friendly way
   */
  private formatConversationalScanResponse(result: ScanResult, scanType: 'quick' | 'deep'): string {
    const riskPercent = Math.round(result.riskScore * 100);
    const url = result.url;
    const domain = this.extractDomain(url);

    let response = '';

    // Conversational intro based on verdict
    switch (result.verdict) {
      case 'SAFE':
        response += `Great news! **${domain}** looks safe to me. ✅\n\n`;
        response += `I ran a ${scanType === 'deep' ? 'comprehensive deep scan' : 'quick scan'} and didn't find any red flags.\n\n`;
        break;
      case 'SUSPICIOUS':
        response += `Hmm, I found some things that concern me about **${domain}**. ⚠️\n\n`;
        response += `It's not definitely malicious, but there are some yellow flags worth noting:\n\n`;
        break;
      case 'DANGEROUS':
        response += `🚨 **Warning!** I strongly recommend avoiding **${domain}**.\n\n`;
        response += `My analysis found clear signs of malicious activity:\n\n`;
        break;
      default:
        response += `I had some trouble analyzing **${domain}** fully. Here's what I found:\n\n`;
    }

    // Key details in a simple format
    response += `**Quick Stats:**\n`;
    response += `• Risk Level: **${result.riskLevel}** (${this.getRiskLevelName(result.riskLevel)})\n`;
    response += `• Confidence: ${(result.confidence * 100).toFixed(0)}%\n`;
    if (result.threatType) {
      response += `• Threat Type: ${result.threatType}\n`;
    }
    response += '\n';

    // Analysis details (top 3 only for readability)
    if (result.reasoning && result.reasoning.length > 0) {
      response += `**What I found:**\n`;
      result.reasoning.slice(0, 3).forEach(reason => {
        response += `• ${reason}\n`;
      });
      response += '\n';
    }

    // Follow-up suggestions based on verdict
    response += this.getFollowUpSuggestions(result);

    // Subtle footer
    response += `\n---\n_${scanType === 'deep' ? 'Deep' : 'Quick'} scan • ${result.latency?.toFixed(0) || '?'}ms_`;

    return response;
  }

  private getFollowUpSuggestions(result: ScanResult): string {
    let suggestions = '**What would you like to do?**\n';

    switch (result.verdict) {
      case 'SAFE':
        suggestions += `• Ask me to explain what makes a site safe\n`;
        suggestions += `• Scan another URL\n`;
        suggestions += `• Learn about phishing protection tips\n`;
        break;
      case 'SUSPICIOUS':
        suggestions += `• Say "tell me more" for a detailed breakdown\n`;
        suggestions += `• Ask "should I trust this site?"\n`;
        suggestions += `• Request a deep scan for more thorough analysis\n`;
        break;
      case 'DANGEROUS':
        suggestions += `• Ask "why is this dangerous?" for details\n`;
        suggestions += `• Say "report this" to flag it\n`;
        suggestions += `• Ask how to protect yourself from similar threats\n`;
        break;
      default:
        suggestions += `• Try a deep scan for more thorough analysis\n`;
        suggestions += `• Paste another URL to check\n`;
    }

    return suggestions;
  }

  private extractDomain(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch {
      return url;
    }
  }

  private formatDeepScanResponse(result: ScanResult): string {
    const response = this.formatScanResponse(result);
    return response.replace('Scan completed', 'Deep scan completed');
  }

  private getVerdictEmoji(verdict: string): string {
    switch (verdict) {
      case 'SAFE': return 'SAFE';
      case 'SUSPICIOUS': return 'SUSPICIOUS';
      case 'DANGEROUS': return 'DANGEROUS';
      default: return 'UNKNOWN';
    }
  }

  private getRecommendation(verdict: string): string {
    switch (verdict) {
      case 'SAFE':
        return 'This URL appears safe to visit.';
      case 'SUSPICIOUS':
        return 'Exercise caution. Verify the source before proceeding.';
      case 'DANGEROUS':
        return 'DO NOT visit this URL. It shows signs of malicious activity.';
      default:
        return 'Unable to determine safety. Proceed with caution.';
    }
  }

  // --------------------------------------------------------------------------
  // Workflow Execution (Multi-Tool Chains)
  // --------------------------------------------------------------------------

  async executeWorkflow(
    workflowId: keyof typeof WORKFLOW_TEMPLATES,
    params: Record<string, any>
  ): Promise<ChatMessage> {
    const workflow = WORKFLOW_TEMPLATES[workflowId];
    if (!workflow) {
      return this.createErrorResponse(`Unknown workflow: ${workflowId}`);
    }

    console.log(`[Orchestrator] Executing workflow: ${workflow.name}`);
    this.setState({ state: 'executing', progress: 10, currentTask: workflow.name });

    // Create execution plan
    const plan = createExecutionPlan(workflow.steps);

    // Execute workflow
    const results = await toolExecutor.executeWorkflow(workflowId, plan, params);

    // Synthesize results
    const resultMap: Record<string, ToolExecutionResult> = {};
    workflow.steps.forEach((step, i) => {
      if (results[i]) {
        resultMap[step.id] = results[i];
      }
    });

    const synthesis = toolExecutor.synthesize({
      results: resultMap,
      weights: workflow.weights,
    });

    this.setState({ progress: 100 });

    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `**${workflow.name}**\n\n${synthesis.summary}\n\n**Verdict:** ${synthesis.verdict}\n**Confidence:** ${(synthesis.confidence * 100).toFixed(0)}%\n\n${synthesis.recommendations?.length ? '**Recommendations:**\n' + synthesis.recommendations.map(r => `- ${r}`).join('\n') : ''}`,
      timestamp: Date.now(),
      metadata: {
        workflow: workflowId,
        results,
        synthesis,
      },
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const orchestrator = new AgentOrchestrator();
