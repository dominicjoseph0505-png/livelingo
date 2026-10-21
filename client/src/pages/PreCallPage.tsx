import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Mic,
  MicOff,
  Volume2,
  CheckCircle,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  Phone,
  Shield,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { AudioMeter } from '../components/common/AudioMeter';
import { MicrophoneAudioVisualizer } from '../services/audioVisualizer';
import { speechSynthesisService } from '../services/speechSynthesis';
import { api } from '../services/api';

export const PreCallPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const [room, setRoom] = useState<any | null>(null);
  const [micStatus, setMicStatus] = useState<'checking' | 'prompt' | 'granted' | 'denied'>('checking');
  const [micLevel, setMicLevel] = useState(0);
  const [frequencyData, setFrequencyData] = useState<Uint8Array | undefined>(undefined);
  const [isPlayingTestSound, setIsPlayingTestSound] = useState(false);
  const [soundTestSuccess, setSoundTestSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isLoadingRoom, setIsLoadingRoom] = useState(true);

  const visualizerRef = useRef<MicrophoneAudioVisualizer | null>(null);

  // Retrieve user session info
  const participantName = sessionStorage.getItem('livelingo_participant_name') || 'Caller';
  const preferredLang = sessionStorage.getItem('livelingo_preferred_lang') || 'en';
  const participantId = sessionStorage.getItem('livelingo_participant_id') || `usr_${Math.random().toString(36).substring(2, 7)}`;

  useEffect(() => {
    if (!sessionStorage.getItem('livelingo_participant_id')) {
      sessionStorage.setItem('livelingo_participant_id', participantId);
    }

    if (roomId) {
      loadRoom(roomId);
    }

    startMicTest();

    return () => {
      visualizerRef.current?.stop();
    };
  }, [roomId]);

  const loadRoom = async (code: string) => {
    try {
      setIsLoadingRoom(true);
      const res = await api.getRoom(code);
      if (res.success && res.room) {
        setRoom(res.room);
      }
    } catch (e) {
      console.warn('Room fetch error in pre-call:', e);
    } finally {
      setIsLoadingRoom(false);
    }
  };

  const startMicTest = async () => {
    setMicStatus('checking');

    if (!visualizerRef.current) {
      visualizerRef.current = new MicrophoneAudioVisualizer();
    }

    const success = await visualizerRef.current.start((level, freq) => {
      setMicLevel(level);
      setFrequencyData(freq);
    });

    if (success) {
      setMicStatus('granted');
    } else {
      setMicStatus('denied');
    }
  };

  const playSpeakerTest = async () => {
    setIsPlayingTestSound(true);
    try {
      await speechSynthesisService.playTestChime();
      setSoundTestSuccess(true);
    } finally {
      setIsPlayingTestSound(false);
    }
  };

  const copyInvite = () => {
    if (!roomId) return;
    const inviteUrl = `${window.location.origin}/join?room=${roomId}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const enterLiveCall = () => {
    visualizerRef.current?.stop();
    navigate(`/call/${roomId}`);
  };

  return (
    <div className="py-6 sm:py-12 px-3.5 sm:px-6 max-w-3xl mx-auto w-full">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-5 sm:mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#5A6270] uppercase tracking-wider">
              Pre-Call Device Diagnostic
            </span>
            <Badge variant="cobalt" size="sm">
              {isLoadingRoom ? 'Verifying...' : `Room: ${room?.code || roomId}`}
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#20242C] mt-1">
            Check Your Audio Setup
          </h1>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={copyInvite}
          className="self-start sm:self-auto min-h-[36px]"
          leftIcon={copied ? <Check className="w-4 h-4 text-[#059669]" /> : <Copy className="w-4 h-4" />}
        >
          {copied ? 'Link Copied' : 'Copy Invite Link'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Microphone Diagnostic Card */}
        <Card className="p-4.5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-[#20242C] uppercase tracking-wider flex items-center gap-2">
                <Mic className="w-4 h-4 text-[#3563E9]" />
                Microphone Test
              </span>

              {micStatus === 'granted' && (
                <Badge variant="success" size="sm" icon={<CheckCircle className="w-3.5 h-3.5" />}>
                  Mic Active
                </Badge>
              )}
              {micStatus === 'denied' && (
                <Badge variant="danger" size="sm" icon={<AlertTriangle className="w-3.5 h-3.5" />}>
                  Access Blocked
                </Badge>
              )}
              {micStatus === 'checking' && (
                <Badge variant="warning" size="sm">
                  Requesting...
                </Badge>
              )}
            </div>

            <p className="text-xs text-[#5A6270] mb-5">
              Speak a few words out loud to test your microphone's input sensitivity.
            </p>

            {/* Live Audio Meter */}
            <div className="bg-[#F8F7F2] p-6 rounded-xl border border-[#E5E2D9] flex flex-col items-center justify-center min-h-[110px]">
              {micStatus === 'granted' ? (
                <div className="w-full flex flex-col items-center space-y-3">
                  <AudioMeter
                    level={micLevel}
                    frequencyData={frequencyData}
                    isActive={true}
                    barCount={16}
                    height={44}
                  />
                  <span className="text-[11px] font-mono text-[#5A6270]">
                    Sensitivity level: {micLevel}%
                  </span>
                </div>
              ) : micStatus === 'denied' ? (
                <div className="text-center space-y-2">
                  <MicOff className="w-8 h-8 text-[#DC2626] mx-auto opacity-70" />
                  <p className="text-xs text-[#DC2626] font-medium">
                    Microphone access was denied or not found.
                  </p>
                  <p className="text-[11px] text-[#5A6270]">
                    Click the camera/lock icon in your browser address bar to allow microphone access.
                  </p>
                </div>
              ) : (
                <div className="text-center text-xs text-[#5A6270] animate-pulse">
                  Initializing microphone stream...
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-[#E5E2D9] flex justify-between items-center">
            <button
              onClick={startMicTest}
              className="inline-flex items-center gap-1.5 text-xs text-[#3563E9] hover:underline font-medium cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retest Microphone
            </button>
            <span className="text-[11px] text-[#5A6270]">Web Audio API</span>
          </div>
        </Card>

        {/* Speaker Diagnostic Card */}
        <Card className="p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-[#20242C] uppercase tracking-wider flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-[#3563E9]" />
                Speaker / Audio Output
              </span>

              {soundTestSuccess && (
                <Badge variant="success" size="sm" icon={<CheckCircle className="w-3.5 h-3.5" />}>
                  Audio Verified
                </Badge>
              )}
            </div>

            <p className="text-xs text-[#5A6270] mb-5">
              Play a test tone to confirm you can hear translated speech through your headphones or speakers.
            </p>

            <div className="bg-[#F8F7F2] p-6 rounded-xl border border-[#E5E2D9] flex flex-col items-center justify-center min-h-[110px] space-y-3">
              <Button
                variant="secondary"
                size="md"
                onClick={playSpeakerTest}
                isLoading={isPlayingTestSound}
                leftIcon={<Volume2 className="w-4 h-4 text-[#3563E9]" />}
              >
                {isPlayingTestSound ? 'Playing Tone...' : 'Play Test Chime'}
              </Button>

              <span className="text-[11px] text-[#5A6270]">
                {soundTestSuccess
                  ? '✓ Harmonic test chime completed successfully.'
                  : 'Click above to test your audio output.'}
              </span>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-[#E5E2D9] flex justify-between items-center">
            <span className="text-xs text-[#5A6270]">Caller Name:</span>
            <span className="text-xs font-bold text-[#20242C]">{participantName}</span>
          </div>
        </Card>
      </div>

      {/* Language Configuration Confirmation */}
      <Card className="mt-6 p-5 bg-[#F2EFE8]/70 border border-[#E5E2D9]">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#3563E9]/10 text-[#3563E9] flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#20242C]">Language Configuration</div>
              <div className="text-xs text-[#5A6270] mt-0.5">
                Your Spoken Language: <strong>{preferredLang === 'en' ? 'English 🇬🇧' : preferredLang === 'hi' ? 'Hindi 🇮🇳' : preferredLang.toUpperCase()}</strong>
              </div>
            </div>
          </div>

          <div className="w-full sm:w-auto">
            <Button
              size="lg"
              variant="primary"
              onClick={enterLiveCall}
              className="w-full sm:w-auto"
              rightIcon={<Phone className="w-4 h-4" />}
            >
              Enter Live Call
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
