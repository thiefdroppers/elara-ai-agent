/**
 * Elara AI Agent - Authentication Client
 *
 * IMPORTANT: This client reads auth tokens from Edge Engine's storage first.
 * If Edge Engine is logged in, AI Agent uses the same token.
 * This avoids duplicate authentication and ensures both extensions share auth.
 *
 * Edge Engine storage keys:
 * - auth_accessToken
 * - auth_refreshToken
 * - auth_expiresAt
 * - auth_user
 */

// ============================================================================
// TYPES
// ============================================================================

interface LoginResponse {
  success: boolean;
  accessToken: string;
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

interface CSRFResponse {
  csrfToken: string;
}

interface AuthCredentials {
  email: string;
  password: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE_URL = 'https://dev-api.thiefdroppers.com';

// Edge Engine storage keys (shared auth)
const EDGE_ENGINE_STORAGE_KEYS = {
  accessToken: 'auth_accessToken',
  refreshToken: 'auth_refreshToken',
  expiresAt: 'auth_expiresAt',
  user: 'auth_user',
};

// Fallback credentials for extension login endpoint
const DEFAULT_CREDENTIALS: AuthCredentials = {
  email: 'admin@oelara.com',
  password: 'ElaraAdmin2025!',
};

// ============================================================================
// AUTH CLIENT CLASS
// ============================================================================

class AuthClient {
  private accessToken: string | null = null;
  private csrfToken: string | null = null;
  private sessionCookie: string | null = null;
  private tokenExpiry: number = 0;
  private isInitialized = false;

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        // FIRST: Try to get token from Edge Engine storage (shared auth)
        const edgeResult = await chrome.storage.local.get([
          EDGE_ENGINE_STORAGE_KEYS.accessToken,
          EDGE_ENGINE_STORAGE_KEYS.refreshToken,
          EDGE_ENGINE_STORAGE_KEYS.expiresAt,
          EDGE_ENGINE_STORAGE_KEYS.user,
        ]);

        if (edgeResult[EDGE_ENGINE_STORAGE_KEYS.accessToken]) {
          this.accessToken = edgeResult[EDGE_ENGINE_STORAGE_KEYS.accessToken];
          this.tokenExpiry = parseInt(edgeResult[EDGE_ENGINE_STORAGE_KEYS.expiresAt]) || 0;

          console.log('[AuthClient] Using token from Edge Engine storage');

          // Check if token is expired
          if (!this.isTokenExpired()) {
            console.log('[AuthClient] Edge Engine token is valid');
            this.isInitialized = true;
            return;
          } else {
            console.log('[AuthClient] Edge Engine token expired');
            this.accessToken = null;
          }
        }

        // FALLBACK: Try AI Agent's own storage
        const result = await chrome.storage.local.get([
          'elara_access_token',
          'elara_csrf_token',
          'elara_session_cookie',
          'elara_token_expiry',
        ]);

        if (result.elara_access_token) {
          this.accessToken = result.elara_access_token;
          this.csrfToken = result.elara_csrf_token || null;
          this.sessionCookie = result.elara_session_cookie || null;
          this.tokenExpiry = result.elara_token_expiry || 0;

          console.log('[AuthClient] Restored tokens from AI Agent storage');

          // Check if token is expired
          if (this.isTokenExpired()) {
            console.log('[AuthClient] Stored token expired, will re-authenticate on first use');
            this.accessToken = null;
          }
        }
      }

