# Elara AI Agent - Immediate Action Checklist

**Priority**: CRITICAL - Production Blockers
**Date**: December 5, 2025
**Estimated Time**: 3-4 weeks to production readiness

---

## ❌ CRITICAL: Security Gaps (Week 1)

### 1. Implement AES-256-GCM Encryption
**Issue**: SEC-001 - Auth tokens stored in plaintext
**Severity**: CRITICAL
**Files to Create**:
- [ ] `src/crypto/encryption.ts`
- [ ] `src/crypto/key-derivation.ts`
- [ ] `src/crypto/__tests__/encryption.test.ts`

**Implementation**:
```typescript
// src/crypto/encryption.ts
import { Buffer } from 'buffer';

interface EncryptedData {
  iv: Uint8Array;
  ciphertext: Uint8Array;
  authTag: Uint8Array;
}

export class AESEncryption {
  /**
   * Encrypt data using AES-256-GCM
   * @param plaintext - Data to encrypt
   * @param key - 256-bit CryptoKey
   * @returns Encrypted data with IV and auth tag
   */
  async encrypt(plaintext: string, key: CryptoKey): Promise<EncryptedData> {
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    // Generate random 96-bit IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt with AES-GCM
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      key,
      data
    );

    // Extract ciphertext and auth tag
    const ciphertext = new Uint8Array(encrypted.slice(0, -16));
    const authTag = new Uint8Array(encrypted.slice(-16));

    return { iv, ciphertext, authTag };
  }

  /**
   * Decrypt data using AES-256-GCM
   * @throws Error if authentication fails (data tampered)
   */
  async decrypt(encrypted: EncryptedData, key: CryptoKey): Promise<string> {
    // Combine ciphertext and auth tag
    const combined = new Uint8Array(encrypted.ciphertext.length + encrypted.authTag.length);
    combined.set(encrypted.ciphertext);
    combined.set(encrypted.authTag, encrypted.ciphertext.length);

    try {
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: encrypted.iv, tagLength: 128 },
        key,
        combined
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      throw new Error('Decryption failed - data corrupted or tampered');
    }
  }

  /**
   * Derive encryption key from browser session ID
   */
  async deriveKey(sessionId: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(sessionId),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }
}

export const aesEncryption = new AESEncryption();
```

**Test Coverage**: 100% required for crypto module

---

### 2. Add Rate Limiting
**Issue**: SEC-002 - API abuse vulnerability
**Severity**: CRITICAL
**Files to Create**:
- [ ] `src/lib/rate-limiter.ts`
- [ ] `src/lib/__tests__/rate-limiter.test.ts`

**Implementation**:
```typescript
// src/lib/rate-limiter.ts
export interface RateLimitConfig {
  maxRequests: number; // e.g., 10
  windowMs: number;    // e.g., 60000 (1 minute)
}

export class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per ms

  constructor(config: RateLimitConfig) {
    this.maxTokens = config.maxRequests;
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
    this.refillRate = config.maxRequests / config.windowMs;
  }

  /**
   * Attempt to consume a token
   * @returns true if request allowed, false if rate limited
   */
  async tryConsume(): Promise<boolean> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Get time until next token available (ms)
   */
  getRetryAfter(): number {
    if (this.tokens >= 1) return 0;
    return Math.ceil((1 - this.tokens) / this.refillRate);
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}

// Usage
export const apiRateLimiter = new TokenBucketRateLimiter({
  maxRequests: 10,
  windowMs: 60000, // 1 minute
});
```

**Integration**:
```typescript
// In edge-client.ts and cloud-client.ts
async sendMessage<T>(message: any): Promise<T> {
  if (!(await apiRateLimiter.tryConsume())) {
    const retryAfter = apiRateLimiter.getRetryAfter();
    throw new RateLimitError(`Rate limited. Retry after ${retryAfter}ms`);
  }

  // Proceed with request...
}
```

---

### 3. Add DOMPurify for XSS Prevention
**Issue**: SEC-003 - HTML sanitization missing
**Severity**: HIGH

**Install**:
```bash
pnpm add dompurify @types/dompurify
```

**Integration**:
```typescript
// src/sidepanel/components/MessageBubble.tsx
import DOMPurify from 'dompurify';

export function MessageBubble({ message }: { message: Message }) {
  const sanitizedContent = DOMPurify.sanitize(message.content, {
    ALLOWED_TAGS: ['b', 'i', 'code', 'pre', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'p', 'a'],
    ALLOWED_ATTR: ['href', 'title'],
    ALLOW_DATA_ATTR: false,
  });

  return (
    <div
      className="message-content"
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  );
}
```

