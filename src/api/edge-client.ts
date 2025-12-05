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
      // Extension ID should be constant once published, but for development
      // we'll try to communicate via window messaging or runtime messaging

      // Check if Edge Engine is installed by attempting a ping
      const available = await this.checkAvailability();
      this.isAvailable = available;

      if (available) {
        console.log('[EdgeClient] Elara Edge Engine found and available');
      } else {
        console.log('[EdgeClient] Elara Edge Engine not found - will use fallback');
      }
    } catch (error) {
      console.warn('[EdgeClient] Initialization failed:', error);
      this.isAvailable = false;
    }
  }

  async checkAvailability(): Promise<boolean> {
    // For now, Edge Engine is optional - return false
    // This can be extended when Edge Engine provides an external messaging API
    return false;
  }

  // --------------------------------------------------------------------------
  // Scan URL (Edge ML Inference)
  // --------------------------------------------------------------------------

  async scanURL(url: string): Promise<EdgeScanResult | null> {
    if (!this.isAvailable) {
      console.log('[EdgeClient] Edge Engine not available');
      return null;
    }

    try {
      // Send message to Edge Engine extension
      // NOTE: This requires Edge Engine to expose an external messaging API
      // For MVP, we'll return null and rely on cloud API + fallback

      // Example implementation when Edge Engine supports it:
      // const response = await chrome.runtime.sendMessage(this.edgeEngineId, {
      //   action: 'scanURL',
      //   payload: { url },
      // });
      // return response;

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
