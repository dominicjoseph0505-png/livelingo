import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, AlertCircle, ArrowRight, CheckCircle2, User } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { LanguageSelector } from '../components/common/LanguageSelector';
import { Badge } from '../components/common/Badge';
import { api } from '../services/api';

export const JoinCallPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [roomCode, setRoomCode] = useState(searchParams.get('room') || '');
  const [guestName, setGuestName] = useState('Caller 2');
  const [preferredLang, setPreferredLang] = useState('hi');
  const [isValidating, setIsValidating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [roomPreview, setRoomPreview] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-validate room if room code present in query
  useEffect(() => {
    const queryRoom = searchParams.get('room');
    if (queryRoom && queryRoom.trim().length >= 4) {
      checkRoomCode(queryRoom.trim());
    }
  }, [searchParams]);

  const checkRoomCode = async (code: string) => {
    if (!code.trim()) return;
    setIsValidating(true);
    setError(null);

    try {
      const formatted = code.trim().toUpperCase();
      const res = await api.getRoom(formatted);
      if (res.success && res.room) {
        setRoomPreview(res.room);
        // Automatically default guest language to room target language
        if (res.room.targetLang) {
          setPreferredLang(res.room.targetLang);
        }
      }
    } catch (err: any) {
      setRoomPreview(null);
      setError('Could not locate an active room with this code. Verify the code with the host.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) {
      setError('Please enter a room code.');
      return;
    }
    if (!guestName.trim()) {
      setError('Please enter your display name.');
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      const code = roomCode.trim().toUpperCase();
      const res = await api.joinRoom(code, guestName.trim(), preferredLang);

      if (res.success && res.room && res.participant) {
        // Save guest session details
        sessionStorage.setItem('livelingo_participant_id', res.participant.id);
        sessionStorage.setItem('livelingo_participant_name', res.participant.name);
        sessionStorage.setItem('livelingo_preferred_lang', preferredLang);
        sessionStorage.setItem('livelingo_target_lang', res.room.sourceLang || 'en');
        sessionStorage.setItem('livelingo_auto_tts', 'true');

        navigate(`/pre-call/${res.room.code}`);
      }
    } catch (err: any) {
      setError(err.message || 'Unable to join the call room. It might be full or ended.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="py-6 sm:py-10 px-3.5 sm:px-6 max-w-xl mx-auto w-full">
      <button
        onClick={() => navigate('/')}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5A6270] hover:text-[#20242C] mb-4 sm:mb-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3563E9] rounded-lg p-1.5 min-h-[36px]"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Home
      </button>

      <div className="mb-5 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#20242C]">Join a Live Call</h1>
        <p className="text-xs sm:text-sm text-[#5A6270] mt-1">
          Enter the room code shared by your call partner to connect.
        </p>
      </div>

      <Card className="p-4.5 sm:p-8">
        <form onSubmit={handleJoin} className="space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-[#DC2626]/10 border border-[#DC2626]/20 flex items-start gap-3 text-xs text-[#DC2626]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold">Room Connection Notice:</span>
                <div>{error}</div>
              </div>
            </div>
          )}

          {/* Room Code */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="roomCode" className="text-xs font-semibold text-[#5A6270] uppercase tracking-wider">
                Room Code / Link
              </label>
              {roomCode && (
                <button
                  type="button"
                  onClick={() => checkRoomCode(roomCode)}
                  className="text-xs text-[#3563E9] hover:underline cursor-pointer"
                >
                  Verify Code
                </button>
              )}
            </div>
            <div className="relative">
              <input
                id="roomCode"
                type="text"
                value={roomCode}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  setRoomCode(val);
                  if (val.length >= 4) {
                    checkRoomCode(val);
                  }
                }}
                placeholder="e.g. LL-8492"
                required
                className="w-full bg-[#F8F7F2] border border-[#E5E2D9] rounded-xl px-4 py-3 text-base font-mono font-bold text-[#20242C] tracking-wider placeholder-[#5A6270]/50 uppercase focus-visible:ring-2 focus-visible:ring-[#3563E9] focus-visible:outline-none transition-colors hover:border-[#D5D1C6]"
              />
              {isValidating && (
                <div className="absolute right-3.5 top-3.5 text-xs text-[#5A6270] animate-pulse">
                  Checking...
                </div>
              )}
            </div>
          </div>

          {/* Validated Room Preview info */}
          {roomPreview && (
            <div className="p-3.5 rounded-xl bg-[#10B981]/10 border border-[#10B981]/20 flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2 text-xs text-[#059669]">
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  Room found: <strong>{roomPreview.code}</strong> (Status: {roomPreview.status})
                </span>
              </div>
              <Badge variant="cobalt" size="sm">
                Host speaks: {roomPreview.sourceLang.toUpperCase()}
              </Badge>
            </div>
          )}

          {/* Your Name */}
          <div>
            <label htmlFor="guestName" className="block text-xs font-semibold text-[#5A6270] uppercase tracking-wider mb-2">
              Your Display Name
            </label>
            <div className="relative">
              <input
                id="guestName"
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="e.g. Priya or राहुल"
                maxLength={40}
                required
                className="w-full bg-[#F8F7F2] border border-[#E5E2D9] rounded-xl px-4 py-3 pl-10 text-sm text-[#20242C] placeholder-[#5A6270]/60 focus-visible:ring-2 focus-visible:ring-[#3563E9] focus-visible:outline-none transition-colors hover:border-[#D5D1C6]"
              />
              <User className="w-4 h-4 text-[#5A6270] absolute left-3.5 top-3.5" />
            </div>
          </div>

          {/* Preferred Language for guest */}
          <LanguageSelector
            label="Your Language (What you speak & hear)"
            value={preferredLang}
            onChange={setPreferredLang}
          />

          <div className="text-[11px] text-[#5A6270] bg-[#F8F7F2] p-3 rounded-lg border border-[#E5E2D9]">
            ℹ️ Before entering the live conversation, you will complete an audio diagnostic check to test your microphone and speakers.
          </div>

          <Button
            type="submit"
            size="lg"
            isLoading={isJoining || isValidating}
            className="w-full"
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Join Call & Proceed to Pre-Call Check
          </Button>
        </form>
      </Card>
    </div>
  );
};
