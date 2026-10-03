import React, { useState, useEffect } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import confetti from 'canvas-confetti';
import {
  Moon,
  Sparkles,
  CheckCircle2,
  Clock,
  Star,
  Lightbulb,
  X,
  Coffee,
} from 'lucide-react';
import { formatLocalDate } from '../../utils/nlpParser';
import { audioEngine } from '../../utils/audioEngine';

interface EveningShutdownModalProps {
  onClose: () => void;
}

export const EveningShutdownModal: React.FC<EveningShutdownModalProps> = ({ onClose }) => {
  const {
    tasks,
    updateTask,
    batchUpdateTasks,
    toggleTaskStatus,
    dismissShutdown,
  } = useTaskContext();

  const todayStr = formatLocalDate(new Date());

  const [reflection, setReflection] = useState<string>(() => {
    try {
      return localStorage.getItem(`flowtask_shutdown_reflection_${todayStr}`) || '';
    } catch {
      return '';
    }
  });

  const handleSaveReflection = (val: string) => {
    setReflection(val);
    try {
      localStorage.setItem(`flowtask_shutdown_reflection_${todayStr}`, val);
    } catch {
      // ignore
    }
  };

  // Completed tasks today
  const completedToday = tasks.filter(
    (t) =>
      t.status === 'done' &&
      ((t.plannedDate || t.dueDate) === todayStr ||
        (t.completedAt && formatLocalDate(new Date(t.completedAt)) === todayStr))
  );

  // Incomplete tasks scheduled for today
  const incompleteToday = tasks.filter(
    (t) => t.status !== 'done' && ((t.plannedDate || t.dueDate) === todayStr || t.isPinnedToday)
  );

  // Metrics
  const totalFocusMinutes = completedToday.reduce(
    (acc, t) => acc + (t.timeSpentMinutes || 0),
    0
  );
  const focusHours = (totalFocusMinutes / 60).toFixed(1);

  const pinnedCompleted = completedToday.filter((t) => t.isPinnedToday).length;
  const pinnedTotal = tasks.filter((t) => t.isPinnedToday).length;

  // Trigger celebration confetti on mount
  useEffect(() => {
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#6366F1', '#A855F7', '#EC4899', '#F59E0B'],
    });
    audioEngine.playCompletionChime();
  }, []);

  const handlePushAllToTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatLocalDate(tomorrow);

    if (incompleteToday.length > 0) {
      batchUpdateTasks(incompleteToday.map((t) => t.id), { plannedDate: tomorrowStr, isPinnedToday: false });
    }
    audioEngine.playClickSound();
  };

  const handleMoveAllToSomeday = () => {
    if (incompleteToday.length > 0) {
      batchUpdateTasks(incompleteToday.map((t) => t.id), { isSomeday: true, plannedDate: undefined, isPinnedToday: false });
    }
    audioEngine.playClickSound();
  };

  const handleFinishShutdown = () => {
    dismissShutdown();
    audioEngine.playPomodoroComplete();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 animate-slide-down"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[var(--bg-surface-l2)] rounded-xl p-6 sm:p-7 border border-[var(--border-hairline)] shadow-modal relative card-surface max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-lg hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs">
            <Moon size={22} className="stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-1.5">
              Daily Evening Shutdown <Sparkles size={16} className="text-amber-400" />
            </h3>
            <p className="text-xs text-[var(--text-secondary)] font-medium">
              Celebrate your progress, close open loops, and step away with peace of mind.
            </p>
          </div>
        </div>

        {/* Metrics Victory Reel */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="p-3 rounded-lg bg-[var(--bg-surface-l1)]/60 border border-[var(--border-hairline)] text-center card-surface">
            <div className="flex items-center justify-center text-emerald-500 mb-1">
              <CheckCircle2 size={16} />
            </div>
            <p className="text-xl font-bold text-[var(--text-primary)] font-mono">{completedToday.length}</p>
            <p className="text-[11px] text-[var(--text-secondary)] font-medium">Completed</p>
          </div>

          <div className="p-3 rounded-lg bg-[var(--bg-surface-l1)]/60 border border-[var(--border-hairline)] text-center card-surface">
            <div className="flex items-center justify-center text-amber-500 mb-1">
              <Clock size={16} />
            </div>
            <p className="text-xl font-bold text-[var(--text-primary)] font-mono">{focusHours}h</p>
            <p className="text-[11px] text-[var(--text-secondary)] font-medium">Focus Logged</p>
          </div>

          <div className="p-3 rounded-lg bg-[var(--bg-surface-l1)]/60 border border-[var(--border-hairline)] text-center card-surface">
            <div className="flex items-center justify-center text-amber-500 mb-1">
              <Star size={16} />
            </div>
            <p className="text-xl font-bold text-[var(--text-primary)] font-mono">
              {pinnedTotal > 0 ? `${pinnedCompleted}/${pinnedTotal}` : '—'}
            </p>
            <p className="text-[11px] text-[var(--text-secondary)] font-medium">Rule of 3 Focus</p>
          </div>
        </div>

        {/* Incomplete Tasks Section */}
        {incompleteToday.length > 0 ? (
          <div className="mb-5 p-4 rounded-lg bg-amber-500/[0.06] border border-amber-500/20">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                {incompleteToday.length} task{incompleteToday.length > 1 ? 's' : ''} left on today&apos;s list:
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePushAllToTomorrow}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/30 transition-colors"
                >
                  Push to Tomorrow
                </button>
                <button
                  type="button"
                  onClick={handleMoveAllToSomeday}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-stone-200/60 dark:bg-white/[0.08] hover:bg-stone-200 text-[var(--text-secondary)] border border-[var(--border-hairline)] transition-colors"
                >
                  Park in Someday
                </button>
              </div>
            </div>

            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {incompleteToday.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-[var(--bg-surface-l2)]/90 border border-[var(--border-hairline)] gap-2"
                >
                  <span className="truncate flex-1 font-medium text-[var(--text-primary)]">
                    {t.title}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        toggleTaskStatus(t.id);
                        audioEngine.playCompletionChime();
                      }}
                      title="Mark as completed today"
                      className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/25 transition-colors"
                    >
                      ✓ Done
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        updateTask(t.id, { plannedDate: formatLocalDate(tomorrow), isPinnedToday: false });
                        audioEngine.playClickSound();
                      }}
                      title="Push to tomorrow"
                      className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 hover:bg-amber-500/25 transition-colors"
                    >
                      Tmrw
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const nextWk = new Date();
                        nextWk.setDate(nextWk.getDate() + 7);
                        updateTask(t.id, { plannedDate: formatLocalDate(nextWk), isPinnedToday: false });
                        audioEngine.playClickSound();
                      }}
                      title="Push to next week (+7 days)"
                      className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 hover:bg-indigo-500/25 transition-colors"
                    >
                      +7d
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        updateTask(t.id, { isSomeday: true, plannedDate: undefined, isPinnedToday: false });
                        audioEngine.playClickSound();
                      }}
                      title="Park in Someday"
                      className="p-1 text-[var(--text-muted)] hover:text-amber-500 rounded hover:bg-amber-500/10 transition-colors"
                    >
                      <Lightbulb size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-5 p-4 rounded-lg bg-emerald-500/[0.08] border border-emerald-500/25 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500 text-white">
              <CheckCircle2 size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                Zero open tasks remaining for today!
              </p>
              <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                You cleared your commitments with complete focus.
              </p>
            </div>
          </div>
        )}

        {/* Mindful Daily Reflection */}
        <div className="mb-5 p-3.5 rounded-xl bg-[var(--bg-surface-l1)]/60 border border-[var(--border-hairline)] space-y-1.5 card-surface">
          <label htmlFor="shutdown-reflection-input" className="block text-xs font-semibold text-[var(--text-primary)]">
            🌟 Daily Highlight or Gratitude (Optional)
          </label>
          <input
            id="shutdown-reflection-input"
            type="text"
            value={reflection}
            onChange={(e) => handleSaveReflection(e.target.value)}
            placeholder="A meaningful win, learning, or moment from today..."
            className="w-full text-xs px-3 py-2 rounded-lg bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] text-[var(--text-primary)] outline-none focus:border-[var(--color-brand)] placeholder:text-[var(--text-muted)]"
          />
        </div>

        {/* Mindful Affirmation Card */}
        <div className="p-4 rounded-lg bg-[var(--bg-surface-l1)]/60 border border-[var(--border-hairline)] mb-6 text-center card-surface">
          <Coffee size={20} className="mx-auto text-amber-500 mb-1.5 opacity-80" />
          <p className="text-xs font-medium text-[var(--text-primary)] italic leading-relaxed">
            &ldquo;Work is done for the day. Close your laptop, step away from screens, and give your mind the rest it deserves.&rdquo;
          </p>
        </div>

        {/* Action Button */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleFinishShutdown}
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white text-xs font-bold shadow-xs active:scale-95 transition-all"
          >
            Complete Shutdown & Disconnect
          </button>
        </div>
      </div>
    </div>
  );
};
