import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { useTaskContext } from '../../context/TaskContext';
import { formatLocalDate } from '../../utils/nlpParser';
import { audioEngine } from '../../utils/audioEngine';
import {
  Moon,
  Sparkles,
  CheckCircle2,
  Calendar,
  Lightbulb,
  ArrowRight,
  ShieldCheck,
  Coffee,
  X,
} from 'lucide-react';

interface DailyShutdownModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DailyShutdownModal: React.FC<DailyShutdownModalProps> = ({ isOpen, onClose }) => {
  const { tasks, updateTask, toggleTaskStatus } = useTaskContext();
  const [step, setStep] = useState<'reflect' | 'triage' | 'unplug'>('reflect');

  const todayStr = formatLocalDate(new Date());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatLocalDate(tomorrow);

  // Completed tasks for today
  const completedTodayTasks = tasks.filter(
    (t) =>
      t.status === 'done' &&
      (t.dueDate === todayStr || (t.completedAt && formatLocalDate(new Date(t.completedAt)) === todayStr))
  );

  // Leftover uncompleted tasks for today
  const leftoverTasks = tasks.filter(
    (t) => t.status !== 'done' && (t.dueDate === todayStr || t.isPinnedToday)
  );

  // Focus time completed (in minutes)
  const totalMinutesCompleted = completedTodayTasks.reduce(
    (acc, t) => acc + (t.timeSpentMinutes || t.estimatedMinutes || 15),
    0
  );

