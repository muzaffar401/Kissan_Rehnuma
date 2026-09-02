/**
 * Market Rate Service for Kissan Rehnuma.
 * All calls go through: Gateway → market-rate-service
 */

import { api } from './apiClient';

// ── Types matching market-rate-service responses ─────────────────────────────

export interface CropPrice {
  crop_name: string;
  mandi_name: string;
  city: string;
  price: number | null;
  min_price: number | null;
  max_price: number | null;
  fqp_price: number | null;
  recorded_date: string | null;
  source: string;
}

export interface AllRatesResponse {
  unit: string;
  recorded_date: string | null;
  total: number;
  crops: CropPrice[];
}

export interface MandiPrice {
  mandi: string;
  city: string;
  price_per_kg: number;
  min_price_per_kg?: number;
  max_price_per_kg?: number;
  fqp_price_per_kg?: number;
  recorded_date: string;
  source: string;
}

export interface RatesResponse {
  crop: string;
  unit: string;
  prices: MandiPrice[];
  cached?: boolean;
}

export interface TrendEntry {
  crop: string;
  current_avg: number;
  previous_avg?: number;
  change_percent?: number;
  direction: 'up' | 'down' | 'flat' | 'new';
}

export interface TrendingResponse {
  days: number;
  trends: TrendEntry[];
}

// ── Service ──────────────────────────────────────────────────────────────────

export const marketService = {
  /** Get all latest mandi rates (optionally search by crop name) */
  async getAllRates(query?: string): Promise<AllRatesResponse> {
    const q = query ? `?q=${encodeURIComponent(query)}` : '';
    return api.get<AllRatesResponse>(`/market/rates${q}`);
  },

  /** Get latest mandi prices for a specific crop */
  async getRates(crop: string): Promise<RatesResponse> {
    return api.get<RatesResponse>(`/market/rates/${encodeURIComponent(crop)}`);
  },

  /** Get trending price directions for all crops over the last N days */
  async getTrending(days: number = 7): Promise<TrendingResponse> {
    return api.get<TrendingResponse>(`/market/rates/trending?days=${days}`);
  },
};
