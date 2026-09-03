/**
 * API Configuration for Kissan Rehnuma.
 *
 * Central configuration for all API endpoints.
 * The frontend communicates ONLY with the API Gateway (port 3000),
 * which then proxies to the appropriate microservice.
 */

/**
 * Gateway base URL.
 * - Web development: http://localhost:3000
 * - Android emulator: http://10.0.2.2:3000 (localhost from emulator)
 * - Physical device/mobile browser: use same hostname as frontend
 *
 * Dynamic detection: Uses window.location.hostname on web so mobile browsers
 * automatically connect to the correct gateway IP.
 */
function getGatewayUrl(): string {
  if (!__DEV__) {
    return 'https://api.kissanrehnuma.com'; // TODO: Update with production URL
  }

  // On web, use the same hostname as the frontend (works for mobile browsers)
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    // If accessed via IP (mobile) or localhost (computer), use same host
    return `http://${hostname}:3000`;
  }

  // Fallback for native (React Native)
  return 'http://localhost:3000';
}

const GATEWAY_URL = getGatewayUrl();

/** API version prefix */
const API_PREFIX = '/api/v1';

/** Full base URL for API calls */
export const API_BASE_URL = `${GATEWAY_URL}${API_PREFIX}`;

/** Gateway health check (no prefix) */
export const GATEWAY_HEALTH = `${GATEWAY_URL}/health`;

/**
 * Token server URL (voice-agent token_server.py).
 * Generates LiveKit JWT tokens and dispatches agents to rooms.
 * Runs on port 8080, same host as the gateway.
 */
function getTokenServerUrl(): string {
  if (!__DEV__) {
    return 'https://api.kissanrehnuma.com'; // TODO: production token endpoint
  }
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    return `http://${hostname}:8080`;
  }
  return 'http://localhost:8080';
}

/** LiveKit Cloud WebSocket URL (must match voice-agent-service .env) */
const LIVEKIT_URL = 'wss://kissan-rehnuma-xa9jeu4t.livekit.cloud';

export const TOKEN_SERVER_URL = getTokenServerUrl();
export { LIVEKIT_URL };

/**
 * API endpoint paths (relative to API_BASE_URL).
 * Usage: `${API_BASE_URL}${ENDPOINTS.auth.login}`
 */
export const ENDPOINTS = {
  // Auth endpoints → user-auth-service
  auth: {
    login: '/auth/login',
    signup: '/auth/signup',
    verifySignupOtp: '/auth/verify-signup-otp',
    forgotPassword: '/auth/forgot-password',
    verifyOtp: '/auth/verify-otp',
    resetPassword: '/auth/reset-password',
    refresh: '/auth/refresh',
  },

  // Crop disease endpoints → crop-disease-service
  crop: {
    detect: '/crop/detect',
    history: '/crop/history',
    health: '/crop/health',
  },

  // Animal disease endpoints → animal-disease-service
  animal: {
    detect: '/animal/detect',
    history: '/animal/history',
    health: '/animal/health',
  },

  // Weather endpoints → weather-alert-service (paths match gateway routes)
  weather: {
    current: (farmerId: number) => `/weather/current/${farmerId}`,
    forecast: (farmerId: number) => `/weather/forecast/${farmerId}`,
    advisory: (farmerId: number) => `/weather/advisory/${farmerId}`,
    location: (farmerId: number) => `/farmers/${farmerId}/location`,
    alertHistory: (farmerId: number) => `/alerts/history/${farmerId}`,
    health: '/weather/health',
  },

  // Market rate endpoints → market-rate-service
  market: {
    allRates: '/market/rates',
    trending: '/market/rates/trending',
    rates: (crop: string) => `/market/rates/${encodeURIComponent(crop)}`,
    health: '/market/health',
  },

  // Helpline endpoints → voice-helpline-service
  helpline: {
    call: '/helpline/call',
    history: '/helpline/history',
    health: '/helpline/health',
  },
} as const;
