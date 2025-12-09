/**
 * Elara Edge Engine - Offscreen Inference Engine
 *
 * Production-grade ONNX Runtime Web inference in Chrome Manifest V3.
 * Runs in an Offscreen Document to bypass service worker dynamic import restrictions.
 *
 * Architecture:
 * - Service Worker sends inference requests via chrome.runtime.connect (port)
 * - This engine loads models, runs inference, and returns predictions
 * - Supports MobileBERT (PRIMARY) and pirocheto (FALLBACK) ensemble for phishing detection
 *
 * Patent: Hybrid Edge-Cloud ML Inference Architecture
 * Co-authored by: Tanmoy Sen (Thiefdroppers Inc.) & Claude (Anthropic)
 */

import * as ort from 'onnxruntime-web';

// ============================================================================
// STARTUP LOGGING - Immediately log when script loads
// ============================================================================
console.log('='.repeat(60));
console.log('[InferenceEngine] OFFSCREEN DOCUMENT LOADED');
console.log('[InferenceEngine] Timestamp:', new Date().toISOString());
console.log('[InferenceEngine] Location:', location.href);
console.log('='.repeat(60));

// ============================================================================
// TYPES
// ============================================================================

interface TokenizedInput {
  inputIds: number[];
  attentionMask: number[];
}

interface InferenceRequest {
  type: 'inference';
  id: string;
  payload: {
    url: string;
    tokenizedInput?: TokenizedInput;
    models?: ('mobilebert' | 'pirocheto')[];
  };
}

interface LoadModelRequest {
  type: 'loadModel';
  id: string;
  payload: {
    name: string;
  };
}

interface InitRequest {
  type: 'init';
  id: string;
}

interface PingRequest {
  type: 'ping';
  id: string;
}

interface PreloadModelsRequest {
  type: 'preloadModels';
  id: string;
  payload: {
    models: string[];
  };
}

type OffscreenRequest = InferenceRequest | LoadModelRequest | InitRequest | PingRequest | PreloadModelsRequest;

interface ModelPrediction {
  probability: number;
  label: number;
  confidence: number;
  latency: number;
  modelName: string;
}

interface InferenceResult {
  predictions: {
    mobilebert?: ModelPrediction;
    pirocheto?: ModelPrediction;
  };
  ensemble: {
    probability: number;
    confidence: number;
  };
  totalLatency: number;
}

// ============================================================================
// MODEL CONFIGURATION - XGBoost + LightGBM (PRIMARY, WORKING)
// Transformer models (MobileBERT, pirocheto) disabled until properly trained
// ============================================================================

interface ModelConfig {
  name: string;
  filename: string;
  inputName: string;       // Single input name for tabular models
  inputNames?: string[];   // For transformer models (input_ids, attention_mask)
  outputNames: string[];
  type: 'tabular' | 'transformer';
  weight: number;
  featureCount?: number;   // For tabular models
  maxSequenceLength?: number;  // For transformer models
}

const MODEL_CONFIGS: Record<string, ModelConfig> = {
  // =========================================================================
  // MOBILEBERT v3.0 FP32 - Custom trained on Elara TI DB (99.25% accuracy)
  // =========================================================================
  mobilebert: {
    name: 'mobilebert',
    filename: 'mobilebert-v3-fp32.onnx',
    inputName: 'input_ids',
    inputNames: ['input_ids', 'attention_mask', 'token_type_ids'],
    outputNames: ['logits'],
    type: 'transformer',
    weight: 0.60,  // PRIMARY - 60% weight
    maxSequenceLength: 128,
  },

  // pirocheto - FALLBACK MODEL (HuggingFace phishing-url-detector)
  pirocheto: {
    name: 'pirocheto',
    filename: 'phishing-url-detector.onnx',
    inputName: 'inputs',  // Single string input
    outputNames: ['label', 'probabilities'],
    type: 'transformer',
    weight: 0.40,  // FALLBACK - 40% weight
    maxSequenceLength: 128,
  },
};

// ============================================================================
// BERT TOKENIZER (Embedded for Offscreen Document)
// ============================================================================

class SimpleTokenizer {
  private vocab: Map<string, number> = new Map();
  private initialized = false;
  private padId = 0;
  private unkId = 100;
  private clsId = 101;
  private sepId = 102;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Try loading vocab.json first (for pirocheto)
      const vocabUrl = chrome.runtime.getURL('models/vocab.json');
      const response = await fetch(vocabUrl);

