/**
 * Elara AI Agent - Agent Orchestrator
 *
 * Multi-agent system coordinator that manages:
 * - Intent classification
 * - Task routing to appropriate handlers
 * - State management
 * - Response generation
 */

import { scannerClient } from '@/api/scanner-client';
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
// CONFIGURATION
// ============================================================================

const URL_PATTERN = /https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?(?:\/[^\s]*)?/gi;

const SCAN_KEYWORDS = ['scan', 'check', 'safe', 'dangerous', 'phishing', 'malware', 'analyze', 'verify'];
const DEEP_SCAN_KEYWORDS = ['deep scan', 'full scan', 'comprehensive', 'detailed analysis'];
const FACT_CHECK_KEYWORDS = ['fact check', 'verify', 'is it true', 'is this true', 'accurate'];
const DEEPFAKE_KEYWORDS = ['deepfake', 'fake image', 'fake video', 'ai generated', 'manipulated'];
const EXPLAIN_KEYWORDS = ['what is', 'how does', 'explain', 'tell me about', 'what are'];

// ============================================================================
// ORCHESTRATOR CLASS
// ============================================================================

export class AgentOrchestrator {
  private state: OrchestratorState = {
    state: 'idle',
    progress: 0,
  };

  // --------------------------------------------------------------------------
  // State Management
  // --------------------------------------------------------------------------

  getState(): OrchestratorState {
    return { ...this.state };
  }

  private setState(updates: Partial<OrchestratorState>): void {
    this.state = { ...this.state, ...updates };
  }

  // --------------------------------------------------------------------------
  // Main Entry Point
  // --------------------------------------------------------------------------

  async processMessage(content: string): Promise<ChatMessage> {
    const id = crypto.randomUUID();
    const timestamp = Date.now();

    try {
      this.setState({ state: 'planning', progress: 10 });

      // Classify intent
      const intent = this.classifyIntent(content);
      console.log('[Orchestrator] Classified intent:', intent);

      this.setState({ state: 'executing', progress: 30, currentTask: intent.intent });

      // Route to appropriate handler
      let response: ChatMessage;

      switch (intent.intent) {
        case 'scan_url':
          response = await this.handleUrlScan(intent.entities.url, content);
          break;
        case 'deep_scan':
          response = await this.handleDeepScan(intent.entities.url, content);
          break;
        case 'fact_check':
          response = await this.handleFactCheck(content);
          break;
        case 'deepfake':
          response = await this.handleDeepfake(content);
          break;
        case 'explain':
          response = await this.handleExplain(content);
          break;
        default:
          response = await this.handleGeneralChat(content);
      }

      this.setState({ state: 'complete', progress: 100 });
      return response;

    } catch (error) {
      console.error('[Orchestrator] Error:', error);
      this.setState({ state: 'error', error: String(error) });

      return {
        id,
        role: 'assistant',
        content: `I encountered an error while processing your request. Please try again.`,
        timestamp,
        metadata: { error: String(error) },
      };
    }
  }

  // --------------------------------------------------------------------------
  // Intent Classification
  // --------------------------------------------------------------------------

  private classifyIntent(message: string): IntentClassification {
    const lowerMessage = message.toLowerCase();
    const urls = message.match(URL_PATTERN);

    // Check for deep scan intent first (more specific)
    const hasDeepScanIntent = DEEP_SCAN_KEYWORDS.some(kw => lowerMessage.includes(kw));
    if (hasDeepScanIntent && urls && urls.length > 0) {
      return {
        intent: 'deep_scan',
        confidence: 0.95,
        entities: { url: this.normalizeUrl(urls[0]) },
      };
    }

    // Check for regular URL scan
    const hasScanIntent = SCAN_KEYWORDS.some(kw => lowerMessage.includes(kw));
    if (urls && urls.length > 0) {
      return {
        intent: 'scan_url',
        confidence: hasScanIntent ? 0.98 : 0.90,
        entities: { url: this.normalizeUrl(urls[0]) },
      };
    }

    // Check for fact check
    const hasFactCheckIntent = FACT_CHECK_KEYWORDS.some(kw => lowerMessage.includes(kw));
    if (hasFactCheckIntent) {
      return {
        intent: 'fact_check',
        confidence: 0.85,
        entities: { claim: message },
      };
    }

    // Check for deepfake detection
    const hasDeepfakeIntent = DEEPFAKE_KEYWORDS.some(kw => lowerMessage.includes(kw));
    if (hasDeepfakeIntent) {
      return {
        intent: 'deepfake',
        confidence: 0.85,
        entities: {},
      };
    }

    // Check for explanation request
    const hasExplainIntent = EXPLAIN_KEYWORDS.some(kw => lowerMessage.includes(kw));
    if (hasExplainIntent) {
      return {
        intent: 'explain',
        confidence: 0.80,
        entities: { topic: message },
      };
    }

    // Default to general chat
    return {
      intent: 'general_chat',
      confidence: 0.50,
      entities: {},
    };
  }

