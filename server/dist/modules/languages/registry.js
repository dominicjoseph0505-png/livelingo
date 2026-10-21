export const LANGUAGE_CODES = ['en', 'kn', 'hi', 'es', 'de', 'ta'];
export const LANGUAGE_CAPABILITIES = [
    {
        code: 'en',
        stt: 'enabled',
        translation: 'enabled',
        tts: 'enabled',
        note: 'Web Speech STT/TTS is widely available. Mark passed only after an end-to-end test on the device.',
        verification: 'unverified',
    },
    {
        code: 'kn',
        stt: 'browser-dependent',
        translation: 'enabled',
        tts: 'browser-dependent',
        note: 'Kannada STT and neural TTS vary by browser and OS voice pack. If no voice is installed, show text only.',
        verification: 'unverified',
    },
    {
        code: 'hi',
        stt: 'enabled',
        translation: 'enabled',
        tts: 'enabled',
        note: 'Hindi is typically available in Chromium Web Speech. Confirm the installed voice before advertising quality.',
        verification: 'unverified',
    },
    {
        code: 'es',
        stt: 'enabled',
        translation: 'enabled',
        tts: 'enabled',
        note: 'Spanish STT/TTS is commonly available. Confirm locale pronunciation on the device.',
        verification: 'unverified',
    },
    {
        code: 'de',
        stt: 'enabled',
        translation: 'enabled',
        tts: 'enabled',
        note: 'German STT/TTS is commonly available. Confirm locale pronunciation on the device.',
        verification: 'unverified',
    },
    {
        code: 'ta',
        stt: 'browser-dependent',
        translation: 'enabled',
        tts: 'browser-dependent',
        note: 'Tamil STT and neural TTS vary by browser and OS voice pack. If no voice is installed, show text only.',
        verification: 'unverified',
    },
];
export function isSupportedLanguage(code) {
    return LANGUAGE_CODES.includes(code.toLowerCase().slice(0, 2));
}
export function directedPairs() {
    const pairs = [];
    for (const source of LANGUAGE_CODES) {
        for (const target of LANGUAGE_CODES) {
            if (source === target)
                continue;
            pairs.push({ source, target, verification: 'unverified' });
        }
    }
    return pairs;
}
export function capabilityMatrix(languages) {
    return {
        languages: languages.map((lang) => ({
            ...lang,
            capability: LANGUAGE_CAPABILITIES.find((item) => item.code === lang.code),
        })),
        directedPairs: directedPairs(),
        note: 'Pairs stay unverified until an end-to-end STT → translation → TTS test is recorded. Do not advertise zero lag.',
    };
}
