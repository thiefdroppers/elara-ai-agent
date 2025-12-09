/**
 * ThiefDroppers - User Profile Service
 *
 * Manages user profiles, preferences, whitelists, blacklists, and URL reports.
 * Stores data in chrome.storage.local and syncs with backend when authenticated.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ReportedUrl {
  url: string;
  domain: string;
  reportType: 'spam' | 'phishing' | 'suspicious' | 'malicious';
  reportedAt: number;
  synced: boolean;
}

export interface UserProfile {
  // Basic info
  userId?: string;
  email: string;
  firstName: string;
  lastName: string;

  // Questionnaire answers
  userType: 'child' | 'teen' | 'adult' | 'senior' | null;
  primaryUse: 'social' | 'shopping' | 'banking' | 'work' | 'general' | null;
  securityExperience: 'beginner' | 'intermediate' | 'advanced' | null;
  concernLevel: 'low' | 'medium' | 'high' | null;
  protectionFocus: ('phishing' | 'scams' | 'malware' | 'privacy')[];

  // Lists
  whitelist: string[];
  blacklist: string[];
  reportedUrls: ReportedUrl[];

  // Status
  onboardingComplete: boolean;
  createdAt: number;
  updatedAt: number;
}

export type UserType = 'child' | 'teen' | 'adult' | 'senior';
export type PrimaryUse = 'social' | 'shopping' | 'banking' | 'work' | 'general';
export type SecurityExperience = 'beginner' | 'intermediate' | 'advanced';
export type ConcernLevel = 'low' | 'medium' | 'high';
export type ProtectionFocus = 'phishing' | 'scams' | 'malware' | 'privacy';
export type ReportType = 'spam' | 'phishing' | 'suspicious' | 'malicious';

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = 'userProfile';
const DEFAULT_PROFILE: Partial<UserProfile> = {
  userType: null,
  primaryUse: null,
  securityExperience: null,
  concernLevel: null,
  protectionFocus: [],
  whitelist: [],
  blacklist: [],
  reportedUrls: [],
  onboardingComplete: false,
};

// ============================================================================
// USER PROFILE SERVICE
// ============================================================================

export class UserProfileService {
  private profile: UserProfile | null = null;
  private initialized = false;
  private listeners: Set<(profile: UserProfile | null) => void> = new Set();

  /**
   * Initialize the service and load profile from storage
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const stored = await chrome.storage.local.get(STORAGE_KEY);
      if (stored[STORAGE_KEY]) {
        this.profile = stored[STORAGE_KEY];
      }
      this.initialized = true;
      console.log('[UserProfile] Initialized:', this.profile ? 'Profile loaded' : 'No profile');
    } catch (error) {
      console.error('[UserProfile] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Add a listener for profile changes
   */
  onProfileChange(callback: (profile: UserProfile | null) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach(cb => cb(this.profile));
  }

  /**
   * Get the current user profile
   */
  async getProfile(): Promise<UserProfile | null> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.profile;
  }

  /**
   * Check if user has completed onboarding
   */
  async hasCompletedOnboarding(): Promise<boolean> {
    const profile = await this.getProfile();
    return profile?.onboardingComplete ?? false;
  }

  /**
   * Save a new profile (creates if doesn't exist)
   */
  async saveProfile(profile: Partial<UserProfile>): Promise<void> {
    const now = Date.now();

    const newProfile: UserProfile = {
      userId: profile.userId || this.generateUserId(),
      email: profile.email || '',
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      userType: profile.userType ?? DEFAULT_PROFILE.userType!,
      primaryUse: profile.primaryUse ?? DEFAULT_PROFILE.primaryUse!,
      securityExperience: profile.securityExperience ?? DEFAULT_PROFILE.securityExperience!,
      concernLevel: profile.concernLevel ?? DEFAULT_PROFILE.concernLevel!,
      protectionFocus: profile.protectionFocus || DEFAULT_PROFILE.protectionFocus!,
      whitelist: profile.whitelist || DEFAULT_PROFILE.whitelist!,
      blacklist: profile.blacklist || DEFAULT_PROFILE.blacklist!,
      reportedUrls: profile.reportedUrls || DEFAULT_PROFILE.reportedUrls!,
      onboardingComplete: profile.onboardingComplete || false,
      createdAt: profile.createdAt || now,
      updatedAt: now,
    };

    this.profile = newProfile;

    try {
      // Save profile and onboardingComplete flag separately for reliable checking
      await chrome.storage.local.set({
        [STORAGE_KEY]: newProfile,
        onboardingComplete: newProfile.onboardingComplete
      });
      this.notifyListeners();
      console.log('[UserProfile] Profile saved, onboardingComplete:', newProfile.onboardingComplete);
    } catch (error) {
      console.error('[UserProfile] Save failed:', error);
      throw error;
    }
  }

  /**
   * Update existing profile with partial data
   */
  async updateProfile(updates: Partial<UserProfile>): Promise<void> {
    if (!this.profile) {
      throw new Error('No profile exists. Use saveProfile() to create one.');
    }

    const updatedProfile: UserProfile = {
      ...this.profile,
      ...updates,
      updatedAt: Date.now(),
    };

    this.profile = updatedProfile;

    try {
      // Save profile and onboardingComplete flag separately for reliable checking
      await chrome.storage.local.set({
        [STORAGE_KEY]: updatedProfile,
        onboardingComplete: updatedProfile.onboardingComplete
      });
      this.notifyListeners();
      console.log('[UserProfile] Profile updated, onboardingComplete:', updatedProfile.onboardingComplete);
    } catch (error) {
      console.error('[UserProfile] Update failed:', error);
      throw error;
    }
  }

  // ============================================================================
  // WHITELIST MANAGEMENT
  // ============================================================================

  async addToWhitelist(domain: string): Promise<void> {
    const normalized = this.normalizeDomain(domain);

    if (!this.isValidDomain(normalized)) {
      throw new Error(`Invalid domain: ${domain}`);
    }

    if (!this.profile) {
      throw new Error('No profile exists');
    }

    if (this.profile.whitelist.includes(normalized)) {
      console.log('[UserProfile] Domain already whitelisted:', normalized);
      return;
    }

    // Remove from blacklist if present
    const blacklist = this.profile.blacklist.filter(d => d !== normalized);

    await this.updateProfile({
      whitelist: [...this.profile.whitelist, normalized],
      blacklist,
    });

    console.log('[UserProfile] Added to whitelist:', normalized);
  }

  async removeFromWhitelist(domain: string): Promise<void> {
    const normalized = this.normalizeDomain(domain);

    if (!this.profile) {
      throw new Error('No profile exists');
    }

    await this.updateProfile({
      whitelist: this.profile.whitelist.filter(d => d !== normalized),
    });

    console.log('[UserProfile] Removed from whitelist:', normalized);
  }

  // ============================================================================
  // BLACKLIST MANAGEMENT
  // ============================================================================

  async addToBlacklist(domain: string): Promise<void> {
    const normalized = this.normalizeDomain(domain);

    if (!this.isValidDomain(normalized)) {
      throw new Error(`Invalid domain: ${domain}`);
    }

    if (!this.profile) {
      throw new Error('No profile exists');
    }

    if (this.profile.blacklist.includes(normalized)) {
      console.log('[UserProfile] Domain already blacklisted:', normalized);
      return;
    }

    // Remove from whitelist if present
    const whitelist = this.profile.whitelist.filter(d => d !== normalized);

    await this.updateProfile({
      blacklist: [...this.profile.blacklist, normalized],
      whitelist,
    });

    console.log('[UserProfile] Added to blacklist:', normalized);
  }

  async removeFromBlacklist(domain: string): Promise<void> {
    const normalized = this.normalizeDomain(domain);

    if (!this.profile) {
      throw new Error('No profile exists');
    }

    await this.updateProfile({
      blacklist: this.profile.blacklist.filter(d => d !== normalized),
    });

    console.log('[UserProfile] Removed from blacklist:', normalized);
  }

  // ============================================================================
  // URL REPORTING
  // ============================================================================

  /**
   * Report a URL as suspicious/malicious
   * TODO: Wire up to backend Elara TI platform to process and store user-reported URLs
   */
  async reportUrl(url: string, reportType: ReportType): Promise<void> {
    if (!this.profile) {
      throw new Error('No profile exists');
    }

    const domain = this.extractDomain(url);

    const report: ReportedUrl = {
      url,
      domain,
      reportType,
      reportedAt: Date.now(),
      synced: false, // Will be set to true after syncing with backend
    };

    // Add to local reported URLs
    const reportedUrls = [...this.profile.reportedUrls, report];

    // Also add to blacklist automatically
    let blacklist = this.profile.blacklist;
    if (!blacklist.includes(domain)) {
      blacklist = [...blacklist, domain];
    }

    await this.updateProfile({
      reportedUrls,
      blacklist,
    });

    console.log('[UserProfile] URL reported:', url, reportType);

    // TODO: Sync with Elara Central TI backend
    // await this.syncReportWithBackend(report);
  }

  /**
   * Get all reported URLs (for displaying in UI)
   */
  getReportedUrls(): ReportedUrl[] {
    return this.profile?.reportedUrls || [];
  }

  /**
   * Sync reported URLs with backend
   * TODO: Implement when backend endpoint is ready
   */
  // @ts-ignore - Will be used when backend endpoint is ready
  private async syncReportWithBackend(report: ReportedUrl): Promise<void> {
    // PLACEHOLDER: Will be implemented to send to Elara Central TI platform
    //
    // Example implementation:
    // const apiUrl = 'https://dev-api.thiefdroppers.com/api/v2/ti/user-report';
    // const response = await fetch(apiUrl, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${authToken}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     url: report.url,
    //     domain: report.domain,
    //     reportType: report.reportType,
    //     reportedAt: report.reportedAt,
    //     userProfile: {
    //       userType: this.profile?.userType,
    //       securityExperience: this.profile?.securityExperience,
    //     }
    //   }),
    // });
    //
    // if (response.ok) {
    //   // Mark as synced
    //   const reportedUrls = this.profile!.reportedUrls.map(r =>
    //     r.url === report.url && r.reportedAt === report.reportedAt
    //       ? { ...r, synced: true }
    //       : r
    //   );
    //   await this.updateProfile({ reportedUrls });
    // }

    console.log('[UserProfile] TODO: Sync report with backend:', report);
  }

  // ============================================================================
  // CHECK METHODS
  // ============================================================================

  isWhitelisted(url: string): boolean {
    if (!this.profile) return false;

    try {
      const domain = this.extractDomain(url);
      return this.profile.whitelist.some(d => this.matchesDomain(domain, d));
    } catch {
      return false;
    }
  }

  isBlacklisted(url: string): boolean {
    if (!this.profile) return false;

    try {
      const domain = this.extractDomain(url);
      return this.profile.blacklist.some(d => this.matchesDomain(domain, d));
    } catch {
      return false;
    }
  }

  /**
   * Get protection settings based on user profile
   */
  getProtectionSettings(): {
    alertLevel: 'minimal' | 'standard' | 'maximum';
    showEducationalTips: boolean;
    autoBlock: boolean;
    simplifiedUI: boolean;
  } {
    if (!this.profile) {
      return {
        alertLevel: 'standard',
        showEducationalTips: false,
        autoBlock: false,
        simplifiedUI: false,
      };
    }

    const { userType, concernLevel, securityExperience } = this.profile;

    return {
      alertLevel: concernLevel === 'high' ? 'maximum' : concernLevel === 'low' ? 'minimal' : 'standard',
      showEducationalTips: securityExperience === 'beginner' || userType === 'teen',
      autoBlock: userType === 'child' || userType === 'senior' || concernLevel === 'high',
      simplifiedUI: userType === 'child' || userType === 'senior',
    };
  }

  // ============================================================================
  // CLEAR & SYNC
  // ============================================================================

  async clearProfile(): Promise<void> {
    this.profile = null;
    await chrome.storage.local.remove(STORAGE_KEY);
    this.notifyListeners();
    console.log('[UserProfile] Profile cleared');
  }

  async syncWithServer(): Promise<void> {
    if (!this.profile) {
      console.log('[UserProfile] No profile to sync');
      return;
    }

    try {
      const stored = await chrome.storage.local.get('auth_accessToken');
      const authToken = stored.auth_accessToken;

      if (!authToken) {
        console.log('[UserProfile] No auth token - skipping sync');
        return;
      }

      const apiUrl = 'https://dev-api.thiefdroppers.com';

      const response = await fetch(`${apiUrl}/api/v2/extension/profile/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.profile),
      });

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.profile) {
        this.profile = {
          ...this.profile,
          ...data.profile,
          updatedAt: Date.now(),
        };
        await chrome.storage.local.set({ [STORAGE_KEY]: this.profile });
      }

      console.log('[UserProfile] Synced with server');
    } catch (error) {
      console.error('[UserProfile] Sync failed:', error);
    }
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private normalizeDomain(domain: string): string {
    let normalized = domain.toLowerCase().trim();
    normalized = normalized.replace(/^(https?:\/\/)?(www\.)?/, '');
    normalized = normalized.replace(/:\d+/, '');
    normalized = normalized.split('/')[0];
    normalized = normalized.split('?')[0];
    normalized = normalized.split('#')[0];
    return normalized;
  }

  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, '');
    } catch {
      return this.normalizeDomain(url);
    }
  }

  private isValidDomain(domain: string): boolean {
    const domainRegex = /^([a-z0-9-]+\.)*[a-z0-9-]+\.[a-z]{2,}$/i;
    return domainRegex.test(domain);
  }

  private matchesDomain(domain: string, pattern: string): boolean {
    if (domain === pattern) return true;
    if (pattern.startsWith('*.')) {
      const suffix = pattern.substring(2);
      return domain === suffix || domain.endsWith(`.${suffix}`);
    }
    return domain.endsWith(`.${pattern}`);
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const userProfileService = new UserProfileService();
