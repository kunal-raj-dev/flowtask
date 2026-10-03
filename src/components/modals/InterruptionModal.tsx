import React, { useState } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { formatLocalDate } from '../../utils/nlpParser';
import {
  Flame,
  X,
  Play,
  RotateCcw,
  Clock,
} from 'lucide-react';

export const InterruptionModal: React.FC = () => {
  const {
    isInterruptionModalOpen,
    setIsInterruptionModalOpen,
    interruptionStash,
    restoreStashedFocus,
    clearInterruptionStash,
    addTask,
    startTaskTimer,
  } = useTaskContext();

  const [title, setTitle] = useState('');

  if (!isInterruptionModalOpen) return null;

  const handleStartEmergencyTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newTask = addTask(title.trim(), {
      priority: 'p1',
      dueDate: formatLocalDate(new Date()),
      isPinnedToday: true,
      estimatedMinutes: 15,
    });

    // Start timer on this emergency task
    startTaskTimer(newTask.id);
    setTitle('');
    setIsInterruptionModalOpen(false);
  };

  const handleAddOnly = () => {
    if (!title.trim()) return;

    addTask(title.trim(), {
      priority: 'p1',
      dueDate: formatLocalDate(new Date()),
      isPinnedToday: true,
      estimatedMinutes: 15,
    });

    setTitle('');
    setIsInterruptionModalOpen(false);
  };

  const elapsedMinutes = interruptionStash
    ? Math.max(1, Math.round(interruptionStash.elapsedSeconds / 60))
    : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
      onClick={() => setIsInterruptionModalOpen(false)}
    >
      <div
        className="w-full max-w-lg bg-[var(--bg-surface-l1)] rounded-xl p-6 sm:p-7 border border-stone-200/90 dark:border-white/10 shadow-modal space-y-5 animate-scale-up card-surface"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-[var(--color-brand)] border border-amber-500/20">
              <Flame size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Interruption Stash & Scratchpad
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Protect your deep focus state from context fragmentation
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsInterruptionModalOpen(false)}
            className="p-1.5 rounded-lg text-stone-400 hover:text-[var(--text-primary)] hover:bg-stone-100 dark:hover:bg-white/[0.06] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stashed Session Banner if present */}
        {interruptionStash && (
          <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] uppercase font-bold text-[var(--color-brand)] tracking-wider">
                Stashed Focus Session
              </div>
              <div className="text-xs font-semibold text-[var(--text-primary)] truncate mt-0.5">
                {interruptionStash.taskTitle}
              </div>
              <div className="text-[11px] text-[var(--text-muted)] font-mono flex items-center gap-1 mt-0.5">
                <Clock size={11} />
                <span>{elapsedMinutes}m elapsed</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={restoreStashedFocus}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white font-semibold text-xs transition-colors shadow-xs"
              >
                <RotateCcw size={12} />
                <span>Restore (Alt+R)</span>
              </button>
              <button
                type="button"
                onClick={clearInterruptionStash}
                title="Discard stashed session"
                className="p-1.5 rounded-lg text-stone-400 hover:text-rose-500 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Interruption Task Form */}
        <form onSubmit={handleStartEmergencyTask} className="space-y-4">
          <div>
            <label htmlFor="emergency-task-input" className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
              What requires immediate attention?
            </label>
            <input
              id="emergency-task-input"
              name="emergencyTaskTitle"
              aria-label="What requires immediate attention?"
              type="text"
              autoFocus
              placeholder="e.g. Production bug in auth flow, quick call with Sarah..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-sm px-3.5 py-2.5 rounded-lg bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] focus:border-[var(--color-brand)] text-[var(--text-primary)] outline-none shadow-xs"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-[var(--text-muted)]">
              Auto-assigns as <strong className="text-rose-500 font-semibold">P1 Urgent</strong> for Today
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddOnly}
                disabled={!title.trim()}
                className="text-xs px-3 py-2 rounded-lg border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:bg-stone-100 dark:hover:bg-white/[0.06] transition-colors disabled:opacity-50 font-medium"
              >
                Queue to Today
              </button>
              <button
                type="submit"
                disabled={!title.trim()}
                className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white transition-colors disabled:opacity-50 shadow-sm"
              >
                <Play size={13} fill="currentColor" />
                <span>Track Emergency</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
