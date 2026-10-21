import { Router } from 'express';
import { sessionManager } from '../modules/sessions/sessionManager.js';
import { translationService } from '../modules/translation/translationService.js';
import { speechRecognitionService } from '../modules/speech-recognition/speechService.js';
import { ttsService } from '../modules/text-to-speech/ttsService.js';
import { livekitService } from '../modules/calling/livekitService.js';
import { SUPPORTED_LANGUAGES, CONFIG } from '../config/index.js';
import { capabilityMatrix, isSupportedLanguage } from '../modules/languages/registry.js';
export const apiRouter = Router();
// Health check
apiRouter.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        service: 'LiveLingo Calling Backend',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
    });
});
// Supported languages list
apiRouter.get('/languages', (_req, res) => {
    res.json({
        languages: SUPPORTED_LANGUAGES,
        primaryPair: {
            source: 'en',
            target: 'hi',
            description: 'Six-language registry: English, Kannada, Hindi, Spanish, German, Tamil',
        },
    });
});
apiRouter.get('/languages/capabilities', (_req, res) => {
    res.json(capabilityMatrix(SUPPORTED_LANGUAGES));
});
// Public service configuration & integration status
apiRouter.get('/config', (_req, res) => {
    res.json({
        services: {
            calling: {
                provider: 'LiveKit WebRTC Audio Mesh',
                isConfigured: CONFIG.livekit.isConfigured,
                maxParticipantsPerRoom: CONFIG.livekit.maxParticipantsPerRoom,
                status: CONFIG.livekit.isConfigured ? 'connected-livekit' : 'unconfigured',
                note: CONFIG.livekit.isConfigured
                    ? 'LiveKit credentials configured for real bidirectional WebRTC audio calling'
                    : 'LiveKit credentials not set in backend environment. Follow setup guide to enable real audio.',
            },
            translation: {
                provider: translationService.name,
                isExternalServiceConnected: CONFIG.translationEngine.isExternalServiceConnected,
                status: CONFIG.translationEngine.provider,
                note: 'Phrase table plus MyMemory for en, kn, hi, es, de, ta. Failed requests return original text with a limitation, never a fake translation.',
            },
            speechRecognition: speechRecognitionService.getStatus(),
            textToSpeech: ttsService.getStatus(),
        },
        version: '1.0.0',
    });
});
// Create a new call room
apiRouter.post('/rooms', (req, res) => {
    try {
        const { hostName, sourceLang = 'en', targetLang = 'hi' } = req.body;
        if (!isSupportedLanguage(sourceLang) || !isSupportedLanguage(targetLang)) {
            return res.status(400).json({
                success: false,
                error: 'Languages must be one of: en, kn, hi, es, de, ta',
            });
        }
        const { room, hostParticipant } = sessionManager.createRoom(hostName || 'Host Caller', sourceLang, targetLang);
        res.status(201).json({
            success: true,
            room,
            hostParticipant,
            invitationUrl: `/join?room=${room.code}`,
            maxParticipants: CONFIG.livekit.maxParticipantsPerRoom,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: 'Failed to create room' });
    }
});
// Get room details
apiRouter.get('/rooms/:id', (req, res) => {
    const roomId = String(req.params.id);
    const room = sessionManager.getRoom(roomId);
    if (!room) {
        return res.status(404).json({ success: false, error: 'Room not found' });
    }
    const connectedCount = Object.values(room.participants).filter((p) => p.isConnected).length;
    res.json({
        success: true,
        room,
        isFull: connectedCount >= CONFIG.livekit.maxParticipantsPerRoom,
        maxParticipants: CONFIG.livekit.maxParticipantsPerRoom,
    });
});
// Join a room (enforcing 2-participant limit)
apiRouter.post('/rooms/:id/join', (req, res) => {
    const roomId = String(req.params.id);
    const room = sessionManager.getRoom(roomId);
    if (!room) {
        return res.status(404).json({ success: false, error: 'Room not found' });
    }
    if (room.status === 'ended') {
        return res.status(400).json({ success: false, error: 'This call has already ended' });
    }
    const connectedCount = Object.values(room.participants).filter((p) => p.isConnected).length;
    if (connectedCount >= CONFIG.livekit.maxParticipantsPerRoom) {
        return res.status(403).json({
            success: false,
            error: 'Room is full. LiveLingo Calling limits rooms to two participants for private calling.',
        });
    }
    const { participantName, preferredLang } = req.body;
    if (preferredLang && !isSupportedLanguage(preferredLang)) {
        return res.status(400).json({
            success: false,
            error: 'preferredLang must be one of: en, kn, hi, es, de, ta',
        });
    }
    const result = sessionManager.joinRoom(roomId, participantName || 'Guest Caller', preferredLang);
    if (!result) {
        return res.status(400).json({ success: false, error: 'Unable to join call room' });
    }
    res.json({
        success: true,
        room: result.room,
        participant: result.participant,
    });
});
// Generate LiveKit Access Token for a participant
apiRouter.post('/rooms/:id/token', async (req, res) => {
    try {
        const roomId = String(req.params.id);
        const { participantId, participantName } = req.body;
        if (!participantId) {
            return res.status(400).json({
                success: false,
                error: 'participantId is required to generate a LiveKit access token',
            });
        }
        const tokenResult = await livekitService.generateParticipantToken(roomId, participantId, participantName || 'Caller');
        res.json(tokenResult);
    }
    catch (error) {
        console.error('[API] /rooms/:id/token error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error generating token',
        });
    }
});
// End call
apiRouter.post('/rooms/:id/end', (req, res) => {
    const roomId = String(req.params.id);
    const room = sessionManager.endRoom(roomId);
    if (!room) {
        return res.status(404).json({ success: false, error: 'Room not found' });
    }
    res.json({ success: true, room });
});
// Direct test translation endpoint
apiRouter.post('/translate', async (req, res) => {
    const { text, sourceLang = 'en', targetLang = 'hi' } = req.body;
    if (!text) {
        return res.status(400).json({ success: false, error: 'Text is required' });
    }
    const result = await translationService.translate(text, sourceLang, targetLang);
    res.json({ success: true, result });
});
// ── Sarvam TTS endpoint ────────────────────────────────────────────────────
// POST /api/tts  { text, lang, rate? }
// Returns base64 WAV audio for Indian languages via Sarvam Bulbul.
// Returns { needsBrowserTts: true } for non-Indian languages — client
// falls back to window.speechSynthesis for those.
apiRouter.post('/tts', async (req, res) => {
    const { text, lang, rate } = req.body;
    if (!text || !lang) {
        return res.status(400).json({ success: false, error: 'text and lang are required' });
    }
    const result = await ttsService.synthesise({ text, lang, rate });
    if (!result) {
        // Non-Indian language or Sarvam not configured — client handles it
        return res.json({ success: true, needsBrowserTts: true, lang });
    }
    if (result.limitation && !result.audioBase64) {
        return res.json({ success: false, needsBrowserTts: true, lang, limitation: result.limitation });
    }
    res.json({
        success: true,
        needsBrowserTts: false,
        audioBase64: result.audioBase64,
        mimeType: result.mimeType,
        engine: result.engine,
        lang,
    });
});
// ── Sarvam STT endpoint ────────────────────────────────────────────────────
// POST /api/stt  multipart/form-data: file (audio blob), lang
// Returns transcript for Indian language audio via Sarvam Saaras.
apiRouter.post('/stt', async (req, res) => {
    try {
        // Express doesn't parse multipart by default — read raw body
        // The client sends: FormData with 'audio' (Blob) and 'lang' (string)
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        await new Promise((resolve, reject) => {
            req.on('end', resolve);
            req.on('error', reject);
        });
        const rawBody = Buffer.concat(chunks);
        const contentType = req.headers['content-type'] ?? '';
        const langHeader = req.headers['x-language'] ?? 'en';
        const result = await speechRecognitionService.transcribeAudio(rawBody, contentType.split(';')[0].trim(), langHeader);
        res.json({ success: true, result });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
