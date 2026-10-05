import React from 'react';
import { X, Keyboard } from 'lucide-react';
import { Kbd } from '../ui';

interface ShortcutsModalProps {
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ onClose }) => {
  const shortcuts = [
    { key: 'j / k', desc: 'Navigate up / down tasks' },
    { key: 'Space / x', desc: 'Toggle complete highlighted task' },
    { key: 'Enter', desc: 'Open task detail drawer' },
    { key: 'p', desc: 'Focus timer on highlighted task' },
    { key: '1 - 4', desc: 'Set priority (P1 to P4)' },
    { key: 'f or *', desc: 'Pin to Top 3 Focus (Rule of 3)' },
    { key: 'F', desc: 'Zen Fullscreen Pomodoro mode' },
    { key: 't / m / s', desc: 'Reschedule: Today / Tomorrow / Someday' },
    { key: 'Shift / ⌘ + Click', desc: 'Multi-select tasks (Batch Dock)' },
    { key: '1 - 3 or ← →', desc: 'Kanban stage column switch' },
    { key: '1 - 4 or ← →', desc: 'Eisenhower matrix quadrant switch' },
    { key: 'Alt + S', desc: 'Stash focus & park interruption' },
    { key: 'Alt + R', desc: 'Restore stashed focus session' },
    { key: 'Alt + B', desc: 'Suggest action steps with AI' },
    { key: 'Alt + N', desc: 'Open sticky scratchpad & notes' },
    { key: 'Ctrl / ⌘ + Shift + D', desc: 'Evening Shutdown Ritual' },
    { key: 'Ctrl / ⌘ + Shift + W', desc: 'Weekly Review Wizard' },
    { key: 'Ctrl / ⌘ + Shift + V', desc: 'Voice-to-Task audio dictation' },
    { key: 'N', desc: 'Quick add task (focus Omnibar)' },
    { key: '[', desc: 'Toggle Sidebar (Zen Focus Mode)' },
    { key: 'Ctrl / ⌘ + Z', desc: 'Undo last action (complete, delete, status)' },
    { key: 'Ctrl / ⌘ + K', desc: 'Open Command Palette' },
    { key: '?', desc: 'Show keyboard shortcuts' },
    { key: 'Esc', desc: 'Close any modal, drawer, or selection' },
  ];

  const nlpSyntax = [
    { token: '#work', desc: 'Assigns task to #work project' },
    { token: '@calls / @computer', desc: 'Assigns context location tag' },
    { token: 'tomorrow morning', desc: 'Sets due date & relative time (9am)' },
    { token: 'next friday at 3pm', desc: 'Sets date & time automatically' },
    { token: 'every weekday', desc: 'Sets recurrence frequency' },
    { token: 'p1 or !urgent', desc: 'Sets priority to P1 Urgent (red)' },
    { token: '~25m or ~1h', desc: 'Sets estimated time duration' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[var(--bg-surface-l2)] rounded-xl p-7 border border-[var(--border-hairline)] shadow-modal relative card-surface animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-lg hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs">
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
                className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--bg-surface-l1)]/60 border border-[var(--border-hairline)] text-xs card-surface"
              >
                <span className="text-[var(--text-secondary)]">{s.desc}</span>
                <Kbd size="xs">
                  {s.key}
                </Kbd>
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
                className="p-2.5 rounded-lg bg-[var(--bg-surface-l1)]/60 border border-[var(--border-hairline)] text-xs flex items-center justify-between card-surface"
              >
                <span className="text-[var(--text-secondary)]">{n.desc}</span>
                <span className="font-mono text-amber-600 dark:text-amber-400 font-semibold text-[11px]">
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
