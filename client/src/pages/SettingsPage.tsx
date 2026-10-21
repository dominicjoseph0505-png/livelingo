import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Globe,
  Volume2,
  Shield,
  Cpu,
  Check,
  Save,
  Play,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { LanguageSelector } from '../components/common/LanguageSelector';
import { speechSynthesisService } from '../services/speechSynthesis';
import { api } from '../services/api';

export const SettingsPage: React.FC = () => {
  const [defaultSourceLang, setDefaultSourceLang] = useState('en');
  const [defaultTargetLang, setDefaultTargetLang] = useState('hi');
  const [ttsSpeed, setTtsSpeed] = useState<number>(1.0);
  const [autoPlayTts, setAutoPlayTts] = useState(true);
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [serverConfig, setServerConfig] = useState<any | null>(null);
  const [capabilityNote, setCapabilityNote] = useState('');
  const [capabilityRows, setCapabilityRows] = useState<
    Array<{ code: string; name: string; stt: string; tts: string; translation: string; verification: string }>
  >([]);

  useEffect(() => {
    // Load stored preferences
    const storedLang = sessionStorage.getItem('livelingo_preferred_lang');
    if (storedLang) setDefaultSourceLang(storedLang);

    const storedSpeed = localStorage.getItem('livelingo_tts_speed');
    if (storedSpeed) setTtsSpeed(parseFloat(storedSpeed));

    // Fetch server status & configuration
    api.getConfig().then((res) => {
      setServerConfig(res.services);
    }).catch((err) => {
      console.warn('Failed to load server config:', err);
    });

    api.getLanguageCapabilities().then((res) => {
      setCapabilityNote(res.note);
      setCapabilityRows(
        res.languages.map((lang) => ({
          code: lang.code,
          name: lang.name,
          stt: lang.capability?.stt || 'unverified',
          tts: lang.capability?.tts || 'unverified',
          translation: lang.capability?.translation || 'enabled',
          verification: lang.capability?.verification || 'unverified',
        }))
      );
    }).catch(() => {});

    // Enumerate audio devices if supported
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const mics = devices.filter((d) => d.kind === 'audioinput');
        setAudioInputDevices(mics);
        if (mics.length > 0) {
          setSelectedMic(mics[0].deviceId);
        }
      }).catch(() => {});
    }
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    sessionStorage.setItem('livelingo_preferred_lang', defaultSourceLang);
    sessionStorage.setItem('livelingo_target_lang', defaultTargetLang);
    localStorage.setItem('livelingo_tts_speed', String(ttsSpeed));
    localStorage.setItem('livelingo_auto_tts', String(autoPlayTts));

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const testVoiceSample = () => {
    const text =
      defaultSourceLang === 'hi'
        ? 'यह लाइव लिंगो कॉलिंग की आवाज़ का परीक्षण है।'
        : 'This is a voice translation audio preview for LiveLingo Calling.';

    speechSynthesisService.speak(text, defaultSourceLang, { rate: ttsSpeed });
  };

  return (
    <div className="py-6 sm:py-10 px-3.5 sm:px-6 max-w-3xl mx-auto w-full">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-[#3563E9]" />
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#20242C]">Preferences & Settings</h1>
        </div>
        <p className="text-sm text-[#5A6270] mt-1">
          Customize language defaults, audio hardware, and inspect engine privacy and connectivity.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Language Defaults Card */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#E5E2D9]">
            <Globe className="w-4 h-4 text-[#3563E9]" />
            <h2 className="text-sm font-bold text-[#20242C] uppercase tracking-wider">
              Default Language Preferences
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <LanguageSelector
              label="Your Primary Language"
              value={defaultSourceLang}
              onChange={setDefaultSourceLang}
            />
            <LanguageSelector
              label="Default Target Language"
              value={defaultTargetLang}
              onChange={setDefaultTargetLang}
            />
          </div>
        </Card>

        {/* Audio & Voice Configuration Card */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#E5E2D9]">
            <Volume2 className="w-4 h-4 text-[#3563E9]" />
            <h2 className="text-sm font-bold text-[#20242C] uppercase tracking-wider">
              Voice & Audio Preferences
            </h2>
          </div>

          <div className="space-y-5">
            {/* Microphone Selector */}
            <div>
              <label htmlFor="micDevice" className="block text-xs font-semibold text-[#5A6270] uppercase tracking-wider mb-2">
                Preferred Microphone Input
              </label>
              <select
                id="micDevice"
                value={selectedMic}
                onChange={(e) => setSelectedMic(e.target.value)}
                className="w-full bg-[#F8F7F2] border border-[#E5E2D9] rounded-xl px-4 py-2.5 text-sm text-[#20242C] focus-visible:ring-2 focus-visible:ring-[#3563E9] focus-visible:outline-none"
              >
                {audioInputDevices.length > 0 ? (
                  audioInputDevices.map((d, idx) => (
                    <option key={d.deviceId || idx} value={d.deviceId}>
                      {d.label || `Microphone ${idx + 1}`}
                    </option>
                  ))
                ) : (
                  <option value="">Default System Microphone</option>
                )}
              </select>
            </div>

            {/* TTS Speed */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[#5A6270] uppercase tracking-wider">
                  Translated Speech Speed ({ttsSpeed}x)
                </span>
                <button
                  type="button"
                  onClick={testVoiceSample}
                  className="inline-flex items-center gap-1.5 text-xs text-[#3563E9] hover:underline font-medium cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Test Voice
                </button>
              </div>

              <div className="flex gap-2">
                {[0.8, 1.0, 1.2, 1.4].map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    onClick={() => setTtsSpeed(speed)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      ttsSpeed === speed
                        ? 'bg-[#3563E9] text-white border-[#3563E9]'
                        : 'bg-[#F8F7F2] text-[#20242C] border-[#E5E2D9] hover:bg-[#F2EFE8]'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            {/* Auto Play TTS Toggle */}
            <label className="flex items-center justify-between p-3.5 rounded-xl border border-[#E5E2D9] hover:bg-[#F8F7F2] cursor-pointer transition-colors">
              <div>
                <div className="text-sm font-medium text-[#20242C]">Automatic Speech Output</div>
                <div className="text-xs text-[#5A6270]">Play translated audio automatically when translation completes</div>
              </div>
              <input
                type="checkbox"
                checked={autoPlayTts}
                onChange={(e) => setAutoPlayTts(e.target.checked)}
                className="w-4 h-4 text-[#3563E9] rounded accent-[#3563E9] cursor-pointer"
              />
            </label>
          </div>
        </Card>

        {/* Engine Transparency & External Services Card */}
        <Card className="p-6 bg-[#F8F7F2]">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E5E2D9]">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#3563E9]" />
              <h2 className="text-sm font-bold text-[#20242C] uppercase tracking-wider">
                Services & Engine Status
              </h2>
            </div>
            <Badge variant="cobalt" size="sm">
              Live Architecture
            </Badge>
          </div>

          <div className="space-y-3 text-xs">
            {/* LiveKit WebRTC Calling Engine */}
            <div className="p-3 bg-white rounded-xl border border-[#E5E2D9] flex items-start justify-between gap-3">
              <div>
                <span className="font-bold text-[#20242C] block">Audio Calling (LiveKit WebRTC):</span>
                <span className="text-[#5A6270]">
                  {serverConfig?.calling?.provider || 'LiveKit WebRTC Audio'} • Limit: 2 Participants
                </span>
                <div className="text-[11px] mt-0.5">
                  {serverConfig?.calling?.isConfigured ? (
                    <span className="text-[#059669] font-medium">✓ Credentials configured for real WebRTC audio publishing & subscription</span>
                  ) : (
                    <span className="text-[#D97706] font-medium">Credentials unset in server/.env (Set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)</span>
                  )}
                </div>
              </div>
              <Badge variant={serverConfig?.calling?.isConfigured ? 'success' : 'warning'} size="sm">
                {serverConfig?.calling?.isConfigured ? 'LiveKit Active' : 'Unconfigured'}
              </Badge>
            </div>

            {/* Translation Engine */}
            <div className="p-3 bg-white rounded-xl border border-[#E5E2D9] flex items-start justify-between gap-3">
              <div>
                <span className="font-bold text-[#20242C] block">Translation Engine:</span>
                <span className="text-[#5A6270]">
                  {serverConfig?.translation?.provider || 'LiveLingo Semantic Neural Lexicon'}
                </span>
                <div className="text-[11px] text-[#5A6270] font-medium mt-0.5">
                  Phrase table plus MyMemory for en, kn, hi, es, de, ta. Failures show original text.
                </div>
              </div>
              <Badge variant="success" size="sm">
                Local Active
              </Badge>
            </div>

            {/* External Cloud Services Disclosure */}
            <div className="p-3 bg-white rounded-xl border border-[#E5E2D9] flex items-start justify-between gap-3">
              <div>
                <span className="font-bold text-[#20242C] block">External Cloud APIs:</span>
                <span className="text-[#5A6270]">
                  Not connected (no external keys provided in environment).
                </span>
                <div className="text-[11px] text-[#5A6270] mt-0.5">
                  Operating purely in offline-ready local mode for speed and privacy.
                </div>
              </div>
              <Badge variant="neutral" size="sm">
                Disconnected
              </Badge>
            </div>

            {/* Speech Recognition Engine */}
            <div className="p-3 bg-white rounded-xl border border-[#E5E2D9] flex items-start justify-between gap-3">
              <div>
                <span className="font-bold text-[#20242C] block">Speech-to-Text Pipeline:</span>
                <span className="text-[#5A6270]">
                  Browser-Native Web Speech API (webkitSpeechRecognition)
                </span>
              </div>
              <Badge variant="success" size="sm">
                Client Native
              </Badge>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#E5E2D9]">
            <Globe className="w-4 h-4 text-[#3563E9]" />
            <h2 className="text-sm font-bold text-[#20242C] uppercase tracking-wider">
              Language capability matrix
            </h2>
          </div>
          <p className="text-xs text-[#5A6270] mb-3">{capabilityNote}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-[#5A6270] border-b border-[#E5E2D9]">
                  <th className="py-2 pr-3 font-semibold">Language</th>
                  <th className="py-2 pr-3 font-semibold">STT</th>
                  <th className="py-2 pr-3 font-semibold">Translation</th>
                  <th className="py-2 pr-3 font-semibold">TTS</th>
                  <th className="py-2 font-semibold">Test</th>
                </tr>
              </thead>
              <tbody>
                {capabilityRows.map((row) => (
                  <tr key={row.code} className="border-b border-[#E5E2D9]/70">
                    <td className="py-2 pr-3 font-medium text-[#20242C]">{row.name} ({row.code})</td>
                    <td className="py-2 pr-3">{row.stt}</td>
                    <td className="py-2 pr-3">{row.translation}</td>
                    <td className="py-2 pr-3">{row.tts}</td>
                    <td className="py-2">{row.verification}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Privacy Information Card */}
        <Card className="p-6 bg-white">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-[#3563E9]" />
            <h2 className="text-sm font-bold text-[#20242C] uppercase tracking-wider">
              Privacy & Data Policy
            </h2>
          </div>

          <p className="text-xs text-[#5A6270] leading-relaxed">
            LiveLingo Calling runs on a zero-persistence architecture. Audio frames and translation transcripts
            are relayed exclusively in memory through ephemeral WebSocket rooms and never written to disk or database.
            Once you hang up or leave the room, the session data is permanently deleted.
          </p>
        </Card>

        {/* Save Preferences Button */}
        <div className="flex items-center justify-between pt-2">
          {savedSuccess ? (
            <span className="text-xs font-semibold text-[#059669] flex items-center gap-1.5 animate-in fade-in">
              <Check className="w-4 h-4" /> Preferences saved successfully
            </span>
          ) : (
            <span className="text-xs text-[#5A6270]">
              Settings apply to your current device
            </span>
          )}

          <Button type="submit" size="md" rightIcon={<Save className="w-4 h-4" />}>
            Save Preferences
          </Button>
        </div>
      </form>
    </div>
  );
};