---

## ❌ CRITICAL: Missing Dependencies (Week 1)

### 4. Install Core ML Dependencies
**Issue**: DEP-001, DEP-002 - Core dependencies missing
**Severity**: CRITICAL

**Install**:
```bash
# Add all missing dependencies
pnpm add @mlc-ai/web-llm onnxruntime-web dompurify

# Add type definitions
pnpm add -D @types/dompurify
```

**Verify**:
```bash
# Check package.json
cat package.json | grep -E "@mlc-ai|onnxruntime|dompurify"
```

---

## ❌ CRITICAL: WebLLM Integration (Week 2)

### 5. Replace Mock Implementations
**Issue**: ARCH-001 - WebLLM stubbed with mocks
**Severity**: CRITICAL
**Files to Modify**:
- [ ] `src/lib/webllm/webllm-engine.ts` (lines 107-163, 258-320)

**Remove**:
```typescript
// DELETE THIS MOCK CODE:
private generateMockResponse(messages: ChatMessage[]): string {
  const lastMessage = messages[messages.length - 1];
  const content = lastMessage?.content.toLowerCase() || '';

  if (content.includes('hello') || content.includes('hi')) {
    return "Hello! I'm Elara...";
  }
  // ... more mock responses
}
```

**Replace with**:
```typescript
// src/lib/webllm/webllm-engine.ts
import { CreateMLCEngine } from '@mlc-ai/web-llm';

async initialize(): Promise<void> {
  this.setState('initializing');

  try {
    this.deviceCapabilities = await detectDeviceCapabilities();

    // ACTUAL WebLLM initialization
    this.engine = await CreateMLCEngine('Phi-3-mini-4k-instruct-q4f16_1', {
      initProgressCallback: (report) => {
        console.log(`[WebLLM] Init: ${report.text} (${report.progress}%)`);
      },
    });

    this.setState('ready');
    console.log('[WebLLMEngine] Initialization complete');
  } catch (error) {
    console.error('[WebLLMEngine] Initialization failed:', error);
    this.setState('error');
    throw error;
  }
}

async loadModel(modelId: string, onProgress?: (progress: number) => void): Promise<void> {
  const modelConfig = AVAILABLE_MODELS[modelId];
  if (!modelConfig) {
    throw new Error(`Unknown model: ${modelId}`);
  }

  this.setState('loading-model');

  try {
    console.log(`[WebLLMEngine] Loading model: ${modelConfig.displayName}`);

    // ACTUAL WebLLM model reload
    await this.engine.reload(modelConfig.modelId, {
      progressCallback: (report) => {
        const progress = Math.round(report.progress * 100);
        console.log(`[WebLLM] ${report.text} (${progress}%)`);
        if (onProgress) {
          onProgress(progress);
        }
      },
    });

    this.currentModel = modelConfig;
    this.contextManager.setMaxTokens(modelConfig.contextWindow);
    this.setState('ready');

    console.log(`[WebLLMEngine] Model loaded: ${modelConfig.displayName}`);
  } catch (error) {
    console.error('[WebLLMEngine] Model loading failed:', error);
    this.setState('error');
    throw error;
  }
}

private async generateStreaming(
  messages: ChatMessage[],
  config: GenerationConfig,
  onStream: StreamCallback
): Promise<{ content: string; metrics: StreamMetrics }> {
  const handler = new StreamingHandler();
  handler.onStream(onStream);
  handler.startStream();

  // ACTUAL WebLLM streaming
  const stream = await this.engine.chat.completions.create({
    messages: this.convertToWebLLMFormat(messages),
    stream: true,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    top_p: config.topP,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || '';
    if (delta) {
      handler.processChunk(delta);
    }
  }

  const metrics = handler.endStream('stop');
  const content = handler.getFullResponse();

  return { content, metrics };
}

private convertToWebLLMFormat(messages: ChatMessage[]): any[] {
  return messages.map(msg => ({
    role: msg.role,
    content: msg.content,
  }));
}
```

---

## ❌ CRITICAL: ONNX Runtime Integration (Week 2)

