import { CONFIG } from '../../config/index.js';
import { isSupportedLanguage } from '../languages/registry.js';
// ── Language-to-BCP-47 map for Sarvam ─────────────────────────────────────
const SARVAM_LANG_MAP = {
    en: 'en-IN',
    hi: 'hi-IN',
    kn: 'kn-IN',
    ta: 'ta-IN',
    bn: 'bn-IN',
    gu: 'gu-IN',
    ml: 'ml-IN',
    mr: 'mr-IN',
    pa: 'pa-IN',
    te: 'te-IN',
};
// Returns true if both langs are in Sarvam's supported set
function shouldUseSarvam(src, tgt) {
    return (CONFIG.sarvam.isConfigured &&
        (src in SARVAM_LANG_MAP) &&
        (tgt in SARVAM_LANG_MAP) &&
        // Sarvam translates between Indian langs and English;
        // pure en→es or en→de should go to MyMemory
        (src !== 'en' || tgt !== 'es') &&
        (src !== 'en' || tgt !== 'de') &&
        (src !== 'es' || tgt !== 'de') &&
        (src !== 'es' || tgt !== 'en') &&
        (src !== 'de' || tgt !== 'en') &&
        (src !== 'de' || tgt !== 'es'));
}
async function translateWithSarvam(text, sourceLang, targetLang) {
    const sourceBcp = SARVAM_LANG_MAP[sourceLang] ?? `${sourceLang}-IN`;
    const targetBcp = SARVAM_LANG_MAP[targetLang] ?? `${targetLang}-IN`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(`${CONFIG.sarvam.baseUrl}/translate`, {
            method: 'POST',
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                'api-subscription-key': CONFIG.sarvam.apiKey,
            },
            body: JSON.stringify({
                input: text,
                source_language_code: sourceBcp,
                target_language_code: targetBcp,
                model: 'sarvam-translate:v1',
                enable_preprocessing: false,
            }),
        });
        if (!response.ok) {
            const err = await response.text().catch(() => response.status.toString());
            throw new Error(`Sarvam translate HTTP ${response.status}: ${err}`);
        }
        const payload = (await response.json());
        const translated = payload.translated_text?.trim();
        if (!translated)
            throw new Error('Empty response from Sarvam translate');
        return translated;
    }
    finally {
        clearTimeout(timeout);
    }
}
const PHRASE_TABLE = {
    hello: { en: 'Hello', kn: 'ನಮಸ್ಕಾರ', hi: 'नमस्ते', es: 'Hola', de: 'Hallo', ta: 'வணக்கம்' },
    hi: { en: 'Hi', kn: 'ನಮಸ್ಕಾರ', hi: 'नमस्ते', es: 'Hola', de: 'Hallo', ta: 'வணக்கம்' },
    'how are you': { en: 'How are you?', kn: 'ನೀವು ಹೇಗಿದ್ದೀರಿ?', hi: 'आप कैसे हैं?', es: '¿Cómo estás?', de: 'Wie geht es dir?', ta: 'நீங்கள் எப்படி இருக்கிறீர்கள்?' },
    'thank you': { en: 'Thank you', kn: 'ಧನ್ಯವಾದಗಳು', hi: 'धन्यवाद', es: 'Gracias', de: 'Danke', ta: 'நன்றி' },
    thanks: { en: 'Thanks', kn: 'ಧನ್ಯವಾದಗಳು', hi: 'धन्यवाद', es: 'Gracias', de: 'Danke', ta: 'நன்றி' },
    goodbye: { en: 'Goodbye', kn: 'ವಿದಾಯ', hi: 'अलविदा', es: 'Adiós', de: 'Auf Wiedersehen', ta: 'பிரியாவிடை' },
    yes: { en: 'Yes', kn: 'ಹೌದು', hi: 'हाँ', es: 'Sí', de: 'Ja', ta: 'ஆம்' },
    no: { en: 'No', kn: 'ಇಲ್ಲ', hi: 'नहीं', es: 'No', de: 'Nein', ta: 'இல்லை' },
    please: { en: 'Please', kn: 'ದಯವಿಟ್ಟು', hi: 'कृपया', es: 'Por favor', de: 'Bitte', ta: 'தயவுசெய்து' },
    'can you hear me': { en: 'Can you hear me?', kn: 'ನಿಮಗೆ ನನ್ನ ಧ್ವನಿ ಕೇಳುತ್ತಿದೆಯೇ?', hi: 'क्या आप मुझे सुन सकते हैं?', es: '¿Puedes oírme?', de: 'Kannst du mich hören?', ta: 'என் குரல் கேட்கிறதா?' },
    'nice to meet you': { en: 'Nice to meet you', kn: 'ನಿಮ್ಮನ್ನು ಭೇಟಿಯಾಗಿ ಸಂತೋಷವಾಯಿತು', hi: 'आपसे मिलकर अच्छा लगा', es: 'Mucho gusto', de: 'Schön, dich zu treffen', ta: 'உங்களை சந்தித்ததில் மகிழ்ச்சி' },
};
const EN_TO_HI_DICTIONARY = {
    hello: 'नमस्ते',
    hi: 'नमस्ते',
    'good morning': 'शुभ प्रभात',
    'good evening': 'शुभ संध्या',
    'how are you': 'आप कैसे हैं?',
    'i am fine': 'मैं ठीक हूँ',
    'thank you': 'धन्यवाद',
    please: 'कृपया',
    yes: 'हाँ',
    no: 'नहीं',
    sorry: 'माफ़ कीजिए',
    goodbye: 'अलविदा',
    'can you hear me': 'क्या आप मुझे सुन सकते हैं?',
    'please repeat that': 'कृपया दोबारा कहिए',
    'what is your name': 'आपका नाम क्या है?',
    'i do not understand': 'मुझे समझ नहीं आया',
};
const cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;
function normalizeLang(code) {
    return code.toLowerCase().slice(0, 2);
}
function cacheKey(text, source, target) {
    return `${source}|${target}|${text.trim().toLowerCase()}`;
}
function lookupPhrase(text, targetLang) {
    const normalized = text.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~?¿¡।]/g, '').trim();
    const row = PHRASE_TABLE[normalized];
    return row?.[targetLang] || null;
}
async function translateWithMyMemory(text, sourceLang, targetLang) {
    const endpoint = CONFIG.translationEngine.endpoint;
    const url = `${endpoint}?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(`${sourceLang}|${targetLang}`)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
            throw new Error(`Translation provider returned ${response.status}`);
        }
        const payload = (await response.json());
        const translated = payload.responseData?.translatedText?.trim();
        if (!translated) {
            throw new Error('Empty translation');
        }
        // MyMemory returns "INVALID LANGUAGE PAIR" or QUERY LENGTH as the translated text on failure
        if (/invalid language pair|query length|my memory/i.test(translated)) {
            throw new Error(translated);
        }
        return translated;
    }
    finally {
        clearTimeout(timeout);
    }
}
export class TranslationService {
    name = 'LiveLingo Six-Language Translation Adapter';
    async translate(text, sourceLang, targetLang) {
        const startTime = Date.now();
        const cleanText = text.trim();
        const sLang = normalizeLang(sourceLang);
        const tLang = normalizeLang(targetLang);
        const base = {
            sourceText: cleanText,
            sourceLang: sLang,
            targetLang: tLang,
            isExternalServiceConnected: CONFIG.translationEngine.isExternalServiceConnected,
        };
        if (!cleanText) {
            return { ...base, translatedText: '', confidence: 1, engine: 'passthrough', latencyMs: 0 };
        }
        if (sLang === tLang) {
            return { ...base, translatedText: cleanText, confidence: 1, engine: 'identity', latencyMs: 1 };
        }
        if (!isSupportedLanguage(sLang) || !isSupportedLanguage(tLang)) {
            return {
                ...base,
                translatedText: cleanText,
                confidence: 0,
                engine: 'unsupported-pair',
                latencyMs: Date.now() - startTime,
                limitation: `Language pair ${sLang}→${tLang} is not in the LiveLingo registry (en, kn, hi, es, de, ta).`,
            };
        }
        const key = cacheKey(cleanText, sLang, tLang);
        const cached = cache.get(key);
        if (cached && cached.expiresAt > Date.now()) {
            return { ...cached.result, latencyMs: Date.now() - startTime };
        }
        const phraseHit = lookupPhrase(cleanText, tLang);
        if (phraseHit) {
            const result = {
                ...base,
                translatedText: phraseHit,
                confidence: 0.97,
                engine: 'phrase-table',
                latencyMs: Math.max(8, Date.now() - startTime),
            };
            cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
            return result;
        }
        if (sLang === 'en' && tLang === 'hi') {
            const normalized = cleanText.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~?]/g, '').trim();
            if (EN_TO_HI_DICTIONARY[normalized]) {
                const result = {
                    ...base,
                    translatedText: EN_TO_HI_DICTIONARY[normalized],
                    confidence: 0.98,
                    engine: 'en-hi-lexicon',
                    latencyMs: Math.max(8, Date.now() - startTime),
                };
                cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
                return result;
            }
        }
        try {
            // Route Indian language pairs through Sarvam for much better quality
            if (shouldUseSarvam(sLang, tLang)) {
                const translated = await translateWithSarvam(cleanText, sLang, tLang);
                console.log(`[Sarvam] EN→HI: "${cleanText}" → "${translated}"`);
                const result = {
                    ...base,
                    translatedText: translated,
                    confidence: 0.95,
                    engine: 'sarvam-translate',
                    latencyMs: Date.now() - startTime,
                };
                cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
                return result;
            }
            const translated = await translateWithMyMemory(cleanText, sLang, tLang);
            const result = {
                ...base,
                translatedText: translated,
                confidence: 0.86,
                engine: 'mymemory',
                latencyMs: Date.now() - startTime,
            };
            cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
            return result;
        }
        catch (error) {
            return {
                ...base,
                translatedText: cleanText,
                confidence: 0,
                engine: 'provider-error',
                latencyMs: Date.now() - startTime,
                limitation: `Translation is unavailable right now (${error?.message || 'provider error'}). Showing original text instead of a fake translation.`,
            };
        }
    }
}
export const translationService = new TranslationService();
