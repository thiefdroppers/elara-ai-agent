/**
 * Elara AI Agent - Edge Engine Client
 *
 * Communicates with Elara Edge Engine extension for local ML scanning.
 * Falls back to backend API if Edge Engine is unavailable.
 *
 * Communication flow:
 * AI Agent → Chrome Extension Messaging → Edge Engine → Local ML Models
 */

// Edge Engine Extension ID (production)
const EDGE_ENGINE_EXTENSION_ID = 'your-edge-engine-extension-id'; // TODO: Get from manifest

// Types matching Edge Engine's expected format
interface EdgeEngineScanResult {
  url: string;
  verdict: 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS' | 'UNKNOWN';
  riskScore: number;
  riskLevel: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  confidence: number;
  confidenceInterval: [number, number];
  decision: 'ALLOW' | 'WARN' | 'BLOCK';
  reasoning: string[];
  models: Record<string, any>;
  source: 'edge' | 'hybrid' | 'deep';
  latency: number;
  timestamp: string;
  cached?: boolean;
}

interface EdgeEngineDeepScanResult extends EdgeEngineScanResult {
  scanId: string;
  stages?: {
    stage1?: any;
    stage2?: any;
  };
  tiData?: any;
  aiSummary?: string;
}

interface ScanContext {
  tabId?: number;
  frameId?: number;
  triggeredBy: 'manual' | 'auto' | 'content-script' | 'navigation' | 'ai-agent';
  privacyMode: boolean;
  timestamp: number;
}

// ============================================================================
// EDGE ENGINE CLIENT
// ============================================================================

class EdgeEngineClient {
  private isAvailable: boolean | null = null;
  private lastCheck: number = 0;
  private readonly CHECK_INTERVAL = 30000; // Check availability every 30s

  /**
   * Check if Edge Engine is available
   */
  async checkAvailability(): Promise<boolean> {
    const now = Date.now();

    // Use cached result if recent
    if (this.isAvailable !== null && now - this.lastCheck < this.CHECK_INTERVAL) {
      return this.isAvailable;
    }

    try {
      // Try to get Edge Engine status
      const response = await this.sendMessage({ action: 'getAIStatus' });
      this.isAvailable = response && !response.error;
      this.lastCheck = now;

      console.log('[EdgeEngineClient] Availability check:', this.isAvailable ? 'AVAILABLE' : 'NOT AVAILABLE');
      return this.isAvailable;
    } catch (error) {
      console.warn('[EdgeEngineClient] Edge Engine not available:', error);
      this.isAvailable = false;
      this.lastCheck = now;
      return false;
    }
  }

  /**
   * Quick scan using Edge Engine's local ML models
   */
  async quickScan(url: string, tabId?: number): Promise<EdgeEngineScanResult | null> {
    console.log('[EdgeEngineClient] ========================================');
    console.log('[EdgeEngineClient] QUICK SCAN via Edge Engine');
    console.log('[EdgeEngineClient] URL:', url);
    console.log('[EdgeEngineClient] ========================================');

    try {
      const context: ScanContext = {
        tabId,
        triggeredBy: 'ai-agent',
        privacyMode: false,
        timestamp: Date.now(),
      };

      const response = await this.sendMessage({
        action: 'scanURL',
        payload: { url, context },
      });

      if (response && !response.error) {
        console.log('[EdgeEngineClient] Quick scan SUCCESS:', response.verdict, `(${response.riskScore}%)`);
        return response as EdgeEngineScanResult;
      }

      console.warn('[EdgeEngineClient] Quick scan failed:', response?.error);
      return null;
    } catch (error) {
      console.error('[EdgeEngineClient] Quick scan error:', error);
      return null;
    }
  }

  /**
   * Deep scan using Edge Engine → Cloud Scanner V2
   */
  async deepScan(url: string, tabId?: number): Promise<EdgeEngineDeepScanResult | null> {
    console.log('[EdgeEngineClient] ========================================');
    console.log('[EdgeEngineClient] DEEP SCAN via Edge Engine (Scanner V2)');
    console.log('[EdgeEngineClient] URL:', url);
    console.log('[EdgeEngineClient] ========================================');

    try {
      const context: ScanContext = {
        tabId,
        triggeredBy: 'ai-agent',
        privacyMode: false,
        timestamp: Date.now(),
      };

      const response = await this.sendMessage({
        action: 'deepScan',
        payload: { url, context },
      });

      if (response && !response.error) {
        console.log('[EdgeEngineClient] Deep scan SUCCESS:', response.verdict, `(${response.riskScore}%)`);
        return response as EdgeEngineDeepScanResult;
      }

      console.warn('[EdgeEngineClient] Deep scan failed:', response?.error);
      return null;
    } catch (error) {
      console.error('[EdgeEngineClient] Deep scan error:', error);
      return null;
    }
  }

