/**
 * Elara AI Agent - AES-256-GCM Encryption Module
 *
 * Provides enterprise-grade encryption for sensitive data storage
 * and API communication using the Web Crypto API.
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 128; // bits
const STORAGE_KEY_NAME = 'elara_master_key';

// ============================================================================
// KEY MANAGEMENT
// ============================================================================

/**
 * Generate a new AES-256 encryption key
 */
export async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Export key to raw bytes for storage
 */
export async function exportKey(key: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.exportKey('raw', key);
}

/**
 * Import key from raw bytes
 */
export async function importKey(keyData: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Get or create the master encryption key
 */
async function getMasterKey(): Promise<CryptoKey> {
  // Check if we're in a Chrome extension context
  if (typeof chrome !== 'undefined' && chrome.storage) {
    const stored = await chrome.storage.local.get([STORAGE_KEY_NAME]);

    if (stored[STORAGE_KEY_NAME]) {
      const keyData = base64ToArrayBuffer(stored[STORAGE_KEY_NAME]);
      return importKey(keyData);
    }

    // Generate new key
    const key = await generateKey();
    const exported = await exportKey(key);
    const base64Key = arrayBufferToBase64(exported);

    await chrome.storage.local.set({ [STORAGE_KEY_NAME]: base64Key });
    return key;
  }

  // Fallback for non-extension context (testing)
  return generateKey();
}

// ============================================================================
// ENCRYPTION / DECRYPTION
// ============================================================================

export interface EncryptedData {
  iv: string;
  ciphertext: string;
}

/**
 * Encrypt a string value using AES-256-GCM
 */
export async function encrypt(
  plaintext: string,
  key?: CryptoKey
): Promise<EncryptedData> {
  const cryptoKey = key || (await getMasterKey());
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encodedData = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    cryptoKey,
    encodedData
  );

  return {
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(ciphertext),
  };
}

/**
 * Decrypt an encrypted value using AES-256-GCM
 */
export async function decrypt(
  encrypted: EncryptedData,
  key?: CryptoKey
): Promise<string> {
  const cryptoKey = key || (await getMasterKey());
  const iv = base64ToArrayBuffer(encrypted.iv);
  const ciphertext = base64ToArrayBuffer(encrypted.ciphertext);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    cryptoKey,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

// ============================================================================
// SECURE STORAGE
// ============================================================================

interface SecureStorageInterface {
  setItem<T>(key: string, value: T): Promise<void>;
  getItem<T>(key: string): Promise<T | null>;
  removeItem(key: string): Promise<void>;
}

function createSecureStorage(): SecureStorageInterface {
  let cachedKey: CryptoKey | null = null;

  const getKey = async (): Promise<CryptoKey> => {
    if (!cachedKey) {
      cachedKey = await getMasterKey();
    }
    return cachedKey;
  };

  return {
    async setItem<T>(key: string, value: T): Promise<void> {
      const cryptoKey = await getKey();
      const serialized = JSON.stringify(value);
      const encrypted = await encrypt(serialized, cryptoKey);

      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.set({ [`secure_${key}`]: encrypted });
      } else {
        localStorage.setItem(`secure_${key}`, JSON.stringify(encrypted));
      }
    },

    async getItem<T>(key: string): Promise<T | null> {
      const cryptoKey = await getKey();
      let encrypted: EncryptedData | null = null;

      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await chrome.storage.local.get([`secure_${key}`]);
        encrypted = result[`secure_${key}`] || null;
      } else {
        const stored = localStorage.getItem(`secure_${key}`);
        encrypted = stored ? JSON.parse(stored) : null;
      }

      if (!encrypted) return null;

      try {
        const decrypted = await decrypt(encrypted, cryptoKey);
        return JSON.parse(decrypted) as T;
      } catch (error) {
        console.error('[SecureStorage] Decryption failed:', error);
        return null;
      }
    },

    async removeItem(key: string): Promise<void> {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.remove([`secure_${key}`]);
      } else {
        localStorage.removeItem(`secure_${key}`);
      }
    },
  };
}

export const secureStorage = createSecureStorage();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ============================================================================
// HMAC SIGNING (for API requests)
// ============================================================================

/**
 * Generate HMAC-SHA256 signature for request signing
 */
export async function signRequest(
  data: string,
  secretKey: string
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const messageData = encoder.encode(data);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  return arrayBufferToBase64(signature);
}

/**
 * Verify HMAC-SHA256 signature
 */
export async function verifySignature(
  data: string,
  signature: string,
  secretKey: string
): Promise<boolean> {
  const computed = await signRequest(data, secretKey);
  return computed === signature;
}
