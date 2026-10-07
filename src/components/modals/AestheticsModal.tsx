import React, { useEffect } from 'react';
import { Palette, X } from 'lucide-react';
import { AestheticsSettingsContent } from '../settings/AestheticsSettingsContent';

interface AestheticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AestheticsModal: React.FC<AestheticsModalProps> = ({ isOpen, onClose }) => {
  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="aesthetics-modal-title"
    >
      <div
        className="w-full max-w-4xl max-h-[92vh] sm:max-h-[88vh] bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-[var(--text-primary)] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator */}
        <div className="sm:hidden w-10 h-1 bg-stone-300 dark:bg-stone-700 rounded-full mx-auto my-2 shrink-0" />

        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[var(--border-hairline)] flex items-center justify-between shrink-0 bg-[var(--bg-surface-l2)]">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs shrink-0">
              <Palette size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="aesthetics-modal-title" className="text-sm sm:text-base font-bold text-[var(--text-primary)]">
                  Aesthetics & Tactile Sound Profiles
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                  Pro Suite
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Tailor your workspace atmosphere, tactile feedback, and acoustic focus
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors shrink-0 active:scale-95"
            aria-label="Close aesthetics modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-5 sm:space-y-7 overflow-y-auto flex-1">
          <AestheticsSettingsContent intensitySliderTitle="Calibrate atmospheric glow intensity" />
        </div>
      </div>
    </div>
  );
};
