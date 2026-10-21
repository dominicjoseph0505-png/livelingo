// Type declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export interface SpeechRecognitionCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onResult?: (text: string, isFinal: boolean) => void;
  onError?: (error: any) => void;
}

export class BrowserSpeechRecognition {
  private recognition: any = null;
  private isListening: boolean = false;
  private isExplicitlyStopped: boolean = false;
  private suppressCapture: boolean = false;
  private language: string = 'en-US';
  private callbacks: SpeechRecognitionCallbacks = {};
  private silenceTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.setupHandlers();
    }
  }

  public isSupported(): boolean {
    return Boolean(this.recognition);
  }

  public setLanguage(langCode: string) {
    // Map short codes (e.g. 'en', 'hi') to speech recognition codes
    const map: Record<string, string> = {
      en: 'en-US',
      kn: 'kn-IN',
      hi: 'hi-IN',
      es: 'es-ES',
      de: 'de-DE',
      ta: 'ta-IN',
    };
    this.language = map[langCode.toLowerCase()] || langCode;
    if (this.recognition) {
      this.recognition.lang = this.language;
    }
  }

  private setupHandlers() {
    if (!this.recognition) return;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.callbacks.onStart?.();
    };

    this.recognition.onresult = (event: any) => {
      if (this.suppressCapture) return;
      
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Reset silence timeout whenever we get a result
      this.clearSilenceTimeout();

      if (finalTranscript.trim()) {
        this.callbacks.onResult?.(finalTranscript.trim(), true);
        // Start silence timer after final result — if no new speech within 2s, finalize
        this.setSilenceTimeout();
      } else if (interimTranscript.trim()) {
        this.callbacks.onResult?.(interimTranscript.trim(), false);
      }
    };

    this.recognition.onerror = (event: any) => {
      // Don't treat "no-speech" as fatal, it just means silence
      if (event.error !== 'no-speech') {
        console.warn('[SpeechRecognition] Error:', event.error);
        this.callbacks.onError?.(event);
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.clearSilenceTimeout();
      this.callbacks.onEnd?.();

      // CRITICAL FIX: Do NOT auto-restart if audio suppression is active
      // This prevents the mic from picking up TTS playback and creating echo loops
      if (!this.isExplicitlyStopped && !this.suppressCapture) {
        try {
          this.recognition.start();
        } catch {
          // Ignore restart conflicts
        }
      }
    };
  }

  private setSilenceTimeout() {
    this.clearSilenceTimeout();
    this.silenceTimeoutId = setTimeout(() => {
      // After 4 seconds of silence following a final result, stop and restart
      // This allows multi-clause sentences to be captured continuously
      // 4s timeout gives users time to naturally speak without being cut off
      if (this.recognition && this.isListening && !this.suppressCapture) {
        try {
          this.recognition.stop();
          // Don't restart immediately — let onend handle it
        } catch {
          // Ignore
        }
      }
    }, 4000);
  }

  private clearSilenceTimeout() {
    if (this.silenceTimeoutId) {
      clearTimeout(this.silenceTimeoutId);
      this.silenceTimeoutId = null;
    }
  }

  public setCaptureSuppressed(suppressed: boolean) {
    this.suppressCapture = suppressed;
  }

  public start(callbacks: SpeechRecognitionCallbacks) {
    this.callbacks = callbacks;
    this.isExplicitlyStopped = false;

    if (!this.recognition) {
      this.callbacks.onError?.(new Error('Web Speech API is not supported in this browser. You can still use push-to-translate text input.'));
      return;
    }

    try {
      this.recognition.lang = this.language;
      this.recognition.start();
    } catch (err: any) {
      // Already running or permission issue
      if (err.name !== 'InvalidStateError') {
        this.callbacks.onError?.(err);
      }
    }
  }

  public stop() {
    this.isExplicitlyStopped = true;
    this.clearSilenceTimeout();
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore
      }
    }
    this.isListening = false;
  }

  public getListeningState(): boolean {
    return this.isListening;
  }
}

export const speechRecognition = new BrowserSpeechRecognition();