  private normalizeUrl(url: string): string {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return `https://${url}`;
    }
    return url;
  }

  // --------------------------------------------------------------------------
  // URL Scan Handler
  // --------------------------------------------------------------------------

  private async handleUrlScan(url: string, _message: string): Promise<ChatMessage> {
    this.setState({ progress: 50 });

    const scanResult = await scannerClient.hybridScan(url);

    this.setState({ progress: 80 });

    const threatCard = this.createThreatCard(scanResult);
    const content = this.formatScanResponse(scanResult);

    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      content,
      timestamp: Date.now(),
      metadata: {
        intent: 'scan_url',
        scanResult,
        threatCard,
      },
    };
  }

  // --------------------------------------------------------------------------
  // Deep Scan Handler
  // --------------------------------------------------------------------------

  private async handleDeepScan(url: string, _message: string): Promise<ChatMessage> {
    this.setState({ progress: 30, currentTask: 'Running comprehensive analysis...' });

    const scanResult = await scannerClient.deepScan(url);

    this.setState({ progress: 90 });

    const threatCard = this.createThreatCard(scanResult);
    const content = this.formatDeepScanResponse(scanResult);

    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      content,
      timestamp: Date.now(),
      metadata: {
        intent: 'deep_scan',
        scanResult,
        threatCard,
      },
    };
  }

  // --------------------------------------------------------------------------
  // Fact Check Handler
  // --------------------------------------------------------------------------

  private async handleFactCheck(message: string): Promise<ChatMessage> {
    // Extract the claim from the message
    const claim = message
      .replace(/fact\s*check:?\s*/i, '')
      .replace(/is\s*(it|this)\s*true\s*:?\s*/i, '')
      .trim();

    // TODO: Wire to actual fact-check API
    const content = `**Fact Check Analysis**

Claim: "${claim}"

I'm analyzing this claim against trusted sources. For accurate fact-checking, I recommend:

1. **Check official sources** - Government websites, peer-reviewed studies
2. **Verify with news outlets** - Reuters, AP News, BBC for cross-referencing
3. **Use fact-check databases** - Snopes, PolitiFact, FactCheck.org

Would you like me to help you find specific sources for this claim?`;

    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      content,
      timestamp: Date.now(),
      metadata: { intent: 'fact_check' },
    };
  }

  // --------------------------------------------------------------------------
  // Deepfake Handler
  // --------------------------------------------------------------------------

  private async handleDeepfake(_message: string): Promise<ChatMessage> {
    const content = `**Deepfake Detection**

To analyze an image or video for AI manipulation, I need you to:

1. **Share the image** - Paste or drag-and-drop the image into this chat
2. **Provide the URL** - If it's hosted online, share the direct link

I'll analyze it for:
- Face manipulation signs
- Inconsistent lighting/shadows
- Unnatural artifacts
- Metadata anomalies

Please share the media you'd like me to analyze.`;

    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      content,
      timestamp: Date.now(),
      metadata: { intent: 'deepfake' },
    };
  }

  // --------------------------------------------------------------------------
  // Explain Handler
  // --------------------------------------------------------------------------

  private async handleExplain(message: string): Promise<ChatMessage> {
    const lowerMessage = message.toLowerCase();
    let content: string;

    if (lowerMessage.includes('phishing')) {
      content = this.explainPhishing();
    } else if (lowerMessage.includes('typosquatting')) {
      content = this.explainTyposquatting();
    } else if (lowerMessage.includes('deepfake')) {
      content = this.explainDeepfake();
    } else if (lowerMessage.includes('malware')) {
      content = this.explainMalware();
    } else {
      content = `I can explain various cybersecurity concepts. Try asking about:

- **Phishing** - How attackers steal credentials
- **Typosquatting** - Fake domains that look like real ones
- **Deepfakes** - AI-generated fake media
- **Malware** - Malicious software types

What would you like to learn about?`;
    }

    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      content,
      timestamp: Date.now(),
      metadata: { intent: 'explain' },
    };
  }

  // --------------------------------------------------------------------------
  // General Chat Handler
  // --------------------------------------------------------------------------

  private async handleGeneralChat(message: string): Promise<ChatMessage> {
    const lowerMessage = message.toLowerCase();

    // Greeting detection
    if (/^(hi|hello|hey|greetings)/i.test(lowerMessage)) {
      return {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Hello! I'm Elara, your AI cybersecurity guardian.

I can help you:
- **Scan URLs** for phishing and malware
- **Analyze images** for deepfakes
- **Fact-check** claims and information
- **Explain** security concepts

Just paste a URL or ask me anything about staying safe online!`,
        timestamp: Date.now(),
      };
    }

    // Help detection
    if (lowerMessage.includes('help') || lowerMessage.includes('can you')) {
      return {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Here's what I can do:

**URL Scanning**
- "Is this safe? https://example.com"
- "Scan https://suspicious-site.com"
- "Deep scan https://site.com"

**Deepfake Detection**
- "Is this image real?" (share an image)
- "Check this video for deepfake"

**Fact Checking**
- "Fact check: [claim]"
- "Is it true that [statement]?"

**Security Education**
- "What is phishing?"
- "Explain typosquatting"

How can I help you today?`,
        timestamp: Date.now(),
      };
    }

    // Default response
    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `I'm here to help with cybersecurity! You can:

- Paste a **URL** to check if it's safe
- Ask me to **explain** security concepts
- Request a **fact check** on any claim

What would you like to do?`,
      timestamp: Date.now(),
    };
  }

  // --------------------------------------------------------------------------
  // Response Formatting
  // --------------------------------------------------------------------------

  private createThreatCard(result: ScanResult): ThreatCard {
    const verdictEmoji = {
      SAFE: 'shield',
      SUSPICIOUS: 'warning',
      DANGEROUS: 'alert',
      UNKNOWN: 'help',
    };

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
    const verdictEmoji = this.getVerdictEmoji(result.verdict);
    const riskPercent = Math.round(result.riskScore * 100);

    let response = `**${verdictEmoji} ${result.verdict}** - Risk Level: ${result.riskLevel} (${riskPercent}%)\n\n`;

    if (result.threatType) {
      response += `**Threat Type:** ${result.threatType}\n\n`;
    }

    if (result.indicators.length > 0) {
      response += `**Indicators Found:**\n`;
      result.indicators.forEach(ind => {
        const severityIcon = ind.severity === 'critical' ? 'exclamation' :
                            ind.severity === 'high' ? 'warning' : 'info';
        response += `- ${ind.description}\n`;
      });
      response += '\n';
    }

    if (result.reasoning.length > 0) {
      response += `**Analysis:**\n`;
      result.reasoning.slice(0, 5).forEach(reason => {
        response += `- ${reason}\n`;
      });
      response += '\n';
    }

    response += `**Recommendation:** ${this.getRecommendation(result.verdict)}\n`;
    response += `\n_Scan completed in ${result.latency.toFixed(0)}ms (${result.scanType})_`;

    return response;
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
  // Educational Content
  // --------------------------------------------------------------------------

  private explainPhishing(): string {
    return `**What is Phishing?**

Phishing is a cyberattack where criminals impersonate legitimate organizations to steal sensitive information.

**Common Types:**
- **Email Phishing** - Fake emails mimicking banks, companies
- **Spear Phishing** - Targeted attacks on specific individuals
- **Clone Phishing** - Copies of legitimate emails with malicious links
- **Smishing** - SMS-based phishing

**Warning Signs:**
- Urgent language ("Act now!", "Account suspended!")
- Suspicious sender addresses
- Generic greetings ("Dear Customer")
- Requests for sensitive information
- Misspelled URLs

**Protection Tips:**
1. Always verify sender email addresses
2. Hover over links before clicking
3. Enable two-factor authentication
4. Use a password manager
5. Keep software updated`;
  }

  private explainTyposquatting(): string {
    return `**What is Typosquatting?**

Typosquatting is registering domains similar to popular websites to catch users who make typing mistakes.

**Examples:**
- gooogle.com (extra 'o')
- paypa1.com ('1' instead of 'l')
- arnazon.com ('rn' looks like 'm')
- faceb00k.com ('0' instead of 'o')

**Common Techniques:**
- **Misspellings** - googel.com
- **Homoglyphs** - Using similar-looking characters
- **Wrong TLD** - google.org instead of google.com
- **Added characters** - google-login.com

**Protection Tips:**
1. Bookmark important sites
2. Use browser autofill
3. Check the URL bar carefully
4. Enable phishing protection
5. Use Elara to scan suspicious URLs!`;
  }

  private explainDeepfake(): string {
    return `**What are Deepfakes?**

Deepfakes are AI-generated synthetic media that can make people appear to say or do things they never did.

**Types of Deepfakes:**
- **Face Swaps** - Replacing one person's face with another
- **Lip Sync** - Making someone appear to say different words
- **Full Body** - Generating entire fake video appearances
- **Voice Cloning** - Synthetic audio mimicking someone's voice

**Detection Signs:**
- Unnatural blinking or eye movement
- Inconsistent lighting/shadows
- Blurry edges around faces
- Audio-video sync issues
- Strange skin textures

**Protection Tips:**
1. Verify source authenticity
2. Look for inconsistencies
3. Check metadata
4. Use detection tools like Elara
5. Be skeptical of sensational content`;
  }

  private explainMalware(): string {
    return `**What is Malware?**

Malware (malicious software) is designed to damage, disrupt, or gain unauthorized access to computer systems.

**Types of Malware:**
- **Viruses** - Self-replicating programs
- **Trojans** - Disguised as legitimate software
- **Ransomware** - Encrypts files for ransom
- **Spyware** - Monitors user activity
- **Worms** - Spread across networks
- **Adware** - Displays unwanted ads

**Infection Methods:**
- Malicious email attachments
- Infected websites (drive-by downloads)
- Fake software updates
- USB drives
- Pirated software

**Protection Tips:**
1. Keep software updated
2. Use reputable antivirus
3. Don't click unknown links
4. Backup important files
5. Use Elara to scan URLs before visiting!`;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const orchestrator = new AgentOrchestrator();