### 6. Create Offscreen Document
**Issue**: ARCH-002, ARCH-003 - Offscreen document missing
**Severity**: CRITICAL
**Files to Create**:
- [ ] `src/offscreen/index.html`
- [ ] `src/offscreen/offscreen.ts`
- [ ] `src/offscreen/inference-engine.ts`

**Create Offscreen HTML**:
```html
<!-- src/offscreen/index.html -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Elara ML Inference Engine</title>
</head>
<body>
  <script src="offscreen.js" type="module"></script>
</body>
</html>
```

**Create Inference Engine**:
```typescript
// src/offscreen/inference-engine.ts
import * as ort from 'onnxruntime-web';

export class InferenceEngine {
  private mobilebertSession: ort.InferenceSession | null = null;
  private pirochetoSession: ort.InferenceSession | null = null;

  async initialize(): Promise<void> {
    console.log('[InferenceEngine] Initializing ONNX Runtime...');

    // Set execution provider (WebGPU preferred, WASM fallback)
    ort.env.wasm.numThreads = 4;
    ort.env.wasm.simd = true;

    try {
      // Try WebGPU first
      this.mobilebertSession = await ort.InferenceSession.create(
        '/models/mobilebert-v3-fp32.onnx',
        { executionProviders: ['webgpu', 'wasm'] }
      );

      this.pirochetoSession = await ort.InferenceSession.create(
        '/models/phishing-url-detector.onnx',
        { executionProviders: ['webgpu', 'wasm'] }
      );

      console.log('[InferenceEngine] Models loaded successfully');
    } catch (error) {
      console.error('[InferenceEngine] Model loading failed:', error);
      throw error;
    }
  }

  async runInference(url: string, features: URLFeatures): Promise<EdgePrediction> {
    if (!this.mobilebertSession || !this.pirochetoSession) {
      throw new Error('Models not loaded');
    }

    const startTime = performance.now();

    // Run both models in parallel
    const [mobilebertResult, pirochetoResult] = await Promise.all([
      this.runMobileBERT(features),
      this.runPirocheto(url),
    ]);

    // Weighted ensemble (60% MobileBERT + 40% pirocheto)
    const probability =
      mobilebertResult.probability * 0.60 +
      pirochetoResult.probability * 0.40;

    const confidence = Math.min(
      mobilebertResult.confidence,
      pirochetoResult.confidence
    );

    const latency = performance.now() - startTime;

    return {
      probability,
      confidence,
      models: {
        mobilebert: mobilebertResult,
        pirocheto: pirochetoResult,
      },
      reasoning: this.generateReasoning(probability, confidence),
      latency,
    };
  }

  private async runMobileBERT(features: URLFeatures): Promise<ModelPrediction> {
    // Prepare input tensor
    const inputTensor = this.prepareMobileBERTInput(features);

    // Run inference
    const results = await this.mobilebertSession!.run({
      input_ids: inputTensor.inputIds,
      attention_mask: inputTensor.attentionMask,
      token_type_ids: inputTensor.tokenTypeIds,
    });

    // Extract probability from output
    const output = results.logits.data as Float32Array;
    const probability = output[1]; // Class 1 = phishing

    return {
      probability,
      confidence: Math.abs(output[1] - output[0]), // Confidence = margin
      latency: 0, // Will be set by parent
    };
  }

  private async runPirocheto(url: string): Promise<ModelPrediction> {
    // Prepare URL input
    const inputTensor = this.preparePirochetoInput(url);

    // Run inference
    const results = await this.pirochetoSession!.run({
      url_input: inputTensor,
    });

    const output = results.output.data as Float32Array;
    const probability = output[0];

    return {
      probability,
      confidence: 1.0 - Math.abs(probability - 0.5) * 2, // Normalize to 0-1
      latency: 0,
    };
  }

  // ... implement prepareMobileBERTInput, preparePirochetoInput, etc.
}

export const inferenceEngine = new InferenceEngine();
```

**Update Manifest**:
```json
// manifest.json
{
  "permissions": [
    "offscreen"
  ],
  "web_accessible_resources": [
    {
      "resources": ["offscreen/index.html", "models/*.onnx"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

---

## ❌ CRITICAL: Testing (Week 3)

### 7. Achieve 80% Test Coverage
**Issue**: TEST-001 - Coverage <10%
**Severity**: CRITICAL
**Target**: 200+ unit tests, 50+ integration tests, 15+ E2E tests

**Create Test Structure**:
```bash
mkdir -p src/lib/webllm/__tests__
mkdir -p src/lib/edge/__tests__
mkdir -p src/crypto/__tests__
mkdir -p src/background/agents/__tests__
```

**Example Test**:
```typescript
// src/crypto/__tests__/encryption.test.ts
import { describe, it, expect } from 'vitest';
import { aesEncryption } from '../encryption';

