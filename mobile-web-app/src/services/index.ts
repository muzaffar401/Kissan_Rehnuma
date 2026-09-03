/**
 * Service layer barrel exports.
 *
 * Central import point for all API services.
 * Usage: import { cropService, authService, api, tokenStorage } from '../services';
 */

export { api, apiRequest, setOnUnauthorized } from './apiClient';
export type { ApiError } from './apiClient';

export { tokenStorage } from './tokenStorage';

export { authService } from './authService';
export type {
  LoginRequest,
  LoginResponse,
  SignupRequest,
  SignupResponse,
  VerifyOtpRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
} from './authService';

export { cropService } from './cropService';
export type {
  DetectResponse,
  HistoryItem,
  HistoryResponse,
  HealthResponse,
} from './cropService';

export { animalService } from './animalService';
export type {
  AnimalDetectResponse,
  AnimalHistoryItem,
  AnimalHealthResponse,
} from './animalService';

export { pdfService } from './pdfService';

export { weatherService } from './weatherService';
export type {
  CurrentWeatherResponse,
  ForecastResponse,
  ForecastEntry,
  AlertHistoryResponse,
  AlertHistoryItem,
  FarmerLocationRequest,
  FarmerLocationResponse,
  AdvisoryResponse,
} from './weatherService';

export { marketService } from './marketService';
export type {
  RatesResponse,
  MandiPrice,
  TrendingResponse,
  TrendEntry,
} from './marketService';

export { fetchVoiceToken, generateRoomName } from './helplineService';
export type { VoiceTokenResponse } from './helplineService';

export { API_BASE_URL, GATEWAY_HEALTH, ENDPOINTS, TOKEN_SERVER_URL, LIVEKIT_URL } from './config';
