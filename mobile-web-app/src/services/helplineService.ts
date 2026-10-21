/**
 * Voice helpline service for Kissan Rehnuma.
 *
 * Handles LiveKit token fetching from the voice-agent token server.
 * The token server generates JWTs and dispatches the AI agent to the room.
 */

import { TOKEN_SERVER_URL } from './config';
import { apiRequest } from './apiClient';

export interface VoiceTokenResponse {
  token: string;
  identity: string;
  room: string;
}

/**
 * Fetch a token for a server-created private room using the farmer's access JWT.
 * @param language  Language code ('en', 'ur', 'sd') for voice agent
 */
export async function fetchVoiceToken(
  language?: string | null,
): Promise<VoiceTokenResponse> {
  const params = new URLSearchParams();
  if (language) {
    params.append('language', language);
  }

  const url = `${TOKEN_SERVER_URL}/?${params.toString()}`;
  return apiRequest<VoiceTokenResponse>(url, { method: 'GET', timeout: 15000 });
}
