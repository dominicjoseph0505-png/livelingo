import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRightLeft,
  Headphones,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Eraser,
  AlertTriangle,
  Zap,
  Languages,
  Radio,
  MessageSquare,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { LanguageSelector } from '../components/common/LanguageSelector';
import { AudioMeter } from '../components/common/AudioMeter';
import { api } from '../services/api';
import { translateClient } from '../services/translationClient';
import { speechRecognition } from '../services/speechRecognition';
import { speechSynthesisService } from '../services/speechSynthesis';
import { MicrophoneAudioVisualizer } from '../services/audioVisualizer';
import { getLanguage, QUICK_PHRASES } from '../data/languages';

// ─── Types ────────────────────────────────────────────────────────────────────

type AppMode = 'hotseat' | 'conversation';
type ActiveSpeaker = 'A' | 'B' | null;

interface SpeakerState {
  interim: string;
  spoken: string;
  translation: string;
  translating: boolean;
  speaking: boolean;
  latencyMs: number | null;
  engine: string | null;
  limitation: string | null;
}

const EMPTY_SPEAKER: SpeakerState = {
  interim: '',
  spoken: '',
  translation: '',
  translating: false,
  speaking: false,
  latencyMs: null,
  engine: null,
  limitation: null,
};

// ─── Conversation mode state ───────────────────────────────────────────────

interface ConvEntry {
  id: string;
  speaker: 'them' | 'me';
  original: string;
  translation: string;
  lang: string;
  translatedLang: string;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export const FaceToFacePage: React.FC = () => {
  const navigate = useNavigate();

  // Shared language config
  const [myLang, setMyLang] = useState('en');       // YOU
  const [theirLang, setTheirLang] = useState('es'); // THEM / vendor

  // Mode toggle
  const [mode, setMode] = useState<AppMode>('conversation');

  // ── Hot-seat mode state ──
  const [langA, setLangA] = useState('en');
  const [langB, setLangB] = useState('es');
  const [activeSpeaker, setActiveSpeaker] = useState<ActiveSpeaker>(null);
  const [stateA, setStateA] = useState<SpeakerState>({ ...EMPTY_SPEAKER });
  const [stateB, setStateB] = useState<SpeakerState>({ ...EMPTY_SPEAKER });

  // ── Conversation mode state ──
  const [convEntries, setConvEntries] = useState<ConvEntry[]>([]);
  // Phase: 'listening-them' = auto-listening to vendor in their language
  //        'replying-me'    = user is holding the reply button
  //        'translating'    = pipeline running
  //        'speaking'       = TTS playing
  //        'idle'           = not started yet
  type ConvPhase = 'idle' | 'listening-them' | 'translating' | 'speaking' | 'replying-me';
  const [convPhase, setConvPhase] = useState<ConvPhase>('idle');
  const [convInterim, setConvInterim] = useState('');
  const [convError, setConvError] = useState<string | null>(null);
  const convPhaseRef = useRef<ConvPhase>('idle');
  const myLangRef = useRef(myLang);
  const theirLangRef = useRef(theirLang);

  // ── Shared state ──
  const [playbackMuted, setPlaybackMuted] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pipelineLocked, setPipelineLocked] = useState(false);

