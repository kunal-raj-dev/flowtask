import React from 'react';
import { X, Keyboard } from 'lucide-react';
import { Kbd } from '../ui';

interface ShortcutsModalProps {
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ onClose }) => {
  const shortcuts = [
    { key: 'j / k', desc: 'Navigate up / down tasks' },
    { key: 'Space', desc: 'Toggle complete highlighted task' },
    { key: 'x', desc: 'Toggle multi-select on highlighted task' },
    { key: 'Enter', desc: 'Open task detail drawer / inline edit' },
    { key: 'p', desc: 'Open Priority Picker popover (1-4)' },
    { key: 'd', desc: 'Open Date Schedule popover (t, m, w, n, s)' },
    { key: 't', desc: 'Pin to Top 3 Focus (Rule of 3)' },
    { key: '1 - 4', desc: 'Set priority directly (P1 to P4)' },
    { key: 'f', desc: 'Start focus timer on highlighted task' },
    { key: 'e', desc: 'Archive highlighted task or selection' },
    { key: 'Delete / Backspace', desc: 'Delete highlighted task' },
    { key: 'c', desc: 'Quick capture task composer' },
    { key: 'm', desc: 'Reschedule highlighted task to Tomorrow' },
    { key: 's', desc: 'Move highlighted task to Someday' },
    { key: 'Shift + j / k', desc: 'Expand multi-selection range' },
    { key: '1 - 3 or ← →', desc: 'Kanban stage column switch' },
    { key: '1 - 4 or ← →', desc: 'Eisenhower matrix quadrant switch' },
    { key: 'Alt + S', desc: 'Stash focus & park interruption' },
    { key: 'Alt + R', desc: 'Restore stashed focus session' },
    { key: 'Alt + B', desc: 'Suggest action steps with AI' },
    { key: 'Alt + N', desc: 'Open sticky scratchpad & notes' },
    { key: 'Ctrl / ⌘ + Shift + D', desc: 'Evening Shutdown Ritual' },
    { key: 'Ctrl / ⌘ + Shift + W', desc: 'Weekly Review Wizard' },
    { key: 'Ctrl / ⌘ + Shift + V', desc: 'Voice-to-Task audio dictation' },
    { key: '[', desc: 'Toggle Sidebar (Zen Focus Mode)' },
    { key: 'Ctrl / ⌘ + Z', desc: 'Undo last action (complete, delete, status)' },
    { key: 'Ctrl / ⌘ + Shift + Z / ⌘ + Y', desc: 'Redo last undone action' },
    { key: 'Ctrl / ⌘ + K', desc: 'Open Command Palette' },
    { key: '?', desc: 'Show keyboard shortcuts' },
    { key: 'Esc', desc: 'Close any modal, popover, drawer, or selection' },
  ];

  const studioShortcuts = [
    { key: 'C', desc: 'Toggle Clear Mode (minimal UI)' },
    { key: 'F', desc: 'Toggle Fullscreen mode' },
    { key: 'Space', desc: 'Pause / Resume focus session' },
    { key: 'Esc', desc: 'Exit Studio back to planner' },
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
      className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-xl flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[var(--bg-surface-l2)] rounded-t-2xl sm:rounded-xl p-5 sm:p-7 border border-[var(--border-hairline)] shadow-modal relative card-surface animate-scale-up max-h-[92dvh] sm:max-h-[88vh] overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pb-7"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator */}
        <div className="sm:hidden w-10 h-1 bg-stone-300 dark:bg-stone-700 rounded-full mx-auto -mt-2 mb-3 shrink-0" />

        <button
          onClick={onClose}
          aria-label="Close shortcuts modal"
          className="absolute top-4 sm:top-5 right-4 sm:right-5 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors active:scale-95"
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

        {/* Focus Studio Shortcuts */}
        <div className="space-y-2 mb-6">
          <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Focus Studio
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {studioShortcuts.map((s) => (
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
