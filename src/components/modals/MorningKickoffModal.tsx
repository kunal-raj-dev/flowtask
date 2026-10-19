import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { useTodayStr } from '../../hooks/useCurrentDate';
import { formatLocalDate } from '../../utils/nlpParser';
import { analyzeRolloverBatch } from '../../utils/rolloverEngine';
import { computeAutoSlotSchedule } from '../../utils/autoSlotAlgorithm';
import { audioEngine } from '../../utils/audioEngine';
import confetti from '../../utils/celebrate';
import {
  Sunrise,
  ArrowRight,
  CheckCircle2,
  Zap,
  Star,
  X,
} from 'lucide-react';

interface MorningKickoffModalProps {
  onClose: () => void;
}

export const MorningKickoffModal: React.FC<MorningKickoffModalProps> = ({ onClose }) => {
  const {
    tasks,
    batchUpdateTasks,
    toggleTaskPinToday,
    calendarEvents,
    settings,
    applyTaskChanges,
  } = useTaskContext();

  const todayStr = useTodayStr();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Rollover analysis
  const rollover = useMemo(() => analyzeRolloverBatch(tasks, todayStr), [tasks, todayStr]);

  const handleRollAllToToday = useCallback(() => {
    if (rollover.overdueTasks.length === 0) return;
    const now = Date.now();
    applyTaskChanges(
      rollover.overdueTasks.map((t) => ({
        id: t.id,
        updates: {
          plannedDate: todayStr,
          isSomeday: false,
          rolloverCount: (t.rolloverCount || 0) + 1,
          lastRolledOverAt: now,
          isAutoTriaged: true,
        },
      })),
      'Morning Kickoff: Roll all overdue tasks to today'
    );
    audioEngine.playClickSound();
  }, [rollover.overdueTasks, todayStr, applyTaskChanges]);

  const handleDeferAllToTomorrow = useCallback(() => {
    if (rollover.overdueTasks.length === 0) return;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = formatLocalDate(tomorrow);
    batchUpdateTasks(
      rollover.overdueTasks.map((t) => t.id),
      { plannedDate: tomorrowStr, isAutoTriaged: true }
    );
    audioEngine.playClickSound();
  }, [rollover.overdueTasks, batchUpdateTasks]);

  const handleMoveStaleToSomeday = useCallback(() => {
    if (rollover.staleTasks.length === 0) return;
    batchUpdateTasks(
      rollover.staleTasks.map((t) => t.id),
      { isSomeday: true, plannedDate: undefined, isPinnedToday: false, isAutoTriaged: true }
    );
    audioEngine.playClickSound();
  }, [rollover.staleTasks, batchUpdateTasks]);

  // Step 2: Today's active tasks for Rule of 3
  const todayTasks = useMemo(
    () =>
      tasks.filter(
        (t) =>
          !t.deletedAt &&
          !t.archivedAt &&
          t.status !== 'done' &&
          (t.plannedDate === todayStr || (!t.plannedDate && t.dueDate === todayStr) || t.isPinnedToday)
      ),
    [tasks, todayStr]
  );

  const pinnedCount = useMemo(() => todayTasks.filter((t) => t.isPinnedToday).length, [todayTasks]);

  // Step 3: Auto-slot preview
  const START_HOUR = settings?.timelineStartHour ?? 7;
  const END_HOUR = Math.max(START_HOUR + 1, settings?.timelineEndHour ?? 22);
  const targetWorkCapacityHours = settings?.targetWorkCapacityHours ?? 6.0;

  const autoSlotPlan = useMemo(() => {
    if (step !== 3) return null;
    const scheduled = todayTasks
      .filter((t) => Boolean(t.scheduledStart))
      .map((t) => {
        const parts = (t.scheduledStart || '09:00').split(':').map(Number);
        return {
          task: t,
          startMin: (parts[0] || 9) * 60 + (parts[1] || 0),
          duration: t.estimatedMinutes || 30,
        };
      });
    const unscheduled = todayTasks.filter((t) => !t.scheduledStart && !t.scheduleLocked);
    return computeAutoSlotSchedule(unscheduled, scheduled, calendarEvents, {
      startHour: START_HOUR,
      endHour: END_HOUR,
      bufferMinutes: settings?.autoSlotBufferMinutes ?? 10,
      maxCapacityMinutes: Math.round(targetWorkCapacityHours * 60),
    });
  }, [step, todayTasks, calendarEvents, START_HOUR, END_HOUR, targetWorkCapacityHours, settings?.autoSlotBufferMinutes]);

  const handleApplyAutoSlot = useCallback(() => {
    if (autoSlotPlan && autoSlotPlan.slotted.length > 0) {
      applyTaskChanges(
        autoSlotPlan.slotted.map((slot) => ({
          id: slot.taskId,
          updates: { scheduledStart: slot.scheduledStart, plannedDate: todayStr },
        })),
        'Morning Kickoff: auto-slot timeline'
      );
    }
    audioEngine.playCompletionChime();
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#F59E0B', '#10B981', '#6366F1'],
    });
    onClose();
  }, [autoSlotPlan, applyTaskChanges, todayStr, onClose]);

  // Keyboard accelerators: 1, 2, 3 in step 1, Space/Enter to advance
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (step === 1) {
        if (e.key === '1') {
          e.preventDefault();
          handleRollAllToToday();
        } else if (e.key === '2') {
          e.preventDefault();
          handleDeferAllToTomorrow();
        } else if (e.key === '3') {
          e.preventDefault();
          handleMoveStaleToSomeday();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          setStep(2);
        }
      } else if (step === 2) {
        if (e.key === 'Enter') {
          e.preventDefault();
          setStep(3);
        }
      } else if (step === 3) {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleApplyAutoSlot();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, handleRollAllToToday, handleDeferAllToTomorrow, handleMoveStaleToSomeday, handleApplyAutoSlot, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Morning Kickoff Ritual"
      className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[var(--bg-surface-l2)] rounded-2xl border border-[var(--border-hairline)] shadow-modal overflow-hidden card-surface animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border-hairline)] flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-transparent to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <Sunrise size={20} className="stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                Morning Kickoff Ritual
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Step {step} of 3: {step === 1 ? 'Smart Rollover & Triage' : step === 2 ? 'Rule of 3 Focus' : 'Timeline Auto-Slot'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-l1)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {step === 1 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">
                    Overdue Influx ({rollover.overdueTasks.length} tasks)
                  </span>
                  <span className="text-xs font-mono text-amber-600 dark:text-amber-400 font-bold">
                    ~{(rollover.totalEstimatedMinutes / 60).toFixed(1)}h backlog
                  </span>
                </div>
                {rollover.overdueTasks.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)] mt-2">
                    No overdue tasks! Your runway is completely clear for today.
                  </p>
                ) : (
                  <div className="mt-3 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {rollover.overdueTasks.slice(0, 6).map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] text-xs"
                      >
                        <span className="truncate text-[var(--text-primary)] font-medium">
                          {t.title}
                        </span>
                        <span className="text-[10px] font-mono text-[var(--text-muted)] shrink-0">
                          {t.plannedDate}
                        </span>
                      </div>
                    ))}
                    {rollover.overdueTasks.length > 6 && (
                      <p className="text-[10px] text-[var(--text-muted)] text-center">
                        + {rollover.overdueTasks.length - 6} more
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Action Accelerators */}
              {rollover.overdueTasks.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={handleRollAllToToday}
                    className="p-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold transition-all text-center flex flex-col items-center gap-1 active:scale-95"
                  >
                    <span className="text-base font-black font-mono">1</span>
                    <span>Roll to Today</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDeferAllToTomorrow}
                    className="p-2.5 rounded-xl bg-stone-500/10 hover:bg-stone-500/20 text-[var(--text-secondary)] border border-[var(--border-hairline)] text-xs font-bold transition-all text-center flex flex-col items-center gap-1 active:scale-95"
                  >
                    <span className="text-base font-black font-mono">2</span>
                    <span>To Tomorrow</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleMoveStaleToSomeday}
                    className="p-2.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30 text-xs font-bold transition-all text-center flex flex-col items-center gap-1 active:scale-95"
                  >
                    <span className="text-base font-black font-mono">3</span>
                    <span>To Someday</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                    Commit Your Top 3 Focus
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Select up to 3 non-negotiable priorities for today ({pinnedCount}/3 selected)
                  </p>
                </div>
                <Star size={16} className={pinnedCount >= 3 ? 'text-amber-500 fill-amber-500' : 'text-stone-400'} />
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {todayTasks.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTaskPinToday(t.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs text-left transition-all ${
                      t.isPinnedToday
                        ? 'bg-amber-500/15 border-amber-500/40 text-[var(--text-primary)] shadow-xs'
                        : 'bg-[var(--bg-surface-l1)] border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Star
                        size={14}
                        className={t.isPinnedToday ? 'text-amber-500 fill-amber-500 shrink-0' : 'text-stone-400 shrink-0'}
                      />
                      <span className="font-semibold truncate">{t.title}</span>
                    </div>
                    <span className="text-[10px] font-mono text-[var(--text-muted)] shrink-0">
                      ~{t.estimatedMinutes || 30}m
                    </span>
                  </button>
                ))}
                {todayTasks.length === 0 && (
                  <p className="text-xs text-[var(--text-muted)] text-center py-6">
                    No tasks planned for today yet.
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap size={16} className="text-amber-500 fill-amber-500" />
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      Magnetic Timeline Auto-Slot
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {autoSlotPlan?.slotted.length || 0} tasks slotted
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  {autoSlotPlan?.message || 'Ready to distribute tasks into free calendar gaps.'}
                </p>

                {autoSlotPlan && autoSlotPlan.slotted.length > 0 && (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 pt-1">
                    {autoSlotPlan.slotted.map((slot) => {
                      const t = tasks.find((x) => x.id === slot.taskId);
                      return (
                        <div
                          key={slot.taskId}
                          className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] text-xs"
                        >
                          <span className="font-medium text-[var(--text-primary)] truncate">
                            {t?.title || 'Task'}
                          </span>
                          <span className="font-mono text-amber-600 dark:text-amber-400 font-bold shrink-0">
                            {slot.scheduledStart}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[var(--bg-surface-l1)]/90 border-t border-[var(--border-hairline)] flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as 1 | 2)}
              className="px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s + 1) as 2 | 3)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-xs shadow-xs transition-all active:scale-95"
              >
                <span>Continue</span>
                <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleApplyAutoSlot}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-xs transition-all active:scale-95"
              >
                <CheckCircle2 size={14} />
                <span>Launch Day</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
