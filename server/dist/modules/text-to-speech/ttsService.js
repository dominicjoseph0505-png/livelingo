import { CONFIG } from '../../config/index.js';
// BCP-47 codes Sarvam TTS supports
const SARVAM_TTS_LANGS = {
    hi: 'hi-IN',
    kn: 'kn-IN',
    ta: 'ta-IN',
    en: 'en-IN',
    bn: 'bn-IN',
    gu: 'gu-IN',
    ml: 'ml-IN',
    mr: 'mr-IN',
    pa: 'pa-IN',
    te: 'te-IN',
};
export const DEFAULT_VOICE_PROFILES = {
    en: {
        id: 'en-natural-standard',
        name: 'English neural (Jenny / Samantha / Google US English)',
        lang: 'en-US',
        gender: 'female',
        preferredBrowserVoices: ['Microsoft Jenny Online (Natural)', 'Google US English', 'Samantha', 'en-US'],
    },
    kn: {
        id: 'kn-sarvam-kavya',
        name: 'Kannada — Sarvam Bulbul (kavya)',
        lang: 'kn-IN',
        gender: 'female',
        preferredBrowserVoices: ['Google ಕನ್ನಡ', 'Microsoft Sapna Online (Natural)', 'kn-IN'],
    },
    hi: {
        id: 'hi-sarvam-pooja',
        name: 'Hindi — Sarvam Bulbul (pooja)',
        lang: 'hi-IN',
        gender: 'female',
        preferredBrowserVoices: ['Microsoft Swara Online (Natural)', 'Google हिन्दी', 'hi-IN'],
    },
    es: {
        id: 'es-natural-standard',
        name: 'Spanish neural (Elvira / Google español)',
        lang: 'es-ES',
        gender: 'female',
        preferredBrowserVoices: ['Microsoft Elvira Online (Natural)', 'Google español', 'Monica', 'es-ES'],
    },
    de: {
        id: 'de-natural-standard',
        name: 'German neural (Katja / Google Deutsch)',
        lang: 'de-DE',
        gender: 'female',
        preferredBrowserVoices: ['Microsoft Katja Online (Natural)', 'Google Deutsch', 'Anna', 'de-DE'],
    },
    ta: {
        id: 'ta-sarvam-gokul',
        name: 'Tamil — Sarvam Bulbul (gokul)',
        lang: 'ta-IN',
        gender: 'male',
        preferredBrowserVoices: ['Google தமிழ்', 'Microsoft Pallavi Online (Natural)', 'ta-IN'],
    },
};
export class TTSService {
    providerName = 'LiveLingo Neural TTS (Sarvam Bulbul + Browser fallback)';
    getVoiceProfile(langCode) {
        const key = langCode.toLowerCase().slice(0, 2);
        return DEFAULT_VOICE_PROFILES[key] ?? {
            id: `${key}-default`,
            name: `${langCode.toUpperCase()} Default Voice`,
            lang: langCode,
            gender: 'female',
            preferredBrowserVoices: [langCode],
            limitation: 'No verified neural voice registered for this language.',
        };
    }
    /**
     * Synthesise speech using Sarvam Bulbul v3 for Indian languages.
     * Returns base64-encoded WAV audio the client can play directly.
     * For non-Indian languages (es, de) returns null — client uses browser TTS.
     */
    async synthesise(request) {
        const lang = request.lang.toLowerCase().slice(0, 2);
        const bcp = SARVAM_TTS_LANGS[lang];
        if (!CONFIG.sarvam.isConfigured || !bcp) {
            // Not a Sarvam language or key not set — caller falls back to browser TTS
            return null;
        }
        const speaker = CONFIG.sarvam.ttsSpeakers[lang] ?? CONFIG.sarvam.ttsSpeakers['en'] ?? 'simran';
        const pace = Math.min(2.0, Math.max(0.5, request.rate ?? 1.0));
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);
        try {
            const response = await fetch(`${CONFIG.sarvam.baseUrl}/text-to-speech`, {
                method: 'POST',
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'api-subscription-key': CONFIG.sarvam.apiKey,
                },
                body: JSON.stringify({
                    text: request.text.slice(0, 2500), // Sarvam v3 limit
                    language_code: bcp,
                    speaker,
                    model: CONFIG.sarvam.ttsModel,
                    pace,
                    speech_sample_rate: 22050,
                    output_audio_codec: 'wav',
                    enable_preprocessing: false,
                }),
            });
            if (!response.ok) {
                const errText = await response.text().catch(() => response.status.toString());
                throw new Error(`Sarvam TTS HTTP ${response.status}: ${errText}`);
            }
            const payload = (await response.json());
            const audioBase64 = payload.audios?.[0];
            if (!audioBase64)
                throw new Error('Empty audio from Sarvam TTS');
            return {
                audioBase64,
                mimeType: 'audio/wav',
                engine: 'sarvam-bulbul',
                lang: request.lang,
                isExternalServiceConnected: true,
            };
        }
        catch (err) {
            console.error('[TTSService] Sarvam TTS error:', err.message);
            return {
                audioBase64: '',
                mimeType: 'audio/wav',
                engine: 'sarvam-bulbul',
                lang: request.lang,
                isExternalServiceConnected: true,
                limitation: `Sarvam TTS unavailable (${err.message}). Client will use browser voice.`,
            };
        }
        finally {
            clearTimeout(timeout);
        }
    }
    getStatus() {
        return {
            provider: this.providerName,
            sarvamConfigured: CONFIG.sarvam.isConfigured,
            sarvamLanguages: Object.keys(SARVAM_TTS_LANGS),
            browserFallbackLanguages: ['es', 'de', 'en'],
            isExternalServiceConnected: CONFIG.sarvam.isConfigured,
            note: CONFIG.sarvam.isConfigured
                ? 'Sarvam Bulbul v3 active for Indian languages. Browser TTS used for Spanish and German.'
                : 'Set SARVAM_API_KEY in server/.env to enable Indian-language neural TTS. Browser voices used as fallback.',
        };
    }
}
export const ttsService = new TTSService();
