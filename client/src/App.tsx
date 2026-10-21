import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/common/Navbar';
import { Footer } from './components/common/Footer';
import { LandingPage } from './pages/LandingPage';
import { FaceToFacePage } from './pages/FaceToFacePage';
import { CreateCallPage } from './pages/CreateCallPage';
import { JoinCallPage } from './pages/JoinCallPage';
import { PreCallPage } from './pages/PreCallPage';
import { ActiveCallPage } from './pages/ActiveCallPage';
import { CallEndedPage } from './pages/CallEndedPage';
import { SettingsPage } from './pages/SettingsPage';
import { NotFoundPage } from './pages/NotFoundPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-[#F8F7F2] text-[#20242C]">
        <Navbar />
        <main className="flex-1 flex flex-col">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/face-to-face" element={<FaceToFacePage />} />
            <Route path="/create" element={<CreateCallPage />} />
            <Route path="/join" element={<JoinCallPage />} />
            <Route path="/pre-call/:roomId" element={<PreCallPage />} />
            <Route path="/call/:roomId" element={<ActiveCallPage />} />
            <Route path="/ended/:roomId" element={<CallEndedPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
};

export default App;