  /**
   * Get cached result if available
   */
  async getCachedResult(url: string): Promise<EdgeEngineScanResult | null> {
    try {
      const response = await this.sendMessage({
        action: 'getResult',
        payload: { url },
      });

      if (response && !response.error && response.verdict) {
        return response as EdgeEngineScanResult;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Add domain to whitelist
   */
  async addToWhitelist(domain: string): Promise<boolean> {
    try {
      const response = await this.sendMessage({
        action: 'addToWhitelist',
        payload: { domain },
      });
      return !response?.error;
    } catch (error) {
      return false;
    }
  }

  /**
   * Add domain to blacklist
   */
  async addToBlacklist(domain: string): Promise<boolean> {
    try {
      const response = await this.sendMessage({
        action: 'addToBlacklist',
        payload: { domain },
      });
      return !response?.error;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get user profile from Edge Engine
   */
  async getProfile(): Promise<any | null> {
    try {
      const response = await this.sendMessage({ action: 'getProfile' });
      return response?.error ? null : response;
    } catch (error) {
      return null;
    }
  }

  /**
   * Sync TI database
   */
  async syncTI(): Promise<boolean> {
    try {
      const response = await this.sendMessage({ action: 'syncTI' });
      return response?.success || false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Send message to Edge Engine
   * Uses internal messaging since both extensions share the same origin
   */
  private sendMessage(message: { action: string; payload?: any }): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Edge Engine message timeout (10s)'));
      }, 10000);

      try {
        // Since AI Agent and Edge Engine are separate extensions,
        // we communicate via shared chrome.storage or external messaging
        // For now, use internal broadcast messaging
        chrome.runtime.sendMessage(message, (response) => {
          clearTimeout(timeout);

          if (chrome.runtime.lastError) {
            // Edge Engine not available or message failed
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          resolve(response);
        });
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const edgeEngineClient = new EdgeEngineClient();

// ============================================================================
// HELPER: Format Edge Engine result for chat display
// ============================================================================

export function formatScanResultForChat(result: EdgeEngineScanResult | EdgeEngineDeepScanResult): string {
  const verdictEmoji = {
    'SAFE': '✅',
    'SUSPICIOUS': '⚠️',
    'DANGEROUS': '🚨',
    'UNKNOWN': '❓',
  }[result.verdict] || '❓';

  const riskColor = {
    'A': 'Safe',
    'B': 'Low Risk',
    'C': 'Moderate',
    'D': 'Elevated',
    'E': 'High Risk',
    'F': 'Critical',
  }[result.riskLevel] || 'Unknown';

  let response = `## ${verdictEmoji} Scan Result: ${result.verdict}\n\n`;

  response += `**Risk Assessment**\n`;
  response += `- **Risk Level:** ${result.riskLevel} (${riskColor})\n`;
  response += `- **Risk Score:** ${result.riskScore}%\n`;
  response += `- **Confidence:** ${(result.confidence * 100).toFixed(0)}%\n`;
  response += `- **Decision:** ${result.decision}\n\n`;

  if (result.reasoning && result.reasoning.length > 0) {
    response += `**Analysis Details**\n`;
    result.reasoning.forEach((reason, i) => {
      response += `${i + 1}. ${reason}\n`;
    });
    response += '\n';
  }

  // Add AI summary if available (deep scan)
  if ('aiSummary' in result && result.aiSummary) {
    response += `**AI Summary**\n${result.aiSummary}\n\n`;
  }

  // Add recommendation
  response += `**Recommendation**\n`;
  switch (result.verdict) {
    case 'SAFE':
      response += `This URL appears safe to visit. No threats detected.\n`;
      break;
    case 'SUSPICIOUS':
      response += `Exercise caution. Verify the website's legitimacy before entering sensitive information.\n`;
      break;
    case 'DANGEROUS':
      response += `**DO NOT visit this URL.** It shows clear signs of malicious activity.\n`;
      break;
    default:
      response += `Unable to determine safety. Proceed with caution and verify the source.\n`;
  }

  response += `\n_Scan completed in ${result.latency?.toFixed(0) || '?'}ms (${result.source || 'edge'})_`;

  return response;
}
