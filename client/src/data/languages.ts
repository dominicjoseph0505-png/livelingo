import type { LanguageConfig } from '../types';

export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇬🇧',
    speechCode: 'en-US',
    ttsVoiceDefault: 'en-US',
    direction: 'ltr',
    status: 'active',
  },
  {
    code: 'kn',
    name: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    flag: '🇮🇳',
    speechCode: 'kn-IN',
    ttsVoiceDefault: 'kn-IN',
    direction: 'ltr',
    status: 'beta',
  },
  {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    flag: '🇮🇳',
    speechCode: 'hi-IN',
    ttsVoiceDefault: 'hi-IN',
    direction: 'ltr',
    status: 'active',
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
    speechCode: 'es-ES',
    ttsVoiceDefault: 'es-ES',
    direction: 'ltr',
    status: 'active',
  },
  {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
    speechCode: 'de-DE',
    ttsVoiceDefault: 'de-DE',
    direction: 'ltr',
    status: 'active',
  },
  {
    code: 'ta',
    name: 'Tamil',
    nativeName: 'தமிழ்',
    flag: '🇮🇳',
    speechCode: 'ta-IN',
    ttsVoiceDefault: 'ta-IN',
    direction: 'ltr',
    status: 'beta',
  },
];

export const SPEECH_LOCALE_MAP: Record<string, string> = {
  en: 'en-US',
  kn: 'kn-IN',
  hi: 'hi-IN',
  es: 'es-ES',
  de: 'de-DE',
  ta: 'ta-IN',
};

export const QUICK_PHRASES: Record<string, string[]> = {
  en: ['Hello, how are you?', 'Can you hear me clearly?', 'Nice to meet you', 'Thank you', 'What is the plan?'],
  kn: ['ನಮಸ್ಕಾರ, ನೀವು ಹೇಗಿದ್ದೀರಿ?', 'ನಿಮಗೆ ನನ್ನ ಧ್ವನಿ ಕೇಳುತ್ತಿದೆಯೇ?', 'ನಿಮ್ಮನ್ನು ಭೇಟಿಯಾಗಿ ಸಂತೋಷವಾಯಿತು', 'ಧನ್ಯವಾದಗಳು'],
  hi: ['नमस्ते, आप कैसे हैं?', 'क्या आप मुझे सुन सकते हैं?', 'आपसे मिलकर अच्छा लगा', 'धन्यवाद'],
  es: ['Hola, ¿cómo estás?', '¿Puedes oírme claramente?', 'Mucho gusto', 'Gracias'],
  de: ['Hallo, wie geht es dir?', 'Kannst du mich klar hören?', 'Schön, dich zu treffen', 'Danke'],
  ta: ['வணக்கம், நீங்கள் எப்படி இருக்கிறீர்கள்?', 'என் குரல் கேட்கிறதா?', 'உங்களை சந்தித்ததில் மகிழ்ச்சி', 'நன்றி'],
};

export function getLanguage(code: string): LanguageConfig | undefined {
  return SUPPORTED_LANGUAGES.find((lang) => lang.code === code);
}

export function formatLanguageLabel(code: string): string {
  const lang = getLanguage(code);
  if (!lang) return code.toUpperCase();
  return `${lang.flag} ${lang.name}`;
}
