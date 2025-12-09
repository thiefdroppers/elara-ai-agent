/**
 * Elara Edge Engine - Ensemble Predictor
 *
 * Uses pirocheto transformer model for phishing detection.
 * MobileBERT disabled due to ONNX Runtime Web WASM compatibility issues.
 *
 * Models:
 * - pirocheto (100% weight) - HuggingFace phishing-url-detector (PRIMARY)
 * - MobileBERT (DISABLED) - WASM compatibility issues with INT8 quantization
 * - Gemini Nano (EXPERIMENTAL) - Chrome built-in AI for borderline cases
 *
 * Patent: Hybrid Edge-Cloud ML Inference Architecture
 * Co-authored by: Tanmoy Sen (Thiefdroppers Inc.) & Claude (Anthropic)
 */

import { modelManager } from '@background/model-manager';
import { patternMatcher } from './pattern-matcher';
import { geminiNano } from './gemini-nano';
import type {
  URLFeatures,
  EdgePrediction,
  ModelPredictions,
  EnsembleWeights,
  RiskLevel,
  Verdict,
  Decision,
} from '@/types';

// ============================================================================
// CONFIGURATION
// ============================================================================

// Default weights - pirocheto only (MobileBERT disabled due to WASM issues)
const DEFAULT_WEIGHTS: EnsembleWeights = {
  mobilebert: 0.0,   // DISABLED - ONNX Runtime Web WASM compatibility issues
  pirocheto: 1.0,    // PRIMARY - HuggingFace phishing-url-detector
};

// Confidence thresholds
const CONFIDENCE_HIGH = 0.90;
const CONFIDENCE_MEDIUM = 0.70;

// Risk level thresholds
const RISK_THRESHOLDS = {
  A: 0.20,  // Very safe
  B: 0.40,  // Safe
  C: 0.55,  // Moderate
  D: 0.70,  // Suspicious
  E: 0.85,  // Dangerous
  // F: > 0.85 (Extremely dangerous)
};

// ============================================================================
// ENSEMBLE PREDICTOR CLASS
// ============================================================================

export class EnsemblePredictor {
  private weights: EnsembleWeights;

  constructor(weights?: Partial<EnsembleWeights>) {
    this.weights = { ...DEFAULT_WEIGHTS, ...weights };
  }

  // --------------------------------------------------------------------------
  // Main Prediction Method
  // --------------------------------------------------------------------------

