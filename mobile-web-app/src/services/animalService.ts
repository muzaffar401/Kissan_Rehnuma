/**
 * Animal Disease Service for Kissan Rehnuma.
 *
 * Handles animal disease detection API calls through the gateway:
 * - Detect disease from livestock image (AI-powered)
 * - Get scan history
 * - Service health check
 *
 * All endpoints go through: Gateway → animal-disease-service
 * Auth: JWT token required for detect and history (auto-injected by apiClient)
 */

import { Platform } from 'react-native';
import { api } from './apiClient';
import { ENDPOINTS } from './config';

// =========================================================
// Types (matching animal-disease-service responses)
// =========================================================

export interface AnimalDetectResponse {
  scan_id: string;
  is_animal: boolean;
  animal_type: string | null;
  disease_name: string | null;
  scientific_name: string | null;
  confidence: number | null;
  symptoms: string[];
  causes: string;
  treatment_recommendations: string;
  prevention_tips: string[];
  affected_species: string;
  image_url: string;
  language: string;
  message: string;
}

export interface AnimalHistoryItem extends AnimalDetectResponse {
  created_at: string;
}

export interface AnimalHealthResponse {
  status: string;
  service: string;
  database: string;
  vision_model: string;
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
// Animal Disease Service
// =========================================================

export const animalService = {
  /**
   * Detect animal disease from a livestock image.
   *
   * Sends image to gateway which proxies to animal-disease-service.
   * The service will:
   * 1. Upload image to Cloudinary
   * 2. Call OpenRouter (Gemini Vision) for analysis
   * 3. Apply Confidence Gate
   * 4. Return diagnosis with treatment recommendations
   *
   * @param imageUri - Local file URI of the image
   * @param imageName - File name (e.g., 'cow.jpg')
   * @param imageType - MIME type (e.g., 'image/jpeg')
   * @param language - Response language: 'en', 'ur', 'pa', 'sd'
   */
  async detectDisease(
    imageUri: string,
    imageName: string,
    imageType: string,
    language: string = 'en',
  ): Promise<AnimalDetectResponse> {
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

    return api.postForm<AnimalDetectResponse>(ENDPOINTS.animal.detect, formData);
  },

  /**
   * Get scan history for the authenticated user.
   *
   * @param limit - Maximum number of results (default: 50, max: 200)
   */
  async getHistory(limit: number = 50): Promise<AnimalHistoryItem[]> {
    return api.get<AnimalHistoryItem[]>(
      `${ENDPOINTS.animal.history}?limit=${limit}`,
    );
  },

  /**
   * Check animal disease service health.
   * Public endpoint (no auth required).
   */
  async getHealth(): Promise<AnimalHealthResponse> {
    return api.get<AnimalHealthResponse>(
      ENDPOINTS.animal.health,
      { skipAuth: true },
    );
  },
};
