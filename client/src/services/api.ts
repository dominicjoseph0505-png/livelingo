import type { RoomSession, LanguageConfig, ServiceStatus, Participant, LiveKitTokenResponse, TranslationResult, LanguageCapability } from '../types';

// Support environment-based backend URL for deployed environments
const getApiBase = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
    return `${import.meta.env.VITE_API_URL}/api`;
  }
  // Development or same-origin proxy
  return '/api';
};

const API_BASE = getApiBase();

export const api = {
  async getLanguages(): Promise<{ languages: LanguageConfig[]; primaryPair: any }> {
    const res = await fetch(`${API_BASE}/languages`);
    if (!res.ok) throw new Error('Failed to fetch languages');
    return res.json();
  },

  async getLanguageCapabilities(): Promise<{
    languages: Array<LanguageConfig & { capability?: LanguageCapability }>;
    directedPairs: Array<{ source: string; target: string; verification: string }>;
    note: string;
  }> {
    const res = await fetch(`${API_BASE}/languages/capabilities`);
    if (!res.ok) throw new Error('Failed to fetch language capabilities');
    return res.json();
  },

  async getConfig(): Promise<{ services: ServiceStatus; version: string }> {
    const res = await fetch(`${API_BASE}/config`);
    if (!res.ok) throw new Error('Failed to fetch configuration');
    return res.json();
  },

  async createRoom(
    hostName: string,
    sourceLang: string = 'en',
    targetLang: string = 'hi'
  ): Promise<{ success: boolean; room: RoomSession; hostParticipant: Participant; invitationUrl: string }> {
    const res = await fetch(`${API_BASE}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostName, sourceLang, targetLang }),
    });
    if (!res.ok) throw new Error('Failed to create call room');
    return res.json();
  },

  async getRoom(roomId: string): Promise<{ success: boolean; room: RoomSession; isFull?: boolean; maxParticipants?: number }> {
    const res = await fetch(`${API_BASE}/rooms/${encodeURIComponent(roomId)}`);
    if (!res.ok) {
      if (res.status === 404) throw new Error('Room not found');
      throw new Error('Failed to fetch room');
    }
    return res.json();
  },

  async joinRoom(
    roomId: string,
    participantName: string,
    preferredLang?: string
  ): Promise<{ success: boolean; room: RoomSession; participant: Participant }> {
    const res = await fetch(`${API_BASE}/rooms/${encodeURIComponent(roomId)}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantName, preferredLang }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to join room');
    }
    return res.json();
  },

  async getRoomToken(
    roomId: string,
    participantId: string,
    participantName: string
  ): Promise<LiveKitTokenResponse> {
    const res = await fetch(`${API_BASE}/rooms/${encodeURIComponent(roomId)}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId, participantName }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok && data.isConfigured !== false) {
      throw new Error(data.error || 'Failed to generate calling access token');
    }
    return data;
  },

  async endRoom(roomId: string): Promise<{ success: boolean; room: RoomSession }> {
    const res = await fetch(`${API_BASE}/rooms/${encodeURIComponent(roomId)}/end`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to end call');
    return res.json();
  },

  async translateText(
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<{ success: boolean; result: TranslationResult }> {
    const res = await fetch(`${API_BASE}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, sourceLang, targetLang }),
    });
    if (!res.ok) throw new Error('Translation failed');
    return res.json();
  },

  /**
   * Request neural TTS audio from the server (Sarvam Bulbul for Indian langs).
   * Returns base64 WAV if Sarvam handled it, or { needsBrowserTts: true } if
   * the client should fall back to window.speechSynthesis.
   */
  async tts(
    text: string,
    lang: string,
    rate = 1.0
  ): Promise<{
    success: boolean;
    needsBrowserTts?: boolean;
    audioBase64?: string;
    mimeType?: string;
    engine?: string;
    limitation?: string;
  }> {
    const res = await fetch(`${API_BASE}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang, rate }),
    });
    if (!res.ok) return { success: false, needsBrowserTts: true };
    return res.json();
  },

  /**
   * Send a recorded audio Blob to the server for Sarvam STT transcription.
   * Used for Kannada and Tamil where browser Web Speech is unreliable.
   */
  async stt(
    audioBlob: Blob,
    lang: string
  ): Promise<{ success: boolean; result: { transcript: string; confidence: number; engine: string; limitation?: string } }> {
    const res = await fetch(`${API_BASE}/stt`, {
      method: 'POST',
      headers: {
        'Content-Type': audioBlob.type || 'audio/webm',
        'x-language': lang,
      },
      body: audioBlob,
    });
    if (!res.ok) throw new Error('STT failed');
    return res.json();
  },
};
