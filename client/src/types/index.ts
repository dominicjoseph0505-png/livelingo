export interface LanguageConfig {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  speechCode: string;
  ttsVoiceDefault: string;
  direction: 'ltr' | 'rtl';
  status: 'active' | 'beta' | 'coming-soon';
}

export interface Participant {
  id: string;
  name: string;
  role: 'host' | 'guest';
  preferredLanguage: string;
  isMuted: boolean;
  isDeafened: boolean;
  isConnected: boolean;
  joinedAt: string;
}

export interface TranscriptItem {
  id: string;
  senderId: string;
  senderName: string;
  originalText: string;
  originalLang: string;
  translatedText: string;
  translatedLang: string;
  timestamp: string;
  status: 'translating' | 'translated' | 'spoken';
}

export interface RoomSession {
  id: string;
  code: string;
  createdAt: string;
  status: 'waiting' | 'active' | 'ended';
  hostParticipantId: string;
  sourceLang: string;
  targetLang: string;
  participants: Record<string, Participant>;
  callStartedAt: string | null;
  callEndedAt: string | null;
  durationSeconds: number;
  transcriptLog: TranscriptItem[];
}

export interface LiveKitTokenResponse {
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

export type LiveKitConnectionStatus =
  | 'unconfigured'
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

export interface TranslationResult {
  sourceText: string;
  sourceLang: string;
  targetLang: string;
  translatedText: string;
  confidence: number;
  engine: string;
  latencyMs: number;
  isExternalServiceConnected: boolean;
  limitation?: string;
}

export interface LanguageCapability {
  code: string;
  stt: 'enabled' | 'browser-dependent';
  translation: 'enabled';
  tts: 'enabled' | 'browser-dependent';
  note: string;
  verification: 'unverified' | 'passed' | 'failed';
}

export interface ServiceStatus {
  calling?: {
    provider: string;
    isConfigured: boolean;
    maxParticipantsPerRoom: number;
    status: string;
    note: string;
  };
  translation: {
    provider: string;
    isExternalServiceConnected: boolean;
    status: string;
    note: string;
  };
  speechRecognition: {
    provider: string;
    isExternalServiceConnected: boolean;
    recommendedClientEngine: string;
  };
  textToSpeech: {
    provider: string;
    isExternalServiceConnected: boolean;
    recommendedClientEngine: string;
  };
}

export interface UserPreferences {
  userName: string;
  preferredLanguage: string;
  targetLanguage: string;
  autoPlayTts: boolean;
  ttsSpeed: number; // 0.8, 1.0, 1.2
  audioInputDeviceId: string;
  audioOutputDeviceId: string;
  showOriginalSubtitles: boolean;
  showTranslatedSubtitles: boolean;
}
