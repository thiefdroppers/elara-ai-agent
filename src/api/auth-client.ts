/**
 * Elara AI Agent - Authentication Client
 *
 * Handles CSRF + session-based authentication with the Elara Platform API.
 * Based on working Python implementation in test_ti_lookup.py
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

// Default admin credentials (as per CLAUDE.md)
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
      // Try to load stored tokens
      if (typeof chrome !== 'undefined' && chrome.storage) {
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

          console.log('[AuthClient] Restored tokens from storage');

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

    // If no token, try to login with default credentials
    if (!this.accessToken) {
      console.log('[AuthClient] No token found, attempting auto-login...');
      const result = await this.login();
      if (!result.success) {
        console.error('[AuthClient] Auto-login failed:', result.error);
        return null;
      }
    }

    // If token is expired or about to expire (< 5 minutes), re-authenticate
    if (this.isTokenExpired(300)) {
      console.log('[AuthClient] Token expired or expiring soon, re-authenticating...');
      const result = await this.login();
      if (!result.success) {
        console.error('[AuthClient] Re-authentication failed:', result.error);
        return null;
      }
    }

    return this.accessToken;
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
