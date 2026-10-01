import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ onClose }) => {
  const shortcuts = [
    { key: 'j / k', desc: 'Navigate up / down tasks' },
    { key: 'Space / x', desc: 'Toggle complete highlighted task' },
    { key: 'Enter', desc: 'Open task detail drawer' },
    { key: '1 - 4', desc: 'Set priority (P1 to P4)' },
    { key: 'f or *', desc: 'Pin to Top 3 Focus (Rule of 3)' },
    { key: 't / m / s', desc: 'Reschedule: Today / Tomorrow / Someday' },
    { key: 'N', desc: 'Quick add task (focus Omnibar)' },
    { key: '[', desc: 'Toggle Sidebar (Zen Focus Mode)' },
    { key: 'Ctrl / ⌘ + K', desc: 'Open Command Palette' },
    { key: '?', desc: 'Show keyboard shortcuts' },
    { key: 'Esc', desc: 'Close any modal or drawer' },
  ];

  const nlpSyntax = [
    { token: '#work', desc: 'Assigns task to #work project' },
    { token: 'tomorrow', desc: 'Sets due date to tomorrow' },
    { token: 'next friday at 3pm', desc: 'Sets date & time automatically' },
    { token: 'p1 or !urgent', desc: 'Sets priority to P1 Urgent (red)' },
    { token: 'p2', desc: 'Sets priority to P2 High (amber)' },
    { token: '~25m or ~1h', desc: 'Sets estimated time duration' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 animate-slide-down"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[var(--bg-surface-l2)] rounded-3xl p-7 border border-[var(--border-hairline)] shadow-modal relative card-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm card-surface">
            <Keyboard size={20} className="stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
              Keyboard Shortcuts & Smart Syntax
            </h3>
            <p className="text-xs text-[var(--text-secondary)] font-medium">
              Work at the speed of thought without touching your mouse
            </p>
          </div>
        </div>

        {/* Global Shortcuts */}
        <div className="space-y-2 mb-6">
          <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            App Shortcuts
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {shortcuts.map((s) => (
              <div
                key={s.key}
                className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-surface-l1)]/60 border border-[var(--border-hairline)] text-xs card-surface"
              >
                <span className="text-[var(--text-secondary)]">{s.desc}</span>
                <kbd className="px-2.5 py-0.5 rounded-lg bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] font-mono text-[10px] text-[var(--text-primary)] font-semibold shadow-xs">
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        {/* NLP Shorthand */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Smart Inline Parsing Syntax
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {nlpSyntax.map((n) => (
              <div
                key={n.token}
                className="p-2.5 rounded-xl bg-[var(--bg-surface-l1)]/60 border border-[var(--border-hairline)] text-xs flex items-center justify-between card-surface"
              >
                <span className="text-[var(--text-secondary)]">{n.desc}</span>
                <span className="font-mono text-purple-600 dark:text-purple-400 font-semibold text-[11px]">
                  {n.token}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
