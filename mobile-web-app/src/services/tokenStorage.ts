/**
 * Secure Token Storage for Kissan Rehnuma.
 *
 * Uses expo-secure-store for encrypted local storage:
 * - iOS: Keychain
 * - Android: Keystore
 * - Web: localStorage (fallback, since SecureStore has limited web support)
 *
 * Stores JWT access tokens securely on device.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** Storage keys */
const KEYS = {
  ACCESS_TOKEN: 'kissan_access_token',
  REFRESH_TOKEN: 'kissan_refresh_token',
  USER_EMAIL: 'kissan_user_email',
  USER_ID: 'kissan_user_id',
  USER_NAME: 'kissan_user_name',
  ONBOARDING_COMPLETE: 'kissan_onboarding_complete',
  APP_LANGUAGE: 'kissan_app_language',
} as const;

/**
 * Platform-aware storage adapter.
 * SecureStore doesn't support web, so we fall back to localStorage.
 */
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

/**
 * Token storage API for JWT management.
 */
export const tokenStorage = {
  /**
   * Save access token after successful login.
   */
  async saveAccessToken(token: string): Promise<void> {
    await storage.setItem(KEYS.ACCESS_TOKEN, token);
  },

  /**
   * Get stored access token.
   * Returns null if not found or expired.
   */
  async getAccessToken(): Promise<string | null> {
    return storage.getItem(KEYS.ACCESS_TOKEN);
  },

  /**
   * Save refresh token after successful login.
   */
  async saveRefreshToken(token: string): Promise<void> {
    await storage.setItem(KEYS.REFRESH_TOKEN, token);
  },

  /**
   * Get stored refresh token.
   * Returns null if not found or expired.
   */
  async getRefreshToken(): Promise<string | null> {
    return storage.getItem(KEYS.REFRESH_TOKEN);
  },

  /**
   * Save user info after login.
   */
  async saveUserInfo(userId: string, email: string, name?: string): Promise<void> {
    const promises: Promise<void>[] = [
      storage.setItem(KEYS.USER_ID, userId),
      storage.setItem(KEYS.USER_EMAIL, email),
    ];
    if (name) {
      promises.push(storage.setItem(KEYS.USER_NAME, name));
    }
    await Promise.all(promises);
  },

  /**
   * Get stored user ID.
   */
  async getUserId(): Promise<string | null> {
    return storage.getItem(KEYS.USER_ID);
  },

  /**
   * Get stored user email.
   */
  async getUserEmail(): Promise<string | null> {
    return storage.getItem(KEYS.USER_EMAIL);
  },

  /**
   * Get stored user name.
   * Falls back to decoding the JWT access token if the cached name is missing
   * (e.g. the user logged in before the name field was cached).
   */
  async getUserName(): Promise<string | null> {
    const cached = await storage.getItem(KEYS.USER_NAME);
    if (cached) return cached;

    // Fallback: decode name from JWT payload
    try {
      const token = await storage.getItem(KEYS.ACCESS_TOKEN);
      if (!token) return null;
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base64));
      if (payload.name) {
        // Cache it for next time
        await storage.setItem(KEYS.USER_NAME, payload.name);
        return payload.name;
      }
    } catch {
      // ignore decode errors
    }
    return null;
  },

  /**
   * Check if user has a stored token (i.e., is logged in).
   */
  async isLoggedIn(): Promise<boolean> {
    const token = await storage.getItem(KEYS.ACCESS_TOKEN);
    return token !== null;
  },

  /**
   * Check if the stored JWT token is still valid (not expired).
   * Decodes the payload without verification — just checks the `exp` claim.
   * Returns false if no token, expired token, or unparseable token.
   */
  async isTokenValid(): Promise<boolean> {
    const token = await storage.getItem(KEYS.ACCESS_TOKEN);
    if (!token) return false;
    try {
      // JWT = header.payload.signature — decode the payload (part 1)
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      const payload = JSON.parse(atob(parts[1]));
      if (!payload.exp) return true; // no expiry = valid forever
      // exp is in seconds, Date.now() is in milliseconds
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  },

  /**
   * Mark onboarding as completed (only shown once per device).
   */
  async setOnboardingComplete(language?: string): Promise<void> {
    const promises: Promise<void>[] = [
      storage.setItem(KEYS.ONBOARDING_COMPLETE, 'true'),
    ];
    if (language) {
      promises.push(storage.setItem(KEYS.APP_LANGUAGE, language));
    }
    await Promise.all(promises);
  },

  /**
   * Check if onboarding has been completed.
   */
  async isOnboardingComplete(): Promise<boolean> {
    const value = await storage.getItem(KEYS.ONBOARDING_COMPLETE);
    return value === 'true';
  },

  /**
   * Get stored app language.
   */
  async getLanguage(): Promise<string | null> {
    return storage.getItem(KEYS.APP_LANGUAGE);
  },

  /**
   * Clear all stored auth data (logout).
   */
  async clearAll(): Promise<void> {
    await Promise.all([
      storage.removeItem(KEYS.ACCESS_TOKEN),
      storage.removeItem(KEYS.REFRESH_TOKEN),
      storage.removeItem(KEYS.USER_ID),
      storage.removeItem(KEYS.USER_EMAIL),
      storage.removeItem(KEYS.USER_NAME),
    ]);
  },

  /**
   * Clear everything including onboarding flag (full reset).
   */
  async clearAllIncludingOnboarding(): Promise<void> {
    await Promise.all([
      storage.removeItem(KEYS.ACCESS_TOKEN),
      storage.removeItem(KEYS.REFRESH_TOKEN),
      storage.removeItem(KEYS.USER_ID),
      storage.removeItem(KEYS.USER_EMAIL),
      storage.removeItem(KEYS.USER_NAME),
      storage.removeItem(KEYS.ONBOARDING_COMPLETE),
      storage.removeItem(KEYS.APP_LANGUAGE),
    ]);
  },
};
