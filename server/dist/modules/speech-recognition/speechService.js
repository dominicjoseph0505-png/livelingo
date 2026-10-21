import { CONFIG } from '../../config/index.js';
// BCP-47 codes Sarvam STT supports
const SARVAM_STT_LANGS = {
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
export class SpeechRecognitionService {
    providerName = 'LiveLingo STT (Sarvam Saaras + Web Speech fallback)';
    validateAudioConfig(metadata) {
        return Boolean(metadata.language);
    }
    /**
     * Transcribe an audio buffer using Sarvam Saaras v2.
     * Called from the /stt endpoint when the client sends a recorded audio blob
     * (typically for Kannada or Tamil where browser STT is unreliable).
     *
     * @param audioBuffer  Raw audio bytes (WAV or WebM/Opus from MediaRecorder)
     * @param mimeType     MIME type of the audio blob
     * @param language     BCP-47 short code, e.g. 'kn', 'hi', 'ta'
     */
    async transcribeAudio(audioBuffer, mimeType, language) {
        const lang = language.toLowerCase().slice(0, 2);
        const bcp = SARVAM_STT_LANGS[lang];
        if (!CONFIG.sarvam.isConfigured || !bcp) {
            // Not a Sarvam language or key missing — client should use Web Speech API
            return {
                transcript: '',
                isFinal: true,
                confidence: 0,
                language,
                timestamp: new Date().toISOString(),
                engine: 'web-speech-fallback',
                isExternalServiceConnected: false,
                limitation: CONFIG.sarvam.isConfigured
                    ? `Language ${language} is not supported by Sarvam STT.`
                    : 'Set SARVAM_API_KEY in server/.env to enable cloud STT for Indian languages.',
            };
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);
        try {
            // Sarvam STT expects multipart/form-data with the audio file
            const form = new FormData();
            // Determine extension from mime type
            const ext = mimeType.includes('webm') ? 'webm'
                : mimeType.includes('ogg') ? 'ogg'
                    : mimeType.includes('wav') ? 'wav'
                        : 'webm';
            form.append('file', new Blob([audioBuffer.buffer], { type: mimeType }), `audio.${ext}`);
            form.append('language_code', bcp);
            form.append('model', CONFIG.sarvam.sttModel);
            form.append('with_timestamps', 'false');
            form.append('debug_mode', 'false');
            const response = await fetch(`${CONFIG.sarvam.baseUrl}/speech-to-text`, {
                method: 'POST',
                signal: controller.signal,
                headers: {
                    'api-subscription-key': CONFIG.sarvam.apiKey,
                    // Do NOT set Content-Type — fetch sets it automatically for FormData
                },
                body: form,
            });
            if (!response.ok) {
                const errText = await response.text().catch(() => response.status.toString());
                throw new Error(`Sarvam STT HTTP ${response.status}: ${errText}`);
            }
            const payload = (await response.json());
            const transcript = payload.transcript?.trim() ?? '';
            return {
                transcript,
                isFinal: true,
                confidence: payload.confidence ?? 0.9,
                language,
                timestamp: new Date().toISOString(),
                engine: 'sarvam-saaras',
                isExternalServiceConnected: true,
            };
        }
        catch (err) {
            console.error('[SpeechService] Sarvam STT error:', err.message);
            return {
                transcript: '',
                isFinal: true,
                confidence: 0,
                language,
                timestamp: new Date().toISOString(),
                engine: 'sarvam-saaras',
                isExternalServiceConnected: true,
                limitation: `Sarvam STT unavailable (${err.message}).`,
            };
        }
        finally {
            clearTimeout(timeout);
        }
    }
    /** Used by signaling.ts to wrap client-reported Web Speech results */
    processClientSpeechEvent(data) {
        return {
            transcript: data.text.trim(),
            isFinal: data.isFinal,
            confidence: data.confidence ?? 0.95,
            language: data.language,
            timestamp: new Date().toISOString(),
            engine: 'client-web-speech',
            isExternalServiceConnected: false,
        };
    }
    getStatus() {
        return {
            provider: this.providerName,
            sarvamConfigured: CONFIG.sarvam.isConfigured,
            sarvamLanguages: Object.keys(SARVAM_STT_LANGS),
            webSpeechFallbackLanguages: ['en', 'es', 'de'],
            supportedAudioCodecs: ['audio/webm;codecs=opus', 'audio/ogg', 'audio/wav'],
            isExternalServiceConnected: CONFIG.sarvam.isConfigured,
            note: CONFIG.sarvam.isConfigured
                ? 'Sarvam Saaras active for Indian languages. Browser Web Speech used for English, Spanish, German.'
                : 'Set SARVAM_API_KEY in server/.env to enable Sarvam STT for Kannada and Tamil.',
        };
    }
}
export const speechRecognitionService = new SpeechRecognitionService();
