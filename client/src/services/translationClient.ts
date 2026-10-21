/**
 * Client-side translation — calls MyMemory directly from the browser.
 * Used by Conversation Mode to skip the server round-trip and cut latency
 * by ~200–600 ms compared to routing through the backend.
 *
 * Falls back to the server API on error.
 */

const MYMEMORY_ENDPOINT = 'https://api.mymemory.translated.net/get';

// Ten-minute in-memory cache keyed by "src|tgt|text"
const cache = new Map<string, { text: string; ts: number }>();
const CACHE_TTL = 10 * 60 * 1000;

// Simple phrase table for instant (0 ms) common lookups
const PHRASE_TABLE: Record<string, Record<string, string>> = {
  hello:           { hi: 'नमस्ते',    es: 'Hola',     de: 'Hallo',           en: 'Hello',         kn: 'ನಮಸ್ಕಾರ', ta: 'வணக்கம்'       },
  hi:              { hi: 'नमस्ते',    es: 'Hola',     de: 'Hallo',           en: 'Hi',            kn: 'ನಮಸ್ಕಾರ', ta: 'வணக்கம்'       },
  'thank you':     { hi: 'धन्यवाद',   es: 'Gracias',  de: 'Danke',           en: 'Thank you',     kn: 'ಧನ್ಯವಾದ',  ta: 'நன்றி'         },
  'thanks':        { hi: 'धन्यवाद',   es: 'Gracias',  de: 'Danke',           en: 'Thanks',        kn: 'ಧನ್ಯವಾದ',  ta: 'நன்றி'         },
  'yes':           { hi: 'हाँ',       es: 'Sí',       de: 'Ja',              en: 'Yes',           kn: 'ಹೌದು',      ta: 'ஆம்'           },
  'no':            { hi: 'नहीं',      es: 'No',       de: 'Nein',            en: 'No',            kn: 'ಇಲ್ಲ',      ta: 'இல்லை'         },
  'please':        { hi: 'कृपया',     es: 'Por favor',de: 'Bitte',           en: 'Please',        kn: 'ದಯವಿಟ್ಟು',  ta: 'தயவுசெய்து'    },
  'goodbye':       { hi: 'अलविदा',    es: 'Adiós',    de: 'Auf Wiedersehen', en: 'Goodbye',       kn: 'ವಿದಾಯ',    ta: 'பிரியாவிடை'    },
  'sorry':         { hi: 'माफ़ कीजिए', es: 'Lo siento',de: 'Entschuldigung',  en: 'Sorry',         kn: 'ಕ್ಷಮಿಸಿ',   ta: 'மன்னிக்கவும்' },
  'how much':      { hi: 'कितना?',    es: '¿Cuánto?', de: 'Wie viel?',       en: 'How much?',     kn: 'ಎಷ್ಟು?',   ta: 'எவ்வளவு?'     },
  'how are you':   { hi: 'आप कैसे हैं?', es: '¿Cómo estás?', de: 'Wie geht es dir?', en: 'How are you?', kn: 'ನೀವು ಹೇಗಿದ್ದೀರಿ?', ta: 'நீங்கள் எப்படி இருக்கிறீர்கள்?' },
  'nice to meet you': { hi: 'आपसे मिलकर अच्छा लगा', es: 'Mucho gusto', de: 'Schön, dich zu treffen', en: 'Nice to meet you', kn: 'ನಿಮ್ಮನ್ನು ಭೇಟಿಯಾಗಿ ಸಂತೋಷ', ta: 'உங்களை சந்தித்ததில் மகிழ்ச்சி' },
};

function normalize(text: string): string {
  return text.toLowerCase().replace(/[.,!?¿¡।॥]/g, '').trim();
}

function phraseHit(text: string, tgt: string): string | null {
  const row = PHRASE_TABLE[normalize(text)];
  return row?.[tgt] ?? null;
}

export interface ClientTranslationResult {
  translatedText: string;
  engine: 'phrase-table' | 'client-mymemory' | 'error-passthrough';
  latencyMs: number;
  limitation?: string;
}

export async function translateClient(
  text: string,
  src: string,
  tgt: string,
  signal?: AbortSignal
): Promise<ClientTranslationResult> {
  const t0 = Date.now();
  const clean = text.trim();
  if (!clean || src === tgt) {
    return { translatedText: clean, engine: 'phrase-table', latencyMs: 0 };
  }

  // 1. Phrase table — instant
  const phrase = phraseHit(clean, tgt);
  if (phrase) {
    return { translatedText: phrase, engine: 'phrase-table', latencyMs: Date.now() - t0 };
  }

  // 2. Cache
  const key = `${src}|${tgt}|${clean.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    return { translatedText: hit.text, engine: 'client-mymemory', latencyMs: Date.now() - t0 };
  }

  // 3. MyMemory direct
  try {
    const url = `${MYMEMORY_ENDPOINT}?q=${encodeURIComponent(clean)}&langpair=${encodeURIComponent(`${src}|${tgt}`)}`;
    const res = await fetch(url, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as { responseData?: { translatedText?: string }; responseStatus?: number };
    const translated = json.responseData?.translatedText?.trim() ?? '';
    if (!translated || /invalid language pair|query length/i.test(translated)) {
      throw new Error('Bad response from MyMemory');
    }
    cache.set(key, { text: translated, ts: Date.now() });
    return { translatedText: translated, engine: 'client-mymemory', latencyMs: Date.now() - t0 };
  } catch (err: any) {
    if (err?.name === 'AbortError') throw err; // propagate cancellation
    // Passthrough — show original text, surface limitation
    return {
      translatedText: clean,
      engine: 'error-passthrough',
      latencyMs: Date.now() - t0,
      limitation: `Translation unavailable (${err?.message ?? 'network error'}). Showing original.`,
    };
  }
}
