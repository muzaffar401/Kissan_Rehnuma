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
  USER_EMAIL: 'kissan_user_email',
  USER_ID: 'kissan_user_id',
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
   * Save user info after login.
   */
  async saveUserInfo(userId: string, email: string): Promise<void> {
    await Promise.all([
      storage.setItem(KEYS.USER_ID, userId),
      storage.setItem(KEYS.USER_EMAIL, email),
    ]);
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
   * Check if user has a stored token (i.e., is logged in).
   */
  async isLoggedIn(): Promise<boolean> {
    const token = await storage.getItem(KEYS.ACCESS_TOKEN);
    return token !== null;
  },

  /**
   * Clear all stored auth data (logout).
   */
  async clearAll(): Promise<void> {
    await Promise.all([
      storage.removeItem(KEYS.ACCESS_TOKEN),
      storage.removeItem(KEYS.USER_ID),
      storage.removeItem(KEYS.USER_EMAIL),
    ]);
  },
};