      if (response.ok) {
        const vocabData = await response.json() as Record<string, number>;
        for (const [token, id] of Object.entries(vocabData)) {
          this.vocab.set(token, id);
        }
        console.log(`[Tokenizer] Loaded vocab.json with ${this.vocab.size} tokens`);
      } else {
        // Try vocab.txt (for MobileBERT)
        const vocabTxtUrl = chrome.runtime.getURL('models/vocab.txt');
        const txtResponse = await fetch(vocabTxtUrl);
        if (txtResponse.ok) {
          const text = await txtResponse.text();
          const lines = text.split('\n');
          lines.forEach((token, idx) => {
            if (token.trim()) {
              this.vocab.set(token.trim(), idx);
            }
          });
          console.log(`[Tokenizer] Loaded vocab.txt with ${this.vocab.size} tokens`);
        }
      }

      // Set special token IDs
      this.padId = this.vocab.get('[PAD]') ?? 0;
      this.unkId = this.vocab.get('[UNK]') ?? 100;
      this.clsId = this.vocab.get('[CLS]') ?? 101;
      this.sepId = this.vocab.get('[SEP]') ?? 102;

      this.initialized = true;
    } catch (error) {
      console.error('[Tokenizer] Failed to load vocab:', error);
      this.initMinimalVocab();
      this.initialized = true;
    }
  }

  private initMinimalVocab(): void {
    // Minimal fallback vocab
    this.vocab.set('[PAD]', 0);
    this.vocab.set('[UNK]', 100);
    this.vocab.set('[CLS]', 101);
    this.vocab.set('[SEP]', 102);

    // Add basic URL characters
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789-._~:/?#[]@!$&\'()*+,;=%';
    let id = 1000;
    for (const char of chars) {
      this.vocab.set(char, id++);
    }
  }

  tokenize(url: string, maxLength: number = 128): TokenizedInput {
    // Preprocess URL
    let text = url.toLowerCase();
    text = text.replace(/^https?:\/\//, '');
    text = text.replace(/^www\./, '');

    // Character-level tokenization (simple but effective for URLs)
    const tokens: number[] = [this.clsId];

    for (const char of text) {
      if (tokens.length >= maxLength - 1) break;
      tokens.push(this.vocab.get(char) ?? this.unkId);
    }

    tokens.push(this.sepId);

    // Pad to max length
    const inputIds = [...tokens];
    const attentionMask = new Array(tokens.length).fill(1);

    while (inputIds.length < maxLength) {
      inputIds.push(this.padId);
      attentionMask.push(0);
    }

    return { inputIds, attentionMask };
  }
}

// ============================================================================
// INFERENCE ENGINE
// ============================================================================

class InferenceEngine {
  private sessions: Map<string, ort.InferenceSession> = new Map();
  private loadingPromises: Map<string, Promise<ort.InferenceSession>> = new Map();
  private initialized = false;
  private backendType: 'webgpu' | 'wasm' = 'wasm';
  private tokenizer: SimpleTokenizer = new SimpleTokenizer();

  // Mutex to prevent "Session already started" errors
  private inferenceInProgress: Map<string, Promise<ModelPrediction>> = new Map();

  /**
   * Initialize ONNX Runtime with optimal backend
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('[InferenceEngine] Initializing ONNX Runtime...');

    // Configure WASM paths for extension environment
    const wasmPath = chrome.runtime.getURL('lib/');
    ort.env.wasm.wasmPaths = wasmPath;

    // CRITICAL: Disable threading - MV3 extensions have issues with SharedArrayBuffer
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.simd = true;

    // Check WebGPU availability
    if (await this.checkWebGPUSupport()) {
      this.backendType = 'webgpu';
      console.log('[InferenceEngine] WebGPU backend available');
    } else {
      this.backendType = 'wasm';
      console.log('[InferenceEngine] Using WASM backend');
    }

    // Initialize tokenizer
    await this.tokenizer.initialize();

    this.initialized = true;
    console.log('[InferenceEngine] Initialized successfully');
  }

  /**
   * Check if WebGPU is available
   */
  private async checkWebGPUSupport(): Promise<boolean> {
    try {
      if (!('gpu' in navigator)) {
        return false;
      }

      const gpu = (navigator as Navigator & { gpu: GPU }).gpu;
      const adapter = await gpu.requestAdapter();

      if (!adapter) {
        return false;
      }

      // Verify we can create a device
      const device = await adapter.requestDevice();
      if ('destroy' in device && typeof device.destroy === 'function') {
        device.destroy();
      }

      return true;
    } catch (error) {
      console.log('[InferenceEngine] WebGPU check failed:', error);
      return false;
    }
  }