describe('AESEncryption', () => {
  it('should encrypt and decrypt data correctly', async () => {
    const plaintext = 'test-auth-token-12345';
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await aesEncryption.deriveKey('session-id', salt);

    const encrypted = await aesEncryption.encrypt(plaintext, key);
    const decrypted = await aesEncryption.decrypt(encrypted, key);

    expect(decrypted).toBe(plaintext);
  });

  it('should throw error on tampered data', async () => {
    const plaintext = 'test-data';
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await aesEncryption.deriveKey('session-id', salt);

    const encrypted = await aesEncryption.encrypt(plaintext, key);

    // Tamper with ciphertext
    encrypted.ciphertext[0] ^= 1;

    await expect(
      aesEncryption.decrypt(encrypted, key)
    ).rejects.toThrow('Decryption failed');
  });

  it('should use different IVs for each encryption', async () => {
    const plaintext = 'test-data';
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await aesEncryption.deriveKey('session-id', salt);

    const encrypted1 = await aesEncryption.encrypt(plaintext, key);
    const encrypted2 = await aesEncryption.encrypt(plaintext, key);

    expect(encrypted1.iv).not.toEqual(encrypted2.iv);
  });
});
```

**Run Tests**:
```bash
# Unit tests
pnpm test

# Coverage report
pnpm test:coverage

# Target: ≥80% coverage
```

---

## Priority Matrix

| Task | Priority | Severity | Week | Est. Hours |
|------|----------|----------|------|------------|
| Implement AES-256-GCM | P0 | Critical | 1 | 16h |
| Add Rate Limiting | P0 | Critical | 1 | 8h |
| Install Dependencies | P0 | Critical | 1 | 2h |
| Add DOMPurify | P0 | High | 1 | 4h |
| Replace WebLLM Mocks | P1 | Critical | 2 | 24h |
| Create Offscreen Document | P1 | Critical | 2 | 32h |
| Implement ONNX Runtime | P1 | Critical | 2 | 40h |
| Write Unit Tests | P2 | Critical | 3 | 60h |
| Add E2E Tests | P2 | High | 3 | 24h |
| Implement Retry Logic | P2 | High | 3 | 16h |

**Total Estimated Effort**: ~226 hours (≈28 days with 1 developer)

---

## Definition of Done

### Week 1: Security & Dependencies ✅
- [ ] All SEC-* critical issues resolved
- [ ] Encryption module with 100% test coverage
- [ ] Rate limiting implemented and tested
- [ ] DOMPurify integrated in all message rendering
- [ ] All missing dependencies installed

### Week 2: ML Integration ✅
- [ ] WebLLM returning actual LLM responses (no mocks)
- [ ] Offscreen document created and functional
- [ ] ONNX Runtime loading and running models
- [ ] Edge inference latency <100ms (p95)
- [ ] All ARCH-* critical issues resolved

### Week 3: Testing & Quality ✅
- [ ] Test coverage ≥80%
- [ ] All unit tests passing
- [ ] E2E tests with Playwright
- [ ] Error handling with retry logic
- [ ] Circuit breaker pattern implemented

### Week 4: Production Ready ✅
- [ ] Security audit passed
- [ ] Performance benchmarks met
- [ ] Chrome Web Store compliance verified
- [ ] Production deployment pipeline ready
- [ ] All critical issues resolved

---

## Quick Start Commands

```bash
# Week 1: Install dependencies
pnpm add @mlc-ai/web-llm onnxruntime-web dompurify @types/dompurify

# Create missing directories
mkdir -p src/crypto src/offscreen src/crypto/__tests__

# Week 2: Build and test
pnpm build:dev
pnpm typecheck
pnpm test

# Week 3: Coverage check
pnpm test:coverage
# Target: ≥80% coverage

# Week 4: Production build
pnpm build:prod
pnpm package
```

---

**Track Progress**: Update this checklist as items are completed
**Next Review**: After each sprint (weekly)
**Contact**: Refer to `docs/validation/validation-report.md` for full details
