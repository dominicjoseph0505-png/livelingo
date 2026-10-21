import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  VolumeX,
  Users,
  Copy,
  Check,
  Send,
  Sparkles,
  Wifi,
  WifiOff,
  Clock,
  Globe,
  Radio,
  Play,
  Settings,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { AudioMeter } from '../components/common/AudioMeter';
import type { RoomSession, Participant, TranscriptItem, LiveKitConnectionStatus } from '../types';
import { formatLanguageLabel, QUICK_PHRASES } from '../data/languages';
import { signalingClient } from '../services/websocket';
import { speechRecognition } from '../services/speechRecognition';
import { speechSynthesisService } from '../services/speechSynthesis';
import { MicrophoneAudioVisualizer } from '../services/audioVisualizer';
import { livekitCallingService } from '../services/livekitCalling';
import { api } from '../services/api';

export const ActiveCallPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  // Session & User State
  const participantId = sessionStorage.getItem('livelingo_participant_id') || `usr_${Date.now()}`;
  const participantName = sessionStorage.getItem('livelingo_participant_name') || 'You';
  const preferredLang = sessionStorage.getItem('livelingo_preferred_lang') || 'en';

  // Room State
  const [room, setRoom] = useState<RoomSession | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [partner, setPartner] = useState<Participant | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);

  // LiveKit WebRTC Audio State
  const [livekitStatus, setLivekitStatus] = useState<LiveKitConnectionStatus>('idle');
  const [isAutoplayBlocked, setIsAutoplayBlocked] = useState(false);
  const [mediaErrorMessage, setMediaErrorMessage] = useState<string | null>(null);
  const [livekitSetupInfo, setLivekitSetupInfo] = useState<{
    missingVars: string[];
    documentationUrl: string;
    description: string;
  } | null>(null);
  const [showLiveKitModal, setShowLiveKitModal] = useState(false);

  // Controls & Media State
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false); // Speaker TTS mute
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [peerIsSpeaking, setPeerIsSpeaking] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [duration, setDuration] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showEndCallModal, setShowEndCallModal] = useState(false);

  // Quick text input for silent or testing environments
  const [textInput, setTextInput] = useState('');
  const [isSubmittingText, setIsSubmittingText] = useState(false);

  // Active status of Speech Recognition engine
  const [sttSupported, setSttSupported] = useState(true);
  const [interimSpeech, setInterimSpeech] = useState<string>('');
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const [ttsLimitation, setTtsLimitation] = useState<string | null>(null);
  const isDeafenedRef = useRef(false);
  const utteranceTokenRef = useRef(0);

  useEffect(() => {
    isDeafenedRef.current = isDeafened;
  }, [isDeafened]);

  const visualizerRef = useRef<MicrophoneAudioVisualizer | null>(null);
  const transcriptBottomRef = useRef<HTMLDivElement | null>(null);

  // 1. Initial Room Load & WebRTC/WebSocket Connect
  useEffect(() => {
    if (!roomId) return;

    // Timer for call duration
    const timerInterval = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);

    initCall();

    return () => {
      clearInterval(timerInterval);
      speechRecognition.stop();
      visualizerRef.current?.stop();
      livekitCallingService.disconnect();
      signalingClient.disconnect();
    };
  }, [roomId]);

  // Auto-scroll transcript container on new message
  useEffect(() => {
    transcriptBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts, interimSpeech]);

  const initCall = async () => {
    try {
      // 1. Fetch initial room state from REST API
      const res = await api.getRoom(roomId!);
      if (res.success && res.room) {
        setRoom(res.room);
        setTranscripts(res.room.transcriptLog || []);

        // Find existing partner if present
        const participants = Object.values(res.room.participants || {});
        const existingPartner = participants.find((p) => p.id !== participantId && p.isConnected);
        if (existingPartner) {
          setPartner(existingPartner);
        }
      }

      // 2. Connect to WebSocket Signaling Server for message translation broadcasts
      await signalingClient.connect();
      setConnectionStatus('connected');
      signalingClient.joinRoom(roomId!, participantId, participantName, preferredLang);
      setupSignalingListeners();

      // 3. Connect to LiveKit WebRTC for real audio calling
      await initLiveKitAudio();

      // 4. Start local audio visualizer
      startLocalAudioMetering();

      // 5. Start speech recognition engine
      startSpeechRecognition();
    } catch (err: any) {
      console.error('[ActiveCall] Failed to initialize call:', err);
      setConnectionStatus('disconnected');
    }
  };

  const initLiveKitAudio = async () => {
    try {
      const tokenRes = await api.getRoomToken(roomId!, participantId, participantName);

      if (!tokenRes.isConfigured) {
        setLivekitStatus('unconfigured');
        if (tokenRes.setupInstructions) {
          setLivekitSetupInfo(tokenRes.setupInstructions);
        }
        return;
      }

      if (tokenRes.token && tokenRes.url) {
        setLivekitStatus('connecting');
        setupLiveKitListeners();
        const connected = await livekitCallingService.connectToRoom(tokenRes.url, tokenRes.token);
        if (connected) {
          setLivekitStatus('connected');
        }
      } else if (tokenRes.error) {
        setLivekitStatus('error');
        setMediaErrorMessage(tokenRes.error);
      }
    } catch (err: any) {
      console.warn('[ActiveCall] LiveKit audio setup error:', err);
      setLivekitStatus('error');
      setMediaErrorMessage(err.message || 'Failed to acquire LiveKit audio credentials');
    }
  };

  const setupLiveKitListeners = () => {
    livekitCallingService.on('status-changed', (data) => {
      setLivekitStatus(data.status);
    });

    livekitCallingService.on('participant-connected', (peer) => {
      setPartner((prev) => ({
        id: peer.identity,
        name: peer.name || 'Partner',
        role: 'guest',
        preferredLanguage: prev?.preferredLanguage || 'hi',
        isConnected: true,
        isMuted: false,
        isDeafened: false,
        joinedAt: new Date().toISOString(),
      }));
    });

    livekitCallingService.on('participant-disconnected', () => {
      setPartner((prev) => (prev ? { ...prev, isConnected: false } : null));
    });

    livekitCallingService.on('autoplay-blocked', () => {
      setIsAutoplayBlocked(true);
    });

    livekitCallingService.on('autoplay-resolved', () => {
      setIsAutoplayBlocked(false);
    });

    livekitCallingService.on('permission-denied', (data) => {
      setMediaErrorMessage(data.message);
    });

    livekitCallingService.on('missing-microphone', (data) => {
      setMediaErrorMessage(data.message);
    });

    livekitCallingService.on('active-speakers', (data) => {
      if (data.isRemoteSpeaking) {
        setPeerIsSpeaking(true);
      } else {
        setPeerIsSpeaking(false);
      }
    });
  };

  const setupSignalingListeners = () => {
    signalingClient.on('connected', () => {
      setConnectionStatus('connected');
    });

    signalingClient.on('disconnected', () => {
      setConnectionStatus('disconnected');
    });

    signalingClient.on('participant-joined', (data) => {
      if (data.participant && data.participant.id !== participantId) {
        setPartner(data.participant);
      }
      if (data.room) {
        setRoom(data.room);
      }
    });

    signalingClient.on('participant-left', (data) => {
      if (partner && partner.id === data.participantId) {
        setPartner((prev) => (prev ? { ...prev, isConnected: false } : null));
      }
    });

    signalingClient.on('peer-speaking-state', (data) => {
      if (partner && partner.id === data.participantId) {
        setPeerIsSpeaking(data.isSpeaking);
      }
    });

    // Real-time translated speech broadcast
    signalingClient.on('speech-broadcast', (data) => {
      if (data.transcriptItem) {
        setTranscripts((prev) => [...prev, data.transcriptItem]);
        if (typeof data.translationMetadata?.latencyMs === 'number') {
          setLastLatencyMs(data.translationMetadata.latencyMs);
        }
        if (data.translationMetadata?.limitation) {
          setTtsLimitation(data.translationMetadata.limitation);
        }

        if (data.transcriptItem.senderId !== participantId && !isDeafenedRef.current) {
          utteranceTokenRef.current += 1;
          const token = utteranceTokenRef.current;
          speechRecognition.setCaptureSuppressed(true);
          speechSynthesisService.speak(
            data.transcriptItem.translatedText,
            data.transcriptItem.translatedLang,
            {
              rate: Number(localStorage.getItem('livelingo_tts_speed') || 1),
              onEnd: () => {
                if (token === utteranceTokenRef.current) {
                  speechRecognition.setCaptureSuppressed(false);
                }
              },
              onError: () => speechRecognition.setCaptureSuppressed(false),
              onLimitation: (message) => {
                setTtsLimitation(message);
                speechRecognition.setCaptureSuppressed(false);
              },
            }
          );
        }
      }
    });

    signalingClient.on('call-ended', (data) => {
      handleCallEndedRemote(data.summary);
    });
  };

  const startLocalAudioMetering = async () => {
    visualizerRef.current = new MicrophoneAudioVisualizer();
    await visualizerRef.current.start((level) => {
      if (!isMuted) {
        setMicLevel(level);
        const speakingNow = level > 15;
        if (speakingNow !== isSpeaking) {
          setIsSpeaking(speakingNow);
          signalingClient.sendSpeakingState(speakingNow);
        }
      } else {
        setMicLevel(0);
      }
    });
  };

  const startSpeechRecognition = () => {
    if (!speechRecognition.isSupported()) {
      setSttSupported(false);
      return;
    }

    speechRecognition.setLanguage(preferredLang);
    speechRecognition.start({
      onResult: (text, isFinal) => {
        if (isMuted) return;

        if (isFinal) {
          setInterimSpeech('');
          signalingClient.sendSpeechInput(text, preferredLang, true);
        } else {
          setInterimSpeech(text);
        }
      },
      onError: (err) => {
        console.warn('Speech recognition warning:', err);
      },
    });
  };

  // Toggle Mute (Controls real LiveKit microphone track + speech recognizer)
  const toggleMute = async () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    signalingClient.sendMediaToggle(nextMuted, isDeafened);
    await livekitCallingService.setMicrophoneMuted(nextMuted);

    if (nextMuted) {
      speechRecognition.stop();
      setIsSpeaking(false);
      signalingClient.sendSpeakingState(false);
    } else {
      speechRecognition.start({
        onResult: (text, isFinal) => {
          if (isFinal) {
            setInterimSpeech('');
            signalingClient.sendSpeechInput(text, preferredLang, true);
          } else {
            setInterimSpeech(text);
          }
        },
      });
    }
  };

  // Toggle Deafen (TTS Speaker mute)
  const toggleDeafen = () => {
    const nextDeaf = !isDeafened;
    setIsDeafened(nextDeaf);
    isDeafenedRef.current = nextDeaf;
    if (nextDeaf) {
      speechSynthesisService.cancel();
      speechRecognition.setCaptureSuppressed(false);
    }
    signalingClient.sendMediaToggle(isMuted, nextDeaf);
  };

  // Handle Autoplay policy unlock
  const handleUnlockAutoplay = async () => {
    await livekitCallingService.resumeAutoplayAudio();
    setIsAutoplayBlocked(false);
  };

  // Send typed phrase
  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || isSubmittingText) return;

    setIsSubmittingText(true);
    signalingClient.sendSpeechInput(textInput.trim(), preferredLang, true);
    setTextInput('');
    setIsSubmittingText(false);
  };

  const sendQuickPhrase = (phrase: string) => {
    signalingClient.sendSpeechInput(phrase, preferredLang, true);
  };

  const handleEndCall = async () => {
    setShowEndCallModal(false);
    signalingClient.sendEndCall();

    try {
      if (roomId) {
        await api.endRoom(roomId);
      }
    } catch {
      // Ignore
    }

    navigateToSummary();
  };

  const handleCallEndedRemote = (_summary?: any) => {
    navigateToSummary();
  };

  const navigateToSummary = () => {
    speechRecognition.stop();
    visualizerRef.current?.stop();
    speechSynthesisService.cancel();
    livekitCallingService.disconnect();

    const summaryData = {
      roomId,
      durationSeconds: duration,
      transcriptCount: transcripts.length,
      userLang: preferredLang,
      partnerLang: partner?.preferredLanguage || 'hi',
      transcripts,
      endedAt: new Date().toISOString(),
    };
    sessionStorage.setItem('livelingo_last_call_summary', JSON.stringify(summaryData));

    navigate(`/ended/${roomId}`);
  };

  const copyRoomLink = () => {
    if (!roomId) return;
    const inviteUrl = `${window.location.origin}/join?room=${roomId}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const replayTranslationSpeech = (text: string, lang: string) => {
    speechSynthesisService.speak(text, lang, { rate: 1.0 });
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-[#F8F7F2]">
      {/* Top Call Status Bar */}
      <div className="bg-white border-b border-[#E5E2D9] px-3 py-2 sm:px-4 sm:py-3 sticky top-16 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          {/* Left: Room & Timer */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={copyRoomLink}
              title="Click to copy invite link"
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#F8F7F2] border border-[#E5E2D9] text-xs font-mono font-bold text-[#20242C] hover:bg-[#F2EFE8] cursor-pointer"
            >
              <span>{room?.code || roomId}</span>
              {copied ? <Check className="w-3.5 h-3.5 text-[#059669]" /> : <Copy className="w-3.5 h-3.5 text-[#5A6270]" />}
            </button>

            <div className="flex items-center gap-1 text-xs font-mono text-[#5A6270]">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatTimer(duration)}</span>
            </div>
          </div>

          {/* Center: Language Bridge Info */}
          <div className="hidden sm:flex items-center gap-2">
            <Badge variant="cobalt" size="sm" icon={<Globe className="w-3 h-3" />}>
              {formatLanguageLabel(preferredLang)} ⇄ {formatLanguageLabel(partner?.preferredLanguage || 'hi')}
            </Badge>
          </div>

          {/* Right: LiveKit Audio & Network Status */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* LiveKit Calling WebRTC Status */}
            {livekitStatus === 'connected' ? (
              <Badge variant="success" size="sm" icon={<Radio className="w-3 h-3" />}>
                <span className="hidden xs:inline">WebRTC Audio</span> Active
              </Badge>
            ) : livekitStatus === 'connecting' ? (
              <Badge variant="warning" size="sm">
                Audio Connecting...
              </Badge>
            ) : livekitStatus === 'reconnecting' ? (
              <Badge variant="warning" size="sm">
                Reconnecting...
              </Badge>
            ) : livekitStatus === 'unconfigured' ? (
              <button
                type="button"
                onClick={() => setShowLiveKitModal(true)}
                className="cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#3563E9] rounded-full"
                title="Click to configure LiveKit WebRTC credentials"
              >
                <Badge variant="neutral" size="sm" icon={<Settings className="w-3 h-3 text-[#3563E9]" />}>
                  LiveKit: Setup
                </Badge>
              </button>
            ) : (
              <Badge variant="danger" size="sm">
                Audio Disconnected
              </Badge>
            )}

            {/* Signaling status */}
            {connectionStatus === 'connected' ? (
              <Badge variant="success" size="sm" icon={<Wifi className="w-3 h-3" />}>
                <span className="hidden xs:inline">Signaling</span>
              </Badge>
            ) : (
              <Badge variant="danger" size="sm" icon={<WifiOff className="w-3 h-3" />}>
                <span className="hidden xs:inline">Offline</span>
              </Badge>
            )}

            <div className="flex items-center gap-1 text-xs text-[#5A6270] bg-[#F8F7F2] px-2 py-1 rounded-lg border border-[#E5E2D9]">
              <Users className="w-3.5 h-3.5" />
              <span>{partner && partner.isConnected ? '2/2' : '1/2'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Autoplay restriction banner */}
      {isAutoplayBlocked && (
        <div className="bg-[#F59E0B]/10 border-b border-[#F59E0B]/30 px-4 py-2.5">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 text-xs">
            <span className="text-[#D97706] font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Browser autoplay restrictions prevented incoming call audio.
            </span>
            <Button size="sm" variant="primary" onClick={handleUnlockAutoplay}>
              Enable Audio Output
            </Button>
          </div>
        </div>
      )}

      {/* Hardware / Media error banner */}
      {mediaErrorMessage && (
        <div className="bg-[#DC2626]/10 border-b border-[#DC2626]/20 px-4 py-2.5">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 text-xs text-[#DC2626]">
            <span>{mediaErrorMessage}</span>
            <button
              onClick={() => setMediaErrorMessage(null)}
              className="text-[#DC2626] font-bold hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Call View */}
      <div className="max-w-6xl mx-auto w-full p-3 sm:p-6 flex-1 flex flex-col gap-3.5 sm:gap-6 pb-20 sm:pb-6">
        {/* Participants Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* You Card */}
          <Card className="p-3.5 sm:p-5 flex flex-col justify-between border-2 border-[#3563E9]/30 relative overflow-hidden bg-white">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-11 h-11 rounded-2xl bg-[#3563E9] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                    {participantName.substring(0, 2).toUpperCase()}
                  </div>
                  {isSpeaking && (
                    <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-[#10B981] border-2 border-white rounded-full animate-ping" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#20242C]">{participantName}</span>
                    <span className="text-[10px] font-semibold bg-[#3563E9]/10 text-[#3563E9] px-2 py-0.5 rounded-full">
                      You
                    </span>
                  </div>
                  <div className="text-xs text-[#5A6270] mt-0.5">
                    Spoken: {formatLanguageLabel(preferredLang)}
                  </div>
                </div>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-1.5">
                {isMuted ? (
                  <Badge variant="danger" size="sm" icon={<MicOff className="w-3 h-3" />}>
                    Muted
                  </Badge>
                ) : isSpeaking ? (
                  <Badge variant="success" size="sm" icon={<Radio className="w-3 h-3" />}>
                    Speaking
                  </Badge>
                ) : (
                  <Badge variant="neutral" size="sm" icon={<Mic className="w-3 h-3 text-[#059669]" />}>
                    Listening
                  </Badge>
                )}
              </div>
            </div>

            {/* Live Mic Meter */}
            <div className="mt-4 pt-3 border-t border-[#E5E2D9] flex items-center justify-between">
              <span className="text-[11px] text-[#5A6270]">Mic Activity:</span>
              <AudioMeter level={micLevel} isActive={!isMuted} barCount={12} height={20} />
            </div>
          </Card>

          {/* Partner Card */}
          <Card className="p-3.5 sm:p-5 flex flex-col justify-between border border-[#E5E2D9] bg-white">
            {partner && partner.isConnected ? (
              <>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-11 h-11 rounded-2xl bg-[#10B981] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                        {partner.name.substring(0, 2).toUpperCase()}
                      </div>
                      {peerIsSpeaking && (
                        <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-[#10B981] border-2 border-white rounded-full animate-ping" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[#20242C]">{partner.name}</span>
                        <span className="text-[10px] font-semibold bg-[#10B981]/10 text-[#059669] px-2 py-0.5 rounded-full">
                          Connected
                        </span>
                      </div>
                      <div className="text-xs text-[#5A6270] mt-0.5">
                        Language: {formatLanguageLabel(partner.preferredLanguage)}
                      </div>
                    </div>
                  </div>

                  <div>
                    {partner.isMuted ? (
                      <Badge variant="danger" size="sm" icon={<MicOff className="w-3 h-3" />}>
                        Muted
                      </Badge>
                    ) : peerIsSpeaking ? (
                      <Badge variant="success" size="sm" icon={<Radio className="w-3 h-3" />}>
                        Speaking
                      </Badge>
                    ) : (
                      <Badge variant="neutral" size="sm">
                        Listening
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#E5E2D9] flex items-center justify-between text-[11px] text-[#5A6270]">
                  <span>WebRTC Audio:</span>
                  <span className={livekitStatus === 'connected' ? 'text-[#059669] font-medium' : 'text-[#5A6270]'}>
                    {livekitStatus === 'connected' ? 'Live Stream Active' : 'Signaling Stream'}
                  </span>
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-2 space-y-2">
                <div className="w-10 h-10 rounded-full bg-[#F8F7F2] border border-[#E5E2D9] flex items-center justify-center text-[#5A6270]">
                  <Users className="w-5 h-5 animate-pulse" />
                </div>
                <div className="text-xs font-bold text-[#20242C]">Waiting for Partner</div>
                <p className="text-[11px] text-[#5A6270] max-w-xs">
                  Share code <strong className="text-[#3563E9]">{roomId}</strong> with your partner. LiveLingo will connect audio and translation immediately upon joining.
                </p>
                <Button variant="secondary" size="sm" onClick={copyRoomLink}>
                  {copied ? 'Link Copied!' : 'Copy Room Invitation'}
                </Button>
              </div>
            )}
          </Card>
        </div>

        {/* Live Dual Transcript Feed Area */}
        {ttsLimitation && (
          <div className="p-3 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-xl text-xs text-[#D97706]">
            {ttsLimitation}
          </div>
        )}

        {!sttSupported && (
          <div className="p-3 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-xl text-xs text-[#D97706] text-center">
            Browser microphone speech-to-text is not supported on this device. You can use the Quick Phrases and text input below to speak and translate.
          </div>
        )}

        <Card className="flex-1 flex flex-col min-h-[340px] max-h-[480px] p-4 sm:p-6 bg-white overflow-hidden shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E2D9]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#3563E9]" />
              <h2 className="text-xs font-bold text-[#20242C] uppercase tracking-wider">
                Live Speech & Translated Transcript Feed
              </h2>
            </div>
            <span className="text-[11px] text-[#5A6270]">
              {transcripts.length} {transcripts.length === 1 ? 'phrase' : 'phrases'}
              {lastLatencyMs != null ? ` · ${lastLatencyMs} ms` : ''}
            </span>
          </div>

          {/* Transcript Scroll List */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
            {transcripts.length === 0 && !interimSpeech ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[#5A6270] space-y-2">
                <Mic className="w-8 h-8 text-[#3563E9] opacity-40 animate-pulse" />
                <p className="text-xs font-medium text-[#20242C]">Conversation transcript is ready</p>
                <p className="text-[11px] max-w-sm">
                  Start speaking into your microphone or send a quick test phrase below. Both original text and translated speech will appear here.
                </p>
              </div>
            ) : (
              transcripts.map((item) => {
                const isFromMe = item.senderId === participantId;
                return (
                  <div
                    key={item.id}
                    className={`flex flex-col ${isFromMe ? 'items-end' : 'items-start'} space-y-1.5`}
                  >
                    <div className="flex items-center gap-2 text-[10px] text-[#5A6270]">
                      <span className="font-semibold text-[#20242C]">{item.senderName}</span>
                      <span>•</span>
                      <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      <span className="uppercase text-[9px] px-1.5 py-0.2 rounded bg-[#F8F7F2] border border-[#E5E2D9]">
                        {item.originalLang.toUpperCase()} ➔ {item.translatedLang.toUpperCase()}
                      </span>
                    </div>

                    {/* Dual Bubble Container */}
                    <div
                      className={`max-w-xl rounded-2xl p-4 border space-y-2.5 ${
                        isFromMe
                          ? 'bg-[#3563E9]/5 border-[#3563E9]/20 rounded-tr-xs'
                          : 'bg-[#F8F7F2] border-[#E5E2D9] rounded-tl-xs'
                      }`}
                    >
                      {/* Original Speech */}
                      <div>
                        <div className="text-[10px] font-semibold text-[#5A6270] uppercase tracking-wider mb-0.5">
                          Original ({item.originalLang.toUpperCase()})
                        </div>
                        <p className="text-sm font-medium text-[#20242C] leading-snug">
                          {item.originalText}
                        </p>
                      </div>

                      {/* Translated Speech */}
                      <div className="pt-2 border-t border-[#E5E2D9]/70 flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-semibold text-[#3563E9] uppercase tracking-wider mb-0.5 flex items-center gap-1">
                            <span>Translated ({item.translatedLang.toUpperCase()})</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                          </div>
                          <p className="text-sm font-bold text-[#20242C] leading-snug">
                            {item.translatedText}
                          </p>
                        </div>

                        {/* Replay TTS Audio */}
                        <button
                          onClick={() => replayTranslationSpeech(item.translatedText, item.translatedLang)}
                          title="Replay translated audio"
                          className="p-1.5 rounded-lg bg-white border border-[#E5E2D9] hover:bg-[#F2EFE8] text-[#5A6270] hover:text-[#3563E9] cursor-pointer transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3563E9]"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Interim Speech (Being Spoken Right Now) */}
            {interimSpeech && (
              <div className="flex flex-col items-end space-y-1 animate-pulse">
                <span className="text-[10px] text-[#3563E9] font-medium">Listening to your speech...</span>
                <div className="max-w-md bg-[#3563E9]/10 border border-[#3563E9]/30 rounded-2xl rounded-tr-xs p-3 text-xs text-[#20242C] italic">
                  "{interimSpeech}"
                </div>
              </div>
            )}

            <div ref={transcriptBottomRef} />
          </div>

          {/* Quick Phrase Chips & Push-to-Talk Bar */}
          <div className="pt-3 border-t border-[#E5E2D9] space-y-2.5">
            {/* Quick Test Chips (Smooth swipe on mobile) */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs px-0.5">
              <span className="text-[10px] uppercase font-bold text-[#5A6270] shrink-0 mr-1 hidden xs:inline">
                Quick Phrases:
              </span>
              {(QUICK_PHRASES[preferredLang] || QUICK_PHRASES.en).map((phrase) => (
                <button
                  key={phrase}
                  type="button"
                  onClick={() => sendQuickPhrase(phrase)}
                  className="px-3 py-1.5 rounded-full bg-[#F8F7F2] border border-[#E5E2D9] text-[#20242C] hover:bg-[#3563E9]/10 hover:border-[#3563E9]/30 hover:text-[#3563E9] transition-colors shrink-0 text-xs font-medium cursor-pointer min-h-[34px]"
                >
                  {phrase}
                </button>
              ))}
            </div>

            {/* Quick Type / Push Input */}
            <form onSubmit={handleSendText} className="flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type a phrase to translate without speaking..."
                className="flex-1 bg-[#F8F7F2] border border-[#E5E2D9] rounded-xl px-3.5 py-2.5 text-sm text-[#20242C] placeholder-[#5A6270]/60 focus-visible:ring-2 focus-visible:ring-[#3563E9] focus-visible:outline-none transition-colors min-h-[44px]"
              />
              <Button
                type="submit"
                size="md"
                disabled={!textInput.trim() || isSubmittingText}
                rightIcon={<Send className="w-3.5 h-3.5" />}
                className="min-h-[44px] px-3.5"
              >
                Send
              </Button>
            </form>
          </div>
        </Card>

        {/* Floating Call Bottom Control Bar (Mobile-first fixed/sticky) */}
        <div className="sticky bottom-2 z-30 bg-white/95 backdrop-blur-md border border-[#E5E2D9] rounded-2xl p-2 sm:p-3 shadow-lg max-w-md mx-auto w-full flex items-center justify-around gap-2">
          {/* Mic Toggle */}
          <button
            onClick={toggleMute}
            aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-xl transition-colors cursor-pointer min-h-[50px] focus-visible:ring-2 focus-visible:ring-[#3563E9] ${
              isMuted
                ? 'bg-[#DC2626]/10 text-[#DC2626] hover:bg-[#DC2626]/20'
                : 'bg-[#F8F7F2] text-[#20242C] hover:bg-[#F2EFE8]'
            }`}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-[#3563E9]" />}
            <span className="text-[10px] font-semibold">{isMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          {/* Speaker / TTS Deafen Toggle */}
          <button
            onClick={toggleDeafen}
            aria-label={isDeafened ? 'Enable translation audio' : 'Mute translation audio'}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-xl transition-colors cursor-pointer min-h-[50px] focus-visible:ring-2 focus-visible:ring-[#3563E9] ${
              isDeafened
                ? 'bg-[#F59E0B]/10 text-[#D97706] hover:bg-[#F59E0B]/20'
                : 'bg-[#F8F7F2] text-[#20242C] hover:bg-[#F2EFE8]'
            }`}
          >
            {isDeafened ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5 text-[#3563E9]" />}
            <span className="text-[10px] font-semibold">{isDeafened ? 'Audio Muted' : 'Audio On'}</span>
          </button>

          {/* End Call Button */}
          <button
            onClick={() => setShowEndCallModal(true)}
            aria-label="End Call"
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-xl bg-[#DC2626] text-white hover:bg-[#B91C1C] shadow-sm active:bg-[#991B1B] transition-all cursor-pointer min-h-[50px] focus-visible:ring-2 focus-visible:ring-[#DC2626]"
          >
            <PhoneOff className="w-5 h-5" />
            <span className="text-[10px] font-bold">End Call</span>
          </button>
        </div>
      </div>

      {/* LiveKit Setup Information Modal (Transparent, never fake) */}
      <Modal
        isOpen={showLiveKitModal}
        onClose={() => setShowLiveKitModal(false)}
        title="LiveKit WebRTC Audio Setup"
        description="Configure real two-person WebRTC audio calling with LiveKit credentials."
        maxWidth="md"
      >
        <div className="space-y-4 text-xs text-[#5A6270]">
          <div className="p-3 bg-[#F8F7F2] border border-[#E5E2D9] rounded-xl space-y-2">
            <span className="font-bold text-[#20242C] block">Status: Backend Credentials Unset</span>
            <p>
              {livekitSetupInfo?.description ||
                'LiveKit calling architecture is fully integrated in both frontend and backend. To publish and subscribe to real microphone audio between two devices, configure your LiveKit credentials in server/.env:'}
            </p>
            {livekitSetupInfo?.missingVars && livekitSetupInfo.missingVars.length > 0 && (
              <div className="text-[11px] text-[#D97706] font-semibold">
                Missing environment variables: {livekitSetupInfo.missingVars.join(', ')}
              </div>
            )}
          </div>

          <div className="bg-[#20242C] text-white p-3.5 rounded-xl font-mono text-[11px] space-y-1 overflow-x-auto">
            <div>LIVEKIT_URL=wss://your-project.livekit.cloud</div>
            <div>LIVEKIT_API_KEY=your_api_key</div>
            <div>LIVEKIT_API_SECRET=your_api_secret</div>
          </div>

          <div className="space-y-1.5">
            <span className="font-bold text-[#20242C] block">Quick Setup Steps:</span>
            <ol className="list-decimal pl-4 space-y-1 text-[#5A6270]">
              <li>Create a free account and project at <a href="https://cloud.livekit.io" target="_blank" rel="noreferrer" className="text-[#3563E9] underline inline-flex items-center gap-1">cloud.livekit.io <ExternalLink className="w-3 h-3" /></a></li>
              <li>Copy your WebSocket URL, API Key, and Secret to <code className="bg-[#F8F7F2] px-1 rounded text-[#20242C]">server/.env</code></li>
              <li>Restart the backend server (<code className="bg-[#F8F7F2] px-1 rounded text-[#20242C]">npm run dev</code>)</li>
            </ol>
          </div>

          <div className="pt-2 flex justify-end">
            <Button size="sm" variant="primary" onClick={() => setShowLiveKitModal(false)}>
              Got it
            </Button>
          </div>
        </div>
      </Modal>

      {/* End Call Confirmation Modal */}
      <Modal
        isOpen={showEndCallModal}
        onClose={() => setShowEndCallModal(false)}
        title="Leave and End this Call?"
        description="Ending the call will disconnect both participants and generate your translation session summary."
        maxWidth="sm"
      >
        <div className="flex gap-3 justify-end pt-3">
          <Button variant="secondary" onClick={() => setShowEndCallModal(false)}>
            Stay in Call
          </Button>
          <Button variant="danger" onClick={handleEndCall}>
            Yes, End Call
          </Button>
        </div>
      </Modal>
    </div>
  );
};