  /**
   * Get or load an ONNX inference session
   */
  async getSession(modelName: string): Promise<ort.InferenceSession> {
    // Return cached session
    const cached = this.sessions.get(modelName);
    if (cached) {
      console.log(`[InferenceEngine] Using cached session for ${modelName}`);
      return cached;
    }

    // Return existing loading promise (prevents concurrent loads)
    const loading = this.loadingPromises.get(modelName);
    if (loading) {
      console.log(`[InferenceEngine] Waiting for existing load of ${modelName}...`);
      return loading;
    }

    // Load the model
    console.log(`[InferenceEngine] Starting fresh load of ${modelName}...`);
    const loadPromise = this.loadModel(modelName);
    this.loadingPromises.set(modelName, loadPromise);

    try {
      const session = await loadPromise;
      this.sessions.set(modelName, session);
      console.log(`[InferenceEngine] Session cached for ${modelName}`);
      return session;
    } catch (error) {
      console.error(`[InferenceEngine] Failed to load ${modelName}:`, error);
      // Clear the promise so we can retry
      this.loadingPromises.delete(modelName);
      throw error;
    } finally {
      // Only delete if it's still the same promise (not replaced by retry)
      if (this.loadingPromises.get(modelName) === loadPromise) {
        this.loadingPromises.delete(modelName);
      }
    }
  }