  async predict(features: URLFeatures): Promise<EdgePrediction> {
    const startTime = performance.now();
    const predictions: ModelPredictions = {};
    const reasoning: string[] = [];

    // ===========================================================================
    // CRITICAL: CHECK TI WHITELIST/BLACKLIST FIRST BEFORE ANY ML PROCESSING
    // This is the most reliable signal - TI DB has millions of verified domains
    // ===========================================================================

    if (features.tiHit) {
      // WHITELIST CHECK FIRST - If whitelisted and NOT blacklisted, return SAFE immediately
      if (features.tiHit.isWhitelisted && !features.tiHit.isBlacklisted) {
        const latency = performance.now() - startTime;
        return {
          probability: 0.05,  // Near-zero risk for whitelisted domains
          confidence: 0.99,   // Maximum confidence from TI DB
          models: {},
          reasoning: [
            'SAFE: Domain is in TI whitelist (source: ' + features.tiHit.source + ')',
            'Confidence: ' + (features.tiHit.confidence ? (features.tiHit.confidence * 100).toFixed(0) + '%' : 'High'),
            'ML analysis skipped - TI whitelist override active'
          ],
          latency,
        };
      }

      // BLACKLIST CHECK - If blacklisted, return DANGEROUS immediately
      if (features.tiHit.isBlacklisted) {
        const latency = performance.now() - startTime;
        return {
          probability: 0.95,  // High risk for blacklisted domains
          confidence: 0.99,   // Maximum confidence from TI DB
          models: {},
          reasoning: [
            'DANGEROUS: Domain is in TI blacklist (source: ' + features.tiHit.source + ')',
            'Severity: ' + (features.tiHit.severity || 'HIGH'),
            'ML analysis skipped - TI blacklist override active'
          ],
          latency,
        };
      }
    }

    // ===========================================================================
    // PROCEED WITH ML ANALYSIS ONLY FOR UNKNOWN DOMAINS
    // ===========================================================================

    // Run pattern matching first (fast, deterministic)
    const patternResult = patternMatcher.analyze(features.url);
    if (patternResult.flags.length > 0) {
      reasoning.push(...patternResult.reasoning.slice(0, 3)); // Top 3 pattern reasons
    }

    // =========================================================================
    // RUN MOBILEBERT + PIROCHETO + GEMINI NANO IN PARALLEL
    // MobileBERT (PRIMARY, 60%) + pirocheto (FALLBACK, 40%)
    // First load: 30s timeout (models are ~50MB total)
    // Subsequent: Models cached, much faster
    // =========================================================================
    console.log('[Ensemble] Starting PARALLEL inference for URL:', features.url);
    const inferenceStartTime = performance.now();

    // Longer timeout for first load (models need to be loaded into memory)
    const ONNX_TIMEOUT_MS = 30000; // 30 seconds for first load

    // Create promises for both transformer models with individual timeouts
    const onnxPromise = (async () => {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`ONNX timeout (${ONNX_TIMEOUT_MS/1000}s)`)), ONNX_TIMEOUT_MS)
        );
        const result = await Promise.race([
          modelManager.runInference(features.url, ['mobilebert', 'pirocheto']),
          timeoutPromise
        ]);
        return { success: true as const, result };
      } catch (error) {
        return { success: false as const, error: error instanceof Error ? error.message : String(error) };
      }
    })();

    const geminiPromise = (async () => {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Gemini timeout (5s)')), 5000)
        );
        const result = await Promise.race([
          geminiNano.analyzeURL(features.url),
          timeoutPromise
        ]);
        return { success: true as const, result };
      } catch (error) {
        return { success: false as const, error: error instanceof Error ? error.message : String(error) };
      }
    })();

    // Wait for BOTH to complete (parallel execution)
    const [onnxOutcome, geminiOutcome] = await Promise.all([onnxPromise, geminiPromise]);
    console.log(`[Ensemble] Parallel inference completed in ${(performance.now() - inferenceStartTime).toFixed(0)}ms`);

    // Process ONNX result (MobileBERT + pirocheto ensemble)
    if (onnxOutcome.success && onnxOutcome.result?.ensemble) {
      const prob = onnxOutcome.result.ensemble.probability;
      reasoning.push(`ML Ensemble: ${(prob * 100).toFixed(1)}% phishing risk`);

      // Extract individual model predictions
      if (onnxOutcome.result.predictions?.mobilebert) {
        predictions.mobilebert = {
          probability: onnxOutcome.result.predictions.mobilebert.probability,
          confidence: onnxOutcome.result.predictions.mobilebert.confidence,
          latency: onnxOutcome.result.predictions.mobilebert.latency,
        };
        reasoning.push(`MobileBERT v3.0: ${(onnxOutcome.result.predictions.mobilebert.probability * 100).toFixed(1)}%`);
        console.log('[Ensemble] MobileBERT success:', onnxOutcome.result.predictions.mobilebert.probability);
      }

      if (onnxOutcome.result.predictions?.pirocheto) {
        predictions.pirocheto = {
          probability: onnxOutcome.result.predictions.pirocheto.probability,
          confidence: onnxOutcome.result.predictions.pirocheto.confidence,
          latency: onnxOutcome.result.predictions.pirocheto.latency,
        };
        reasoning.push(`pirocheto: ${(onnxOutcome.result.predictions.pirocheto.probability * 100).toFixed(1)}%`);
        console.log('[Ensemble] pirocheto success:', onnxOutcome.result.predictions.pirocheto.probability);
      }
    } else {
      const errorMsg = !onnxOutcome.success ? onnxOutcome.error : 'No result';
      console.warn('[Ensemble] ML models failed:', errorMsg);
      reasoning.push(`ML models: ${errorMsg}`);
    }

    // Process Gemini Nano result
    if (geminiOutcome.success && geminiOutcome.result?.available && geminiOutcome.result.riskScore !== undefined) {
      reasoning.push(`Gemini Nano: ${(geminiOutcome.result.riskScore * 100).toFixed(1)}% phishing risk`);
      if (geminiOutcome.result.reasoning) {
        reasoning.push(...geminiOutcome.result.reasoning.slice(0, 2));
      }
      predictions.lexical = {
        probability: geminiOutcome.result.riskScore,
        confidence: 0.85,
        latency: geminiOutcome.result.latency || 0,
      };
      console.log('[Ensemble] Gemini Nano success:', geminiOutcome.result.riskScore);
    } else {
      const errorMsg = !geminiOutcome.success ? geminiOutcome.error :
        (geminiOutcome.result?.error || 'Not available');
      console.log('[Ensemble] Gemini Nano not available:', errorMsg);
    }

    // Compute ensemble prediction (combine ML + pattern matching)
    const mlResult = this.fuseResults(predictions);

    // Final score combines ML models (70%) with pattern matching (30%)
    const mlWeight = 0.70;
    const patternWeight = 0.30;

    let probability: number;
    let confidence: number;

    const hasMLPredictions = Object.keys(predictions).length > 0;

    if (hasMLPredictions) {
      // Both signals available - BOOST confidence to favor edge-only routing
      probability = mlResult.probability * mlWeight + patternResult.score * patternWeight;
      // CRITICAL FIX: Ensure minimum confidence of 0.70 when ML models succeed
      // This prevents unnecessary deep scans when MobileBERT/pirocheto give results
      const baseConfidence = mlResult.confidence * 0.6 + patternResult.confidence * 0.4;
      confidence = Math.max(baseConfidence, 0.70); // Minimum 70% confidence with ML
      console.log(`[Ensemble] ML predictions available - boosted confidence: ${(confidence * 100).toFixed(0)}%`);
    } else {
      // ML models failed, rely on pattern matching with reasonable confidence
      probability = patternResult.score;
      // CRITICAL FIX: Pattern matching alone should still route to edge/hybrid, not deep
      // Bump confidence to 0.50 minimum to avoid deep scan when models fail
      confidence = Math.max(patternResult.confidence * 0.8, 0.50);
      reasoning.unshift('ML models unavailable - using pattern matching (edge-only)');
      console.log(`[Ensemble] ML unavailable - pattern-only confidence: ${(confidence * 100).toFixed(0)}%`);
    }

    // Pattern matching can override if very high confidence threat
    if (patternResult.score >= 0.85 && patternResult.flags.includes('credential_stuffing')) {
      probability = Math.max(probability, 0.95);
      confidence = Math.max(confidence, 0.95);
    }

    // NOTE: Gemini Nano already runs in parallel above - no need for async call here

    // Add TI cache reasoning if available
    if (features.tiHit) {
      if (features.tiHit.isBlacklisted) {
        reasoning.unshift(`TI Cache: BLACKLISTED (source: ${features.tiHit.source})`);
      } else if (features.tiHit.isWhitelisted) {
        reasoning.unshift(`TI Cache: WHITELISTED (source: ${features.tiHit.source})`);
      }
    }

    // Add feature-based reasoning
    this.addFeatureReasoning(features, reasoning);

    const latency = performance.now() - startTime;

    return {
      probability,
      confidence,
      models: predictions,
      reasoning,
      latency,
    };
  }

  // --------------------------------------------------------------------------
  // Ensemble Fusion
  // --------------------------------------------------------------------------

  private fuseResults(predictions: ModelPredictions): {
    probability: number;
    confidence: number;
  } {
    let weightedSum = 0;
    let totalWeight = 0;
    let confidenceSum = 0;
    let confidenceCount = 0;

    // Gemini Nano result (stored as lexical for now)
    if (predictions.lexical) {
      const weight = 0.80 * predictions.lexical.confidence; // Gemini Nano gets 80% weight
      weightedSum += predictions.lexical.probability * weight;
      totalWeight += weight;
      confidenceSum += predictions.lexical.confidence;
      confidenceCount++;
    }

    // XGBoost + LightGBM (if enabled)
    if (predictions.xgboost) {
      const weight = (this.weights.xgboost ?? 0.55) * predictions.xgboost.confidence;
      weightedSum += predictions.xgboost.probability * weight;
      totalWeight += weight;
      confidenceSum += predictions.xgboost.confidence;
      confidenceCount++;
    }

    if (predictions.lightgbm) {
      const weight = (this.weights.lightgbm ?? 0.45) * predictions.lightgbm.confidence;
      weightedSum += predictions.lightgbm.probability * weight;
      totalWeight += weight;
      confidenceSum += predictions.lightgbm.confidence;
      confidenceCount++;
    }

    // Legacy support for transformer models (if enabled)
    if (predictions.mobilebert) {
      const weight = (this.weights.mobilebert ?? 0.60) * predictions.mobilebert.confidence;
      weightedSum += predictions.mobilebert.probability * weight;
      totalWeight += weight;
      confidenceSum += predictions.mobilebert.confidence;
      confidenceCount++;
    }

    if (predictions.pirocheto) {
      const weight = (this.weights.pirocheto ?? 0.40) * predictions.pirocheto.confidence;
      weightedSum += predictions.pirocheto.probability * weight;
      totalWeight += weight;
      confidenceSum += predictions.pirocheto.confidence;
      confidenceCount++;
    }

    // Fallback if no models succeeded
    if (totalWeight === 0) {
      return { probability: 0.5, confidence: 0 };
    }

    const probability = weightedSum / totalWeight;

    // Confidence is based on:
    // 1. Average model confidence
    // 2. Agreement between models
    // 3. Number of models that succeeded
    const avgConfidence = confidenceSum / confidenceCount;
    const modelCoverage = confidenceCount / 2;
    const agreement = this.computeAgreement(predictions);

    const confidence = avgConfidence * 0.5 + agreement * 0.3 + modelCoverage * 0.2;

    return { probability, confidence };
  }

  private computeAgreement(predictions: ModelPredictions): number {
    const probs: number[] = [];

    // Gemini Nano (stored as lexical)
    if (predictions.lexical) probs.push(predictions.lexical.probability);
    // XGBoost + LightGBM
    if (predictions.xgboost) probs.push(predictions.xgboost.probability);
    if (predictions.lightgbm) probs.push(predictions.lightgbm.probability);
    // Legacy transformer models
    if (predictions.mobilebert) probs.push(predictions.mobilebert.probability);
    if (predictions.pirocheto) probs.push(predictions.pirocheto.probability);

    if (probs.length < 2) return 0.5;

    // Compute variance (lower variance = higher agreement)
    const mean = probs.reduce((a, b) => a + b, 0) / probs.length;
    const variance = probs.reduce((acc, p) => acc + Math.pow(p - mean, 2), 0) / probs.length;

    // Convert variance to agreement score (0-1)
    // Max variance for probabilities in [0,1] is 0.25
    return 1 - Math.min(variance / 0.25, 1);
  }

  // --------------------------------------------------------------------------
  // Feature Reasoning
  // --------------------------------------------------------------------------

  private addFeatureReasoning(features: URLFeatures, reasoning: string[]): void {
    const lex = features.lexical;

    // Add notable feature observations
    if (lex.hasIPAddress) {
      reasoning.push('URL uses IP address instead of domain');
    }

    if (!lex.isHTTPS) {
      reasoning.push('No HTTPS encryption');
    }

    if (lex.suspiciousKeywords > 2) {
      reasoning.push(`${lex.suspiciousKeywords} suspicious keywords detected`);
    }

    if (lex.tldRisk > 0.7) {
      reasoning.push(`High-risk TLD: .${lex.tld}`);
    }

    if (lex.entropy > 4.5) {
      reasoning.push('High URL entropy (possible random generation)');
    }

    if (lex.subdomainCount > 3) {
      reasoning.push(`Excessive subdomains: ${lex.subdomainCount}`);
    }

    // DOM features
    if (features.dom) {
      if (features.dom.hasLoginForm && features.dom.formTargetExternal) {
        reasoning.push('Login form with external target (credential harvesting risk)');
      }

      if (features.dom.obfuscatedScripts) {
        reasoning.push('Obfuscated JavaScript detected');
      }

      if (features.dom.hiddenIframeCount > 0) {
        reasoning.push(`${features.dom.hiddenIframeCount} hidden iframes detected`);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Risk Level Computation
  // --------------------------------------------------------------------------

  computeRiskLevel(probability: number): RiskLevel {
    if (probability <= RISK_THRESHOLDS.A) return 'A';
    if (probability <= RISK_THRESHOLDS.B) return 'B';
    if (probability <= RISK_THRESHOLDS.C) return 'C';
    if (probability <= RISK_THRESHOLDS.D) return 'D';
    if (probability <= RISK_THRESHOLDS.E) return 'E';
    return 'F';
  }

  // --------------------------------------------------------------------------
  // Verdict Computation
  // --------------------------------------------------------------------------

  computeVerdict(probability: number, tiHit?: { isBlacklisted: boolean; isWhitelisted: boolean }): Verdict {
    // TI overrides
    if (tiHit?.isBlacklisted) return 'DANGEROUS';
    if (tiHit?.isWhitelisted && probability < 0.3) return 'SAFE';

    // Model-based verdict
    if (probability >= 0.8) return 'DANGEROUS';
    if (probability >= 0.5) return 'SUSPICIOUS';
    if (probability >= 0.3) return 'UNKNOWN';
    return 'SAFE';
  }

  // --------------------------------------------------------------------------
  // Decision Computation
  // --------------------------------------------------------------------------

  computeDecision(
    probability: number,
    confidence: number,
    tiHit?: { isBlacklisted: boolean; isWhitelisted: boolean }
  ): Decision {
    // TI blacklist = always block
    if (tiHit?.isBlacklisted) return 'BLOCK';

    // TI whitelist = usually allow
    if (tiHit?.isWhitelisted && probability < 0.5) return 'ALLOW';

    // High confidence dangerous = block
    if (probability >= 0.8 && confidence >= CONFIDENCE_HIGH) return 'BLOCK';

    // Medium probability = warn
    if (probability >= 0.5) return 'WARN';

    // Low probability but low confidence = warn
    if (probability >= 0.3 && confidence < CONFIDENCE_MEDIUM) return 'WARN';

    return 'ALLOW';
  }

  // --------------------------------------------------------------------------
  // Confidence Interval
  // --------------------------------------------------------------------------

  computeConfidenceInterval(
    probability: number,
    confidence: number
  ): [number, number] {
    // Width of interval is inversely proportional to confidence
    const width = (1 - confidence) * 0.4; // Max width = 0.4

    const lower = Math.max(0, probability - width / 2);
    const upper = Math.min(1, probability + width / 2);

    return [lower, upper];
  }

  // --------------------------------------------------------------------------
  // Weight Management
  // --------------------------------------------------------------------------

  setWeights(weights: Partial<EnsembleWeights>): void {
    this.weights = { ...this.weights, ...weights };
  }

  getWeights(): EnsembleWeights {
    return { ...this.weights };
  }

  // --------------------------------------------------------------------------
  // Gemini Nano Analysis (Optional Enhancement) - Reserved for future use
  // --------------------------------------------------------------------------

  // @ts-ignore - Reserved for future borderline case analysis
  private async _tryGeminiNanoAnalysis(url: string, currentScore: number): Promise<{
    reasoning?: string[];
    explanation?: string;
  } | null> {
    try {
      // Check if Gemini Nano is available
      const availability = await geminiNano.checkAvailability();
      if (!availability.available) {
        return null;
      }

      // Only use Gemini Nano for borderline cases (40-70% risk)
      // High confidence cases don't need additional analysis
      if (currentScore < 0.40 || currentScore > 0.70) {
        return null;
      }

      // Get detailed analysis from Gemini Nano
      const result = await geminiNano.analyzeURL(url);

      if (!result.available || result.error) {
        return null;
      }

      // Get user-friendly explanation
      const explanation = await geminiNano.explainRisk(url, currentScore);

      return {
        reasoning: result.reasoning,
        explanation: explanation ?? undefined,
      };

    } catch {
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // Public Gemini Nano Methods
  // --------------------------------------------------------------------------

  async getGeminiNanoExplanation(url: string, riskScore: number): Promise<string | null> {
    try {
      const availability = await geminiNano.checkAvailability();
      if (!availability.available) {
        return null;
      }
      return await geminiNano.explainRisk(url, riskScore);
    } catch {
      return null;
    }
  }

  async isGeminiNanoAvailable(): Promise<boolean> {
    const availability = await geminiNano.checkAvailability();
    return availability.available;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const ensemblePredictor = new EnsemblePredictor();
