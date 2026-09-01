/**
 * Auth Service for Kissan Rehnuma.
 *
 * Handles all authentication API calls through the gateway:
 * - Login (returns JWT token)
 * - Signup (registers + sends OTP)
 * - Verify signup OTP
 * - Forgot password
 * - Reset password
 *
 * All endpoints go through: Gateway → user-auth-service
 */

import { api } from './apiClient';
import { tokenStorage } from './tokenStorage';
import { ENDPOINTS } from './config';

// =========================================================
// Types (matching user-auth-service schemas)
// =========================================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  access_token: string;
  token_type: string;
}

export interface SignupRequest {
  name: string;
  email: string;
  lastname: string;
  cnic: string;
  Mobile_Number: string;
  Address: string;
  City: string;
  country: string;
  latitude: string;
  longitude: string;
  password: string;
}

export interface SignupResponse {
  message: string;
  farmer_id: string;
}

export interface VerifyOtpRequest {
  email: string;
  otp: string;
}

export interface VerifyOtpResponse {
  message: string;
  farmer_id: number;
  email: string;
  email_verified: boolean;
  access_token: string;
  token_type: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  otp: string;
  new_password: string;
  confirm_password: string;
}

// =========================================================
// Auth Service
// =========================================================

export const authService = {
  /**
   * Login with email and password.
   * On success, stores JWT token and user info securely.
   */
  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>(
      ENDPOINTS.auth.login,
      data,
      { skipAuth: true }, // No token needed for login
    );

    // Store token and user info securely
    if (response.access_token) {
      await tokenStorage.saveAccessToken(response.access_token);

      // Decode basic user info from JWT payload (sub = user_id)
      try {
        const payload = decodeJWTPayload(response.access_token);
        if (payload.sub && payload.email) {
          await tokenStorage.saveUserInfo(payload.sub, payload.email);
        }
      } catch {
        // If decode fails, user info just won't be cached
      }
    }

    return response;
  },

  /**
   * Register a new farmer account.
   * Sends OTP to email for verification.
   */
  async signup(data: SignupRequest): Promise<SignupResponse> {
    return api.post<SignupResponse>(
      ENDPOINTS.auth.signup,
      data,
      { skipAuth: true },
    );
  },

  /**
   * Verify signup OTP to activate account.
   */
  async verifySignupOtp(data: VerifyOtpRequest): Promise<VerifyOtpResponse> {
    return api.post<VerifyOtpResponse>(
      ENDPOINTS.auth.verifySignupOtp,
      data,
      { skipAuth: true },
    );
  },

  /**
   * Request password reset OTP.
   */
  async forgotPassword(data: ForgotPasswordRequest): Promise<{ message: string }> {
    return api.post<{ message: string }>(
      ENDPOINTS.auth.forgotPassword,
      data,
      { skipAuth: true },
    );
  },

  /**
   * Reset password with OTP verification.
   */
  async resetPassword(data: ResetPasswordRequest): Promise<{ message: string }> {
    return api.post<{ message: string }>(
      ENDPOINTS.auth.resetPassword,
      data,
      { skipAuth: true },
    );
  },

  /**
   * Logout: clear stored tokens and user info.
   */
  async logout(): Promise<void> {
    await tokenStorage.clearAll();
  },

  /**
   * Check if user is currently logged in.
   */
  async isLoggedIn(): Promise<boolean> {
    return tokenStorage.isLoggedIn();
  },

  /**
   * Get stored user ID (from JWT).
   */
  async getUserId(): Promise<string | null> {
    return tokenStorage.getUserId();
  },

  /**
   * Get stored user email.
   */
  async getUserEmail(): Promise<string | null> {
    return tokenStorage.getUserEmail();
  },
};

// =========================================================
// JWT Utilities
// =========================================================

/**
 * Decode JWT payload without verification (client-side only for display).
 * JWT format: header.payload.signature (base64url encoded)
 */
function decodeJWTPayload(token: string): { sub?: string; email?: string } {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return {};

    // Base64url decode the payload
    const payload = parts[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = atob(base64);
    return JSON.parse(jsonStr);
  } catch {
    return {};
  }
}
