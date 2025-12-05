/**
 * Elara AI Agent - Edge Engine Client
 *
 * Communicates with Elara Edge Engine extension for on-device ML inference.
 * Uses Chrome extension messaging API to run MobileBERT + pirocheto models.
 */

// ============================================================================
// TYPES
// ============================================================================

interface EdgePrediction {
  probability: number;
  confidence: number;
  models: {
    mobilebert?: {
      probability: number;
      confidence: number;
      latency: number;
    };
    pirocheto?: {
      probability: number;
      confidence: number;
      latency: number;
    };
  };
  reasoning: string[];
  latency: number;
}

interface EdgeScanResult {
  url: string;
  verdict: 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS' | 'UNKNOWN';
  riskScore: number;
  riskLevel: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  confidence: number;
  confidenceInterval: [number, number];
  decision: 'ALLOW' | 'WARN' | 'BLOCK';
  reasoning: string[];
  models: Record<string, { probability: number; confidence: number; latency: number }>;
  source: string;
  latency: number;
  timestamp: string;
}

// ============================================================================
// EDGE CLIENT CLASS
// ============================================================================

class EdgeClient {
  private edgeEngineId: string | null = null;
  private isAvailable = false;

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  async initialize(): Promise<void> {
    try {
      // Try to find Elara Edge Engine extension
      // The Edge Engine has the extension key in manifest which gives it a stable ID
      // We can try to communicate with it via chrome.runtime.sendMessage

      // Known Edge Engine extension ID (derived from manifest key)
      // This ID is consistent across installs due to the "key" field in manifest.json
      const knownEdgeEngineId = 'jlhplkbgaihoahjglnpmmclheiklgdpb'; // Derived from the public key

      // Check if Edge Engine is installed by attempting a ping
      const available = await this.checkAvailability(knownEdgeEngineId);
      if (available) {
        this.edgeEngineId = knownEdgeEngineId;
        this.isAvailable = true;
        console.log('[EdgeClient] Elara Edge Engine found:', knownEdgeEngineId);
      } else {
        console.log('[EdgeClient] Elara Edge Engine not found - will use fallback');
        this.isAvailable = false;
      }
    } catch (error) {
      console.warn('[EdgeClient] Initialization failed:', error);
      this.isAvailable = false;
    }
  }

  async checkAvailability(extensionId: string): Promise<boolean> {
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      return false;
    }

    try {
      // Try to ping the Edge Engine extension
      const response = await chrome.runtime.sendMessage(extensionId, {
        action: 'ping',
      });

      return response && response.success === true;
    } catch (error) {
      // Extension not installed or not responding
      console.debug('[EdgeClient] Edge Engine ping failed:', error);
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // Scan URL (Edge ML Inference)
  // --------------------------------------------------------------------------

  async scanURL(url: string): Promise<EdgeScanResult | null> {
    if (!this.isAvailable || !this.edgeEngineId) {
      console.log('[EdgeClient] Edge Engine not available');
      return null;
    }

    try {
      // Send message to Edge Engine extension for ML inference
      const response = await chrome.runtime.sendMessage(this.edgeEngineId, {
        action: 'scan',
        payload: { url },
      });

      if (response && response.success && response.result) {
        console.log('[EdgeClient] Edge scan successful');
        return response.result;
      }

      console.warn('[EdgeClient] Edge scan returned invalid response:', response);
      return null;
    } catch (error) {
      console.error('[EdgeClient] Scan failed:', error);
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // Get Prediction (Raw ML Output)
  // --------------------------------------------------------------------------

  async getPrediction(url: string): Promise<EdgePrediction | null> {
    if (!this.isAvailable) {
      return null;
    }

    try {
      // Similar to scanURL, this would communicate with Edge Engine
      // For MVP, return null
      return null;
    } catch (error) {
      console.error('[EdgeClient] Prediction failed:', error);
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // Status
  // --------------------------------------------------------------------------

  getStatus(): { available: boolean; extensionId: string | null } {
    return {
      available: this.isAvailable,
      extensionId: this.edgeEngineId,
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const edgeClient = new EdgeClient();
