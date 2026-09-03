/**
 * Weather Service for Kissan Rehnuma.
 * All calls go through: Gateway → weather-alert-service
 */

import { api } from './apiClient';
import { ENDPOINTS } from './config';

// ── Types matching weather-alert-service responses ──────────────────────────

export interface CurrentWeatherResponse {
  farmer_id: number;
  latitude: number;
  longitude: number;
  temperature: number;
  humidity: number;
  wind_speed_kmh: number;
  rain_mm: number;
  source: 'api' | 'cache';
  fetched_at: string;
}

export interface ForecastEntry {
  time: string;
  temp_min: number;
  temp_max: number;
  rain_mm: number;
  wind_kmh: number;
}

export interface ForecastResponse {
  farmer_id: number;
  forecast: ForecastEntry[];
}

export interface AlertHistoryItem {
  alert_type: string;
  message: string;
  sent_at: string;
  status: string;
}

export interface AlertHistoryResponse {
  farmer_id: number;
  alerts: AlertHistoryItem[];
}

export interface FarmerLocationRequest {
  latitude: number;
  longitude: number;
}

export interface FarmerLocationResponse {
  farmer_id: number;
  latitude: number;
  longitude: number;
}

export interface AdvisoryResponse {
  farmer_id: number;
  advice: string;
  source: 'llm' | 'static';
}

// ── Service ──────────────────────────────────────────────────────────────────

export const weatherService = {
  /** Register or update the farmer's GPS location */
  async registerLocation(
    farmerId: number,
    payload: FarmerLocationRequest,
  ): Promise<FarmerLocationResponse> {
    return api.put<FarmerLocationResponse>(
      ENDPOINTS.weather.location(farmerId),
      payload,
    );
  },

  /** Get current weather for the farmer's registered location */
  async getCurrentWeather(farmerId: number): Promise<CurrentWeatherResponse> {
    return api.get<CurrentWeatherResponse>(ENDPOINTS.weather.current(farmerId));
  },

  /** Get hourly forecast for the farmer's registered location */
  async getForecast(farmerId: number): Promise<ForecastResponse> {
    return api.get<ForecastResponse>(ENDPOINTS.weather.forecast(farmerId));
  },

  /** Get LLM-generated farming advice based on current weather + forecast */
  async getAdvisory(farmerId: number, lang: string = 'ur'): Promise<AdvisoryResponse> {
    return api.get<AdvisoryResponse>(`${ENDPOINTS.weather.advisory(farmerId)}?lang=${lang}`);
  },

  /** Get sent alert history for a farmer */
  async getAlertHistory(farmerId: number): Promise<AlertHistoryResponse> {
    return api.get<AlertHistoryResponse>(ENDPOINTS.weather.alertHistory(farmerId));
  },

  /** Register device FCM token for push notifications */
  async registerDevice(payload: {
    farmer_id: number;
    token: string;
    platform: string;
  }): Promise<void> {
    return api.post('/devices/register', payload);
  },
};
