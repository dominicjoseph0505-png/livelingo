import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PhoneCall, PlusCircle, LogIn, Settings, Menu, X, Headphones } from 'lucide-react';

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navLinks = [
    { to: '/face-to-face', label: 'Face-to-Face', icon: Headphones },
    { to: '/create', label: 'Create a Call', icon: PlusCircle },
    { to: '/join', label: 'Join a Call', icon: LogIn },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#F8F7F2]/90 backdrop-blur-md border-b border-[#E5E2D9]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3563E9] rounded-lg p-1">
          <div className="w-9 h-9 rounded-xl bg-[#3563E9] flex items-center justify-center text-white shadow-xs group-hover:bg-[#274FC2] transition-colors">
            <PhoneCall className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg text-[#20242C] tracking-tight leading-none">
              LiveLingo
            </span>
            <span className="text-[10px] font-medium text-[#5A6270] tracking-wide uppercase mt-0.5">
              Translate
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden sm:flex items-center gap-1 sm:gap-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3563E9] ${
                  isActive
                    ? 'bg-white text-[#3563E9] shadow-xs border border-[#E5E2D9]'
                    : 'text-[#5A6270] hover:text-[#20242C] hover:bg-[#F2EFE8]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          className="sm:hidden p-2 rounded-xl text-[#5A6270] hover:text-[#20242C] hover:bg-[#F2EFE8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3563E9]"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 top-16 bg-black/20 z-30 sm:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-40 sm:hidden border-b border-[#E5E2D9] bg-white px-4 py-4 space-y-2 shadow-lg animate-in slide-in-from-top-2">
            <div className="pb-3 border-b border-[#E5E2D9]/60">
              <span className="text-xs font-semibold text-[#5A6270]">Real-time translation</span>
            </div>
            <div className="space-y-1 pt-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-base font-semibold transition-colors min-h-[48px] active:scale-[0.98] ${
                      isActive
                        ? 'bg-[#3563E9]/10 text-[#3563E9]'
                        : 'text-[#5A6270] hover:bg-[#F2EFE8] active:bg-[#E5E2D9]'
                    }`}
                  >
                    <Icon className="w-5 h-5 text-[#3563E9]" />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </header>
  );
};
