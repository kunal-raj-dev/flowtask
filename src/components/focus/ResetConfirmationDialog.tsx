import React, { useEffect, useRef } from 'react';
import { RotateCcw, AlertTriangle, X } from 'lucide-react';
import { formatSecondsToHumanReadable } from '../../utils/focusTimeFormat';

export interface ResetConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmSave: () => void;
  onConfirmDiscard: () => void;
  elapsedSeconds: number;
  taskTitle?: string | null;
  phase?: string | null;
  isRoundRestart?: boolean;
}

export const ResetConfirmationDialog: React.FC<ResetConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirmSave,
  onConfirmDiscard,
  elapsedSeconds,
  taskTitle,
  phase = 'focus',
  isRoundRestart = false,
}) => {
  const saveButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Auto-focus default action (Save time & reset)
      const timer = setTimeout(() => {
        saveButtonRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formattedTime = formatSecondsToHumanReadable(elapsedSeconds) || `${elapsedSeconds}s`;
  const phaseLabel = phase === 'short_break'
    ? 'Short Break'
    : phase === 'long_break'
      ? 'Long Break'
      : 'Deep Focus';

  const title = isRoundRestart ? 'Restart Pomodoro Round?' : 'Reset Current Timer?';
  const saveLabel = isRoundRestart ? 'Save time & restart' : 'Save time & reset';
  const discardLabel = isRoundRestart ? 'Discard & restart' : 'Discard & reset';

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="reset-dialog-title"
        aria-describedby="reset-dialog-desc"
        className="w-full max-w-md rounded-2xl bg-stone-900/95 border border-amber-500/30 text-stone-100 shadow-2xl p-6 relative overflow-hidden backdrop-blur-xl"
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 35px -5px rgba(245, 158, 11, 0.15)',
        }}
      >
        {/* Close icon (Cancel) */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cancel and continue timer"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Icon & Title */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
            {isRoundRestart ? <RotateCcw size={20} /> : <AlertTriangle size={20} />}
          </div>
          <div>
            <h2 id="reset-dialog-title" className="text-base font-bold tracking-tight text-white m-0">
              {title}
            </h2>
            <p className="text-xs text-amber-400/90 font-medium m-0 mt-0.5">
              {phaseLabel} · {formattedTime} recorded
            </p>
          </div>
        </div>

        {/* Description */}
        <div id="reset-dialog-desc" className="text-xs text-stone-300 leading-relaxed space-y-2 mb-6">
          <p>
            {taskTitle ? (
              <>Working on <span className="font-semibold text-white">"{taskTitle}"</span>. </>
            ) : null}
            You have <strong className="text-amber-300 font-mono">{formattedTime}</strong> of elapsed focus time.
          </p>
          <p className="text-stone-400">
            {isRoundRestart
              ? 'Restarting the round will reset the timer to Focus Cycle 1 at original duration.'
              : 'Resetting will return this timer to its original duration ready to start.'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row-reverse gap-2.5">
          {/* Primary Action: Save & Reset */}
          <button
            ref={saveButtonRef}
            type="button"
            onClick={onConfirmSave}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs text-stone-950 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] transition-all cursor-pointer shadow-md shadow-amber-950/20"
          >
            <RotateCcw size={15} />
            {saveLabel}
          </button>

          {/* Secondary Action: Discard & Reset */}
          <button
            type="button"
            onClick={onConfirmDiscard}
            className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-xl font-semibold text-xs text-rose-300 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 active:scale-[0.98] transition-all cursor-pointer"
          >
            {discardLabel}
          </button>

          {/* Cancel */}
          <button
            type="button"
            onClick={onClose}
            className="sm:w-auto inline-flex items-center justify-center px-4 py-2.5 rounded-xl font-medium text-xs text-stone-400 hover:text-stone-200 hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
