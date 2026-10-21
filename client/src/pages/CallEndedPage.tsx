import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  PhoneOff,
  Clock,
  MessageSquare,
  Globe,
  Home,
  PlusCircle,
  Download,
  Copy,
  Check,
  Star,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';

export const CallEndedPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const [summary, setSummary] = useState<any | null>(null);
  const [showTranscripts, setShowTranscripts] = useState(false);
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [rating, setRating] = useState<number>(5);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem('livelingo_last_call_summary');
    if (raw) {
      try {
        setSummary(JSON.parse(raw));
      } catch {
        // Fallback
      }
    }
  }, []);

  const formatDuration = (secs: number = 0) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  const copyFullTranscript = () => {
    if (!summary?.transcripts || summary.transcripts.length === 0) return;

    const formatted = summary.transcripts
      .map(
        (t: any) =>
          `[${t.senderName} (${t.originalLang.toUpperCase()})]: ${t.originalText}\n[Translated (${t.translatedLang.toUpperCase()})]: ${t.translatedText}\n`
      )
      .join('\n');

    navigator.clipboard.writeText(formatted);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2500);
  };

  const downloadTranscriptFile = () => {
    if (!summary?.transcripts || summary.transcripts.length === 0) return;

    const formatted = summary.transcripts
      .map(
        (t: any) =>
          `[${new Date(t.timestamp).toLocaleTimeString()}] ${t.senderName} (${t.originalLang.toUpperCase()} -> ${t.translatedLang.toUpperCase()}):\nOriginal: ${t.originalText}\nTranslated: ${t.translatedText}\n`
      )
      .join('\n---\n\n');

    const blob = new Blob([`LiveLingo Call Transcript - Room ${roomId || 'Session'}\n\n` + formatted], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LiveLingo-Transcript-${roomId || 'call'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="py-6 sm:py-10 px-3.5 sm:px-6 max-w-2xl mx-auto w-full">
      <Card className="p-4.5 sm:p-10 text-center space-y-6">
        {/* Call Ended Icon */}
        <div className="w-14 h-14 rounded-full bg-[#DC2626]/10 text-[#DC2626] flex items-center justify-center mx-auto">
          <PhoneOff className="w-7 h-7" />
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#20242C]">Call Concluded</h1>
          <p className="text-sm text-[#5A6270] mt-1">
            Thank you for using LiveLingo Calling. Here is your session overview.
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-3 bg-[#F8F7F2] p-4 rounded-xl border border-[#E5E2D9]">
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#5A6270] flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#3563E9]" /> Duration
            </span>
            <span className="text-lg sm:text-xl font-bold font-mono text-[#20242C] mt-1">
              {formatDuration(summary?.durationSeconds || 0)}
            </span>
          </div>

          <div className="flex flex-col items-center border-x border-[#E5E2D9]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#5A6270] flex items-center gap-1">
              <MessageSquare className="w-3 h-3 text-[#3563E9]" /> Translated
            </span>
            <span className="text-lg sm:text-xl font-bold text-[#20242C] mt-1">
              {summary?.transcriptCount || summary?.transcripts?.length || 0}
            </span>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#5A6270] flex items-center gap-1">
              <Globe className="w-3 h-3 text-[#3563E9]" /> Language
            </span>
            <span className="text-xs sm:text-sm font-bold text-[#20242C] mt-1">
              EN ⇄ HI
            </span>
          </div>
        </div>

        {/* Transcript Review Accordion */}
        {summary?.transcripts && summary.transcripts.length > 0 && (
          <div className="text-left border border-[#E5E2D9] rounded-xl overflow-hidden">
            <button
              onClick={() => setShowTranscripts(!showTranscripts)}
              className="w-full p-4 bg-[#F8F7F2] flex items-center justify-between text-xs font-bold text-[#20242C] hover:bg-[#F2EFE8] cursor-pointer"
            >
              <span>Review Call Transcripts ({summary.transcripts.length})</span>
              {showTranscripts ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showTranscripts && (
              <div className="p-4 bg-white space-y-3 max-h-60 overflow-y-auto">
                {summary.transcripts.map((t: any, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-[#F8F7F2] border border-[#E5E2D9] text-xs">
                    <div className="font-semibold text-[#20242C]">{t.senderName}:</div>
                    <div className="text-[#5A6270] mt-0.5">"{t.originalText}"</div>
                    <div className="text-[#3563E9] font-medium mt-1">➔ "{t.translatedText}"</div>
                  </div>
                ))}

                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={copyFullTranscript}
                    leftIcon={copiedTranscript ? <Check className="w-3.5 h-3.5 text-[#059669]" /> : <Copy className="w-3.5 h-3.5" />}
                  >
                    {copiedTranscript ? 'Copied' : 'Copy Text'}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={downloadTranscriptFile}
                    leftIcon={<Download className="w-3.5 h-3.5" />}
                  >
                    Download .txt
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Call Quality Rating */}
        <div className="p-4 rounded-xl bg-white border border-[#E5E2D9] space-y-2">
          <span className="text-xs font-semibold text-[#20242C]">
            How was the voice translation quality?
          </span>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => {
                  setRating(star);
                  setRatingSubmitted(true);
                }}
                className="p-1 hover:scale-110 transition-transform cursor-pointer"
                aria-label={`${star} star rating`}
              >
                <Star
                  className={`w-6 h-6 ${
                    star <= rating ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-[#E5E2D9]'
                  }`}
                />
              </button>
            ))}
          </div>
          {ratingSubmitted && (
            <span className="text-[11px] text-[#059669] font-medium block">
              ✓ Thanks for your feedback!
            </span>
          )}
        </div>

        {/* Navigation Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button
            size="lg"
            variant="secondary"
            onClick={() => navigate('/')}
            className="flex-1"
            leftIcon={<Home className="w-4 h-4" />}
          >
            Return Home
          </Button>
          <Button
            size="lg"
            variant="primary"
            onClick={() => navigate('/create')}
            className="flex-1"
            leftIcon={<PlusCircle className="w-4 h-4" />}
          >
            Start Another Call
          </Button>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-xs text-[#5A6270] pt-1">
          <ShieldCheck className="w-4 h-4 text-[#059669]" />
          <span>Call data has been safely cleared from active memory.</span>
        </div>
      </Card>
    </div>
  );
};
