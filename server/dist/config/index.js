import dotenv from 'dotenv';
dotenv.config();
export const SUPPORTED_LANGUAGES = [
    {
        code: 'en',
        name: 'English',
        nativeName: 'English',
        flag: '🇬🇧',
        speechCode: 'en-US',
        ttsVoiceDefault: 'en-US-JennyNeural',
        direction: 'ltr',
        status: 'active',
    },
    {
        code: 'kn',
        name: 'Kannada',
        nativeName: 'ಕನ್ನಡ',
        flag: '🇮🇳',
        speechCode: 'kn-IN',
        ttsVoiceDefault: 'kn-IN-SapnaNeural',
        direction: 'ltr',
        status: 'beta',
    },
    {
        code: 'hi',
        name: 'Hindi',
        nativeName: 'हिन्दी',
        flag: '🇮🇳',
        speechCode: 'hi-IN',
        ttsVoiceDefault: 'hi-IN-SwaraNeural',
        direction: 'ltr',
        status: 'active',
    },
    {
        code: 'es',
        name: 'Spanish',
        nativeName: 'Español',
        flag: '🇪🇸',
        speechCode: 'es-ES',
        ttsVoiceDefault: 'es-ES-ElviraNeural',
        direction: 'ltr',
        status: 'active',
    },
    {
        code: 'de',
        name: 'German',
        nativeName: 'Deutsch',
        flag: '🇩🇪',
        speechCode: 'de-DE',
        ttsVoiceDefault: 'de-DE-KatjaNeural',
        direction: 'ltr',
        status: 'active',
    },
    {
        code: 'ta',
        name: 'Tamil',
        nativeName: 'தமிழ்',
        flag: '🇮🇳',
        speechCode: 'ta-IN',
        ttsVoiceDefault: 'ta-IN-PallaviNeural',
        direction: 'ltr',
        status: 'beta',
    },
];
const livekitUrl = process.env.LIVEKIT_URL?.trim() || '';
const livekitApiKey = process.env.LIVEKIT_API_KEY?.trim() || '';
const livekitApiSecret = process.env.LIVEKIT_API_SECRET?.trim() || '';
const isLiveKitValid = Boolean(livekitUrl &&
    livekitApiKey &&
    livekitApiSecret &&
    !livekitUrl.includes('your-project') &&
    !livekitApiKey.includes('your_api_key'));
const sarvamApiKey = process.env.SARVAM_API_KEY?.trim() || '';
const isSarvamConfigured = Boolean(sarvamApiKey && !sarvamApiKey.includes('your_'));
export const CONFIG = {
    port: parseInt(process.env.PORT || '3001', 10),
    host: process.env.HOST || '0.0.0.0',
    corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:5173', 'http://127.0.0.1:5173'],
    sessionTimeoutMinutes: 120,
    // LiveKit WebRTC Audio Calling Configuration
    livekit: {
        url: livekitUrl,
        apiKey: livekitApiKey,
        apiSecret: livekitApiSecret,
        isConfigured: isLiveKitValid,
        maxParticipantsPerRoom: 2,
        tokenTtlSeconds: 3600,
    },
    // Sarvam AI — Indian language STT, TTS, Translation
    // https://dashboard.sarvam.ai — free credits on signup
    sarvam: {
        apiKey: sarvamApiKey,
        isConfigured: isSarvamConfigured,
        baseUrl: 'https://api.sarvam.ai',
        // Languages Sarvam handles natively (all Indian scheduled languages)
        supportedLangs: ['kn', 'hi', 'ta', 'bn', 'gu', 'ml', 'mr', 'pa', 'te', 'or'],
        ttsModel: 'bulbul:v3',
        ttsSpeakers: {
            kn: 'kavya', // Kannada — female voice
            hi: 'pooja', // Hindi — female voice
            ta: 'gokul', // Tamil — male voice (Sarvam's most stable for Tamil)
            en: 'simran', // English Indian-accent fallback
        },
        sttModel: 'saaras:v2',
    },
    translationEngine: {
        provider: process.env.TRANSLATION_PROVIDER || 'mymemory',
        endpoint: process.env.TRANSLATION_API_URL || 'https://api.mymemory.translated.net/get',
        isExternalServiceConnected: Boolean(process.env.TRANSLATION_API_KEY),
    },
    ttsEngine: {
        provider: isSarvamConfigured ? 'sarvam-bulbul' : 'browser-native',
        isExternalServiceConnected: isSarvamConfigured,
    },
    speechEngine: {
        provider: isSarvamConfigured ? 'sarvam-saaras' : 'web-speech',
        isExternalServiceConnected: isSarvamConfigured,
    },
};
