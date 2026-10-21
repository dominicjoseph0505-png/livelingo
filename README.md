# LiveLingo Calling

**Real-Time Bidirectional Voice-Translation Calling Application**

LiveLingo is a language-bridging app with two modes: **Face-to-Face Translator** (one shared device) and **Live Translation Call** (two people on separate devices and networks). Languages: English, Kannada, Hindi, Spanish, German, and Tamil. Delay is measured; the product does not claim zero lag.

---

## 🎨 Design System & Aesthetics

Crafted according to premium consumer product design guidelines:
- **Warm Ivory Background:** `#F8F7F2`
- **Deep Charcoal Typography:** `#20242C`
- **Cobalt Blue Accent:** `#3563E9` (Hover: `#274FC2`, Soft tint: `#3563E9`/10)
- **Muted Slate Secondary Text:** `#5A6270`
- **Soft Neutral Surfaces:** `#FFFFFF` and `#F2EFE8`
- **Subtle Borders:** `#E5E2D9`
- **Typography:** Inter sans-serif (Google Fonts)
- **Mobile-First Responsive Layout:** Tested down to 360px viewport width with touch targets (≥44px), touch manipulation optimization, and no-scrollbar horizontal swipe gestures.

---

## 🏗️ Technical Foundation

### Frontend
- **Framework:** React 19 + TypeScript + Vite 8
- **Styling:** Tailwind CSS v4 with `@tailwindcss/vite`
- **Routing:** React Router (`react-router-dom` v7)
- **Icons:** Lucide React (`lucide-react`)
- **Audio & Speech Engine:**
  - **Speech-to-Text:** Browser-native Web Speech API (`webkitSpeechRecognition` / `SpeechRecognition`) with interim and final streaming results.
  - **Text-to-Speech:** Browser Speech Synthesis API (`window.speechSynthesis`) with automatic voice matching for Hindi (`hi-IN`) and English (`en-US`), rate and pitch control.
  - **Live Audio Metering:** Web Audio API (`AudioContext` + `AnalyserNode`) sampling microphone decibel levels in real-time.
  - **Harmonic Output Test:** Synthesized audio chime oscillator to verify speaker output without external audio dependencies.

### Backend
- **Runtime:** Node.js (v20+) + TypeScript
- **Server:** Express 4 + HTTP
- **Real-Time Signaling:** WebSocket (`ws` v8) for peer room coordination, WebRTC offer/answer/ICE exchange, live speech streaming, and translation broadcasts.
- **Architecture Modules:**
  - `server/src/config/index.ts`: Language registry, audio codecs, engine providers, and environment configuration.
  - `server/src/modules/sessions/sessionManager.ts`: Ephemeral room lifecycle, participant states (host/guest, mute, deafen), and in-memory transcript logging.
  - `server/src/modules/calling/signaling.ts`: WebSocket signaling server for real-time peer discovery, speech packet translation, and broadcast.
  - `server/src/modules/translation/translationService.ts`: Bidirectional English ↔ Hindi semantic engine with extensive lexicon, phrase dictionaries, and extensible provider interface for cloud providers.
  - `server/src/modules/speech-recognition/speechService.ts`: Audio stream verification, codec negotiation, and speech event normalization.
  - `server/src/modules/text-to-speech/ttsService.ts`: Voice profile definitions (Hindi Swara/Lekha, English Jenny/Samantha), rate/pitch presets.

---

## 📱 Screens Implemented

1. **Landing Page (`/`):**
   - Two product paths: Face-to-Face Translator and Live Translation Call.
   - Six language badges: English, Kannada, Hindi, Spanish, German, Tamil.

1b. **Face-to-Face Translator (`/face-to-face`):**
   - You speak / They hear selectors, start/stop listening, swap, mute playback, clear.
   - Honest Listening / Translating / Speaking / Paused / Error states.
   - Echo prevention by pausing recognition during TTS, plus headphones / push-to-talk.

2. **Create-Call Page (`/create`):**
   - Display name input.
   - Source language (You Speak) and Target language (Partner Hears) selectors with 1-click swap.
   - Call options (Spoken Translation TTS toggle, Live Subtitles toggle).
   - Secure room generator with 1-click invitation link copy.

3. **Join-Call Page (`/join`):**
   - Room Code input with auto-capitalization and query parameter auto-fill (`?room=LL-XXXX`).
   - Guest display name input and spoken language selector.
   - Real-time room status verification before entering.

4. **Pre-Call Device Check (`/pre-call/:roomId`):**
   - Live microphone permission status (Granted, Prompt, Denied).
   - Real-time multi-bar microphone audio waveform visualizer.
   - Speaker output diagnostic test playing a harmonic test chime.
   - Language configuration summary and "Enter Live Call" action.

5. **Active-Call Screen (`/call/:roomId`):**
   - Top status bar: Room code copy pill, duration timer (`mm:ss`), network connection indicator, participant counter (`2/2`).
   - Participant cards for You and Partner with real-time mic activity, speaking pulses, and language tags.
   - Live dual transcript feed displaying original spoken text and instant translated speech with speaker audio replay.
   - Quick-phrase swipeable chips for testing without speaking aloud.
   - Mobile-first sticky bottom controls: Mic Mute/Unmute, Speaker Deafen/Undeafen, and End Call with confirmation modal.

6. **Call-Ended Screen (`/ended/:roomId`):**
   - Call duration metric, total phrases translated counter, and language pair badge.
   - Transcript review drawer with 1-click copy and `.txt` download.
   - 5-star call rating widget.
   - "Return Home" and "Start Another Call" actions.

7. **Settings Page (`/settings`):**
   - Default language preferences.
   - Microphone input hardware selector.
   - Speech synthesis speed control (0.8x, 1.0x, 1.2x, 1.4x) with voice preview.
   - Engine transparency panel clearly disclosing local active engine status and external API connection status.
   - Privacy and data retention statement (Zero persistence, in-memory processing).

---

## 🚀 Quickstart & Launch Instructions

### 1. Prerequisites
- Node.js v18+ (tested on Node v20/v26)
- npm v9+

### 2. Install Dependencies
From the repository root:
```bash
npm install
npm --prefix server install
npm --prefix client install
```

### 3. Run Development Servers
To run both backend server and frontend client concurrently:
```bash
npm run dev
```

Alternatively, run in separate terminals:
```bash
# Terminal 1: Backend Server (Port 3001)
npm run dev:server

# Terminal 2: Frontend Client (Port 5173)
npm run dev:client
```

Open your browser to:
👉 **`http://localhost:5173`**

### 4. Build for Production
To build both server and client:
```bash
npm run build
```
This runs TypeScript type checking (`tsc -b`) and Vite production bundle optimization (`dist/`).

### 5. Deployment notes
The Vite frontend can go to Vercel. The Express + WebSocket + LiveKit token server needs a persistent host (Railway, Fly.io, Render, or a VM). Do not put long-lived WebRTC signaling on Vercel serverless functions.

Production checklist:
- Set `CORS_ORIGINS` to the HTTPS frontend origin
- Set `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- Serve the app over HTTPS for microphone access
- Do not deploy until local Face-to-Face and two-browser calling tests pass

Language pair tests stay **unverified** until someone records STT → translation → TTS on real devices. Kannada and Tamil voices depend on the OS.

---

## 🔒 Privacy & Security
LiveLingo Calling adheres to strict ephemeral data standards:
- Audio packets and translation transcript events are transmitted live in memory via WebSocket.
- No audio files, recordings, or transcripts are stored on disk or in databases.
- When all participants leave a room, the room session and all transcript buffers are permanently erased from memory.
