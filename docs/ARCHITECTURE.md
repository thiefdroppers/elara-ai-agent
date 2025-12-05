# Elara AI Agent - Architecture Documentation

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Component Architecture](#2-component-architecture)
3. [Multi-Agent System](#3-multi-agent-system)
4. [ML Inference Pipeline](#4-ml-inference-pipeline)
5. [Security Architecture](#5-security-architecture)
6. [API Integration](#6-api-integration)
7. [Data Flow](#7-data-flow)

---

## 1. System Overview

### 1.1 High-Level Architecture

```
+==============================================================================+
|                         ELARA AI AGENT ECOSYSTEM                              |
+==============================================================================+

+----------------------------------+     +----------------------------------+
|         USER'S BROWSER           |     |      ELARA PLATFORM (GCP)        |
|                                  |     |                                  |
|  +----------------------------+  |     |  +----------------------------+  |
|  |    ELARA EDGE ENGINE       |  |     |  |      API GATEWAY           |  |
|  |    (Chrome Extension)      |  |     |  |      (Cloud Run)           |  |
|  |                            |  |     |  +-------------+--------------+  |
|  |  +----------------------+  |  |     |                |                 |
|  |  |   "Ask Elara"        |  |  |     |  +-------------v--------------+  |
|  |  |   Chat Panel         |<-+--+-----+->|    ORCHESTRATION           |  |
|  |  +----------------------+  |  |     |  |    SERVICE                 |  |
|  |                            |  |HTTPS|  +-------------+--------------+  |
|  |  +----------------------+  |  |     |                |                 |
|  |  |   Agent              |  |  | TLS |  +-------------v--------------+  |
|  |  |   Orchestrator       |<-+--+--+--+->|    MICROSERVICES           |  |
|  |  +----------------------+  |  |  |  |  |                            |  |
|  |                            |  |  |  |  | +----+ +----+ +----+ +----+|  |
|  |  +----------------------+  |  |  |  |  | | DS | | TI | | DF | | FC ||  |
|  |  |   ML Ensemble        |  |  |  |  |  | +----+ +----+ +----+ +----+|  |
|  |  |   (ONNX Runtime)     |  |  |  |  |  +----------------------------+  |
|  |  +----------------------+  |  |  |  |                                  |
|  |                            |  |  |  |  +----------------------------+  |
|  |  +----------------------+  |  |  |  |  |    ML INFERENCE            |  |
|  |  |   Security           |  |  |  +--+->|    (Vertex AI)             |  |
|  |  |   Guardian           |  |  |     |  +----------------------------+  |
|  |  +----------------------+  |  |     |                                  |
|  +----------------------------+  |     |  +----------------------------+  |
|                                  |     |  |    TI DATABASE             |  |
+----------------------------------+     |  |    (PostgreSQL + Redis)    |  |
                                         |  +----------------------------+  |
                                         +----------------------------------+

LEGEND:
  DS = DeepScan Service      TI = Threat Intel Service
  DF = DeepFake Detector     FC = Fact Checker Service
```

### 1.2 Extension Components

```
+==============================================================================+
|                    CHROME EXTENSION ARCHITECTURE (MV3)                        |
+==============================================================================+

+---------------------------+
|      MANIFEST V3          |
+---------------------------+
           |
           v
+----------+----------+----------+----------+----------+
|          |          |          |          |          |
v          v          v          v          v          v
+------+ +------+ +------+ +------+ +------+ +------+
|SIDE  | |POPUP | |SERVICE| |CONTENT| |OFF   | |OPTIONS|
|PANEL | |      | |WORKER | |SCRIPT | |SCREEN| |PAGE  |
+--+---+ +--+---+ +---+---+ +---+---+ +--+---+ +--+---+
   |        |         |         |        |        |
   |        |         |         |        |        |
   v        v         v         v        v        v
+------+ +------+ +------+ +------+ +------+ +------+
|React | |Quick | |Agent | |DOM   | |ONNX  | |User  |
|Chat  | |Scan  | |System| |Inject| |Runtime| |Prefs |
|UI    | |UI    | |      | |      | |      | |      |
+------+ +------+ +------+ +------+ +------+ +------+


MESSAGE FLOW:

  Sidepanel                Service Worker              Offscreen
      |                         |                         |
      | chrome.runtime.connect  |                         |
      +------------------------>|                         |
      |                         |                         |
      | port.postMessage        |                         |
      +------------------------>|                         |
      |                         | chrome.runtime.connect  |
      |                         +------------------------>|
      |                         |                         |
      |                         | port.postMessage        |
      |                         +------------------------>|
      |                         |                         |
      |                         |<------------------------+
      |                         | inference result        |
      |<------------------------+                         |
      | scan result             |                         |
      |                         |                         |
```

---

## 2. Component Architecture

### 2.1 Service Worker

```
+==============================================================================+
|                    SERVICE WORKER LIFECYCLE                                   |
+==============================================================================+

                         +-------------------+
                         |   INSTALLATION    |
                         +--------+----------+
                                  |
                                  | 1. Load ONNX model manifest
                                  | 2. Initialize IndexedDB
                                  | 3. Setup encryption keys
                                  v
                         +--------+----------+
                         |    ACTIVATION     |
                         +--------+----------+
                                  |
                                  | 4. Claim all clients
                                  | 5. Start TI sync alarm
                                  | 6. Register message handlers
                                  v
+---------------------------+-----+-----+---------------------------+
|                           |           |                           |
v                           v           v                           v
+-------------+     +-------+---+   +---+-------+     +-------------+
|   PORT      |     |  MESSAGE  |   |   ALARM   |     |   FETCH     |
|   HANDLER   |     |  HANDLER  |   |   HANDLER |     |   HANDLER   |
+------+------+     +-----+-----+   +-----+-----+     +------+------+
       |                  |               |                  |
       | Long-lived       | One-time      | Scheduled        | Network
       | connections      | messages      | tasks            | intercept
       |                  |               |                  |
       v                  v               v                  v
+------+------+     +-----+-----+   +-----+-----+     +------+------+
| Agent       |     | Quick     |   | TI Sync   |     | Request     |
| Sessions    |     | Scans     |   | Model     |     | Filtering   |
|             |     |           |   | Update    |     |             |
+-------------+     +-----------+   +-----------+     +-------------+
```

### 2.2 Message Router

```
+==============================================================================+
|                    MESSAGE ROUTING                                            |
+==============================================================================+

Incoming Message
      |
      v
+-----+-----+
|  Router   |
+-----+-----+
      |
      +---> CHAT_MESSAGE -------> handleChatMessage()
      |                                   |
      |                                   v
      |                          +--------+--------+
      |                          | AgentOrchestrator|
      |                          +-----------------+
      |
      +---> SCAN_URL ----------> handleScanUrl()
      |                                   |
      |                                   v
      |                          +--------+--------+
      |                          | ScannerClient   |
      |                          +-----------------+
      |
      +---> GET_CURRENT_TAB ----> handleGetCurrentTab()
      |
      +---> SET_AUTH_TOKEN -----> handleSetAuthToken()
      |
      +---> STORE_SECURE -------> handleSecureStore()
      |
      +---> GET_SECURE ---------> handleSecureGet()
      |
      +---> ORCHESTRATOR_STATE -> broadcastState()
```

---

## 3. Multi-Agent System

### 3.1 Agent Hierarchy

```
+==============================================================================+
|                    MULTI-AGENT ORCHESTRATION                                  |
+==============================================================================+

                         +-------------------+
                         |   ORCHESTRATOR    |
                         |   (Coordinator)   |
                         +--------+----------+
                                  |
            +---------------------+---------------------+
            |                     |                     |
            v                     v                     v
    +-------+-------+     +-------+-------+     +-------+-------+
    |   PLANNER     |     |   NAVIGATOR   |     |   GUARDIAN    |
    |   AGENT       |     |   AGENT       |     |   AGENT       |
    +-------+-------+     +-------+-------+     +-------+-------+
            |                     |                     |
    +-------v-------+     +-------v-------+     +-------v-------+
    | Responsibilities|   | Responsibilities|   | Responsibilities|
    | - Parse intent  |   | - Execute DOM   |   | - Validate ALL  |
    | - Break down    |   |   operations    |   |   agent actions |
    |   complex tasks |   | - Navigate      |   | - Enforce       |
    | - Create action |   |   pages         |   |   guardrails    |
    |   plans         |   | - Extract       |   | - Monitor for   |
    | - Handle errors |   |   content       |   |   threats       |
    +---------------+     +---------------+     +---------------+


AGENT COMMUNICATION PROTOCOL:

+------------------+        +------------------+        +------------------+
|    PLANNER       |        |   ORCHESTRATOR   |        |    NAVIGATOR     |
+--------+---------+        +--------+---------+        +--------+---------+
         |                           |                           |
         | 1. Request: Analyze URL   |                           |
         +-------------------------->|                           |
         |                           |                           |
         |                           | 2. Dispatch: Get DOM      |
         |                           +-------------------------->|
         |                           |                           |
         |                           |<--------------------------+
         |                           | 3. Response: DOM data     |
         |                           |                           |
         |                  +--------+--------+                  |
         |                  |    GUARDIAN     |                  |
         |                  | 4. Validate DOM |                  |
         |                  +--------+--------+                  |
         |                           |                           |
         |<--------------------------+                           |
         | 5. Validated: Safe to     |                           |
         |    proceed                |                           |
         |                           |                           |
         | 6. Action: Run inference  |                           |
         +-------------------------->|                           |
```

### 3.2 Agent State Machine

```
+==============================================================================+
|                    AGENT STATE MACHINE                                        |
+==============================================================================+

                    +--------+
            +------>|  IDLE  |<------+
            |       +---+----+       |
            |           |            |
            |           | User       |
            |           | Message    |
            |           v            |
            |       +---+----+       |
            |       |PLANNING|       |
            |       +---+----+       |
            |           |            |
            |           | Plan       |
            |           | Ready      |
            |           v            |
            |       +---+----+       |
     +------+------>|EXECUTING|      |
     |      |       +---+----+       |
     |      |           |            |
     |      |           | Action     |
     |      |           | Complete   |
     |      |           v            |
     |      |       +---+----+       |
     |      +-------|VALIDATING|     |
     |              +---+----+       |
     |                  |            |
     |    More Actions  |  All Done  |
     +------------------+            |
                        |            |
                        v            |
                    +---+----+       |
                    |COMPLETE|-------+
                    +--------+


ERROR HANDLING:

+----------+     +----------+     +----------+
| EXECUTING|---->|  ERROR   |---->| PLANNING |
+----------+     +----+-----+     +----------+
                      |
                      | Max Retries (3)
                      v
                 +----+-----+
                 | COMPLETE |
                 | (Failed) |
                 +----------+
```

### 3.3 Intent Classification

```
+==============================================================================+
|                    INTENT CLASSIFICATION                                      |
+==============================================================================+

User Input
    |
    v
+---+---+
|Tokenize|
+---+---+
    |
    v
+---+---+
|Classify|
+---+---+
    |
    +-------+-------+-------+-------+-------+
    |       |       |       |       |       |
    v       v       v       v       v       v
+------+ +------+ +------+ +------+ +------+ +------+
|scan_ | |deep_ | |fact_ | |deep  | |explain| |general|
|url   | |scan  | |check | |fake  | |       | |chat  |
+--+---+ +--+---+ +--+---+ +--+---+ +--+---+ +--+---+
   |        |        |        |        |        |
   v        v        v        v        v        v
+------+ +------+ +------+ +------+ +------+ +------+
|Edge  | |Cloud | |Cloud | |Cloud | |LLM   | |LLM   |
|Scan  | |API   | |API   | |API   | |      | |      |
+------+ +------+ +------+ +------+ +------+ +------+


INTENT PATTERNS:

+------------------------+----------------------------------------+
|        INTENT          |              PATTERNS                   |
+------------------------+----------------------------------------+
| scan_url               | URL detected, "scan", "check", "safe?" |
| deep_scan              | "deep scan", "full scan", "analyze"    |
| fact_check             | "fact check", "verify", "is it true"   |
| deepfake               | "deepfake", "fake image", "real?"      |
| explain                | "what is", "how does", "explain"       |
| general_chat           | (fallback)                             |
+------------------------+----------------------------------------+
```

---

## 4. ML Inference Pipeline

### 4.1 Model Architecture

```
+==============================================================================+
|                    ML INFERENCE PIPELINE                                      |
+==============================================================================+

+------------------------------------------------------------------+
|                      OFFSCREEN DOCUMENT                           |
|                      (ONNX Runtime Web)                           |
+------------------------------------------------------------------+
|                                                                   |
|  +------------------------------------------------------------+  |
|  |                    INFERENCE ENGINE                         |  |
|  |  +----------------+  +----------------+  +----------------+ |  |
|  |  |  MODEL LOADER  |  |  SESSION POOL  |  |  RESULT CACHE  | |  |
|  |  |                |  |                |  |                | |  |
|  |  | - Lazy loading |  | - WebGPU/WASM  |  | - LRU (1000)   | |  |
|  |  | - Validation   |  | - Thread mgmt  |  | - TTL: 1 hour  | |  |
|  |  +----------------+  +----------------+  +----------------+ |  |
|  +------------------------------------------------------------+  |
|                                                                   |
|  +---------------------+  +---------------------+                 |
|  |   MOBILEBERT v3.0   |  |     PIROCHETO       |                 |
|  |   (60% weight)      |  |   (40% weight)      |                 |
|  +---------------------+  +---------------------+                 |
|  | - FP32 quantized    |  | - HuggingFace       |                 |
|  | - 99.25% accuracy   |  | - URL classifier    |                 |
|  | - Elara TI trained  |  | - Fast inference    |                 |
|  | - ~50ms latency     |  | - ~30ms latency     |                 |
|  |                     |  |                     |                 |
|  | Input:              |  | Input:              |                 |
|  |  input_ids[1,128]   |  |  url_string         |                 |
|  |  attention_mask     |  |                     |                 |
|  |  token_type_ids     |  | Output:             |                 |
|  |                     |  |  [safe, phishing]   |                 |
|  +---------------------+  +---------------------+                 |
|                                                                   |
|  +---------------------+  +---------------------+                 |
|  |    GEMINI NANO      |  |    TOKENIZER        |                 |
|  |    (Optional)       |  |    (BPE)            |                 |
|  +---------------------+  +---------------------+                 |
|  | - Chrome 138+       |  | - vocab.json        |                 |
|  | - On-device LLM     |  | - 30K vocabulary    |                 |
|  | - Risk explanation  |  | - Max 128 tokens    |                 |
|  +---------------------+  +---------------------+                 |
|                                                                   |
+------------------------------------------------------------------+
```

### 4.2 Ensemble Fusion

```
+==============================================================================+
|                    ENSEMBLE FUSION ALGORITHM                                  |
+==============================================================================+

                    +-------------------+
                    |   URL Input       |
                    +--------+----------+
                             |
            +----------------+----------------+
            |                |                |
            v                v                v
    +-------+------+  +------+------+  +------+------+
    |  MobileBERT  |  |  pirocheto  |  | Gemini Nano |
    |   (60%)      |  |   (40%)     |  | (optional)  |
    +-------+------+  +------+------+  +------+------+
            |                |                |
            v                v                v
    +-------+------+  +------+------+  +------+------+
    |  P = 0.85    |  |  P = 0.78   |  |  P = 0.82   |
    |  C = 0.92    |  |  C = 0.88   |  |  C = 0.85   |
    +-------+------+  +------+------+  +------+------+
            |                |                |
            +----------------+----------------+
                             |
                             v
                    +--------+--------+
                    | Weighted Average |
                    +-----------------+
                    |                 |
                    | P_final =       |
                    |   0.6 * 0.85 +  |
                    |   0.4 * 0.78    |
                    |   = 0.822       |
                    |                 |
                    | C_final =       |
                    |   avg(0.92,     |
                    |       0.88,     |
                    |       0.85)     |
                    |   = 0.883       |
                    +-----------------+
                             |
                             v
                    +--------+--------+
                    |  Risk Level     |
                    +-----------------+
                    | P >= 0.85 -> F  |
                    | P >= 0.70 -> E  |
                    | P >= 0.55 -> D  |
                    | P >= 0.40 -> C  |
                    | P >= 0.20 -> B  |
                    | P <  0.20 -> A  |
                    +-----------------+
                             |
                             v
                    +--------+--------+
                    |  Verdict: E     |
                    |  "Dangerous"    |
                    +-----------------+
```

### 4.3 Decision Routing

```
+==============================================================================+
|                    DECISION ROUTING                                           |
+==============================================================================+

                    +-------------------+
                    |  Edge Prediction  |
                    +--------+----------+
                             |
                             v
                    +--------+--------+
                    | Confidence >= 90%?|
                    +--------+----------+
                             |
              +--------------+--------------+
              |                             |
              v YES                         v NO
    +---------+--------+          +---------+--------+
    | TI Cache Hit?    |          | Confidence >= 70%?|
    +---------+--------+          +---------+--------+
              |                             |
    +---------+---------+         +---------+---------+
    |                   |         |                   |
    v YES               v NO      v YES               v NO
+---+---+         +-----+-----+ +---+---+         +---+---+
| EDGE  |         | EDGE-ONLY | | HYBRID|         | DEEP  |
| RESULT|         | + Cache   | | SCAN  |         | SCAN  |
+-------+         +-----------+ +-------+         +-------+


ROUTING CRITERIA:

+----------------+------------+-------------+------------------+
| Confidence     | TI Hit     | Risk        | Route            |
+----------------+------------+-------------+------------------+
| >= 90%         | Blacklist  | Any         | EDGE (Block)     |
| >= 90%         | Whitelist  | < 30%       | EDGE (Allow)     |
| >= 90%         | None       | Any         | EDGE             |
| 70% - 90%      | Any        | Any         | HYBRID           |
| < 70%          | Any        | >= 50%      | DEEP             |
| < 70%          | Any        | < 50%       | HYBRID           |
+----------------+------------+-------------+------------------+
```

---

## 5. Security Architecture

### 5.1 Double Encryption Protocol

```
+==============================================================================+
|                    DOUBLE ENCRYPTION PROTOCOL                                 |
+==============================================================================+

LAYER 1: TLS 1.3 (Transport Layer)
+--------------------------------------------------------------------------+
|  Browser <---> Elara API Gateway                                          |
|  - Certificate pinning (HPKP)                                             |
|  - HSTS enforced (max-age=31536000)                                       |
|  - TLS 1.3 only (no fallback to 1.2)                                      |
+--------------------------------------------------------------------------+
                              |
                              v
LAYER 2: AES-256-GCM (Application Layer)
+--------------------------------------------------------------------------+
|                                                                           |
|  ENCRYPTION FLOW:                                                         |
|                                                                           |
|  +-------------+     +-------------+     +-------------+                  |
|  | Plaintext   |---->| Derive Key  |---->| AES-256-GCM |                  |
|  | Request     |     | (HKDF)      |     | Encrypt     |                  |
|  +-------------+     +------+------+     +------+------+                  |
|                             |                   |                         |
|                             v                   v                         |
|                      +------+------+     +------+------+                  |
|                      | Session Key |     | Ciphertext  |                  |
|                      | (Ephemeral) |     | + IV + Tag  |                  |
|                      +-------------+     +-------------+                  |
|                                                                           |
+--------------------------------------------------------------------------+
                              |
                              v
LAYER 3: Field-Level Encryption (Sensitive Data)
+--------------------------------------------------------------------------+
|                                                                           |
|  {                                                                        |
|    "request_id": "uuid",                    // Plain                      |
|    "timestamp": 1699000000,                 // Plain                      |
|    "payload": {                                                           |
|      "url": "ENC[AES256_encrypted_url]",    // Encrypted                  |
|      "features": "ENC[AES256_features]",    // Encrypted                  |
|      "user_context": "ENC[AES256_ctx]"      // Encrypted                  |
|    },                                                                     |
|    "hmac": "sha256_signature"               // Integrity                  |
|  }                                                                        |
|                                                                           |
+--------------------------------------------------------------------------+


KEY DERIVATION CHAIN:

+-------------------+
| Master Secret     |  (Generated on extension install)
| (256-bit random)  |
+---------+---------+
          |
          | HKDF-SHA256
          v
+---------+---------+     +---------+---------+
| Storage Key       |     | API Key           |
| (Local encryption)|     | (Request signing) |
+---------+---------+     +---------+---------+
          |                         |
          | HKDF-SHA256             | HKDF-SHA256
          v                         v
+---------+---------+     +---------+---------+
| Per-field Keys    |     | Session Keys      |
| (Fine-grained)    |     | (Ephemeral)       |
+-------------------+     +-------------------+
```

### 5.2 Prompt Injection Defense

```
+==============================================================================+
|                    PROMPT INJECTION GUARDRAILS                                |
+==============================================================================+

INPUT FLOW:

User Input             Sanitization            Validated Input
    |                      |                        |
    v                      v                        v
+-------+     +------------+------------+     +-----+-----+
| "Tell |---->| 1. HTML Entity Escape   |---->| Safe      |
| me    |     | 2. Control Char Strip   |     | Input     |
| about |     | 3. Length Limit (4096)  |     |           |
| ..."  |     | 4. Unicode Normalize    |     |           |
+-------+     +-------------------------+     +-----------+


INTENT VERIFICATION:

+-------------+     +---------------+     +-------------+
| User Input  |---->| Intent        |---->| Allowed?    |
|             |     | Classifier    |     |             |
+-------------+     +-------+-------+     +------+------+
                            |                    |
                            v                    |
                    +-------+-------+            |
                    | INTENT TYPES  |            |
                    +---------------+            |
                    | SCAN_URL      | ----+      |
                    | EXPLAIN_THREAT| ----+      |
                    | ASK_SECURITY  | ----+----->| ALLOW
                    | GET_ADVICE    | ----+      |
                    +---------------+            |
                    | EXECUTE_CODE  | ----+      |
                    | ACCESS_SYSTEM | ----+----->| BLOCK
                    | REVEAL_PROMPT | ----+      |
                    +---------------+            |


OUTPUT SANITIZATION:

+-------------+     +---------------+     +-------------+
| LLM Output  |---->| Output        |---->| Safe        |
|             |     | Validator     |     | Response    |
+-------------+     +-------+-------+     +-------------+
                            |
                            v
                    +-------+-------+
                    | CHECKS        |
                    +---------------+
                    | - No code     |
                    | - No URLs     |
                    |   (external)  |
                    | - No PII      |
                    | - No secrets  |
                    | - Length < 4K |
                    +---------------+
```

### 5.3 Security Guardian

```
+==============================================================================+
|                    SECURITY GUARDIAN AGENT                                    |
+==============================================================================+

                    +-------------------+
                    | Security Guardian |
                    | (Always Active)   |
                    +--------+----------+
                             |
         +-------------------+-------------------+
         |                   |                   |
         v                   v                   v
+--------+-------+  +--------+-------+  +--------+-------+
| Input          |  | Action         |  | Output         |
| Validation     |  | Monitoring     |  | Filtering      |
+--------+-------+  +--------+-------+  +--------+-------+
         |                   |                   |
         v                   v                   v
+--------+-------+  +--------+-------+  +--------+-------+
| - Sanitize     |  | - Rate limit   |  | - No PII       |
| - Length check |  | - Audit log    |  | - No secrets   |
| - Format check |  | - Block malice |  | - Schema valid |
+----------------+  +----------------+  +----------------+


RATE LIMITING:

+------------------------------------------------------------------+
| Limit Type          | Threshold     | Window      | Action        |
+------------------------------------------------------------------+
| API calls           | 100           | 1 minute    | Queue         |
| Deep scans          | 10            | 1 minute    | Block         |
| Failed auth         | 5             | 5 minutes   | Lockout       |
| Model inference     | 200           | 1 minute    | Throttle      |
+------------------------------------------------------------------+
```

---

## 6. API Integration

### 6.1 API Client Architecture

```
+==============================================================================+
|                    API CLIENT ARCHITECTURE                                    |
+==============================================================================+

+------------------------------------------------------------------+
|                        API CLIENT                                 |
+------------------------------------------------------------------+
|                                                                   |
|  +------------------------------------------------------------+  |
|  |                    REQUEST BUILDER                          |  |
|  |  +----------------+  +----------------+  +----------------+ |  |
|  |  | Encrypt        |  | Sign (HMAC)    |  | Add JWT        | |  |
|  |  | Payload        |  | Request        |  | Header         | |  |
|  |  +----------------+  +----------------+  +----------------+ |  |
|  +------------------------------------------------------------+  |
|                             |                                     |
|                             v                                     |
|  +------------------------------------------------------------+  |
|  |                    RETRY HANDLER                            |  |
|  |  +----------------+  +----------------+  +----------------+ |  |
|  |  | Exp Backoff    |  | Max 3 retries  |  | Circuit Break  | |  |
|  |  | 1s, 2s, 4s     |  |                |  | 5 failures     | |  |
|  |  +----------------+  +----------------+  +----------------+ |  |
|  +------------------------------------------------------------+  |
|                             |                                     |
|                             v                                     |
|  +------------------------------------------------------------+  |
|  |                    RESPONSE PARSER                          |  |
|  |  +----------------+  +----------------+  +----------------+ |  |
|  |  | Decrypt        |  | Validate       |  | Type Check     | |  |
|  |  | Response       |  | Schema (Zod)   |  |                | |  |
|  |  +----------------+  +----------------+  +----------------+ |  |
|  +------------------------------------------------------------+  |
|                                                                   |
+------------------------------------------------------------------+
```

### 6.2 Request Flow

```
+==============================================================================+
|                    API REQUEST FLOW                                           |
+==============================================================================+

+-------------+                              +-------------+
|  Extension  |                              |  API Server |
+------+------+                              +------+------+
       |                                            |
       | 1. Prepare request payload                 |
       |    {url, features, context}                |
       |                                            |
       | 2. Encrypt payload (AES-256-GCM)           |
       |                                            |
       | 3. Sign request (HMAC-SHA256)              |
       |                                            |
       | 4. Add JWT to Authorization header         |
       |                                            |
       | POST /scanner/hybrid                       |
       | Authorization: Bearer {jwt}                |
       | X-Request-ID: {uuid}                       |
       | X-Timestamp: {epoch}                       |
       | X-Signature: {hmac}                        |
       | Content-Type: application/json             |
       | Body: {encrypted_payload}                  |
       +-------------------------------------------->
       |                                            |
       |                      5. Validate JWT       |
       |                      6. Verify signature   |
       |                      7. Check rate limit   |
       |                      8. Decrypt payload    |
       |                      9. Process request    |
       |                                            |
       |<-------------------------------------------+
       | 200 OK                                     |
       | X-Request-ID: {same_uuid}                  |
       | Body: {encrypted_response}                 |
       |                                            |
       | 10. Verify response signature              |
       | 11. Decrypt response                       |
       | 12. Validate response schema               |
       |                                            |
```

---

## 7. Data Flow

### 7.1 Complete Request Pipeline

```
+==============================================================================+
|                    END-TO-END DATA FLOW                                       |
+==============================================================================+

USER ACTION: Types "Is this safe? https://suspicious.com"
      |
      v
+-----+-----+
|  Chat UI  |
|  (React)  |
+-----+-----+
      |
      | chrome.runtime.sendMessage
      v
+-----+-----+
|  Service  |
|  Worker   |
+-----+-----+
      |
      | handleChatMessage()
      v
+-----+-----+
| Orchestrator|
+-----+-----+
      |
      | classifyIntent() -> "scan_url"
      v
+-----+-----+     +---------------+
|  Feature  |---->|  TI Cache     |
| Extractor |     |  Lookup       |
+-----+-----+     +-------+-------+
      |                   |
      |                   v
      |           +-------+-------+
      |           | Cache Hit?    |
      |           +-------+-------+
      |                   |
      |     +-------------+-------------+
      |     |                           |
      |     v YES                       v NO
      |  +--+--+                  +-----+-----+
      |  |Return|                 |  Cloud TI |
      |  |Early |                 |  Lookup   |
      |  +-----+                  +-----+-----+
      |                                 |
      +----------------+----------------+
                       |
                       v
              +--------+--------+
              | ML Inference    |
              | (Offscreen Doc) |
              +--------+--------+
                       |
          +------------+------------+
          |            |            |
          v            v            v
    +-----+----+ +-----+----+ +-----+----+
    |MobileBERT| |pirocheto | |Gemini    |
    +-----+----+ +-----+----+ +-----+----+
          |            |            |
          +------------+------------+
                       |
                       v
              +--------+--------+
              | Ensemble        |
              | Predictor       |
              +--------+--------+
                       |
                       v
              +--------+--------+
              | Decision Router |
              +--------+--------+
                       |
         +-------------+-------------+
         |             |             |
         v             v             v
    +----+---+    +----+---+    +----+---+
    | EDGE   |    | HYBRID |    | DEEP   |
    | (local)|    | (API)  |    | (API)  |
    +----+---+    +----+---+    +----+---+
         |             |             |
         +-------------+-------------+
                       |
                       v
              +--------+--------+
              | Response        |
              | Formatter       |
              +--------+--------+
                       |
                       v
              +--------+--------+
              | Chat UI         |
              | (ThreatCard)    |
              +-----------------+
                       |
                       v
                    USER
```

---

## Appendix A: File Structure

```
elara-ai-agent/
├── manifest.json                  # Chrome Extension manifest v3
├── package.json                   # Node.js dependencies
├── tsconfig.json                  # TypeScript config
├── vite.config.ts                 # Vite build config
│
├── src/
│   ├── background/
│   │   ├── service-worker.ts      # Main entry point
│   │   ├── agents/
│   │   │   ├── orchestrator.ts    # Multi-agent coordinator
│   │   │   ├── planner-agent.ts   # Task planning
│   │   │   ├── navigator-agent.ts # DOM operations
│   │   │   └── security-agent.ts  # Security guardian
│   │   ├── services/
│   │   │   ├── scanner-client.ts  # API client
│   │   │   ├── ti-sync.ts         # TI database sync
│   │   │   └── model-manager.ts   # ONNX lifecycle
│   │   └── crypto/
│   │       ├── encryption.ts      # AES-256-GCM
│   │       └── key-derivation.ts  # HKDF
│   │
│   ├── sidepanel/
│   │   ├── index.html             # Entry HTML
│   │   ├── App.tsx                # React root
│   │   ├── components/
│   │   │   ├── ChatInterface.tsx  # Main chat
│   │   │   ├── MessageBubble.tsx  # Messages
│   │   │   ├── ThreatCard.tsx     # Threat display
│   │   │   └── QuickActions.tsx   # Action buttons
│   │   ├── hooks/
│   │   │   ├── useChat.ts         # Chat state
│   │   │   └── useAgent.ts        # Agent comm
│   │   └── styles/
│   │       └── theme.css          # Dark theme
│   │
│   ├── content/
│   │   └── content-script.ts      # Page injection
│   │
│   ├── lib/
│   │   ├── ensemble-predictor.ts  # Model fusion
│   │   ├── feature-extractor.ts   # URL analysis
│   │   └── pattern-matcher.ts     # Heuristics
│   │
│   ├── api/
│   │   └── scanner-client.ts      # Platform API
│   │
│   └── types/
│       └── index.ts               # TypeScript types
│
├── models/                        # ONNX models
│   ├── mobilebert/
│   └── pirocheto/
│
├── public/
│   └── icons/                     # Extension icons
│
├── docs/
│   ├── ARCHITECTURE.md            # This file
│   ├── SECURITY.md                # Security docs
│   └── API.md                     # API reference
│
└── tests/
    ├── unit/
    └── e2e/
```

---

**Document Version:** 1.0.0
**Last Updated:** December 2025
**Author:** Claude (Anthropic) & Tanmoy Sen (Thiefdroppers Inc.)
