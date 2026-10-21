import React from 'react';
import { Shield, Sparkles, Cpu } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-[#E5E2D9] bg-[#F2EFE8]/50 py-8 px-4 text-xs text-[#5A6270]">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Left */}
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#3563E9]" />
          <span>
            <strong className="text-[#20242C]">Private & Real-Time:</strong> In-memory audio processing. No voice or transcripts stored.
          </span>
        </div>

        {/* Center / Right */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-[11px]">
          <span className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-full border border-[#E5E2D9]">
            <Cpu className="w-3.5 h-3.5 text-[#059669]" />
            Languages: <strong className="text-[#20242C]">en kn hi es de ta</strong>
          </span>
          <span className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-full border border-[#E5E2D9]">
            <Sparkles className="w-3.5 h-3.5 text-[#3563E9]" />
            Translation: phrase table + MyMemory · TTS is device voices
          </span>
        </div>
      </div>
    </footer>
  );
};
