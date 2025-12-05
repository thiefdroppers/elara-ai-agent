/**
 * Elara AI Agent - Confidence Router
 *
 * Routes scan requests based on confidence levels:
 * - High confidence (>=0.90): Edge-only, cache result
 * - Medium confidence (0.70-0.90): Escalate to hybrid scan
 * - Low confidence (<0.70): Escalate to deep scan
 */

import type { EdgePrediction } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

export type ScanTier = 'edge' | 'hybrid' | 'deep';

export interface RoutingDecision {
  tier: ScanTier;
  reasoning: string;
  shouldCache: boolean;
  escalationReason?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIDENCE_HIGH = 0.90;
const CONFIDENCE_MEDIUM = 0.70;

// ============================================================================
// CONFIDENCE ROUTER CLASS
// ============================================================================

export class ConfidenceRouter {
  /**
   * Determine which scan tier to use based on edge prediction confidence
   */
  route(prediction: EdgePrediction): RoutingDecision {
    const { confidence, probability } = prediction;

    // HIGH CONFIDENCE: Edge-only result
    if (confidence >= CONFIDENCE_HIGH) {
      return {
        tier: 'edge',
        reasoning: `High confidence (${(confidence * 100).toFixed(0)}%) - edge prediction reliable`,
        shouldCache: true,
      };
    }

    // MEDIUM CONFIDENCE: Escalate to hybrid (TI enrichment)
    if (confidence >= CONFIDENCE_MEDIUM) {
      return {
        tier: 'hybrid',
        reasoning: `Medium confidence (${(confidence * 100).toFixed(0)}%) - requesting TI enrichment`,
        shouldCache: true,
        escalationReason: 'Confidence below high threshold, enriching with cloud TI database',
      };
    }

    // LOW CONFIDENCE: Escalate to deep scan
    return {
      tier: 'deep',
      reasoning: `Low confidence (${(confidence * 100).toFixed(0)}%) - triggering comprehensive analysis`,
      shouldCache: true,
      escalationReason: 'Low edge confidence requires Scanner V2 pipeline analysis',
    };
  }

  /**
   * Check if edge result should be cached
   */
  shouldCache(prediction: EdgePrediction): boolean {
    // Cache all results regardless of confidence
    // Even low-confidence results are useful to avoid re-scanning
    return true;
  }

  /**
   * Determine if escalation is needed
   */
  needsEscalation(prediction: EdgePrediction): boolean {
    return prediction.confidence < CONFIDENCE_HIGH;
  }

  /**
   * Get escalation tier
   */
  getEscalationTier(prediction: EdgePrediction): ScanTier | null {
    const decision = this.route(prediction);
    return decision.tier !== 'edge' ? decision.tier : null;
  }

  /**
   * Format routing decision for display
   */
  formatDecision(decision: RoutingDecision): string {
    let message = `Scan Tier: ${decision.tier.toUpperCase()}\n`;
    message += `Reasoning: ${decision.reasoning}\n`;

    if (decision.escalationReason) {
      message += `Escalation: ${decision.escalationReason}\n`;
    }

    message += `Caching: ${decision.shouldCache ? 'Enabled' : 'Disabled'}`;

    return message;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const confidenceRouter = new ConfidenceRouter();
