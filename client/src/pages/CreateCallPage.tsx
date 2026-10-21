import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRightLeft,
  Sparkles,
  Check,
  Copy,
  ArrowRight,
  Shield,
  Phone,
  Volume2,
  Captions,
  User,
  Globe,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { LanguageSelector } from '../components/common/LanguageSelector';
import { api } from '../services/api';
import { getLanguage } from '../data/languages';

export const CreateCallPage: React.FC = () => {
  const navigate = useNavigate();
  const [hostName, setHostName] = useState('Caller 1');
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('hi');
  const [autoPlayTts, setAutoPlayTts] = useState(true);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [createdRoomData, setCreatedRoomData] = useState<{
    code: string;
    roomId: string;
    participantId: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const swapLanguages = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
  };

  const handleCreateCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostName.trim()) {
      setError('Please enter your display name.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.createRoom(hostName.trim(), sourceLang, targetLang);
      if (response.success && response.room) {
        sessionStorage.setItem('livelingo_participant_id', response.hostParticipant.id);
        sessionStorage.setItem('livelingo_participant_name', response.hostParticipant.name);
        sessionStorage.setItem('livelingo_preferred_lang', sourceLang);
        sessionStorage.setItem('livelingo_target_lang', targetLang);
        sessionStorage.setItem('livelingo_auto_tts', String(autoPlayTts));
        setCreatedRoomData({
          code: response.room.code,
          roomId: response.room.id,
          participantId: response.hostParticipant.id,
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create call room. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyInviteLink = () => {
    if (!createdRoomData) return;
    const inviteUrl = `${window.location.origin}/join?room=${createdRoomData.code}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const proceedToPreCall = () => {
    if (!createdRoomData) return;
    navigate(`/pre-call/${createdRoomData.code}`);
  };

  const sourceLangData = getLanguage(sourceLang);
  const targetLangData = getLanguage(targetLang);

  return (
    <div className="py-6 sm:py-10 px-4 sm:px-6 max-w-2xl mx-auto w-full">

      {/* Back nav */}
      <button
        onClick={() => navigate('/')}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#5A6270] hover:text-[#20242C] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3563E9] rounded-lg px-1 py-1 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </button>

      {/* Header */}
      <div className="flex items-start gap-3 mb-7">
        <div className="w-10 h-10 rounded-xl bg-[#3563E9]/10 flex items-center justify-center shrink-0 mt-0.5">
          <Phone className="w-5 h-5 text-[#3563E9]" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#20242C] tracking-tight">
            Create a Live Call
          </h1>
          <p className="text-sm text-[#5A6270] mt-0.5">
            Set your languages, generate a room code, and share it with your partner.
          </p>
        </div>
      </div>

      {!createdRoomData ? (
        <form onSubmit={handleCreateCall} className="space-y-5">

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[#DC2626]/10 border border-[#DC2626]/20 text-sm text-[#DC2626] font-medium">
              <span className="mt-0.5 shrink-0">⚠</span>
              {error}
            </div>
          )}

          {/* Step 1 — Display Name */}
          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-[#3563E9] text-white text-xs font-bold flex items-center justify-center shrink-0">1</div>
              <span className="text-sm font-bold text-[#20242C]">Your display name</span>
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#5A6270]">
                <User className="w-4 h-4" />
              </div>
              <input
                id="hostName"
                type="text"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                placeholder="e.g. Alex or राहुल"
                maxLength={40}
                required
                className="w-full bg-[#F8F7F2] border border-[#E5E2D9] rounded-xl pl-10 pr-4 py-3 text-sm text-[#20242C] placeholder-[#5A6270]/50 focus-visible:ring-2 focus-visible:ring-[#3563E9] focus-visible:outline-none hover:border-[#D5D1C6] transition-colors"
              />
            </div>
            <p className="text-xs text-[#5A6270] mt-2">
              Your partner will see this name during the call.
            </p>
          </Card>

          {/* Step 2 — Language Pair */}
          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-[#3563E9] text-white text-xs font-bold flex items-center justify-center shrink-0">2</div>
              <span className="text-sm font-bold text-[#20242C]">Choose your language pair</span>
            </div>

            <div className="grid grid-cols-[1fr_44px_1fr] gap-2 items-end mb-4">
              <LanguageSelector
                label="You speak"
                value={sourceLang}
                onChange={setSourceLang}
              />
              <div className="flex items-end justify-center pb-[3px]">
                <button
                  type="button"
                  onClick={swapLanguages}
                  aria-label="Swap language pair"
                  className="w-10 h-10 rounded-xl border border-[#E5E2D9] bg-white text-[#3563E9] hover:bg-[#EEF2FD] hover:border-[#3563E9]/40 hover:shadow-sm active:scale-95 flex items-center justify-center transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3563E9]"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                </button>
              </div>
              <LanguageSelector
                label="Partner hears"
                value={targetLang}
                onChange={setTargetLang}
              />
            </div>

            {/* Live preview pill */}
            {sourceLangData && targetLangData && (
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#3563E9]/06 border border-[#3563E9]/15">
                <Globe className="w-3.5 h-3.5 text-[#3563E9] shrink-0" />
                <p className="text-xs text-[#3563E9] font-medium">
                  {sourceLangData.flag} {sourceLangData.name}
                  <span className="mx-1.5 text-[#3563E9]/50">→</span>
                  {targetLangData.flag} {targetLangData.name}
                  <span className="text-[#3563E9]/60 font-normal ml-1.5">· bidirectional</span>
                </p>
              </div>
            )}

            <p className="text-[11px] text-[#5A6270] mt-3">
              Both participants select their own language when they join. LiveLingo translates in both directions automatically.
            </p>
          </Card>

          {/* Step 3 — Preferences */}
          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-[#3563E9] text-white text-xs font-bold flex items-center justify-center shrink-0">3</div>
              <span className="text-sm font-bold text-[#20242C]">Call preferences</span>
            </div>

            <div className="space-y-2.5">
              <ToggleRow
                icon={<Volume2 className="w-4 h-4" />}
                title="Spoken translation"
                description="Automatically speak translated phrases aloud"
                checked={autoPlayTts}
                onChange={setAutoPlayTts}
              />
              <ToggleRow
                icon={<Captions className="w-4 h-4" />}
                title="Live dual subtitles"
                description="Show original and translated text on screen"
                checked={showSubtitles}
                onChange={setShowSubtitles}
              />
            </div>
          </Card>

          {/* CTA */}
          <Button
            type="submit"
            size="lg"
            isLoading={isLoading}
            className="w-full"
            rightIcon={<Sparkles className="w-4 h-4" />}
          >
            {isLoading ? 'Creating room…' : 'Generate Call Room'}
          </Button>

          <p className="text-center text-[11px] text-[#5A6270] flex items-center justify-center gap-1.5">
            <Shield className="w-3 h-3 text-[#3563E9]" />
            Ephemeral session — no data stored, no recordings kept.
          </p>

        </form>
      ) : (
        /* ── Room Created Success ── */
        <Card className="p-6 sm:p-8 text-center space-y-6">

          {/* Success icon */}
          <div className="relative mx-auto w-16 h-16">
            <div className="absolute inset-0 rounded-full bg-[#10B981]/15 animate-pulse" />
            <div className="relative w-16 h-16 rounded-full bg-[#10B981]/15 border-2 border-[#10B981]/30 text-[#059669] flex items-center justify-center">
              <Check className="w-8 h-8" strokeWidth={2.5} />
            </div>
          </div>

          <div>
            <h2 className="text-xl font-extrabold text-[#20242C] tracking-tight">
              Your call room is ready!
            </h2>
            <p className="text-sm text-[#5A6270] mt-1">
              Share the room code or invite link with your partner.
            </p>
          </div>

          {/* Room code */}
          <div className="bg-[#F8F7F2] border border-[#E5E2D9] rounded-2xl p-5 max-w-xs mx-auto">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#5A6270]">
              Room code
            </span>
            <div className="text-4xl font-mono font-extrabold text-[#3563E9] tracking-[0.15em] my-2">
              {createdRoomData.code}
            </div>
            <span className="text-[11px] text-[#5A6270]/70">Valid for this session</span>
          </div>

          {/* Language pair reminder */}
          <div className="flex items-center justify-center gap-2 text-sm text-[#5A6270]">
            <span>{sourceLangData?.flag} {sourceLangData?.name}</span>
            <ArrowRightLeft className="w-3.5 h-3.5 text-[#3563E9]/60" />
            <span>{targetLangData?.flag} {targetLangData?.name}</span>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 max-w-sm mx-auto w-full">
            <Button
              type="button"
              variant="secondary"
              onClick={copyInviteLink}
              leftIcon={copied ? <Check className="w-4 h-4 text-[#059669]" /> : <Copy className="w-4 h-4" />}
              className={`flex-1 ${copied ? 'border-[#10B981]/40 text-[#059669]' : ''}`}
            >
              {copied ? 'Copied!' : 'Copy invite link'}
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={proceedToPreCall}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="flex-1"
            >
              Enter call
            </Button>
          </div>

          <p className="text-[11px] text-[#5A6270] flex items-center justify-center gap-1.5">
            <Shield className="w-3 h-3 text-[#3563E9]" />
            End-to-end ephemeral session. No recordings kept.
          </p>

        </Card>
      )}
    </div>
  );
};

/* ── Toggle row sub-component ── */
interface ToggleRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ icon, title, description, checked, onChange }) => (
  <label className="flex items-center gap-3.5 p-3.5 rounded-xl border border-[#E5E2D9] hover:bg-[#F8F7F2] hover:border-[#D5D1C6] cursor-pointer transition-all duration-150 group">
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-[#3563E9]/10 text-[#3563E9]' : 'bg-[#F2EFE8] text-[#5A6270]'}`}>
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-sm font-semibold text-[#20242C]">{title}</div>
      <div className="text-xs text-[#5A6270]">{description}</div>
    </div>
    {/* Custom toggle */}
    <div className={`relative w-10 h-5.5 rounded-full transition-colors duration-200 shrink-0 ${checked ? 'bg-[#3563E9]' : 'bg-[#D5D1C6]'}`}>
      <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? 'translate-x-4.5' : 'translate-x-0'}`} />
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </div>
  </label>
);