  /**
   * Load an ONNX model
   */
  private async loadModel(modelName: string): Promise<ort.InferenceSession> {
    const config = MODEL_CONFIGS[modelName];
    if (!config) {
      throw new Error(`Unknown model: ${modelName}`);
    }

    console.log(`[InferenceEngine] Loading model: ${modelName}`);
    const startTime = performance.now();

    // Fetch model from extension bundle
    const modelUrl = chrome.runtime.getURL(`models/${config.filename}`);
    const response = await fetch(modelUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch model: ${config.filename} (${response.status})`);
    }

    const modelData = await response.arrayBuffer();

    // Create session with optimal options
    const options: ort.InferenceSession.SessionOptions = {
      executionProviders: this.backendType === 'webgpu'
        ? ['webgpu', 'wasm']
        : ['wasm'],
      graphOptimizationLevel: 'all',
      enableCpuMemArena: true,
      enableMemPattern: true,
    };

    const session = await ort.InferenceSession.create(modelData, options);

    const loadTime = performance.now() - startTime;
    console.log(`[InferenceEngine] Loaded ${modelName} in ${loadTime.toFixed(0)}ms`);

    return session;
  }

  /**
   * Extract 38 numeric features from URL for XGBoost/LightGBM models
   * Features match the training data from model-manifest.json
   */
  extractURLFeatures(url: string): Float32Array {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      parsedUrl = new URL('http://invalid.url');
    }

    const hostname = parsedUrl.hostname;
    const path = parsedUrl.pathname;
    const fullUrl = url.toLowerCase();

    // Feature extraction functions
    const entropy = (s: string): number => {
      if (!s || s.length === 0) return 0;
      const freq: Record<string, number> = {};
      for (const c of s) freq[c] = (freq[c] || 0) + 1;
      const len = s.length;
      return -Object.values(freq).reduce((sum, f) => {
        const p = f / len;
        return sum + p * Math.log2(p);
      }, 0);
    };

    const digitRatio = (s: string): number => {
      if (!s) return 0;
      return (s.match(/\d/g)?.length || 0) / s.length;
    };

    const letterRatio = (s: string): number => {
      if (!s) return 0;
      return (s.match(/[a-zA-Z]/g)?.length || 0) / s.length;
    };

    const specialRatio = (s: string): number => {
      if (!s) return 0;
      return (s.match(/[^a-zA-Z0-9]/g)?.length || 0) / s.length;
    };

    const countChar = (s: string, char: string): number => (s.split(char).length - 1);

    // Suspicious keywords
    const suspiciousKeywords = [
      'login', 'signin', 'verify', 'account', 'secure', 'update', 'confirm',
      'password', 'banking', 'wallet', 'paypal', 'apple', 'microsoft', 'amazon',
      'facebook', 'instagram', 'netflix', 'support', 'help', 'service'
    ];
    const keywordCount = suspiciousKeywords.filter(kw => fullUrl.includes(kw)).length;

    // High-risk TLDs
    const highRiskTlds = ['tk', 'ml', 'ga', 'cf', 'gq', 'xyz', 'top', 'work', 'click', 'loan', 'zip'];
    const tld = hostname.split('.').pop()?.toLowerCase() || '';
    const tldRisk = highRiskTlds.includes(tld) ? 1.0 : 0.0;

    // Free hosting domains
    const freeHosting = ['000webhostapp', 'github.io', 'netlify', 'vercel', 'herokuapp', 'firebaseapp', 'web.app'];
    const isFreeHosting = freeHosting.some(h => hostname.includes(h)) ? 1.0 : 0.0;

    // URL shorteners
    const shorteners = ['bit.ly', 'tinyurl', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly'];
    const isShortener = shorteners.some(s => hostname.includes(s)) ? 1.0 : 0.0;

    // IP address check
    const hasIP = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(hostname) ? 1.0 : 0.0;

    // Punycode check (internationalized domain)
    const hasPunycode = hostname.includes('xn--') ? 1.0 : 0.0;

    // 38 features matching model-manifest.json
    const features = new Float32Array([
      // Basic length features
      fullUrl.length,                           // url_length
      hostname.length,                          // hostname_length
      path.length,                              // path_length

      // Character ratios
      digitRatio(fullUrl),                      // digit_ratio
      letterRatio(fullUrl),                     // letter_ratio
      specialRatio(fullUrl),                    // special_ratio

      // Entropy
      entropy(fullUrl),                         // url_entropy
      entropy(hostname),                        // hostname_entropy

      // Character counts
      countChar(fullUrl, '.'),                  // dot_count
      countChar(fullUrl, '-'),                  // dash_count
      countChar(fullUrl, '_'),                  // underscore_count
      countChar(fullUrl, '/'),                  // slash_count
      countChar(fullUrl, '@'),                  // at_count
      countChar(fullUrl, '?'),                  // question_count
      countChar(fullUrl, '&'),                  // ampersand_count

      // Structure
      hostname.split('.').length - 1,           // subdomain_count
      path.split('/').filter(Boolean).length,   // path_depth
      parsedUrl.searchParams.size,              // query_param_count

      // Protocol and port
      parsedUrl.protocol === 'https:' ? 1 : 0,  // is_https
      parsedUrl.port ? 1 : 0,                   // has_port
      hasIP,                                    // has_ip

      // Risk indicators
      tldRisk,                                  // tld_risk
      keywordCount,                             // keyword_count
      keywordCount > 0 ? 1 : 0,                 // has_suspicious_keyword
      isFreeHosting,                            // is_free_hosting
      isShortener,                              // is_shortener
      hasPunycode,                              // has_punycode

      // Pattern detection
      (fullUrl.match(/[0-9a-fA-F]{8,}/g)?.length || 0), // hex_count
      (fullUrl.match(/\.[a-z]{2,4}\.[a-z]{2,4}$/i) ? 1 : 0), // double_ext
      (hostname.match(/[bcdfghjklmnpqrstvwxyz]{4,}/gi)?.length || 0), // consonant_clusters

      // BigQuery-derived features (placeholders - set to neutral values)
      entropy(hostname),                        // bq_domain_entropy (reuse)
      digitRatio(hostname),                     // bq_digit_ratio (reuse)
      0,                                        // bq_redirect_count (unknown at scan time)
      0,                                        // bq_form_count (unknown at scan time)
      0,                                        // bq_password_fields (unknown at scan time)
      0,                                        // bq_external_links_count (unknown at scan time)
      keywordCount,                             // bq_phishing_keyword_count (reuse)
      keywordCount > 2 ? 1 : 0,                 // bq_urgent_word_count (approximation)
    ]);

    return features;
  }

  /**
   * Run inference on tabular models (XGBoost or LightGBM)
   */
  async runTabularInference(
    modelName: string,
    features: Float32Array
  ): Promise<ModelPrediction> {
    const session = await this.getSession(modelName);
    const config = MODEL_CONFIGS[modelName];

    const startTime = performance.now();

    // Create input tensor for tabular model
    const inputTensor = new ort.Tensor('float32', features, [1, features.length]);

    // Run inference
    const results = await session.run({
      [config.inputName]: inputTensor,
    });

    const latency = performance.now() - startTime;

    // Extract predictions - tabular models have output_label and output_probability
    const labelTensor = results[config.outputNames[0]];
    const probTensor = results[config.outputNames[1]];

    let probability: number;
    let label: number;

    // Handle different output formats
    if (labelTensor.data instanceof BigInt64Array) {
      label = Number(labelTensor.data[0]);
    } else {
      label = (labelTensor.data as Float32Array)[0] > 0.5 ? 1 : 0;
    }

    if (probTensor.data instanceof Float32Array) {
      // Probability array: [prob_class_0, prob_class_1]
      const probs = probTensor.data;
      probability = probs.length >= 2 ? probs[1] : probs[0];
    } else {
      probability = label;
    }

    // Compute confidence based on probability distance from 0.5
    const confidence = Math.abs(probability - 0.5) * 2;

    return {
      probability,
      label,
      confidence,
      latency,
      modelName,
    };
  }

  /**
   * Run inference on a transformer model with mutex to prevent concurrent runs
   * MobileBERT: requires tokenization (input_ids, attention_mask, token_type_ids)
   * pirocheto: takes STRING input directly (has built-in tokenizer)
   */
  async runTransformerInference(
    modelName: string,
    url: string,
    tokenizedInput?: TokenizedInput
  ): Promise<ModelPrediction> {
    // Check if inference is already in progress for this model
    // If so, wait for it to complete (prevents "Session already started" errors)
    const existingInference = this.inferenceInProgress.get(modelName);
    if (existingInference) {
      console.log(`[InferenceEngine] Waiting for existing ${modelName} inference to complete...`);
      try {
        await existingInference;
      } catch {
        // Ignore errors from previous inference
      }
    }

    // Create and store the inference promise
    const inferencePromise = this.runTransformerInferenceInternal(modelName, url, tokenizedInput);
    this.inferenceInProgress.set(modelName, inferencePromise);

    try {
      const result = await inferencePromise;
      return result;
    } finally {
      // Clear the inference lock
      if (this.inferenceInProgress.get(modelName) === inferencePromise) {
        this.inferenceInProgress.delete(modelName);
      }
    }
  }

  /**
   * Internal inference method (called after mutex acquired)
   */
  private async runTransformerInferenceInternal(
    modelName: string,
    url: string,
    tokenizedInput?: TokenizedInput
  ): Promise<ModelPrediction> {
    const session = await this.getSession(modelName);
    const config = MODEL_CONFIGS[modelName];

    const startTime = performance.now();
    let results: ort.InferenceSession.OnnxValueMapType;

    if (modelName === 'mobilebert') {
      // MobileBERT requires tokenization with 3 inputs: input_ids, attention_mask, token_type_ids
      const tokens = tokenizedInput || this.tokenizer.tokenize(url, config.maxSequenceLength || 128);

      const inputIdsTensor = new ort.Tensor(
        'int64',
        BigInt64Array.from(tokens.inputIds.map(BigInt)),
        [1, tokens.inputIds.length]
      );
      const attentionMaskTensor = new ort.Tensor(
        'int64',
        BigInt64Array.from(tokens.attentionMask.map(BigInt)),
        [1, tokens.attentionMask.length]
      );
      // token_type_ids: all zeros for single sequence classification
      const tokenTypeIdsTensor = new ort.Tensor(
        'int64',
        BigInt64Array.from(new Array(tokens.inputIds.length).fill(BigInt(0))),
        [1, tokens.inputIds.length]
      );

      results = await session.run({
        'input_ids': inputIdsTensor,
        'attention_mask': attentionMaskTensor,
        'token_type_ids': tokenTypeIdsTensor,
      });
    } else {
      // pirocheto expects raw URL string
      const inputTensor = new ort.Tensor('string', [url], [1]);
      results = await session.run({
        [config.inputName]: inputTensor,
      });
    }

    const latency = performance.now() - startTime;

    // Log outputs for debugging
    console.log(`[InferenceEngine] ${modelName} output keys:`, Object.keys(results));

    let probability: number;
    let label: number;

    if (modelName === 'mobilebert') {
      // MobileBERT outputs logits [batch, 2] - apply softmax
      const logits = results['logits']?.data as Float32Array;
      if (logits && logits.length >= 2) {
        // Softmax to convert logits to probabilities
        const expLogits = [Math.exp(logits[0]), Math.exp(logits[1])];
        const sumExp = expLogits[0] + expLogits[1];
        probability = expLogits[1] / sumExp; // Phishing probability (class 1)
      } else {
        probability = 0.5;
      }
    } else {
      // pirocheto outputs 'label' and 'probabilities'
      const probOutput = results['probabilities'] || results[config.outputNames[1]];
      const labelOutput = results['label'] || results[config.outputNames[0]];

      if (probOutput) {
        const probs = probOutput.data;
        if (probs.length >= 2) {
          probability = Number(probs[1]); // Phishing probability
        } else {
          probability = Number(probs[0]);
        }
      } else if (labelOutput) {
        const labelStr = String(labelOutput.data[0]).toLowerCase();
        probability = labelStr.includes('phish') || labelStr.includes('malicious') ? 0.9 : 0.1;
      } else {
        const firstOutput = results[session.outputNames[0]];
        const data = firstOutput?.data;
        if (data && data.length >= 2) {
          probability = Number(data[1]);
        } else if (data) {
          probability = Number(data[0]);
        } else {
          probability = 0.5;
        }
      }
    }

    label = probability > 0.5 ? 1 : 0;
    const confidence = Math.abs(probability - 0.5) * 2;

    console.log(`[InferenceEngine] ${modelName}: prob=${probability.toFixed(3)}, label=${label}, conf=${confidence.toFixed(3)}, latency=${latency.toFixed(0)}ms`);

    return {
      probability,
      label,
      confidence,
      latency,
      modelName,
    };
  }

  /**
   * Run ensemble inference
   * MobileBERT (PRIMARY, 60%) + pirocheto (FALLBACK, 40%)
   */
  async runEnsembleInference(
    url: string,
    models: string[] = ['mobilebert', 'pirocheto']
  ): Promise<InferenceResult> {
    const startTime = performance.now();
    const predictions: Record<string, ModelPrediction> = {};

    // Extract features once for all tabular models
    const features = this.extractURLFeatures(url);
    console.log('[InferenceEngine] Extracted', features.length, 'features for URL:', url);

    // Run models sequentially to avoid ONNX session conflicts
    // This prevents "Session already started" and null 'ec' errors
    for (const model of models) {
      const config = MODEL_CONFIGS[model];
      if (!config) {
        console.warn(`[InferenceEngine] Unknown model: ${model}, skipping`);
        continue;
      }

      try {
        let prediction: ModelPrediction;
        if (config.type === 'tabular') {
          prediction = await this.runTabularInference(model, features);
        } else {
          prediction = await this.runTransformerInference(model, url);
        }
        predictions[model] = prediction;
        console.log(`[InferenceEngine] ${model}: prob=${prediction.probability.toFixed(3)}, conf=${prediction.confidence.toFixed(3)}`);
      } catch (error) {
        console.error(`[InferenceEngine] Model ${model} failed:`, (error as Error).message);
        // Continue with other models
      }
    }

    // Compute ensemble prediction with weighted average
    const validPredictions = Object.entries(predictions)
      .filter((entry): entry is [string, ModelPrediction] => entry[1] !== undefined);

    let ensembleProbability = 0.5;
    let ensembleConfidence = 0;

    if (validPredictions.length > 0) {
      // Weighted average based on model weights and confidence
      let totalWeight = 0;
      let weightedSum = 0;

      for (const [modelName, pred] of validPredictions) {
        const config = MODEL_CONFIGS[modelName];
        const weight = (config?.weight ?? 0.5) * pred.confidence;
        weightedSum += pred.probability * weight;
        totalWeight += weight;
      }

      if (totalWeight > 0) {
        ensembleProbability = weightedSum / totalWeight;
      } else {
        // Simple average if no weights
        ensembleProbability = validPredictions.reduce(
          (sum, [, p]) => sum + p.probability,
          0
        ) / validPredictions.length;
      }

      // Ensemble confidence: higher if models agree
      if (validPredictions.length >= 2) {
        const probs = validPredictions.map(([, p]) => p.probability);
        const agreement = 1 - Math.abs(probs[0] - probs[1]);
        const avgConfidence = validPredictions.reduce(
          (sum, [, p]) => sum + p.confidence,
          0
        ) / validPredictions.length;
        ensembleConfidence = agreement * avgConfidence;
      } else {
        ensembleConfidence = validPredictions[0][1].confidence;
      }
    }

    const totalLatency = performance.now() - startTime;

    console.log(`[InferenceEngine] Ensemble result: prob=${ensembleProbability.toFixed(3)}, conf=${ensembleConfidence.toFixed(3)}, latency=${totalLatency.toFixed(0)}ms`);

    return {
      predictions: predictions as InferenceResult['predictions'],
      ensemble: {
        probability: ensembleProbability,
        confidence: ensembleConfidence,
      },
      totalLatency,
    };
  }

  /**
   * Check if models are loaded
   */
  isModelLoaded(modelName: string): boolean {
    return this.sessions.has(modelName);
  }

  /**
   * Preload all models
   */
  async preloadModels(): Promise<void> {
    await Promise.all(
      Object.keys(MODEL_CONFIGS).map((name) => this.getSession(name))
    );
    console.log('[InferenceEngine] All models preloaded');
  }
}

// ============================================================================
// MESSAGE HANDLER - Using Port Communication
// ============================================================================

const engine = new InferenceEngine();

// ============================================================================
// GLOBAL REQUEST QUEUE - Serializes all inference requests
// ONNX Runtime cannot handle concurrent inference - this prevents hangs
// ============================================================================

interface QueuedRequest {
  request: OffscreenRequest;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

const requestQueue: QueuedRequest[] = [];
let isProcessingQueue = false;

async function enqueueRequest(request: OffscreenRequest): Promise<unknown> {
  return new Promise((resolve, reject) => {
    requestQueue.push({ request, resolve, reject });
    console.log(`[InferenceEngine] 📋 Request queued: ${request.type} (queue size: ${requestQueue.length})`);
    processQueue();
  });
}

async function processQueue(): Promise<void> {
  if (isProcessingQueue) {
    return; // Already processing
  }

  isProcessingQueue = true;

  while (requestQueue.length > 0) {
    const item = requestQueue.shift()!;
    console.log(`[InferenceEngine] 🔄 Processing queued request: ${item.request.type} (remaining: ${requestQueue.length})`);

    try {
      const result = await handleRequestInternal(item.request);
      item.resolve(result);
    } catch (error) {
      item.reject(error as Error);
    }
  }

  isProcessingQueue = false;
}

// Handle port connections from service worker
chrome.runtime.onConnect.addListener((port) => {
  console.log(`[InferenceEngine] 📡 Port connection attempt: name="${port.name}"`);

  if (port.name !== 'offscreen-inference') {
    console.log('[InferenceEngine] ⚠️ Ignoring port with name:', port.name);
    return;
  }

  console.log('[InferenceEngine] ✅ Port connected successfully:', port.name);

  port.onMessage.addListener(async (request: OffscreenRequest) => {
    console.log(`[InferenceEngine] 📥 Port message received: type="${request?.type}", id="${request?.id}"`);

    if (!request || !request.type || !request.id) {
      console.warn('[InferenceEngine] Invalid message format:', request);
      return;
    }

    try {
      // Use queue for inference requests to prevent ONNX concurrent access issues
      const result = request.type === 'inference' || request.type === 'preloadModels'
        ? await enqueueRequest(request)
        : await handleRequestInternal(request);
      console.log(`[InferenceEngine] 📤 Sending response for: ${request.type}`);
      port.postMessage({
        type: 'result',
        id: request.id,
        payload: result,
      });
      console.log(`[InferenceEngine] ✅ Response sent for: ${request.id}`);
    } catch (error) {
      console.error(`[InferenceEngine] ❌ Error processing ${request.type}:`, (error as Error).message);
      console.error('[InferenceEngine] Stack:', (error as Error).stack);
      port.postMessage({
        type: 'error',
        id: request.id,
        payload: { error: (error as Error).message },
      });
    }
  });

  port.onDisconnect.addListener(() => {
    console.log('[InferenceEngine] ⚠️ Port disconnected');
  });
});

// Also keep the sendMessage listener for backward compatibility
chrome.runtime.onMessage.addListener(
  (request: OffscreenRequest & { target?: string }, _sender, sendResponse) => {
    console.log('[InferenceEngine] Message received:', request?.type, 'target:', request?.target);

    // Only handle messages specifically targeted to this offscreen document
    if (!request || request.target !== 'offscreen-inference-engine') {
      return false;
    }

    if (!request.type || !request.id) {
      console.warn('[InferenceEngine] Invalid message format:', request);
      return false;
    }

    // Use queue for inference requests
    const handler = request.type === 'inference' || request.type === 'preloadModels'
      ? enqueueRequest(request)
      : handleRequestInternal(request);

    handler
      .then((result) => {
        sendResponse({
          type: 'result',
          id: request.id,
          payload: result,
        });
      })
      .catch((error) => {
        sendResponse({
          type: 'error',
          id: request.id,
          payload: { error: (error as Error).message },
        });
      });

    return true;
  }
);

async function handleRequestInternal(request: OffscreenRequest): Promise<unknown> {
  console.log('[InferenceEngine] handleRequestInternal:', request.type);

  switch (request.type) {
    case 'ping':
      console.log('[InferenceEngine] Ping received, responding ready');
      return { status: 'ready', timestamp: Date.now() };

    case 'init':
      console.log('[InferenceEngine] Initializing engine...');
      await engine.initialize();
      return { status: 'initialized' };

    case 'loadModel':
      console.log('[InferenceEngine] Loading model:', request.payload.name);
      await engine.initialize();
      await engine.getSession(request.payload.name);
      return { status: 'loaded', model: request.payload.name };

    case 'inference': {
      console.log('[InferenceEngine] Running inference for URL:', request.payload.url);
      await engine.initialize();
      const url = request.payload.url;
      // Use MobileBERT (PRIMARY) + pirocheto (FALLBACK) ensemble
      const models = request.payload.models || ['mobilebert', 'pirocheto'];
      console.log('[InferenceEngine] Using models:', models.join(', '));
      const result = await engine.runEnsembleInference(url, models);
      console.log('[InferenceEngine] Inference complete:', {
        hasResults: Object.keys(result.predictions).length > 0,
        ensemble: result.ensemble,
        latency: result.totalLatency,
      });
      return result;
    }

    case 'preloadModels': {
      console.log('[InferenceEngine] 🧠 Preloading models:', request.payload.models);
      const startTime = performance.now();
      await engine.initialize();

      const modelsToLoad = request.payload.models || ['mobilebert', 'pirocheto'];
      const loadedModels: string[] = [];

      for (const modelName of modelsToLoad) {
        try {
          const modelStart = performance.now();
          await engine.getSession(modelName);
          const modelTime = performance.now() - modelStart;
          console.log(`[InferenceEngine] ✅ ${modelName} loaded in ${modelTime.toFixed(0)}ms`);
          loadedModels.push(modelName);
        } catch (error) {
          console.error(`[InferenceEngine] ❌ Failed to load ${modelName}:`, (error as Error).message);
        }
      }

      const totalTime = performance.now() - startTime;
      console.log(`[InferenceEngine] 🎉 Preload complete in ${totalTime.toFixed(0)}ms - loaded: ${loadedModels.join(', ')}`);

      return {
        status: 'preloaded',
        models: loadedModels,
        totalTime,
      };
    }

    default:
      throw new Error(`Unknown request type: ${(request as { type: string }).type}`);
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Signal that offscreen document is ready
console.log('='.repeat(60));
console.log('[InferenceEngine] 🚀 OFFSCREEN DOCUMENT INITIALIZING');
console.log('[InferenceEngine] Document URL:', window.location.href);
console.log('[InferenceEngine] Timestamp:', new Date().toISOString());
console.log('='.repeat(60));

// Preload pirocheto first (fast), then MobileBERT (larger but loads via preload button)
(async () => {
  const startTime = performance.now();
  try {
    console.log('[InferenceEngine] Step 1/3: Initializing ONNX Runtime...');
    await engine.initialize();
    console.log(`[InferenceEngine] ✅ ONNX Runtime initialized (${(performance.now() - startTime).toFixed(0)}ms)`);

    // Load pirocheto first (smaller, faster to load)
    console.log('[InferenceEngine] Step 2/3: Preloading pirocheto (FALLBACK)...');
    const pirochetoStart = performance.now();
    await engine.getSession('pirocheto');
    console.log(`[InferenceEngine] ✅ pirocheto loaded (${(performance.now() - pirochetoStart).toFixed(0)}ms)`);

    // Attempt to load MobileBERT (94MB - may take time but important for accuracy)
    console.log('[InferenceEngine] Step 3/3: Preloading MobileBERT (PRIMARY)...');
    const mobilebertStart = performance.now();
    try {
      await engine.getSession('mobilebert');
      console.log(`[InferenceEngine] ✅ MobileBERT loaded (${(performance.now() - mobilebertStart).toFixed(0)}ms)`);
    } catch (mbError) {
      console.warn(`[InferenceEngine] ⚠️ MobileBERT preload failed - will retry on first use: ${(mbError as Error).message}`);
    }

    const totalTime = performance.now() - startTime;
    console.log('='.repeat(60));
    console.log(`[InferenceEngine] 🎉 READY - Total init time: ${totalTime.toFixed(0)}ms`);
    console.log('[InferenceEngine] PRIMARY: MobileBERT v3.0 (60% weight) - Custom trained on Elara TI DB');
    console.log('[InferenceEngine] FALLBACK: pirocheto (40% weight) - HuggingFace model');
    console.log('[InferenceEngine] Ensemble: MobileBERT + pirocheto for optimal accuracy');
    console.log('[InferenceEngine] Ready to receive inference requests via port');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('='.repeat(60));
    console.error('[InferenceEngine] ❌ CRITICAL: Initialization FAILED');
    console.error('[InferenceEngine] Error:', (error as Error).message || error);
    console.error('[InferenceEngine] Stack:', (error as Error).stack);
    console.error('='.repeat(60));
  }
})();
