/**
 * Crop Disease Service for Kissan Rehnuma.
 *
 * Handles crop disease detection API calls through the gateway:
 * - Detect disease from leaf image (AI-powered)
 * - Get scan history
 * - Service health check
 *
 * All endpoints go through: Gateway → crop-disease-service
 * Auth: JWT token required for detect and history (auto-injected by apiClient)
 */

import { Platform } from 'react-native';
import { api } from './apiClient';
import { ENDPOINTS } from './config';

// =========================================================
// Types (matching crop-disease-service responses)
// =========================================================

export interface DetectResponse {
  scan_id: string;
  is_plant: boolean;
  disease_name: string | null;
  scientific_name: string | null;
  crop_type: string | null;
  confidence: number | null;
  symptoms: string[];
  causes: string;
  treatment_recommendations: string;
  prevention_tips: string[];
  affected_crops: string;
  image_url: string;
  language: string;
  message: string;
}

export interface HistoryItem extends DetectResponse {
  created_at: string;
}

export interface HistoryResponse {
  scans: HistoryItem[];
  total: number;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
}

// =========================================================
// Helpers
// =========================================================

/**
 * Convert a URI (blob:, data:, http:, file:) to a Blob.
 * Works on web only — native uses {uri, name, type} directly.
 */
async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error('Failed to fetch image for upload');
  return response.blob();
}

// =========================================================
// Crop Service
// =========================================================

export const cropService = {
  /**
   * Detect crop disease from a leaf/plant image.
   *
   * Sends image to gateway which proxies to crop-disease-service.
   * The service will:
   * 1. Upload image to Cloudinary
   * 2. Call OpenRouter (Gemini Vision) for analysis
   * 3. Apply Confidence Gate
   * 4. Return diagnosis with treatment recommendations
   *
   * @param imageUri - Local file URI of the image
   * @param imageName - File name (e.g., 'leaf.jpg')
   * @param imageType - MIME type (e.g., 'image/jpeg')
   * @param language - Response language: 'en', 'ur', 'pa', 'sd'
   */
  async detectDisease(
    imageUri: string,
    imageName: string,
    imageType: string,
    language: string = 'en',
  ): Promise<DetectResponse> {
    const formData = new FormData();

    if (Platform.OS === 'web') {
      // Web: FormData needs actual Blob/File objects (not {uri, name, type})
      const blob = await uriToBlob(imageUri);
      const file = new File([blob], imageName, { type: imageType });
      formData.append('image', file);
    } else {
      // React Native: FormData accepts {uri, name, type} directly
      formData.append('image', {
        uri: imageUri,
        name: imageName,
        type: imageType,
      } as unknown as Blob);
    }

    formData.append('language', language);

    return api.postForm<DetectResponse>(ENDPOINTS.crop.detect, formData);
  },

  /**
   * Get scan history for the authenticated user.
   *
   * @param limit - Maximum number of results (default: 50, max: 200)
   */
  async getHistory(limit: number = 50): Promise<HistoryItem[]> {
    // Service returns a raw array of scan objects: [{scan_id, ...}, ...]
    // NOT wrapped in {scans: [...], total: N}
    return api.get<HistoryItem[]>(
      `${ENDPOINTS.crop.history}?limit=${limit}`,
    );
  },

  /**
   * Check crop disease service health.
   * Public endpoint (no auth required).
   */
  async getHealth(): Promise<HealthResponse> {
    return api.get<HealthResponse>(
      ENDPOINTS.crop.health,
      { skipAuth: true },
    );
  },
};
