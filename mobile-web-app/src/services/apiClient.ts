/**
 * API Client for Kissan Rehnuma.
 *
 * A lightweight fetch wrapper that provides:
 * - Automatic base URL prepending
 * - JWT Bearer token auto-injection from secure storage
 * - Response parsing (JSON)
 * - Centralized error handling
 * - 401 auto-logout (token expired/invalid)
 *
 * All API calls go through the API Gateway, never directly to microservices.
 */

import { API_BASE_URL } from './config';
import { tokenStorage } from './tokenStorage';

// =========================================================
// Types
// =========================================================

/** Standard API error response from the gateway */
export interface ApiError {
  detail: string;
  error_code?: string;
  status: number;
}

/** Options for API requests */
interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  /** Request body (objects auto-serialized to JSON) */
  body?: BodyInit | Record<string, unknown>;
  /** Skip auth token injection (for login/signup) */
  skipAuth?: boolean;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
}

/** Callback for 401 unauthorized events */
type OnUnauthorizedCallback = () => void;

// =========================================================
// State
// =========================================================

/** Optional callback invoked when a 401 is received */
let onUnauthorized: OnUnauthorizedCallback | null = null;

/**
 * Register a callback for 401 unauthorized responses.
 * Typically used to redirect user to login screen.
 */
export function setOnUnauthorized(callback: () => void): void {
  onUnauthorized = callback;
}

// =========================================================
// Core fetch wrapper
// =========================================================

/**
 * Make an authenticated API request through the gateway.
 *
 * @param path - API path relative to base URL (e.g., '/auth/login')
 * @param options - Request options
 * @returns Parsed JSON response
 * @throws ApiError on non-2xx responses
 */
export async function apiRequest<T = unknown>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { body, skipAuth = false, timeout = 30000, headers: customHeaders, ...rest } = options;

  // Build URL
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;

  // Build headers
  const headers: Record<string, string> = {
    ...(customHeaders as Record<string, string>),
  };

  // Auto-inject JWT token for authenticated endpoints
  if (!skipAuth) {
    const token = await tokenStorage.getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  // Handle body serialization
  let requestBody: BodyInit | undefined;
  if (body) {
    if (body instanceof FormData || body instanceof Blob || typeof body === 'string') {
      requestBody = body;
    } else {
      // JSON body
      requestBody = JSON.stringify(body);
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
    }
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...rest,
      headers,
      body: requestBody,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Parse response
    const contentType = response.headers.get('content-type') || '';
    let data: unknown;

    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Handle 401 Unauthorized (token expired/invalid)
    if (response.status === 401 && !skipAuth) {
      // Clear invalid token
      await tokenStorage.clearAll();
      // Notify listener (e.g., redirect to login)
      if (onUnauthorized) {
        onUnauthorized();
      }
    }

    // Handle error responses
    if (!response.ok) {
      // Extract error detail — FastAPI may return string or array of validation errors
      let detail = 'An unexpected error occurred';
      let errorCode: string | undefined;

      if (typeof data === 'object' && data !== null) {
        const rawData = data as Record<string, unknown>;
        const rawDetail = rawData.detail;

        if (typeof rawDetail === 'string') {
          detail = rawDetail;
        } else if (Array.isArray(rawDetail)) {
          // FastAPI 422 validation errors: [{type, loc, msg, input, ctx}]
          detail = rawDetail
            .map((e: Record<string, unknown>) => {
              const loc = Array.isArray(e.loc) ? e.loc.join('.') : String(e.loc || '');
              const msg = typeof e.msg === 'string' ? e.msg : 'Validation error';
              return loc ? `${loc}: ${msg}` : msg;
            })
            .join('; ');
        }

        if (typeof rawData.error_code === 'string') {
          errorCode = rawData.error_code;
        }
      } else if (typeof data === 'string') {
        detail = data || `Request failed with status ${response.status}`;
      }

      const apiError: ApiError = {
        detail,
        error_code: errorCode,
        status: response.status,
      };
      throw apiError;
    }

    return data as T;
  } catch (error) {
    clearTimeout(timeoutId);

    // Re-throw ApiError as-is
    if (error && typeof error === 'object' && 'status' in error) {
      throw error;
    }

    // Handle network/timeout errors
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw {
        detail: 'Request timed out. Please check your connection and try again.',
        error_code: 'TIMEOUT',
        status: 0,
      } satisfies ApiError;
    }

    throw {
      detail: 'Network error. Please check your internet connection.',
      error_code: 'NETWORK_ERROR',
      status: 0,
    } satisfies ApiError;
  }
}

// =========================================================
// Convenience methods
// =========================================================

export const api = {
  /** GET request */
  get<T = unknown>(path: string, options?: ApiRequestOptions) {
    return apiRequest<T>(path, { ...options, method: 'GET' });
  },

  /** POST request with JSON body */
  post<T = unknown>(path: string, body?: object, options?: ApiRequestOptions) {
    return apiRequest<T>(path, { ...options, method: 'POST', body: body as Record<string, unknown> });
  },

  /** POST request with FormData (for file uploads) */
  postForm<T = unknown>(path: string, formData: FormData, options?: ApiRequestOptions) {
    return apiRequest<T>(path, { ...options, method: 'POST', body: formData });
  },

  /** PUT request */
  put<T = unknown>(path: string, body?: object, options?: ApiRequestOptions) {
    return apiRequest<T>(path, { ...options, method: 'PUT', body: body as Record<string, unknown> });
  },

  /** DELETE request */
  delete<T = unknown>(path: string, options?: ApiRequestOptions) {
    return apiRequest<T>(path, { ...options, method: 'DELETE' });
  },
};
