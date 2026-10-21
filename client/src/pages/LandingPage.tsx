import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Headphones, PhoneCall, ShieldCheck, Users } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';

export const LandingPage: React.FC = () => {
  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      <section className="py-12 sm:py-16 px-4 sm:px-6 max-w-6xl mx-auto w-full">
        <div className="max-w-3xl mx-auto text-center space-y-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#3563E9]/10 text-[#3563E9] text-xs font-semibold tracking-wide border border-[#3563E9]/20">
            Two ways to speak across languages
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-[#20242C] tracking-tight leading-[1.15]">
            Speak in your language.
            <br />
            <span className="text-[#3563E9]">They hear in theirs.</span>
          </h1>
          <p className="text-base sm:text-lg text-[#5A6270] leading-relaxed">
            Face-to-face on one device, or a live call from different networks.
            English, Kannada, Hindi, Spanish, German, and Tamil — with measured delay, never a zero-lag claim.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <span className="text-xs text-[#5A6270]/60 font-medium tracking-wider uppercase">6 languages</span>
            <span className="text-[#E5E2D9] select-none">·</span>
            <span className="text-xs font-semibold text-[#20242C]">EN</span>
            <span className="text-[#E5E2D9] select-none">·</span>
            <span className="text-xs font-semibold text-[#20242C]">KN</span>
            <span className="text-[#E5E2D9] select-none">·</span>
            <span className="text-xs font-semibold text-[#20242C]">HI</span>
            <span className="text-[#E5E2D9] select-none">·</span>
            <span className="text-xs font-semibold text-[#20242C]">ES</span>
            <span className="text-[#E5E2D9] select-none">·</span>
            <span className="text-xs font-semibold text-[#20242C]">DE</span>
            <span className="text-[#E5E2D9] select-none">·</span>
            <span className="text-xs font-semibold text-[#20242C]">TA</span>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-5 max-w-5xl mx-auto">
          <Link to="/face-to-face" className="group block h-full">
            <Card hoverable className="h-full p-7 sm:p-8">
              <div className="w-12 h-12 rounded-2xl bg-[#3563E9]/10 text-[#3563E9] flex items-center justify-center mb-5">
                <Headphones className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-extrabold text-[#20242C]">Face-to-Face Translator</h2>
              <p className="text-sm text-[#5A6270] mt-2 leading-relaxed">
                People standing together on one phone or laptop. Listen, translate, and speak with original and translated text kept separate.
              </p>
              <div className="mt-6">
                <Button size="lg" className="w-full sm:w-auto" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Open translator
                </Button>
              </div>
            </Card>
          </Link>

          <Card hoverable className="h-full p-7 sm:p-8">
            <div className="w-12 h-12 rounded-2xl bg-[#3563E9]/10 text-[#3563E9] flex items-center justify-center mb-5">
              <PhoneCall className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-extrabold text-[#20242C]">Live Translation Call</h2>
            <p className="text-sm text-[#5A6270] mt-2 leading-relaxed">
              Two people join from separate devices. Same Wi-Fi is not required — each caller needs working internet. Join with a room code or invite link.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-2">
              <Link to="/create">
                <Button size="lg" className="w-full sm:w-auto" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Create a call
                </Button>
              </Link>
              <Link to="/join">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  Join a call
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </section>

      <section className="py-12 border-t border-[#E5E2D9] bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Card variant="flat" className="p-6 bg-[#F8F7F2]/60">
            <Users className="w-5 h-5 text-[#3563E9] mb-3" />
            <h3 className="font-bold text-[#20242C]">Different networks</h3>
            <p className="text-xs text-[#5A6270] mt-2 leading-relaxed">
              Callers can use Wi-Fi and mobile data. Quality still depends on signal, firewalls, and latency.
            </p>
          </Card>
          <Card variant="flat" className="p-6 bg-[#F8F7F2]/60">
            <Headphones className="w-5 h-5 text-[#3563E9] mb-3" />
            <h3 className="font-bold text-[#20242C]">No feedback loops</h3>
            <p className="text-xs text-[#5A6270] mt-2 leading-relaxed">
              Translated playback is paused out of the microphone path. Use headphones when the speaker is loud.
            </p>
          </Card>
          <Card variant="flat" className="p-6 bg-[#F8F7F2]/60">
            <ShieldCheck className="w-5 h-5 text-[#3563E9] mb-3" />
            <h3 className="font-bold text-[#20242C]">Honest language support</h3>
            <p className="text-xs text-[#5A6270] mt-2 leading-relaxed">
              Kannada and Tamil voices depend on the device. If a voice is missing, you still get the translated text.
            </p>
          </Card>
        </div>
      </section>
    </div>
  );
};
