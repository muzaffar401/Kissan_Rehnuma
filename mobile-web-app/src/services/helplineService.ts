/**
 * Voice helpline service for Kissan Rehnuma.
 *
 * Handles LiveKit token fetching from the voice-agent token server.
 * The token server generates JWTs and dispatches the AI agent to the room.
 */

import { TOKEN_SERVER_URL } from './config';

export interface VoiceTokenResponse {
  token: string;
  identity: string;
  room: string;
}

/**
 * Generate a unique room name for this call.
 */
export function generateRoomName(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `krn-room-${timestamp}-${random}`;
}

/**
 * Fetch a LiveKit token from the token server.
 *
 * @param identity  Unique caller identity (farmer UUID or user ID)
 * @param roomName  LiveKit room name
 * @param farmerId  Real farmer UUID from the database
 * @param farmerName Farmer's display name for personalization
 * @param language  Language code ('en', 'ur', 'sd') for voice agent
 */
export async function fetchVoiceToken(
  identity: string,
  roomName: string,
  farmerId?: string | null,
  farmerName?: string | null,
  language?: string | null,
): Promise<VoiceTokenResponse> {
  const params = new URLSearchParams({
    identity,
    room: roomName,
  });

  if (farmerId) {
    params.append('farmer_id', farmerId);
  }
  if (farmerName) {
    params.append('farmer_name', farmerName);
  }
  if (language) {
    params.append('language', language);
  }

  const url = `${TOKEN_SERVER_URL}/?${params.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error');
    throw new Error(`Token server error ${response.status}: ${text}`);
  }

  return response.json();
}
