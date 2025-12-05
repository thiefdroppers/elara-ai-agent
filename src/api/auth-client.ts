/**
 * Elara AI Agent - Authentication Client
 *
 * Handles OAuth2 authentication with the Elara Platform API.
 * Supports password grant flow and automatic token refresh.
 */

// ============================================================================
// TYPES
// ============================================================================

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

interface AuthCredentials {
  email: string;
  password: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE_URL = 'https://dev-api.thiefdroppers.com/api/v2';
const CLIENT_ID = 'elara-extension';

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
  private refreshToken: string | null = null;
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
          'elara_refresh_token',
          'elara_token_expiry',
        ]);

        if (result.elara_access_token) {
          this.accessToken = result.elara_access_token;
          this.refreshToken = result.elara_refresh_token || null;
          this.tokenExpiry = result.elara_token_expiry || 0;

          console.log('[AuthClient] Restored tokens from storage');

          // Check if token is expired
          if (this.isTokenExpired()) {
            console.log('[AuthClient] Stored token expired, will refresh on first use');
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
  // Authentication Flow
  // --------------------------------------------------------------------------

  async login(credentials?: AuthCredentials): Promise<{ success: boolean; error?: string }> {
    const creds = credentials || DEFAULT_CREDENTIALS;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'password',
          email: creds.email,
          password: creds.password,
          client_id: CLIENT_ID,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AuthClient] Login failed:', errorText);
        return { success: false, error: `Login failed: ${response.status}` };
      }

      const data: TokenResponse = await response.json();
      await this.storeTokens(data);

      console.log('[AuthClient] Login successful');
      return { success: true };
    } catch (error) {
      console.error('[AuthClient] Login error:', error);
      return { success: false, error: String(error) };
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

    // If token is expired or about to expire (< 5 minutes), refresh it
    if (this.isTokenExpired(300)) {
      console.log('[AuthClient] Token expired or expiring soon, refreshing...');
      const refreshed = await this.refreshAccessToken();
      if (!refreshed) {
        console.log('[AuthClient] Refresh failed, attempting re-login...');
        const result = await this.login();
        if (!result.success) {
          console.error('[AuthClient] Re-login failed:', result.error);
          return null;
        }
      }
    }

    return this.accessToken;
  }

  async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) {
      console.warn('[AuthClient] No refresh token available');
      return false;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
        }),
      });

      if (!response.ok) {
        console.error('[AuthClient] Token refresh failed:', response.status);
        return false;
      }

      const data: TokenResponse = await response.json();
      await this.storeTokens(data);

      console.log('[AuthClient] Token refreshed successfully');
      return true;
    } catch (error) {
      console.error('[AuthClient] Token refresh error:', error);
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // Token Management
  // --------------------------------------------------------------------------

  private async storeTokens(data: TokenResponse): Promise<void> {
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token || this.refreshToken;
    this.tokenExpiry = Date.now() + data.expires_in * 1000;

    // Persist to storage
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({
        elara_access_token: this.accessToken,
        elara_refresh_token: this.refreshToken,
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

  async logout(): Promise<void> {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = 0;

    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.remove([
        'elara_access_token',
        'elara_refresh_token',
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