  // On initial open, trigger celebration
  useEffect(() => {
    if (isOpen) {
      setStep('reflect');
      audioEngine.playPomodoroComplete();
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#F59E0B', '#10B981', '#6366F1', '#EC4899'],
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePushAllToTomorrow = () => {
    leftoverTasks.forEach((task) => {
      updateTask(task.id, { dueDate: tomorrowStr });
    });
  };

  const handleCompleteShutdown = () => {
    localStorage.setItem('flowtask_last_shutdown_date', todayStr);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[var(--bg-surface-l1)] border border-stone-200/80 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden card-surface animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="px-6 pt-5 pb-3 border-b border-[var(--border-hairline)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-sm">
              <Moon size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Evening Daily Shutdown</h3>
              <p className="text-[11px] text-[var(--text-secondary)]">Create closure & disconnect guilt-free</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 pt-3 pb-1 flex items-center gap-2">
          {(['reflect', 'triage', 'unplug'] as const).map((s, idx) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                step === s
                  ? 'bg-amber-500'
                  : idx < ['reflect', 'triage', 'unplug'].indexOf(step)
                  ? 'bg-emerald-500'
                  : 'bg-stone-200 dark:bg-stone-800'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Reflect & Celebrate */}
        {step === 'reflect' && (
          <div className="p-6 space-y-5 animate-slide-down">
            <div className="text-center">
              <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 text-amber-500 dark:text-amber-400 mb-2">
                <Sparkles size={28} />
              </div>
              <h4 className="text-lg font-bold text-[var(--text-primary)]">
                {completedTodayTasks.length > 0 ? 'Splendid work today!' : 'Time to wrap up your day'}
              </h4>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Reflecting on what was accomplished frees your mind from lingering anxiety.
              </p>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-white dark:bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] text-center card-surface">
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {completedTodayTasks.length}
                </div>
                <div className="text-[11px] font-semibold text-[var(--text-secondary)] mt-0.5">
                  Tasks Completed
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white dark:bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] text-center card-surface">
                <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
                  {totalMinutesCompleted}m
                </div>
                <div className="text-[11px] font-semibold text-[var(--text-secondary)] mt-0.5">
                  Focused Effort Logged
                </div>
              </div>
            </div>

            {/* Completed Tasks Highlight */}
            {completedTodayTasks.length > 0 && (
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                  Today&apos;s Accomplishments
                </div>
                {completedTodayTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 p-2 rounded-xl bg-emerald-500/5 text-xs text-[var(--text-secondary)] border border-emerald-500/15"
                  >
                    <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />
                    <span className="line-through truncate">{task.title}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => {
                if (leftoverTasks.length > 0) {
                  setStep('triage');
                } else {
                  setStep('unplug');
                }
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-stone-900 dark:bg-white text-white dark:text-stone-950 font-bold text-xs flex items-center justify-center gap-2 hover:bg-stone-800 dark:hover:bg-stone-100 transition-all active:scale-[0.98] shadow-md card-surface"
            >
              <span>{leftoverTasks.length > 0 ? 'Triage Remaining Tasks' : 'Proceed to Unplug'}</span>
              <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* Step 2: Clean Slate Triage */}
        {step === 'triage' && (
          <div className="p-6 space-y-4 animate-slide-down">
            <div>
              <h4 className="text-base font-bold text-[var(--text-primary)]">
                Triage Leftovers ({leftoverTasks.length})
              </h4>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                No guilt. Decide what to carry forward tomorrow or postpone to someday.
              </p>
            </div>

            <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
              {leftoverTasks.map((task) => (
                <div
                  key={task.id}
                  className="p-3 rounded-2xl bg-white dark:bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] flex items-center justify-between gap-3 card-surface"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                      {task.title}
                    </p>
                    {task.priority !== 'p4' && (
                      <span className="text-[10px] font-mono uppercase text-amber-600 dark:text-amber-400 font-bold">
                        {task.priority}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => updateTask(task.id, { dueDate: tomorrowStr })}
                      title="Move to Tomorrow"
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-stone-100 dark:bg-white/10 text-[var(--text-primary)] hover:bg-stone-200 dark:hover:bg-white/15 transition-colors"
                    >
                      <Calendar size={11} />
                      Tomorrow
                    </button>
                    <button
                      onClick={() => updateTask(task.id, { dueDate: undefined, projectId: 'ideas' })}
                      title="Move to Someday"
                      className="p-1 text-[var(--text-muted)] hover:text-amber-500 rounded-lg transition-colors"
                    >
                      <Lightbulb size={13} />
                    </button>
                    <button
                      onClick={() => toggleTaskStatus(task.id)}
                      title="Mark Complete"
                      className="p-1 text-[var(--text-muted)] hover:text-emerald-500 rounded-lg transition-colors"
                    >
                      <CheckCircle2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex items-center justify-between gap-2 border-t border-[var(--border-hairline)]">
              <button
                onClick={handlePushAllToTomorrow}
                className="text-xs text-amber-600 dark:text-amber-400 font-semibold hover:underline"
              >
                Push All to Tomorrow
              </button>

              <button
                onClick={() => setStep('unplug')}
                className="py-2 px-4 rounded-xl bg-stone-900 dark:bg-white text-white dark:text-stone-950 font-bold text-xs flex items-center gap-1.5 hover:bg-stone-800 dark:hover:bg-stone-100 transition-all active:scale-95 shadow-sm card-surface"
              >
                <span>Ready to Unplug</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Unplug & Disconnect */}
        {step === 'unplug' && (
          <div className="p-6 space-y-5 text-center animate-slide-down">
            <div className="inline-flex p-4 rounded-3xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/10 text-indigo-500 dark:text-indigo-300 shadow-inner">
              <Coffee size={36} />
            </div>

            <div>
              <h4 className="text-xl font-bold text-[var(--text-primary)]">
                You&apos;re Officially Done for Today 🌙
              </h4>
              <p className="text-xs text-[var(--text-secondary)] mt-2 max-w-sm mx-auto leading-relaxed">
                Your tasks are organized and your tomorrow is clear. Close this tab, step away from your computer, and take time for yourself.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 text-left flex items-start gap-3">
              <ShieldCheck size={18} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-[var(--text-secondary)] leading-snug">
                <span className="font-bold text-[var(--text-primary)]">Anti-Burnout Guarantee:</span> Tomorrow will wait for tomorrow. Rest is what makes your next focus session deep and creative.
              </div>
            </div>

            <button
              onClick={handleCompleteShutdown}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] card-surface"
            >
              Complete Shutdown & Disconnect
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
