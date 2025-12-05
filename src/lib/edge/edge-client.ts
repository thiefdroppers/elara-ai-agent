/**
 * Elara AI Agent - Edge Client
 *
 * Interface to Elara Edge Engine for ML-based phishing detection.
 * Communicates with Edge Engine via Chrome extension messaging.
 */

import type { URLFeatures, EdgePrediction, ScanResult } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

export interface EdgeScanRequest {
  url: string;
  features?: Partial<URLFeatures>;
  timeout?: number;
}

export interface EdgeScanResponse {
  success: boolean;
  prediction?: EdgePrediction;
  error?: string;
  cached?: boolean;
}

// ============================================================================
// EDGE CLIENT CLASS
// ============================================================================

export class EdgeClient {
  private readonly extensionId: string | null = null;
  private readonly timeout: number = 5000; // 5s timeout

  constructor(extensionId?: string) {
    // If we're running in the same extension, no need for extension ID
    this.extensionId = extensionId || null;
  }

  /**
   * Perform edge scan using Edge Engine
   */
  async scanURL(request: EdgeScanRequest): Promise<EdgePrediction> {
    const startTime = performance.now();

    try {
      // Send message to Edge Engine (via background service worker)
      const response = await this.sendMessage<EdgeScanResponse>({
        type: 'EDGE_SCAN',
        payload: {
          url: request.url,
          features: request.features,
        },
      });

      if (!response.success || !response.prediction) {
        throw new Error(response.error || 'Edge scan failed');
      }

      const latency = performance.now() - startTime;
      console.log(
        `[EdgeClient] Scan completed in ${latency.toFixed(0)}ms (cached: ${response.cached})`
      );

      return response.prediction;
    } catch (error) {
      console.error('[EdgeClient] Scan failed:', error);
      throw new Error(`Edge scan failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Convert EdgePrediction to ScanResult format
   */
  convertToScanResult(url: string, prediction: EdgePrediction): ScanResult {
    const verdict = this.computeVerdict(prediction.probability);
    const riskLevel = this.computeRiskLevel(prediction.probability);
    const riskScore = Math.round(prediction.probability * 100);

    return {
      url,
      verdict,
      riskLevel,
      riskScore,
      confidence: prediction.confidence,
      indicators: this.extractIndicators(prediction),
      reasoning: prediction.reasoning,
      scanType: 'edge',
      latency: prediction.latency,
      timestamp: Date.now(),
    };
  }

  /**
   * Check if URL is in local cache
   */
  async checkCache(url: string): Promise<ScanResult | null> {
    try {
      const response = await this.sendMessage<{ result: ScanResult | null }>({
        type: 'CHECK_CACHE',
        payload: { url },
      });

      return response.result || null;
    } catch (error) {
      console.warn('[EdgeClient] Cache check failed:', error);
      return null;
    }
  }

  /**
   * Clear result cache
   */
  async clearCache(): Promise<void> {
    await this.sendMessage({ type: 'CLEAR_CACHE' });
  }

  // --------------------------------------------------------------------------
  // Messaging
  // --------------------------------------------------------------------------

  /**
   * Send message to Edge Engine (or background service worker)
   */
  private async sendMessage<T = any>(message: any): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Message timeout'));
      }, this.timeout);

      if (this.extensionId) {
        // Cross-extension messaging (if Edge Engine is separate extension)
        chrome.runtime.sendMessage(this.extensionId, message, (response) => {
          clearTimeout(timeoutId);

          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          resolve(response);
        });
      } else {
        // Same-extension messaging (Edge Engine in same extension)
        chrome.runtime.sendMessage(message, (response) => {
          clearTimeout(timeoutId);

          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          resolve(response);
        });
      }
    });
  }

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  /**
   * Compute verdict from probability
   */
  private computeVerdict(probability: number): 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS' | 'UNKNOWN' {
    if (probability <= 0.40) return 'SAFE';
    if (probability <= 0.70) return 'SUSPICIOUS';
    return 'DANGEROUS';
  }

  /**
   * Compute risk level from probability
   */
  private computeRiskLevel(probability: number): 'A' | 'B' | 'C' | 'D' | 'E' | 'F' {
    if (probability <= 0.20) return 'A'; // Very safe
    if (probability <= 0.40) return 'B'; // Safe
    if (probability <= 0.55) return 'C'; // Moderate
    if (probability <= 0.70) return 'D'; // Suspicious
    if (probability <= 0.85) return 'E'; // Dangerous
    return 'F'; // Extremely dangerous
  }

  /**
   * Extract threat indicators from prediction
   */
  private extractIndicators(
    prediction: EdgePrediction
  ): Array<{ type: string; value: string; severity: string; description: string }> {
    const indicators: Array<{
      type: string;
      value: string;
      severity: string;
      description: string;
    }> = [];

    // Extract from reasoning
    prediction.reasoning.forEach((reason) => {
      if (reason.includes('BLACKLIST') || reason.includes('DANGEROUS')) {
        indicators.push({
          type: 'threat_intelligence',
          value: 'blacklisted',
          severity: 'critical',
          description: reason,
        });
      } else if (reason.includes('SUSPICIOUS') || reason.includes('WARNING')) {
        indicators.push({
          type: 'suspicious_pattern',
          value: 'detected',
          severity: 'high',
          description: reason,
        });
      } else if (reason.includes('SAFE') || reason.includes('WHITELIST')) {
        indicators.push({
          type: 'trusted_source',
          value: 'verified',
          severity: 'low',
          description: reason,
        });
      }
    });

    // Extract from model predictions
    if (prediction.models.pirocheto) {
      const prob = prediction.models.pirocheto.probability;
      if (prob > 0.70) {
        indicators.push({
          type: 'ml_model',
          value: `pirocheto: ${Math.round(prob * 100)}%`,
          severity: prob > 0.85 ? 'critical' : 'high',
          description: `Pirocheto model detected phishing patterns (confidence: ${Math.round(prediction.models.pirocheto.confidence * 100)}%)`,
        });
      }
    }

    return indicators;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const edgeClient = new EdgeClient();
