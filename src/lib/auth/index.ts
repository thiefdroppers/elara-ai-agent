/**
 * Auth Library - Authentication service for the extension
 *
 * Provides:
 * - Email/password login
 * - Google OAuth
 * - Token management
 * - User profile
 */

export { authService, AuthService, AuthError } from './auth-service';
export type {
  User,
  AuthTokens,
  AuthState,
  LoginRequest,
  RegisterRequest,
  AuthErrorType,
  AuthStateChangeListener
} from './auth-service';

export { userProfileService, UserProfileService } from './user-profile';
export type { UserProfile } from './user-profile';