      this.isInitialized = true;
      console.log('[AuthClient] Initialized');
    } catch (error) {
      console.error('[AuthClient] Initialization failed:', error);
      this.isInitialized = true; // Still mark as initialized
    }
  }

  // --------------------------------------------------------------------------
  // Authentication Flow (CSRF + Session-based)
  // --------------------------------------------------------------------------

  async login(credentials?: AuthCredentials): Promise<{ success: boolean; error?: string }> {
    const creds = credentials || DEFAULT_CREDENTIALS;

    try {
      console.log('[AuthClient] Starting login flow...');

      // Step 1: Get CSRF token
      const csrfToken = await this.fetchCSRFToken();
      if (!csrfToken) {
        return { success: false, error: 'Failed to obtain CSRF token' };
      }

      console.log('[AuthClient] Got CSRF token');
      this.csrfToken = csrfToken;

      // Step 2: Login with CSRF token
      const response = await fetch(`${API_BASE_URL}/api/v2/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          email: creds.email,
          password: creds.password,
        }),
        credentials: 'include', // Important for cookies
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AuthClient] Login failed:', response.status, errorText);
        return { success: false, error: `Login failed: ${response.status}` };
      }

      const data: LoginResponse = await response.json();

      if (!data.success || !data.accessToken) {
        return { success: false, error: 'No access token in response' };
      }

      // Extract session cookie from Set-Cookie header (if available)
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        this.sessionCookie = setCookie;
      }

      await this.storeTokens({
        accessToken: data.accessToken,
        csrfToken,
        sessionCookie: this.sessionCookie,
      });

      console.log('[AuthClient] Login successful');
      return { success: true };
    } catch (error) {
      console.error('[AuthClient] Login error:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Fetch CSRF token from API
   */
  private async fetchCSRFToken(): Promise<string | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/csrf-token`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        console.warn('[AuthClient] CSRF token fetch failed');
        return null;
      }

      const data: CSRFResponse = await response.json();
      return data.csrfToken || null;
    } catch (error) {
      console.error('[AuthClient] CSRF token fetch error:', error);
      return null;
    }
  }

  async ensureValidToken(): Promise<string | null> {
    await this.initialize();

    // If we have a valid token, return it
    if (this.accessToken && !this.isTokenExpired(300)) {
      return this.accessToken;
    }

    // Try to refresh from Edge Engine storage (user might have logged in there)
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const edgeResult = await chrome.storage.local.get([
        EDGE_ENGINE_STORAGE_KEYS.accessToken,
        EDGE_ENGINE_STORAGE_KEYS.expiresAt,
      ]);

      if (edgeResult[EDGE_ENGINE_STORAGE_KEYS.accessToken]) {
        const expiresAt = parseInt(edgeResult[EDGE_ENGINE_STORAGE_KEYS.expiresAt]) || 0;
        if (Date.now() < expiresAt) {
          this.accessToken = edgeResult[EDGE_ENGINE_STORAGE_KEYS.accessToken];
          this.tokenExpiry = expiresAt;
          console.log('[AuthClient] Got fresh token from Edge Engine storage');
          return this.accessToken;
        }
      }
    }

    // No valid token from Edge Engine - try extension login endpoint
    if (!this.accessToken) {
      console.log('[AuthClient] No token found, attempting extension login...');
      const result = await this.extensionLogin();
      if (!result.success) {
        console.error('[AuthClient] Extension login failed:', result.error);
        return null;
      }
    }

    return this.accessToken;
  }

  /**
   * Login using the extension-specific endpoint (no CSRF required)
   */
  private async extensionLogin(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('[AuthClient] Using extension login endpoint...');

      const response = await fetch(`${API_BASE_URL}/api/v2/auth/extension/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: DEFAULT_CREDENTIALS.email,
          password: DEFAULT_CREDENTIALS.password,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AuthClient] Extension login failed:', response.status, errorText);
        return { success: false, error: `Login failed: ${response.status}` };
      }

      const data = await response.json();

      if (!data.accessToken) {
        return { success: false, error: 'No access token in response' };
      }

      // Calculate expiry (default 30 min if not provided)
      const expiresIn = data.expiresIn || 1800; // seconds
      this.accessToken = data.accessToken;
      this.tokenExpiry = Date.now() + expiresIn * 1000;

      // Store in AI Agent storage
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.set({
          elara_access_token: this.accessToken,
          elara_token_expiry: this.tokenExpiry,
        });
      }

      console.log('[AuthClient] Extension login successful');
      return { success: true };
    } catch (error) {
      console.error('[AuthClient] Extension login error:', error);
      return { success: false, error: String(error) };
    }
  }

  // --------------------------------------------------------------------------
  // Token Management
  // --------------------------------------------------------------------------

  private async storeTokens(data: {
    accessToken: string;
    csrfToken: string;
    sessionCookie: string | null;
  }): Promise<void> {
    this.accessToken = data.accessToken;
    this.csrfToken = data.csrfToken;
    this.sessionCookie = data.sessionCookie;
    // Set expiry to 24 hours from now (session-based, so conservative)
    this.tokenExpiry = Date.now() + 24 * 60 * 60 * 1000;

    // Persist to storage
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({
        elara_access_token: this.accessToken,
        elara_csrf_token: this.csrfToken,
        elara_session_cookie: this.sessionCookie,
        elara_token_expiry: this.tokenExpiry,
      });
    }
  }

  private isTokenExpired(bufferSeconds = 0): boolean {
    if (!this.accessToken || this.tokenExpiry === 0) {
      return true;
    }
    return Date.now() >= this.tokenExpiry - bufferSeconds * 1000;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getCSRFToken(): string | null {
    return this.csrfToken;
  }

  async logout(): Promise<void> {
    this.accessToken = null;
    this.csrfToken = null;
    this.sessionCookie = null;
    this.tokenExpiry = 0;

    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.remove([
        'elara_access_token',
        'elara_csrf_token',
        'elara_session_cookie',
        'elara_token_expiry',
      ]);
    }

    console.log('[AuthClient] Logged out');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const authClient = new AuthClient();
