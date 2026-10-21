import { AccessToken } from 'livekit-server-sdk';
import { CONFIG } from '../../config/index.js';
import { sessionManager } from '../sessions/sessionManager.js';

export interface LiveKitTokenResult {
  success: boolean;
  token?: string;
  url?: string;
  participantId?: string;
  roomName?: string;
  isConfigured: boolean;
  error?: string;
  setupInstructions?: {
    missingVars: string[];
    documentationUrl: string;
    description: string;
  };
}

export class LiveKitService {
  public isConfigured(): boolean {
    return CONFIG.livekit.isConfigured;
  }

  public getLiveKitUrl(): string {
    return CONFIG.livekit.url;
  }

  /**
   * Generates a secure, short-lived LiveKit participant JWT token for WebRTC calling.
   * Validates room participant limit (strictly max 2 participants).
   */
  public async generateParticipantToken(
    roomId: string,
    participantId: string,
    participantName: string
  ): Promise<LiveKitTokenResult> {
    const room = sessionManager.getRoom(roomId);
    if (!room) {
      return {
        success: false,
        isConfigured: this.isConfigured(),
        error: `Room '${roomId}' not found. Please create or verify the call room first.`,
      };
    }

    if (room.status === 'ended') {
      return {
        success: false,
        isConfigured: this.isConfigured(),
        error: `Call in room '${roomId}' has already ended.`,
      };
    }

    // Validate 2-participant limit
    const connectedParticipants = Object.values(room.participants).filter((p) => p.isConnected);
    const isExistingParticipant = Boolean(room.participants[participantId]);

    if (!isExistingParticipant && connectedParticipants.length >= CONFIG.livekit.maxParticipantsPerRoom) {
      return {
        success: false,
        isConfigured: this.isConfigured(),
        error: `Room '${roomId}' is full. LiveLingo Calling limits rooms to two participants for private calling.`,
      };
    }

    // If LiveKit credentials are not configured on the server, return informative status
    if (!CONFIG.livekit.isConfigured) {
      const missingVars: string[] = [];
      if (!CONFIG.livekit.url) missingVars.push('LIVEKIT_URL');
      if (!CONFIG.livekit.apiKey) missingVars.push('LIVEKIT_API_KEY');
      if (!CONFIG.livekit.apiSecret) missingVars.push('LIVEKIT_API_SECRET');

      return {
        success: false,
        isConfigured: false,
        error: 'LiveKit credentials are not configured on the backend.',
        setupInstructions: {
          missingVars,
          documentationUrl: 'https://docs.livekit.io/realtime/quickstarts/cloud/',
          description:
            'To enable real two-person WebRTC audio calling, obtain free credentials from cloud.livekit.io (or run a local LiveKit instance) and set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET in your backend environment.',
        },
      };
    }

    try {
      // Create AccessToken with short-lived TTL (1 hour default)
      const at = new AccessToken(CONFIG.livekit.apiKey, CONFIG.livekit.apiSecret, {
        identity: participantId,
        name: participantName.trim() || 'Caller',
        ttl: CONFIG.livekit.tokenTtlSeconds,
      });

      // Grant audio calling permissions strictly to this room
      at.addGrant({
        roomJoin: true,
        room: room.code, // Normalize to room code (e.g. LL-XXXX)
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      });

      const token = await at.toJwt();

      return {
        success: true,
        token,
        url: CONFIG.livekit.url,
        participantId,
        roomName: room.code,
        isConfigured: true,
      };
    } catch (err: any) {
      console.error('[LiveKitService] Token generation failed:', err);
      return {
        success: false,
        isConfigured: true,
        error: err.message || 'Failed to generate LiveKit access token',
      };
    }
  }
}

export const livekitService = new LiveKitService();
