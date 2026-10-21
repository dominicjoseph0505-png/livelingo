import { SPEECH_LOCALE_MAP } from '../data/languages';
import { api } from './api';

export interface SpeakOptions {
  pitch?: number;
  rate?: number;
  volume?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
  onLimitation?: (message: string) => void;
}

export class BrowserSpeechSynthesis {
  private voices: SpeechSynthesisVoice[] = [];
  private isInitialized = false;
  private speakGeneration = 0;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  private loadVoices() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.voices = window.speechSynthesis.getVoices();
      if (this.voices.length > 0) {
        this.isInitialized = true;
      }
    }
  }

  public getIsReady(): boolean {
    return this.isInitialized;
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  public getVoicesForLanguage(langCode: string): SpeechSynthesisVoice[] {
    const locale = (SPEECH_LOCALE_MAP[langCode.toLowerCase()] || langCode).toLowerCase();
    const prefix = locale.slice(0, 2);
    return this.voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
  }

  public findBestVoice(langCode: string): SpeechSynthesisVoice | null {
    const matches = this.getVoicesForLanguage(langCode);
    if (matches.length === 0) return null;

    const preferred = matches.find((v) =>
      /natural|online|neural|google|microsoft|samantha|swara|lekha|jenny|elvira|katja|sapna|pallavi/i.test(
        v.name
      )
    );

    return preferred || matches[0];
  }

  public hasVoiceForLanguage(langCode: string): boolean {
    this.loadVoices();
    return this.findBestVoice(langCode) !== null;
  }

  private chunkSentences(text: string): string[] {
    const parts = text
      .split(/(?<=[.!?।॥])\s+/)
      .map((part) => part.trim())
      .filter(Boolean);
    return parts.length > 0 ? parts : [text.trim()];
  }

  public speak(text: string, langCode: string, options: SpeakOptions = {}): boolean {
    if (!this.isSupported() || !text.trim()) return false;

    this.loadVoices();
    const voice = this.findBestVoice(langCode);
    if (!voice) {
      options.onLimitation?.(
        `No installed voice for ${langCode.toUpperCase()}. Translated text is shown instead of synthesized speech.`
      );
      options.onError?.(new Error(`No TTS voice for ${langCode}`));
      return false;
    }

    this.speakGeneration += 1;
    const generation = this.speakGeneration;
    window.speechSynthesis.cancel();

    const chunks = this.chunkSentences(text);
    const locale = SPEECH_LOCALE_MAP[langCode.toLowerCase()] || langCode;

    const speakChunk = (index: number) => {
      if (generation !== this.speakGeneration) return;
      const chunk = chunks[index];
      if (!chunk) {
        options.onEnd?.();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.voice = voice;
      utterance.lang = locale;
      utterance.pitch = options.pitch ?? 1.0;
      utterance.rate = Math.min(1.15, Math.max(0.85, options.rate ?? 1.0));
      utterance.volume = options.volume ?? 1.0;

      if (index === 0) {
        utterance.onstart = () => options.onStart?.();
      }
      utterance.onend = () => speakChunk(index + 1);
      utterance.onerror = (err) => options.onError?.(err);

      window.speechSynthesis.speak(utterance);
    };

    try {
      speakChunk(0);
      return true;
    } catch (e) {
      options.onError?.(e);
      return false;
    }
  }

  public cancel() {
    this.speakGeneration += 1;
    if (this.isSupported()) {
      window.speechSynthesis.cancel();
    }
  }

  /**
   * Speak using Sarvam Bulbul for Indian languages, browser TTS for others.
   * Tries server first; if it returns needsBrowserTts or fails, falls back
   * to window.speechSynthesis automatically.
   */
  public async speakWithSarvam(
    text: string,
    langCode: string,
    options: SpeakOptions = {}
  ): Promise<boolean> {
    // Indian languages that Sarvam TTS covers
    const SARVAM_LANGS = new Set(['hi', 'kn', 'ta', 'bn', 'gu', 'ml', 'mr', 'pa', 'te']);
    const lang = langCode.toLowerCase().slice(0, 2);

    if (!SARVAM_LANGS.has(lang)) {
      // Not an Indian language — use browser TTS directly
      return this.speak(text, langCode, options);
    }

    const rate = options.rate ?? 1.0;

    try {
      const response = await api.tts(text, langCode, rate);

      if (response.needsBrowserTts || !response.audioBase64) {
        // Server said to use browser, or Sarvam not configured
        return this.speak(text, langCode, options);
      }

      // Decode base64 WAV and play via Web Audio API
      const binary = atob(response.audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const audioBlob = new Blob([bytes], { type: 'audio/wav' });
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);

      this.speakGeneration += 1;
      const gen = this.speakGeneration;

      audio.onplay  = () => { if (gen === this.speakGeneration) options.onStart?.(); };
      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (gen === this.speakGeneration) options.onEnd?.();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        // Fallback to browser TTS on audio decode error
        this.speak(text, langCode, options);
      };

      await audio.play();
      return true;
    } catch {
      // Network error or server down — fall back to browser
      return this.speak(text, langCode, options);
    }
  }

  public playTestChime(): Promise<void> {
    return new Promise((resolve) => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) {
          resolve();
          return;
        }

        const ctx = new AudioCtx();
        const notes = [523.25, 659.25, 783.99, 1046.5];

        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);

          gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.1);
          gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + idx * 0.1 + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.5);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(ctx.currentTime + idx * 0.1);
          osc.stop(ctx.currentTime + idx * 0.1 + 0.6);
        });

        setTimeout(() => {
          ctx.close().then(resolve).catch(() => resolve());
        }, 1200);
      } catch {
        resolve();
      }
    });
  }
}

export const speechSynthesisService = new BrowserSpeechSynthesis();
