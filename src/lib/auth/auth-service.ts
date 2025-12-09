/**
 * Elara Edge Engine - Authentication Service
 *
 * Comprehensive authentication service for the Chrome extension.
 * Handles login, registration, token management, OAuth, and state management.
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role?: string;
  createdAt: string;
  emailVerified?: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in milliseconds
}

export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  lastRefresh: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // Seconds
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export type AuthErrorType =
  | 'INVALID_CREDENTIALS'
  | 'NETWORK_ERROR'
  | 'TOKEN_EXPIRED'
  | 'REFRESH_FAILED'
  | 'UNAUTHORIZED'
  | 'VALIDATION_ERROR'
  | 'OAUTH_NOT_CONFIGURED'
  | 'UNKNOWN_ERROR';

export class AuthError extends Error {
  constructor(
    public type: AuthErrorType,
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export type AuthStateChangeListener = (state: AuthState) => void;

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE_URL = 'https://dev-api.thiefdroppers.com/api/v2';

const AUTH_ENDPOINTS = {
  // Extension-specific endpoints (no CSRF required)
  login: '/auth/extension/login',
  register: '/auth/extension/register',
  refresh: '/auth/extension/refresh',
  // Standard endpoints
  logout: '/auth/logout',
  me: '/auth/me',
  googleOAuth: '/auth/google/token-exchange', // POST endpoint for Chrome extension
} as const;

const STORAGE_KEYS = {
  accessToken: 'auth_accessToken',
  refreshToken: 'auth_refreshToken',
  expiresAt: 'auth_expiresAt',
  user: 'auth_user',
  lastRefresh: 'auth_lastRefresh',
} as const;

const CONFIG = {
  // Refresh token 5 minutes before expiry
  refreshBeforeExpiry: 5 * 60 * 1000, // 5 minutes in ms
  // Default token expiry if not provided
  defaultTokenExpiry: 30 * 60, // 30 minutes in seconds
  // Request timeout
  requestTimeout: 15000, // 15 seconds
} as const;

// ============================================================================
// AUTH SERVICE CLASS
// ============================================================================

export class AuthService {
  private state: AuthState = {
    user: null,
    tokens: null,
    isAuthenticated: false,
    lastRefresh: 0,
  };

  private listeners: Set<AuthStateChangeListener> = new Set();
  private refreshPromise: Promise<void> | null = null;
  private refreshTimer: number | null = null;
  private requestQueue: Array<() => void> = [];
  private isRefreshing = false;
  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  async initialize(): Promise<void> {
    console.log('[AuthService] Initializing...');

    try {
      // Load auth state from storage
      const stored = await chrome.storage.local.get([
        STORAGE_KEYS.accessToken,
        STORAGE_KEYS.refreshToken,
        STORAGE_KEYS.expiresAt,
        STORAGE_KEYS.user,
        STORAGE_KEYS.lastRefresh,
      ]);

      if (stored[STORAGE_KEYS.accessToken] && stored[STORAGE_KEYS.user]) {
        this.state = {
          user: JSON.parse(stored[STORAGE_KEYS.user]),
          tokens: {
            accessToken: stored[STORAGE_KEYS.accessToken],
            refreshToken: stored[STORAGE_KEYS.refreshToken] || '',
            expiresAt: parseInt(stored[STORAGE_KEYS.expiresAt]) || 0,
          },
          isAuthenticated: true,
          lastRefresh: parseInt(stored[STORAGE_KEYS.lastRefresh]) || 0,
        };

        console.log('[AuthService] Restored auth state from storage');

        // Check if token needs refresh
        await this.checkAndRefreshToken();

        // Schedule next refresh
        this.scheduleTokenRefresh();
      } else {
        console.log('[AuthService] No stored auth state found');
      }
    } catch (error) {
      console.error('[AuthService] Failed to initialize:', error);
      this.state = {
        user: null,
        tokens: null,
        isAuthenticated: false,
        lastRefresh: 0,
      };
    }

    console.log('[AuthService] Initialized');
  }

  // --------------------------------------------------------------------------
  // Authentication Methods
  // --------------------------------------------------------------------------

  async login(email: string, password: string): Promise<User> {
    console.log('[AuthService] Logging in...');

    try {
      const response = await this.fetchWithTimeout<LoginResponse>(
        AUTH_ENDPOINTS.login,
        {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        }
      );

      await this.handleAuthResponse(response);

      console.log('[AuthService] Login successful');
      return response.user;
    } catch (error) {
      console.error('[AuthService] Login failed:', error);
      throw this.normalizeError(error);
    }
  }

  async register(
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ): Promise<User> {
    console.log('[AuthService] Registering new user...');

    try {
      const response = await this.fetchWithTimeout<LoginResponse>(
        AUTH_ENDPOINTS.register,
        {
          method: 'POST',
          body: JSON.stringify({ email, password, firstName: firstName || "User", lastName: lastName || "", organizationName: "Personal" }),
        }
      );

      await this.handleAuthResponse(response);

      console.log('[AuthService] Registration successful');
      return response.user;
    } catch (error) {
      console.error('[AuthService] Registration failed:', error);
      throw this.normalizeError(error);
    }
  }

  async logout(): Promise<void> {
    console.log('[AuthService] Logging out...');

    try {
      // Attempt to notify server (best effort)
      if (this.state.tokens?.accessToken) {
        await this.fetchWithTimeout(AUTH_ENDPOINTS.logout, {
          method: 'POST',
        }).catch((err) => {
          console.warn('[AuthService] Server logout failed:', err);
        });
      }
    } finally {
      // Always clear local state
      await this.clearAuthState();
      console.log('[AuthService] Logout complete');
    }
  }

  async refreshToken(): Promise<void> {
    // Prevent concurrent refresh requests
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.executeTokenRefresh();

    try {
      await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async executeTokenRefresh(): Promise<void> {
    console.log('[AuthService] Refreshing access token...');

    if (!this.state.tokens?.refreshToken) {
      throw new AuthError('REFRESH_FAILED', 'No refresh token available');
    }

    this.isRefreshing = true;

    try {
      const response = await this.fetchWithTimeout<RefreshResponse>(
        AUTH_ENDPOINTS.refresh,
        {
          method: 'POST',
          body: JSON.stringify({
            refreshToken: this.state.tokens.refreshToken,
          }),
        }
      );

      // Update tokens
      const expiresAt = Date.now() + response.expiresIn * 1000;
      const tokens: AuthTokens = {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken || this.state.tokens.refreshToken,
        expiresAt,
      };

      this.state.tokens = tokens;
      this.state.lastRefresh = Date.now();

      // Persist to storage
      await chrome.storage.local.set({
        [STORAGE_KEYS.accessToken]: tokens.accessToken,
        [STORAGE_KEYS.refreshToken]: tokens.refreshToken,
        [STORAGE_KEYS.expiresAt]: tokens.expiresAt.toString(),
        [STORAGE_KEYS.lastRefresh]: this.state.lastRefresh.toString(),
      });

      console.log('[AuthService] Token refresh successful');

      // Process queued requests
      this.processRequestQueue();

      // Schedule next refresh
      this.scheduleTokenRefresh();
    } catch (error) {
      console.error('[AuthService] Token refresh failed:', error);

      // On refresh failure, logout user
      await this.clearAuthState();

      throw new AuthError('REFRESH_FAILED', 'Failed to refresh token');
    } finally {
      this.isRefreshing = false;
    }
  }

  async getCurrentUser(): Promise<User> {
    console.log('[AuthService] Fetching current user...');

    try {
      const response = await this.fetchWithTimeout<{ user: User }>(
        AUTH_ENDPOINTS.me,
        {
          method: 'GET',
        }
      );

      // Update stored user
      this.state.user = response.user;
      await chrome.storage.local.set({
        [STORAGE_KEYS.user]: JSON.stringify(response.user),
      });

      console.log('[AuthService] Current user fetched');
      return response.user;
    } catch (error) {
      console.error('[AuthService] Failed to fetch current user:', error);
      throw this.normalizeError(error);
    }
  }

  // --------------------------------------------------------------------------
  // OAuth Methods
  // --------------------------------------------------------------------------

  async initiateGoogleOAuth(): Promise<User> {
    console.log('[AuthService] Initiating Google OAuth via chrome.identity...');

    // Chrome extensions use the oauth2.client_id from manifest.json automatically
    // when calling chrome.identity.getAuthToken(). No env var needed.
    // The client_id is: 122460113662-e8fds1n2suqs53apv6sk49ru07dcco92.apps.googleusercontent.com

    try {
      // Use chrome.identity.getAuthToken for Chrome Extension OAuth clients
      // This is the recommended approach for extensions
      const googleAccessToken = await new Promise<string>((resolve, reject) => {
        chrome.identity.getAuthToken(
          { interactive: true },
          (token) => {
            if (chrome.runtime.lastError) {
              console.error('[AuthService] getAuthToken error:', chrome.runtime.lastError.message);
              reject(new Error(chrome.runtime.lastError.message || 'Failed to get auth token'));
            } else if (token) {
              console.log('[AuthService] Got Google access token');
              resolve(token);
            } else {
              reject(new Error('No token received from Google'));
            }
          }
        );
      });

      if (!googleAccessToken) {
        throw new Error('No access token in OAuth response');
      }

      // Exchange Google token with our backend for ThiefDroppers tokens
      const response = await this.fetchWithTimeout<LoginResponse>(
        AUTH_ENDPOINTS.googleOAuth,
        {
          method: 'POST',
          body: JSON.stringify({ googleAccessToken }),
        }
      );

      await this.handleAuthResponse(response);
      console.log('[AuthService] Google OAuth successful');
      return response.user;

    } catch (error) {
      console.error('[AuthService] Google OAuth failed:', error);
      throw new AuthError('UNKNOWN_ERROR', error instanceof Error ? error.message : 'Google OAuth failed');
    }
  }

  // --------------------------------------------------------------------------
  // Simplified Methods for Onboarding Flow
  // --------------------------------------------------------------------------

  /**
   * Simplified login with Google for onboarding
   * Returns result object instead of throwing
   */
  async loginWithGoogle(): Promise<{
    success: boolean;
    user?: { email: string; firstName: string };
    error?: string;
  }> {
    try {
      const user = await this.initiateGoogleOAuth();
      return {
        success: true,
        user: {
          email: user.email,
          firstName: user.firstName,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Google login failed',
      };
    }
  }

  /**
   * Simplified email login for onboarding
   * Returns result object instead of throwing
   */
  async loginWithEmail(
    email: string,
    password: string
  ): Promise<{
    success: boolean;
    user?: { email: string; firstName: string };
    error?: string;
  }> {
    try {
      const user = await this.login(email, password);
      return {
        success: true,
        user: {
          email: user.email,
          firstName: user.firstName,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed',
      };
    }
  }

  /**
   * Simplified registration for onboarding
   * Returns result object instead of throwing
   */
  async registerWithEmail(
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ): Promise<{
    success: boolean;
    user?: { email: string; firstName: string };
    error?: string;
  }> {
    try {
      const user = await this.register(email, password, firstName, lastName);
      return {
        success: true,
        user: {
          email: user.email,
          firstName: user.firstName,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed',
      };
    }
  }

  async handleOAuthCallback(tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }): Promise<void> {
    console.log('[AuthService] Handling OAuth callback...');

    try {
      // Store tokens
      const expiresAt = Date.now() + tokens.expiresIn * 1000;
      const authTokens: AuthTokens = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt,
      };

      this.state.tokens = authTokens;
      this.state.lastRefresh = Date.now();

      // Fetch user profile
      const user = await this.getCurrentUser();

      this.state.user = user;
      this.state.isAuthenticated = true;

      // Persist to storage
      await chrome.storage.local.set({
        [STORAGE_KEYS.accessToken]: authTokens.accessToken,
        [STORAGE_KEYS.refreshToken]: authTokens.refreshToken,
        [STORAGE_KEYS.expiresAt]: authTokens.expiresAt.toString(),
        [STORAGE_KEYS.user]: JSON.stringify(user),
        [STORAGE_KEYS.lastRefresh]: this.state.lastRefresh.toString(),
      });

      // Notify listeners
      this.notifyStateChange();

      // Schedule token refresh
      this.scheduleTokenRefresh();

      console.log('[AuthService] OAuth callback handled successfully');
    } catch (error) {
      console.error('[AuthService] OAuth callback handling failed:', error);
      throw this.normalizeError(error);
    }
  }

  // --------------------------------------------------------------------------
  // State Management
  // --------------------------------------------------------------------------

  isAuthenticated(): boolean {
    return this.state.isAuthenticated && this.state.tokens !== null;
  }

  getUser(): User | null {
    return this.state.user;
  }

  async getAccessToken(): Promise<string> {
    // Check if token is valid
    if (!this.state.tokens?.accessToken) {
      throw new AuthError('UNAUTHORIZED', 'Not authenticated');
    }

    // Check if token needs refresh
    const now = Date.now();
    const expiresAt = this.state.tokens.expiresAt;
    const shouldRefresh = expiresAt - now < CONFIG.refreshBeforeExpiry;

    if (shouldRefresh) {
      console.log('[AuthService] Token expiring soon, refreshing...');

      // Queue this request if already refreshing
      if (this.isRefreshing) {
        return new Promise((resolve) => {
          this.requestQueue.push(() => {
            resolve(this.state.tokens!.accessToken);
          });
        });
      }

      await this.refreshToken();
    }

    return this.state.tokens.accessToken;
  }

  getAuthState(): AuthState {
    return { ...this.state };
  }

  // --------------------------------------------------------------------------
  // Event Listeners
  // --------------------------------------------------------------------------

  onAuthStateChanged(listener: AuthStateChangeListener): () => void {
    this.listeners.add(listener);

    // Immediately call with current state
    listener(this.getAuthState());

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyStateChange(): void {
    const state = this.getAuthState();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        console.error('[AuthService] Listener error:', error);
      }
    });
  }

  // --------------------------------------------------------------------------
  // Token Management
  // --------------------------------------------------------------------------

  private async checkAndRefreshToken(): Promise<void> {
    if (!this.state.tokens) return;

    const now = Date.now();
    const expiresAt = this.state.tokens.expiresAt;
    const isExpired = now >= expiresAt;
    const shouldRefresh = expiresAt - now < CONFIG.refreshBeforeExpiry;

    if (isExpired) {
      console.log('[AuthService] Token expired, refreshing...');
      try {
        await this.refreshToken();
      } catch (error) {
        console.error('[AuthService] Failed to refresh expired token:', error);
        await this.clearAuthState();
      }
    } else if (shouldRefresh) {
      console.log('[AuthService] Token expiring soon, refreshing...');
      this.refreshToken().catch((error) => {
        console.error('[AuthService] Background refresh failed:', error);
      });
    }
  }

  private scheduleTokenRefresh(): void {
    // Clear existing timer
    if (this.refreshTimer !== null) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    if (!this.state.tokens) return;

    const now = Date.now();
    const expiresAt = this.state.tokens.expiresAt;
    const timeUntilRefresh = expiresAt - now - CONFIG.refreshBeforeExpiry;

    if (timeUntilRefresh > 0) {
      console.log(
        `[AuthService] Scheduling token refresh in ${Math.round(timeUntilRefresh / 1000)}s`
      );

      this.refreshTimer = setTimeout(() => {
        this.refreshToken().catch((error) => {
          console.error('[AuthService] Scheduled refresh failed:', error);
        });
      }, timeUntilRefresh) as unknown as number;
    }
  }

  private processRequestQueue(): void {
    const queue = [...this.requestQueue];
    this.requestQueue = [];

    queue.forEach((resolve) => {
      try {
        resolve();
      } catch (error) {
        console.error('[AuthService] Queue processing error:', error);
      }
    });
  }

  // --------------------------------------------------------------------------
  // Storage Management
  // --------------------------------------------------------------------------

  private async handleAuthResponse(response: LoginResponse): Promise<void> {
    // Calculate token expiry
    const expiresAt = Date.now() + response.expiresIn * 1000;

    // Update state
    this.state = {
      user: response.user,
      tokens: {
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        expiresAt,
      },
      isAuthenticated: true,
      lastRefresh: Date.now(),
    };

    // Persist to storage
    await chrome.storage.local.set({
      [STORAGE_KEYS.accessToken]: response.accessToken,
      [STORAGE_KEYS.refreshToken]: response.refreshToken,
      [STORAGE_KEYS.expiresAt]: expiresAt.toString(),
      [STORAGE_KEYS.user]: JSON.stringify(response.user),
      [STORAGE_KEYS.lastRefresh]: this.state.lastRefresh.toString(),
    });

    // Notify listeners
    this.notifyStateChange();

    // Schedule token refresh
    this.scheduleTokenRefresh();
  }

  private async clearAuthState(): Promise<void> {
    // Clear refresh timer
    if (this.refreshTimer !== null) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    // Clear state
    this.state = {
      user: null,
      tokens: null,
      isAuthenticated: false,
      lastRefresh: 0,
    };

    // Clear storage
    await chrome.storage.local.remove([
      STORAGE_KEYS.accessToken,
      STORAGE_KEYS.refreshToken,
      STORAGE_KEYS.expiresAt,
      STORAGE_KEYS.user,
      STORAGE_KEYS.lastRefresh,
    ]);

    // Clear request queue
    this.requestQueue = [];
    this.isRefreshing = false;

    // Notify listeners
    this.notifyStateChange();
  }

  // --------------------------------------------------------------------------
  // HTTP Client
  // --------------------------------------------------------------------------

  private async fetchWithTimeout<T>(
    endpoint: string,
    options: {
      method: string;
      body?: string;
      headers?: Record<string, string>;
    }
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      CONFIG.requestTimeout
    );

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      // Add auth header if available and not a login/register request
      if (
        this.state.tokens?.accessToken &&
        endpoint !== AUTH_ENDPOINTS.login &&
        endpoint !== AUTH_ENDPOINTS.register &&
        endpoint !== AUTH_ENDPOINTS.refresh
      ) {
        headers['Authorization'] = `Bearer ${this.state.tokens.accessToken}`;
      }

      const response = await fetch(url, {
        method: options.method,
        headers,
        body: options.body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new AuthError(
            'NETWORK_ERROR',
            'Request timeout',
            408
          );
        }
      }

      throw error;
    }
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    let errorMessage = response.statusText;
    let errorType: AuthErrorType = 'UNKNOWN_ERROR';

    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch {
      // Failed to parse error response
    }

    switch (response.status) {
      case 401:
        errorType = 'UNAUTHORIZED';
        // Clear auth state on 401
        await this.clearAuthState();
        break;
      case 400:
        errorType = 'VALIDATION_ERROR';
        break;
      case 403:
        errorType = 'INVALID_CREDENTIALS';
        break;
      case 404:
      case 500:
      case 502:
      case 503:
        errorType = 'NETWORK_ERROR';
        break;
    }

    throw new AuthError(errorType, errorMessage, response.status);
  }

  private normalizeError(error: unknown): AuthError {
    if (error instanceof AuthError) {
      return error;
    }

    if (error instanceof Error) {
      return new AuthError('UNKNOWN_ERROR', error.message);
    }

    return new AuthError('UNKNOWN_ERROR', 'An unknown error occurred');
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const authService = new AuthService();
