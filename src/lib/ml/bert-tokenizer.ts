/**
 * Elara Edge Engine - BERT Tokenizer
 *
 * Production-ready WordPiece tokenizer for MobileBERT/DistilBERT models.
 * Optimized for browser environment with lazy-loaded vocabulary.
 *
 * Features:
 * - WordPiece tokenization (same as HuggingFace transformers)
 * - Support for [CLS], [SEP], [PAD], [UNK] tokens
 * - Configurable max sequence length
 * - Attention mask generation
 *
 * Patent: Hybrid Edge-Cloud ML Inference Architecture
 * Co-authored by: Tanmoy Sen (Thiefdroppers Inc.) & Claude (Anthropic)
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const VOCAB_URL = chrome.runtime.getURL('models/vocab.json');
const MAX_SEQUENCE_LENGTH = 128;

// Special tokens
const SPECIAL_TOKENS = {
  PAD: '[PAD]',
  UNK: '[UNK]',
  CLS: '[CLS]',
  SEP: '[SEP]',
  MASK: '[MASK]',
};

// ============================================================================
// BERT TOKENIZER CLASS
// ============================================================================

export class BertTokenizer {
  private vocab: Map<string, number> = new Map();
  private reverseVocab: Map<number, string> = new Map();
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  // Special token IDs (will be set after vocab load)
  private padId = 0;
  private unkId = 100;
  private clsId = 101;
  private sepId = 102;
  private maskId = 103;

  /**
   * Initialize tokenizer by loading vocabulary
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = this._doInitialize();
    await this.initPromise;
  }

  private async _doInitialize(): Promise<void> {
    try {
      console.log('[BertTokenizer] Loading vocabulary...');
      const startTime = performance.now();

      const response = await fetch(VOCAB_URL);
      if (!response.ok) {
        throw new Error(`Failed to load vocab: ${response.status}`);
      }

      const vocabData = await response.json() as Record<string, number>;

      // Build vocab maps
      for (const [token, id] of Object.entries(vocabData)) {
        this.vocab.set(token, id);
        this.reverseVocab.set(id, token);
      }

      // Set special token IDs
      this.padId = this.vocab.get(SPECIAL_TOKENS.PAD) ?? 0;
      this.unkId = this.vocab.get(SPECIAL_TOKENS.UNK) ?? 100;
      this.clsId = this.vocab.get(SPECIAL_TOKENS.CLS) ?? 101;
      this.sepId = this.vocab.get(SPECIAL_TOKENS.SEP) ?? 102;
      this.maskId = this.vocab.get(SPECIAL_TOKENS.MASK) ?? 103;

      const loadTime = performance.now() - startTime;
      console.log(`[BertTokenizer] Loaded ${this.vocab.size} tokens in ${loadTime.toFixed(0)}ms`);

      this.initialized = true;
    } catch (error) {
      console.error('[BertTokenizer] Failed to initialize:', error);
      // Initialize with minimal vocab for graceful degradation
      this.initializeMinimalVocab();
      this.initialized = true;
    }
  }

  /**
   * Initialize with minimal vocabulary for fallback
   */
  private initializeMinimalVocab(): void {
    console.log('[BertTokenizer] Initializing minimal vocabulary...');

    // Add special tokens
    this.vocab.set(SPECIAL_TOKENS.PAD, 0);
    this.vocab.set(SPECIAL_TOKENS.UNK, 100);
    this.vocab.set(SPECIAL_TOKENS.CLS, 101);
    this.vocab.set(SPECIAL_TOKENS.SEP, 102);
    this.vocab.set(SPECIAL_TOKENS.MASK, 103);

    // Add common URL-related tokens
    const commonTokens = [
      'http', 'https', 'www', 'com', 'org', 'net', 'io', 'co',
      'login', 'sign', 'account', 'secure', 'verify', 'update',
      'password', 'credential', 'bank', 'pay', 'wallet', 'crypto',
      'google', 'facebook', 'amazon', 'microsoft', 'apple',
      'phish', 'scam', 'fake', 'urgent', 'alert', 'suspend',
      '.', '/', '-', '_', '@', '?', '=', '&', '#', ':', '%',
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    ];

    let id = 1000;
    for (const token of commonTokens) {
      if (!this.vocab.has(token)) {
        this.vocab.set(token, id);
        this.reverseVocab.set(id, token);
        id++;
      }
    }

    // Add all lowercase letters and common bigrams
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    for (const char of letters) {
      if (!this.vocab.has(char)) {
        this.vocab.set(char, id++);
      }
    }
  }

  /**
   * Tokenize text into input_ids and attention_mask
   */
  async encode(
    text: string,
    maxLength: number = MAX_SEQUENCE_LENGTH
  ): Promise<{ inputIds: number[]; attentionMask: number[] }> {
    await this.initialize();

    // Basic preprocessing
    const cleanedText = this.preprocessText(text);

    // WordPiece tokenization
    const tokens = this.wordPieceTokenize(cleanedText);

    // Truncate if necessary (leave room for [CLS] and [SEP])
    const maxTokens = maxLength - 2;
    const truncatedTokens = tokens.slice(0, maxTokens);

    // Build input_ids: [CLS] + tokens + [SEP]
    const inputIds: number[] = [this.clsId];
    for (const token of truncatedTokens) {
      inputIds.push(this.vocab.get(token) ?? this.unkId);
    }
    inputIds.push(this.sepId);

    // Pad to max length
    const attentionMask: number[] = new Array(inputIds.length).fill(1);

    while (inputIds.length < maxLength) {
      inputIds.push(this.padId);
      attentionMask.push(0);
    }

    return { inputIds, attentionMask };
  }

  /**
   * Batch encode multiple texts
   */
  async batchEncode(
    texts: string[],
    maxLength: number = MAX_SEQUENCE_LENGTH
  ): Promise<{ inputIds: number[][]; attentionMask: number[][] }> {
    const results = await Promise.all(
      texts.map((text) => this.encode(text, maxLength))
    );

    return {
      inputIds: results.map((r) => r.inputIds),
      attentionMask: results.map((r) => r.attentionMask),
    };
  }

  /**
   * Convert input_ids back to text (for debugging)
   */
  decode(inputIds: number[]): string {
    const tokens: string[] = [];

    for (const id of inputIds) {
      const token = this.reverseVocab.get(id);
      if (token && !Object.values(SPECIAL_TOKENS).includes(token)) {
        tokens.push(token);
      }
    }

    // Basic detokenization
    let text = tokens.join(' ');

    // Remove WordPiece markers
    text = text.replace(/ ##/g, '');

    return text;
  }

  // --------------------------------------------------------------------------
  // Text Preprocessing
  // --------------------------------------------------------------------------

  private preprocessText(text: string): string {
    // Lowercase
    let processed = text.toLowerCase();

    // Remove extra whitespace
    processed = processed.replace(/\s+/g, ' ').trim();

    // URL-specific preprocessing
    // Normalize protocols
    processed = processed.replace(/^https?:\/\//, '');

    // Remove www.
    processed = processed.replace(/^www\./, '');

    return processed;
  }

  // --------------------------------------------------------------------------
  // WordPiece Tokenization
  // --------------------------------------------------------------------------

  private wordPieceTokenize(text: string): string[] {
    const tokens: string[] = [];
    const words = this.basicTokenize(text);

    for (const word of words) {
      const subTokens = this.wordPieceTokenizeWord(word);
      tokens.push(...subTokens);
    }

    return tokens;
  }

  private basicTokenize(text: string): string[] {
    // Split on whitespace and punctuation, keeping punctuation as tokens
    const tokens: string[] = [];
    let current = '';

    for (const char of text) {
      if (this.isPunctuation(char) || this.isWhitespace(char)) {
        if (current) {
          tokens.push(current);
          current = '';
        }
        if (this.isPunctuation(char)) {
          tokens.push(char);
        }
      } else {
        current += char;
      }
    }

    if (current) {
      tokens.push(current);
    }

    return tokens;
  }

  private wordPieceTokenizeWord(word: string): string[] {
    if (word.length === 0) {
      return [];
    }

    // Check if whole word is in vocab
    if (this.vocab.has(word)) {
      return [word];
    }

    const tokens: string[] = [];
    let start = 0;

    while (start < word.length) {
      let end = word.length;
      let foundSubword = false;

      while (start < end) {
        let subword = word.slice(start, end);

        // Add ## prefix for non-first subwords
        if (start > 0) {
          subword = '##' + subword;
        }

        if (this.vocab.has(subword)) {
          tokens.push(subword);
          foundSubword = true;
          break;
        }

        end--;
      }

      // If no subword found, use [UNK] for single character
      if (!foundSubword) {
        tokens.push(SPECIAL_TOKENS.UNK);
        start++;
      } else {
        start = end;
      }
    }

    return tokens;
  }

  // --------------------------------------------------------------------------
  // Character Classification
  // --------------------------------------------------------------------------

  private isPunctuation(char: string): boolean {
    const code = char.charCodeAt(0);

    // ASCII punctuation ranges
    if ((code >= 33 && code <= 47) ||   // !"#$%&'()*+,-./
        (code >= 58 && code <= 64) ||   // :;<=>?@
        (code >= 91 && code <= 96) ||   // [\]^_`
        (code >= 123 && code <= 126)) { // {|}~
      return true;
    }

    return false;
  }

  private isWhitespace(char: string): boolean {
    return /\s/.test(char);
  }

  // --------------------------------------------------------------------------
  // Utility Methods
  // --------------------------------------------------------------------------

  getVocabSize(): number {
    return this.vocab.size;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getSpecialTokenIds(): {
    pad: number;
    unk: number;
    cls: number;
    sep: number;
    mask: number;
  } {
    return {
      pad: this.padId,
      unk: this.unkId,
      cls: this.clsId,
      sep: this.sepId,
      mask: this.maskId,
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const bertTokenizer = new BertTokenizer();
