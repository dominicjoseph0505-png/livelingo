import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'md',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-xl',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full ${maxWidthStyles[maxWidth]} bg-white rounded-2xl border border-[#E5E2D9] shadow-xl p-6 relative`}
      >
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 p-1.5 text-[#5A6270] hover:text-[#20242C] rounded-lg hover:bg-[#F2EFE8] transition-colors focus-visible:ring-2 focus-visible:ring-[#3563E9] focus-visible:outline-none"
        >
          <X className="w-5 h-5" />
        </button>

        {title && <h3 className="text-lg font-bold text-[#20242C]">{title}</h3>}
        {description && <p className="text-sm text-[#5A6270] mt-1 mb-4">{description}</p>}

        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
};