  // Refs
  const langARef = useRef(langA);
  const langBRef = useRef(langB);
  const activeSpeakerRef = useRef(activeSpeaker);
  const playbackMutedRef = useRef(playbackMuted);
  const pipelineRef  = useRef(false);
  const entryIdRef   = useRef(0);
  const convGenRef   = useRef(0);
  const convAbortRef = useRef<AbortController | null>(null);
  const visualizerRef = useRef<MicrophoneAudioVisualizer | null>(null);
  const convScrollRef = useRef<HTMLDivElement>(null);
  const replyButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { langARef.current = langA; }, [langA]);
  useEffect(() => { langBRef.current = langB; }, [langB]);
  useEffect(() => { activeSpeakerRef.current = activeSpeaker; }, [activeSpeaker]);
  useEffect(() => { playbackMutedRef.current = playbackMuted; }, [playbackMuted]);
  useEffect(() => { myLangRef.current = myLang; }, [myLang]);
  useEffect(() => { theirLangRef.current = theirLang; }, [theirLang]);
  useEffect(() => { convPhaseRef.current = convPhase; }, [convPhase]);

  // Sync lang selectors with conversation mode langs when switching modes
  // Derived during the render that triggers the switch — no effect needed
  const effectiveLangA = mode === 'hotseat' ? langA : myLang;
  const effectiveLangB = mode === 'hotseat' ? langB : theirLang;
  void effectiveLangA; void effectiveLangB; // used implicitly via langA/langB state in hotseat

  // Auto-scroll conversation feed
  useEffect(() => {
    convScrollRef.current?.scrollTo({ top: convScrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [convEntries, convInterim]);

  useEffect(() => {
    visualizerRef.current = new MicrophoneAudioVisualizer();
    visualizerRef.current.start((level) => setMicLevel(level)).catch(() => {});
    return () => {
      speechRecognition.stop();
      speechSynthesisService.cancel();
      visualizerRef.current?.stop();
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // SHARED PIPELINE
  // ─────────────────────────────────────────────────────────────────────────

  const setHotA = (p: Partial<SpeakerState>) => setStateA(prev => ({ ...prev, ...p }));
  const setHotB = (p: Partial<SpeakerState>) => setStateB(prev => ({ ...prev, ...p }));
  const patchHotSpeaker = (who: 'A' | 'B', p: Partial<SpeakerState>) =>
    who === 'A' ? setHotA(p) : setHotB(p);

  async function runHotPipeline(who: 'A' | 'B', text: string, src: string, tgt: string) {
    if (!text.trim() || pipelineRef.current) return;
    pipelineRef.current = true;
    setPipelineLocked(true);
    patchHotSpeaker(who, { spoken: text, translating: true, translation: '', limitation: null });
    try {
      const { result } = await api.translateText(text, src, tgt);
      patchHotSpeaker(who, {
        translation: result.translatedText, translating: false,
        latencyMs: result.latencyMs, engine: result.engine,
        limitation: result.limitation ?? null,
      });
      if (result.limitation || playbackMutedRef.current) {
        pipelineRef.current = false; setPipelineLocked(false); return;
      }
      speechRecognition.setCaptureSuppressed(true);
      patchHotSpeaker(who, { speaking: true });
      const spoke = speechSynthesisService.speak(result.translatedText, tgt, {
        rate: Number(localStorage.getItem('livelingo_tts_speed') || 1),
        onStart: () => patchHotSpeaker(who, { speaking: true }),
        onEnd:  () => { speechRecognition.setCaptureSuppressed(false); patchHotSpeaker(who, { speaking: false }); pipelineRef.current = false; setPipelineLocked(false); },
        onError:() => { speechRecognition.setCaptureSuppressed(false); patchHotSpeaker(who, { speaking: false }); pipelineRef.current = false; setPipelineLocked(false); },
        onLimitation: (msg) => { patchHotSpeaker(who, { limitation: msg, speaking: false }); speechRecognition.setCaptureSuppressed(false); pipelineRef.current = false; setPipelineLocked(false); },
      });
      if (!spoke) { speechRecognition.setCaptureSuppressed(false); patchHotSpeaker(who, { speaking: false }); pipelineRef.current = false; setPipelineLocked(false); }
    } catch (err: any) {
      patchHotSpeaker(who, { translating: false, speaking: false, limitation: err.message || 'Translation failed.' });
      pipelineRef.current = false; setPipelineLocked(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HOT-SEAT MODE helpers
  // ─────────────────────────────────────────────────────────────────────────

  const stopHotListening = useCallback(() => {
    speechRecognition.stop();
    setActiveSpeaker(null);
  }, []);

  const startHotListening = useCallback((who: 'A' | 'B') => {
    if (!speechRecognition.isSupported()) {
      setErrorMessage('Speech recognition is not supported. Use Chrome on desktop or Android.');
      return;
    }
    if (activeSpeakerRef.current === who) { stopHotListening(); return; }
    speechRecognition.stop();
    setErrorMessage(null);
    const src = who === 'A' ? langARef.current : langBRef.current;
    const tgt = who === 'A' ? langBRef.current : langARef.current;
    speechRecognition.setLanguage(src);
    speechRecognition.setCaptureSuppressed(false);
    setActiveSpeaker(who);
    speechRecognition.start({
      onStart: () => {},
      onResult: (text, isFinal) => {
        if (!isFinal) { patchHotSpeaker(who, { interim: text }); return; }
        patchHotSpeaker(who, { interim: '' });
        void runHotPipeline(who, text, src, tgt);
      },
      onError: (err) => {
        const code = (err as any)?.error || (err as any)?.message || '';
        if (code === 'not-allowed') { setErrorMessage('Microphone permission denied.'); setActiveSpeaker(null); }
      },
      onEnd: () => {
        if (activeSpeakerRef.current === who) {
          speechRecognition.setLanguage(who === 'A' ? langARef.current : langBRef.current);
          try { speechRecognition.start({ onStart:()=>{}, onResult:()=>{}, onError:()=>{}, onEnd:()=>{} }); } catch { /* ignore */ }
        }
      },
    });
  }, [stopHotListening]);

  const clearHotAll = () => {
    speechSynthesisService.cancel();
    setStateA({ ...EMPTY_SPEAKER }); setStateB({ ...EMPTY_SPEAKER });
    pipelineRef.current = false; setPipelineLocked(false);
  };

  const swapHotLanguages = () => {
    speechSynthesisService.cancel(); speechRecognition.stop();
    setActiveSpeaker(null);
    setLangA(langB); setLangB(langA);
    clearHotAll();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // CONVERSATION MODE
  // ─────────────────────────────────────────────────────────────────────────

  const stopConv = () => {
    convAbortRef.current?.abort();
    convAbortRef.current = null;
    convGenRef.current++;
    speechRecognition.stop();
    speechSynthesisService.cancel();
    setConvPhase('idle');
    setConvInterim('');
    pipelineRef.current = false;
  };

  // ── Core pipeline ────────────────────────────────────────────────────────
  // Low-latency design:
  //  1. Generation counter — new utterance immediately supersedes previous.
  //  2. AbortController — cancels in-flight HTTP fetch when superseded.
  //  3. translateClient — calls MyMemory or Sarvam directly/via server
  //     (Indian langs routed through server → Sarvam for best quality).
  //  4. speakWithSarvam — Sarvam Bulbul for kn/hi/ta, browser TTS for es/de.
  //  5. Interim pre-translation — starts translating after ≥3 words while
  //     the person is still speaking, not after they stop.
  async function runConvPipeline(
    speaker: 'them' | 'me',
    text: string,
    isFinal: boolean
  ) {
    if (!text.trim()) return;

    const src = speaker === 'them' ? theirLangRef.current : myLangRef.current;
    const tgt = speaker === 'them' ? myLangRef.current   : theirLangRef.current;

    // Bump generation — any prior async chain checks this and bails
    const gen = ++convGenRef.current;

    // Cancel previous in-flight request
    convAbortRef.current?.abort();
    const abortCtrl = new AbortController();
    convAbortRef.current = abortCtrl;

    // Cancel any TTS that's currently playing
    speechSynthesisService.cancel();
    speechRecognition.setCaptureSuppressed(false);
    setConvPhase('translating');

    try {
      const result = await translateClient(text, src, tgt, abortCtrl.signal);

      if (gen !== convGenRef.current) return; // superseded

      if (!isFinal) {
        // Interim: show live translation, start speaking immediately
        setConvInterim(`${text}  →  ${result.translatedText}`);
        if (!result.limitation && !playbackMutedRef.current) {
          speechRecognition.setCaptureSuppressed(true);
          setConvPhase('speaking');
          void speechSynthesisService.speakWithSarvam(result.translatedText, tgt, {
            rate: Math.min(1.2, Number(localStorage.getItem('livelingo_tts_speed') || 1)),
            onEnd: () => {
              if (gen === convGenRef.current) {
                speechRecognition.setCaptureSuppressed(false);
                const p = convPhaseRef.current;
                if (p !== 'idle') setConvPhase(speaker === 'them' ? 'listening-them' : 'replying-me');
              }
            },
            onError: () => {
              if (gen === convGenRef.current) speechRecognition.setCaptureSuppressed(false);
            },
          });
        }
        return;
      }

      // Final — commit to the feed
      setConvInterim('');
      const entry: ConvEntry = {
        id: String(++entryIdRef.current),
        speaker,
        original: text,
        translation: result.translatedText,
        lang: src,
        translatedLang: tgt,
      };
      setConvEntries(prev => [...prev, entry]);

      if (result.limitation || playbackMutedRef.current) {
        pipelineRef.current = false;
        if (convPhaseRef.current !== 'idle') { setConvPhase('listening-them'); startConvListenThem(); }
        return;
      }

      speechRecognition.setCaptureSuppressed(true);
      setConvPhase('speaking');

      const afterSpeak = () => {
        if (gen !== convGenRef.current) return;
        speechRecognition.setCaptureSuppressed(false);
        pipelineRef.current = false;
        if (convPhaseRef.current !== 'idle') { setConvPhase('listening-them'); startConvListenThem(); }
      };

      void speechSynthesisService.speakWithSarvam(result.translatedText, tgt, {
        rate: Number(localStorage.getItem('livelingo_tts_speed') || 1),
        onStart:      () => { if (gen === convGenRef.current) setConvPhase('speaking'); },
        onEnd:        afterSpeak,
        onError:      afterSpeak,
        onLimitation: afterSpeak,
      });

    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      if (gen !== convGenRef.current) return;
      pipelineRef.current = false;
      setConvError(err.message || 'Translation failed.');
      if (convPhaseRef.current !== 'idle') { setConvPhase('listening-them'); startConvListenThem(); }
    }
  }

  // Start listening to THEM continuously
  const startConvListenThem = () => {
    if (!speechRecognition.isSupported()) {
      setConvError('Speech recognition is not supported. Use Chrome on desktop or Android.');
      return;
    }
    setConvError(null);
    setConvPhase('listening-them');
    setConvInterim('');
    speechRecognition.setLanguage(theirLangRef.current);
    speechRecognition.setCaptureSuppressed(false);
    speechRecognition.start({
      onStart: () => {},
      onResult: (text, isFinal) => {
        if (!isFinal) {
          setConvInterim(text);
          // Pre-translate once ≥3 words are heard
          if (text.trim().split(/\s+/).length >= 3 && convPhaseRef.current === 'listening-them') {
            void runConvPipeline('them', text, false);
          }
          return;
        }
        setConvInterim('');
        if (convPhaseRef.current === 'listening-them' || convPhaseRef.current === 'speaking') {
          void runConvPipeline('them', text, true);
        }
      },
      onError: (err) => {
        const code = (err as any)?.error || (err as any)?.message || '';
        if (code === 'not-allowed') { setConvError('Microphone permission denied.'); setConvPhase('idle'); }
      },
      onEnd: () => {
        if (convPhaseRef.current === 'listening-them') {
          speechRecognition.setLanguage(theirLangRef.current);
          try { speechRecognition.start({ onStart:()=>{}, onResult:()=>{}, onError:()=>{}, onEnd:()=>{} }); }
          catch { /* race */ }
        }
      },
    });
  };

  // Hold-to-reply
  const startReply = () => {
    convAbortRef.current?.abort();
    convAbortRef.current = null;
    convGenRef.current++;
    speechRecognition.stop();
    speechSynthesisService.cancel();
    setConvPhase('replying-me');
    setConvInterim('');
    speechRecognition.setLanguage(myLangRef.current);
    speechRecognition.setCaptureSuppressed(false);
    speechRecognition.start({
      onStart: () => {},
      onResult: (text, isFinal) => {
        if (!isFinal) {
          setConvInterim(text);
          if (text.trim().split(/\s+/).length >= 3 && convPhaseRef.current === 'replying-me') {
            void runConvPipeline('me', text, false);
          }
          return;
        }
        setConvInterim('');
        if (convPhaseRef.current === 'replying-me' || convPhaseRef.current === 'speaking') {
          void runConvPipeline('me', text, true);
        }
      },
      onError: () => {},
      onEnd: () => {
        if (convPhaseRef.current === 'replying-me') {
          try { speechRecognition.start({ onStart:()=>{}, onResult:()=>{}, onError:()=>{}, onEnd:()=>{} }); }
          catch { /* race */ }
        }
      },
    });
  };

  const endReply = () => {
    if (convPhaseRef.current !== 'replying-me') return;
    speechRecognition.stop();
    setConvInterim('');
    setConvPhase('listening-them');
    startConvListenThem();
  };

  const handleReplyTouchStart = (e: React.TouchEvent) => { e.preventDefault(); startReply(); };
  const handleReplyTouchEnd   = (e: React.TouchEvent) => { e.preventDefault(); endReply(); };

  const clearConv = () => {
    convAbortRef.current?.abort();
    convAbortRef.current = null;
    convGenRef.current++;
    stopConv();
    setConvEntries([]);
    setConvError(null);
  };

  const swapConvLanguages = () => {
    convAbortRef.current?.abort();
    convAbortRef.current = null;
    convGenRef.current++;
    stopConv();
    setMyLang(theirLang);
    setTheirLang(myLang);
    setConvEntries([]);
    setConvError(null);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  const myLangData    = getLanguage(myLang);
  const theirLangData = getLanguage(theirLang);
  const langAData     = getLanguage(langA);
  const langBData     = getLanguage(langB);
  const hotIsBusy     = pipelineLocked || activeSpeaker !== null;

  const isConvActive  = convPhase !== 'idle';

  return (
    <div className="min-h-screen flex flex-col py-5 sm:py-8 px-4 sm:px-6 max-w-4xl mx-auto w-full gap-5">

      {/* ── Back nav ── */}
      <button
        onClick={() => { stopConv(); stopHotListening(); navigate('/'); }}
        className="self-start inline-flex items-center gap-1.5 text-sm font-medium text-[#5A6270] hover:text-[#20242C] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3563E9] rounded-lg px-1 py-1"
      >
        <ArrowLeft className="w-4 h-4" />
        Home
      </button>

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#3563E9]/10 flex items-center justify-center shrink-0">
            <Languages className="w-4.5 h-4.5 text-[#3563E9]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#20242C] tracking-tight leading-tight">
              Face-to-Face Translator
            </h1>
            <p className="text-xs text-[#5A6270]">Real-time translation between two people.</p>
          </div>
        </div>

        {/* Audio mute */}
        <button
          type="button"
          onClick={() => { const n = !playbackMuted; setPlaybackMuted(n); if (n) speechSynthesisService.cancel(); }}
          className={`self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3563E9] ${
            playbackMuted ? 'bg-[#F59E0B]/10 text-[#D97706] border-[#F59E0B]/30' : 'bg-white text-[#5A6270] border-[#E5E2D9] hover:border-[#D5D1C6]'
          }`}
        >
          {playbackMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          {playbackMuted ? 'Audio off' : 'Audio on'}
        </button>
      </div>

      {/* ── Mode toggle ── */}
      <div className="flex gap-1.5 p-1 bg-[#F2EFE8] rounded-xl border border-[#E5E2D9] w-fit">
        <ModeTab
          active={mode === 'conversation'}
          icon={<Radio className="w-3.5 h-3.5" />}
          label="Conversation"
          sublabel="Vendor doesn't need the app"
          onClick={() => { stopHotListening(); setMode('conversation'); }}
        />
        <ModeTab
          active={mode === 'hotseat'}
          icon={<MessageSquare className="w-3.5 h-3.5" />}
          label="Hot-seat"
          sublabel="Each person taps their side"
          onClick={() => { stopConv(); setMode('hotseat'); }}
        />
      </div>

      {/* ════════════════════════════════════════════════
          CONVERSATION MODE
          ════════════════════════════════════════════════ */}
      {mode === 'conversation' && (
        <div className="flex flex-col gap-4">

          {/* Language setup */}
          <Card className="p-4">
            <div className="grid grid-cols-[1fr_44px_1fr] gap-2 items-end">
              <LanguageSelector
                label="They speak (vendor)"
                value={theirLang}
                onChange={(v) => { stopConv(); setTheirLang(v); setConvEntries([]); }}
              />
              <div className="flex items-end justify-center pb-[3px]">
                <button
                  type="button"
                  onClick={swapConvLanguages}
                  aria-label="Swap languages"
                  className="w-10 h-10 rounded-xl border border-[#E5E2D9] bg-white text-[#3563E9] hover:bg-[#EEF2FD] hover:border-[#3563E9]/40 active:scale-95 flex items-center justify-center transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3563E9]"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                </button>
              </div>
              <LanguageSelector
                label="I speak (you)"
                value={myLang}
                onChange={(v) => { stopConv(); setMyLang(v); setConvEntries([]); }}
              />
            </div>
            <p className="text-[11px] text-[#5A6270] mt-3 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#3563E9]" />
              The app continuously listens in <strong>{theirLangData?.name}</strong>. Hold <strong>Reply</strong> when you want to speak {myLangData?.name}.
            </p>
          </Card>

          {/* Error */}
          {convError && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#DC2626]/10 border border-[#DC2626]/20 text-xs text-[#DC2626]">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{convError}</span>
            </div>
          )}

          {/* ── Status bar ── */}
          <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all duration-300 ${
            convPhase === 'listening-them' ? 'bg-[#ECFDF5] border-[#10B981]/25' :
            convPhase === 'replying-me'    ? 'bg-[#EEF2FD] border-[#3563E9]/25' :
            convPhase === 'translating'    ? 'bg-[#EEF2FD] border-[#3563E9]/20' :
            convPhase === 'speaking'       ? 'bg-[#EEF2FD] border-[#3563E9]/25' :
            'bg-[#F8F7F2] border-[#E5E2D9]'
          }`}>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                convPhase === 'listening-them' ? 'bg-[#10B981] animate-pulse' :
                convPhase === 'replying-me'    ? 'bg-[#3563E9] animate-pulse' :
                convPhase === 'translating'    ? 'bg-[#3563E9] animate-pulse' :
                convPhase === 'speaking'       ? 'bg-[#3563E9] animate-ping'  :
                'bg-[#D5D1C6]'
              }`} />
              <span className={`text-xs font-semibold ${
                convPhase === 'listening-them' ? 'text-[#059669]' :
                convPhase === 'replying-me'    ? 'text-[#3563E9]' :
                convPhase === 'translating'    ? 'text-[#3563E9]' :
                convPhase === 'speaking'       ? 'text-[#3563E9]' :
                'text-[#5A6270]'
              }`}>
                {convPhase === 'idle'           && 'Ready — tap Start'}
                {convPhase === 'listening-them' && `Listening for ${theirLangData?.name}…`}
                {convPhase === 'replying-me'    && `Listening for your ${myLangData?.name}…`}
                {convPhase === 'translating'    && 'Translating…'}
                {convPhase === 'speaking'       && 'Playing translation…'}
              </span>
            </div>

            {/* Waveform */}
            <AudioMeter level={micLevel} isActive={isConvActive} barCount={18} height={24} />
          </div>

          {/* ── Conversation feed ── */}
          <div
            ref={convScrollRef}
            className="flex flex-col gap-3 max-h-[38vh] min-h-[120px] overflow-y-auto rounded-2xl border border-[#E5E2D9] bg-[#F8F7F2] p-3 no-scrollbar"
          >
            {convEntries.length === 0 && convPhase === 'idle' && (
              <div className="flex flex-col items-center justify-center h-24 gap-2 text-center">
                <Languages className="w-6 h-6 text-[#5A6270]/40" />
                <p className="text-xs text-[#5A6270]/50">
                  Tap <strong>Start listening</strong> and place the phone between you.<br />
                  The vendor speaks — you hear it in {myLangData?.name}. Hold <strong>Reply</strong> to speak back.
                </p>
              </div>
            )}

            {convEntries.map((entry) => (
              <ConvBubble key={entry.id} entry={entry} myLangData={myLangData} theirLangData={theirLangData} />
            ))}

            {/* Live interim */}
            {convInterim && (
              <div className={`flex ${convPhase === 'replying-me' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl border text-sm italic text-[#5A6270] ${
                  convPhase === 'replying-me'
                    ? 'bg-[#EEF2FD]/70 border-[#3563E9]/20 rounded-br-sm'
                    : 'bg-white border-[#E5E2D9] rounded-bl-sm'
                }`}>
                  {convInterim}
                  <span className="inline-block w-1.5 h-1.5 ml-1 mb-0.5 rounded-full bg-current animate-pulse" />
                </div>
              </div>
            )}
          </div>

          {/* ── Main controls ── */}
          <div className="flex flex-col gap-3">

            {/* Start / Stop */}
            {convPhase === 'idle' ? (
              <button
                type="button"
                onClick={startConvListenThem}
                className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl bg-[#10B981] text-white font-bold text-base shadow-lg shadow-[#10B981]/25 hover:bg-[#059669] active:scale-[0.98] transition-all duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#10B981]/40"
              >
                <Mic className="w-5 h-5" />
                Start listening
              </button>
            ) : (
              <button
                type="button"
                onClick={stopConv}
                className="w-full flex items-center justify-center gap-2.5 py-3 rounded-2xl border-2 border-[#DC2626]/30 bg-white text-[#DC2626] font-semibold text-sm hover:bg-[#DC2626]/05 active:scale-[0.98] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]/40"
              >
                <MicOff className="w-4 h-4" />
                Stop session
              </button>
            )}

            {/* Hold-to-reply */}
            <button
              ref={replyButtonRef}
              type="button"
              disabled={convPhase === 'idle' || convPhase === 'translating' || convPhase === 'speaking'}
              onMouseDown={startReply}
              onMouseUp={endReply}
              onMouseLeave={endReply}
              onTouchStart={handleReplyTouchStart}
              onTouchEnd={handleReplyTouchEnd}
              aria-label="Hold to reply in your language"
              className={`w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-bold text-base select-none transition-all duration-150 focus-visible:outline-none focus-visible:ring-4 disabled:opacity-30 disabled:cursor-not-allowed ${
                convPhase === 'replying-me'
                  ? 'bg-[#3563E9] text-white shadow-lg shadow-[#3563E9]/30 scale-[0.98] ring-4 ring-[#3563E9]/20'
                  : 'bg-white border-2 border-[#3563E9]/30 text-[#3563E9] hover:bg-[#EEF2FD] active:bg-[#3563E9] active:text-white focus-visible:ring-[#3563E9]/40'
              }`}
            >
              <Mic className="w-5 h-5" />
              {convPhase === 'replying-me' ? `Speaking in ${myLangData?.name}… (release when done)` : `Hold to reply in ${myLangData?.name}`}
            </button>

            {/* Clear */}
            {convEntries.length > 0 && (
              <button
                type="button"
                onClick={clearConv}
                className="self-center inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium text-[#5A6270] hover:text-[#20242C] border border-[#E5E2D9] hover:border-[#D5D1C6] bg-white transition-all duration-150"
              >
                <Eraser className="w-3.5 h-3.5" />
                Clear conversation
              </button>
            )}
          </div>

          {/* Echo tip */}
          <div className="flex items-center gap-2 text-[11px] text-[#5A6270]">
            <Headphones className="w-3.5 h-3.5 text-[#3563E9] shrink-0" />
            <span>Use headphones or earbuds — prevents the translated audio from being re-captured by the mic.</span>
          </div>

        </div>
      )}

      {/* ════════════════════════════════════════════════
          HOT-SEAT MODE  (unchanged)
          ════════════════════════════════════════════════ */}
      {mode === 'hotseat' && (
        <div className="flex flex-col gap-4">

          {/* Language bar */}
          <Card className="p-4">
            <div className="grid grid-cols-[1fr_48px_1fr] gap-2 sm:gap-3 items-end">
              <LanguageSelector label="Person A" value={langA} onChange={(v) => { setLangA(v); clearHotAll(); }} />
              <div className="flex items-end justify-center pb-[3px]">
                <button
                  type="button"
                  onClick={swapHotLanguages}
                  aria-label="Swap languages"
                  className="w-11 h-11 rounded-xl border border-[#E5E2D9] bg-white text-[#3563E9] hover:bg-[#EEF2FD] hover:border-[#3563E9]/40 hover:shadow-sm active:scale-95 flex items-center justify-center transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3563E9]"
                >
                  <ArrowRightLeft className="w-4.5 h-4.5" />
                </button>
              </div>
              <LanguageSelector label="Person B" value={langB} onChange={(v) => { setLangB(v); clearHotAll(); }} />
            </div>
          </Card>

          {errorMessage && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#DC2626]/10 border border-[#DC2626]/20 text-xs text-[#DC2626]">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <HotSeatPanel
              who="A" langCode={langA} langData={langAData} otherLangData={langBData}
              state={stateA} isActive={activeSpeaker === 'A'} isBusyOther={activeSpeaker === 'B'}
              micLevel={activeSpeaker === 'A' ? micLevel : 0}
              onTap={() => startHotListening('A')}
              onQuickPhrase={(p) => void runHotPipeline('A', p, langA, langB)}
              isBusy={hotIsBusy && activeSpeaker !== 'A'}
            />
            <HotSeatPanel
              who="B" langCode={langB} langData={langBData} otherLangData={langAData}
              state={stateB} isActive={activeSpeaker === 'B'} isBusyOther={activeSpeaker === 'A'}
              micLevel={activeSpeaker === 'B' ? micLevel : 0}
              onTap={() => startHotListening('B')}
              onQuickPhrase={(p) => void runHotPipeline('B', p, langB, langA)}
              isBusy={hotIsBusy && activeSpeaker !== 'B'}
            />
          </div>

          <div className="flex items-center gap-2 text-[11px] text-[#5A6270]">
            <Headphones className="w-3.5 h-3.5 text-[#3563E9] shrink-0" />
            <span>Use headphones to prevent echo. The mic pauses automatically while translated speech is playing.</span>
          </div>

        </div>
      )}

    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ModeTab
// ─────────────────────────────────────────────────────────────────────────────

const ModeTab: React.FC<{
  active: boolean;
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  onClick: () => void;
}> = ({ active, icon, label, sublabel, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3563E9] ${
      active
        ? 'bg-white text-[#20242C] shadow-sm border border-[#E5E2D9]'
        : 'text-[#5A6270] hover:text-[#20242C]'
    }`}
  >
    <span className={active ? 'text-[#3563E9]' : 'text-[#5A6270]'}>{icon}</span>
    <span>
      <span className="block text-xs font-bold leading-tight">{label}</span>
      <span className="block text-[10px] leading-tight opacity-70">{sublabel}</span>
    </span>
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// ConvBubble — a single exchange in Conversation Mode
// ─────────────────────────────────────────────────────────────────────────────

const ConvBubble: React.FC<{
  entry: ConvEntry;
  myLangData: ReturnType<typeof getLanguage>;
  theirLangData: ReturnType<typeof getLanguage>;
}> = ({ entry, myLangData, theirLangData }) => {
  const isMe = entry.speaker === 'me';

  return (
    <div className={`flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
      {/* Speaker label */}
      <span className="text-[10px] font-semibold text-[#5A6270] px-1">
        {isMe ? `You · ${myLangData?.name}` : `Them · ${theirLangData?.name}`}
      </span>

      {/* Original bubble */}
      <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm ${
        isMe
          ? 'bg-[#3563E9] text-white rounded-br-sm'
          : 'bg-white border border-[#E5E2D9] text-[#20242C] rounded-bl-sm'
      }`}>
        <p className="font-medium leading-relaxed">{entry.original}</p>
      </div>

      {/* Translation bubble */}
      <div className={`max-w-[85%] px-3.5 py-2 rounded-xl text-xs ${
        isMe
          ? 'bg-[#EEF2FD] text-[#1E3EB0] rounded-tr-sm'
          : 'bg-[#ECFDF5] text-[#065F46] rounded-tl-sm'
      }`}>
        <span className="font-semibold">{entry.translation}</span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// HotSeatPanel — unchanged from before
// ─────────────────────────────────────────────────────────────────────────────

interface HotSeatPanelProps {
  who: 'A' | 'B';
  langCode: string;
  langData: ReturnType<typeof getLanguage>;
  otherLangData: ReturnType<typeof getLanguage>;
  state: SpeakerState;
  isActive: boolean;
  isBusyOther: boolean;
  micLevel: number;
  onTap: () => void;
  onQuickPhrase: (phrase: string) => void;
  isBusy: boolean;
}

const HotSeatPanel: React.FC<HotSeatPanelProps> = ({
  who, langCode, langData, otherLangData, state,
  isActive, isBusyOther, micLevel, onTap, onQuickPhrase, isBusy,
}) => {
  const color = who === 'A' ? 'cobalt' : 'emerald';
  const activeRing  = color === 'cobalt' ? 'border-[#3563E9]/40 shadow-[0_0_0_3px_rgba(53,99,233,0.06)]' : 'border-[#10B981]/40 shadow-[0_0_0_3px_rgba(16,185,129,0.06)]';
  const micBg       = color === 'cobalt' ? 'bg-[#3563E9]'  : 'bg-[#10B981]';
  const micHover    = color === 'cobalt' ? 'hover:bg-[#274FC2]' : 'hover:bg-[#059669]';
  const micRing     = color === 'cobalt' ? 'bg-[#3563E9]/15' : 'bg-[#10B981]/15';
  const labelColor  = color === 'cobalt' ? 'text-[#3563E9]' : 'text-[#059669]';
  const labelBg     = color === 'cobalt' ? 'bg-[#3563E9]/08 border-[#3563E9]/15' : 'bg-[#10B981]/08 border-[#10B981]/15';
  const transBg     = color === 'cobalt' ? 'bg-[#EEF2FD]/40' : 'bg-[#ECFDF5]/40';
  const transText   = color === 'cobalt' ? 'text-[#1E3EB0]' : 'text-[#065F46]';
  const skelColor   = color === 'cobalt' ? 'bg-[#3563E9]/12' : 'bg-[#10B981]/12';
  const phrases     = QUICK_PHRASES[langCode] || QUICK_PHRASES.en;

  return (
    <div className={`flex flex-col gap-3 rounded-2xl border p-4 sm:p-5 bg-white transition-all duration-300 ${isActive ? activeRing : 'border-[#E5E2D9]'}`}>
      <div className="flex items-center justify-between">
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${labelBg} ${labelColor}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${color === 'cobalt' ? 'bg-[#3563E9]' : 'bg-[#10B981]'} ${isActive ? 'animate-pulse' : ''}`} />
          Person {who} · {langData?.flag} {langData?.name}
        </div>
        {state.latencyMs != null && (
          <span className="inline-flex items-center gap-1 text-[10px] text-[#5A6270]">
            <Zap className="w-3 h-3" />{state.latencyMs} ms
          </span>
        )}
      </div>

      <div className="flex flex-col items-center gap-3 py-2">
        <div className="relative">
          {isActive && (
            <>
              <span className={`absolute inset-0 rounded-full ${micRing} animate-ping`} />
              <span className={`absolute inset-[-8px] rounded-full ${micRing} animate-pulse`} />
            </>
          )}
          <button
            type="button" onClick={onTap} disabled={isBusyOther}
            className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 active:scale-95 shadow-lg disabled:opacity-30 disabled:cursor-not-allowed ${micBg} text-white ${micHover}`}
            style={isActive ? { boxShadow: color === 'cobalt' ? '0 4px 24px -2px rgba(53,99,233,0.4)' : '0 4px 24px -2px rgba(16,185,129,0.4)' } : {}}
          >
            {isActive ? <MicOff className="w-9 h-9" /> : <Mic className="w-9 h-9" />}
          </button>
        </div>
        <p className="text-xs font-semibold text-[#5A6270] text-center">
          {isBusyOther ? 'Waiting…' : isActive ? 'Tap to stop' : `Tap to speak in ${langData?.name ?? langCode}`}
        </p>
        <div className={`w-full h-8 transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-0'}`}>
          <AudioMeter level={micLevel} isActive={isActive} barCount={24} height={28} className="w-full" />
        </div>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#5A6270] mb-1.5">Said</p>
        <div className="min-h-[52px] px-3.5 py-2.5 rounded-xl bg-[#F8F7F2] border border-[#E5E2D9]">
          {state.spoken ? <p className="text-sm font-medium text-[#20242C] leading-relaxed">{state.spoken}</p>
           : state.interim ? <p className="text-sm font-medium text-[#20242C]/60 italic leading-relaxed">{state.interim}</p>
           : <p className="text-xs text-[#5A6270]/50 select-none">{isActive ? `Listening in ${langData?.name}…` : 'Spoken text appears here.'}</p>}
        </div>
      </div>

      <div>
        <p className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${labelColor}`}>Heard · {otherLangData?.name}</p>
        <div className={`min-h-[52px] px-3.5 py-2.5 rounded-xl border ${state.speaking ? `${transBg} ${color === 'cobalt' ? 'border-[#3563E9]/25' : 'border-[#10B981]/25'}` : `${transBg} border-[#E5E2D9]`} transition-all duration-200`}>
          {state.translating ? (
            <div className="space-y-1.5 pt-0.5">
              <div className={`h-3 rounded-full animate-pulse w-4/5 ${skelColor}`} />
              <div className={`h-3 rounded-full animate-pulse w-3/5 ${skelColor}`} />
            </div>
          ) : state.translation ? (
            <p className={`text-sm font-bold leading-relaxed ${transText}`}>{state.translation}</p>
          ) : (
            <p className="text-xs text-[#5A6270]/50 select-none">Translation appears here.</p>
          )}
        </div>
        {state.speaking && <p className={`text-[10px] font-semibold mt-1 animate-pulse ${labelColor}`}>▶ Playing translation…</p>}
        {state.limitation && (
          <div className="flex items-start gap-2 mt-2 p-2.5 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/25 text-[11px] text-[#D97706]">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /><span>{state.limitation}</span>
          </div>
        )}
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#5A6270]/70 mb-1.5">Quick phrases</p>
        <div className="flex flex-wrap gap-1.5">
          {phrases.slice(0, 4).map((phrase) => (
            <button key={phrase} type="button" onClick={() => onQuickPhrase(phrase)}
              disabled={isBusy || state.translating || state.speaking}
              className={`px-2.5 py-1 rounded-full border text-[11px] font-medium transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3563E9] ${
                color === 'cobalt' ? 'bg-white border-[#E5E2D9] text-[#20242C] hover:border-[#3563E9]/40 hover:bg-[#EEF2FD]/60 hover:text-[#3563E9]'
                : 'bg-white border-[#E5E2D9] text-[#20242C] hover:border-[#10B981]/40 hover:bg-[#ECFDF5]/60 hover:text-[#059669]'
              }`}
            >{phrase}</button>
          ))}
        </div>
      </div>
    </div>
  );
};
