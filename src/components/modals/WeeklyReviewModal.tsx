import React, { useState, useMemo, useContext } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { WorkspaceStoreContext } from '../../services/workspaceStore';
import { saveReviewEntry } from '../../services/lifeOrganizationService';
import { formatLocalDate } from '../../utils/nlpParser';
import { useTodayStr } from '../../hooks/useCurrentDate';
import { audioEngine } from '../../utils/audioEngine';
import confetti from '../../utils/celebrate';
import {
  Compass,
  CheckCircle2,
  X,
  ArrowRight,
  Sparkles,
  Inbox,
  Star,
  Check,
  Clock,
  Flame,
} from 'lucide-react';

interface WeeklyReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTask: (taskId: string) => void;
}

export const WeeklyReviewModal: React.FC<WeeklyReviewModalProps> = ({
  isOpen,
  onClose,
  onOpenTask: _onOpenTask,
}) => {
  const { tasks, projects, updateTask, toggleTaskStatus } = useTaskContext();
  const store = useContext(WorkspaceStoreContext);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const todayStr = useTodayStr();

  // Step 3 reflection & priorities state
  const [reflection, setReflection] = useState<string>('');
  const [priorityOne, setPriorityOne] = useState<string>('');
  const [priorityTwo, setPriorityTwo] = useState<string>('');
  const [priorityThree, setPriorityThree] = useState<string>('');

  const {
    inboxTasks,
    completedPastWeek,
    totalEstimatedMins,
    totalMeasuredSeconds,
    estimatedHoursFormatted,
    measuredHoursFormatted,
    topProject,
    sevenDaysAgoStr,
  } = useMemo(() => {
    const [y, m, d] = todayStr.split('-').map(Number);
    const today = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    const sevenDaysAgoMs = sevenDaysAgo.getTime();
    const sevenDaysAgoFormatted = formatLocalDate(sevenDaysAgo);

    // Step 1: Open tasks in Inbox or without planned/due date
    const inbox = tasks.filter(
      (t) => t.status !== 'done' && (t.projectId === 'inbox' || (!t.plannedDate && !t.dueDate && !t.isSomeday))
    );

    // Step 2: Completed tasks in the past 7 days
    const completed = tasks.filter(
      (t) => t.status === 'done' && t.completedAt && t.completedAt >= sevenDaysAgoMs
    );

    // Separate estimated effort vs measured focus time (F33)
    const estMins = completed.reduce((acc, t) => acc + (t.estimatedMinutes || 25), 0);
    const measuredSec = completed.reduce((acc, t) => acc + (t.timeSpentMinutes ? t.timeSpentMinutes * 60 : 0), 0);

    const estHours = (estMins / 60).toFixed(1);
    const measHours = (measuredSec / 3600).toFixed(1);

    // Top project worked on
    const counts = new Map<string, number>();
    completed.forEach((t) => {
      counts.set(t.projectId, (counts.get(t.projectId) || 0) + 1);
    });
    const topId = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
    const top = projects.find((p) => p.id === topId);

    // Step 3: Upcoming tasks for the next 7 days
    const todayDateStr = todayStr;
    const nextWeekEnd = new Date(today);
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);
    const nextWeekEndStr = formatLocalDate(nextWeekEnd);

    const upcoming = tasks.filter((t) => {
      if (t.status === 'done') return false;
      const targetDate = t.plannedDate || t.dueDate;
      return targetDate && targetDate >= todayDateStr && targetDate <= nextWeekEndStr;
    });

    return {
      inboxTasks: inbox,
      completedPastWeek: completed,
      totalEstimatedMins: estMins,
      totalMeasuredSeconds: measuredSec,
      estimatedHoursFormatted: estHours,
      measuredHoursFormatted: measHours,
      topProject: top,
      upcomingNextWeekTasks: upcoming,
      sevenDaysAgoStr: sevenDaysAgoFormatted,
    };
  }, [tasks, projects, todayStr]);

  if (!isOpen) return null;

  const handleNextStep = () => {
    if (step === 1) {
      setStep(2);
      audioEngine.playCompletionChime();
      confetti({ particleCount: 45, spread: 60, origin: { y: 0.6 } });
    } else if (step === 2) {
      setStep(3);
    } else {
      // Complete review and save durable ReviewEntry record (F33)
      if (store) {
        const nextPriorities = [priorityOne.trim(), priorityTwo.trim(), priorityThree.trim()].filter(Boolean);
        saveReviewEntry(store, {
          periodStart: sevenDaysAgoStr,
          periodEnd: todayStr,
          reviewedAt: Date.now(),
          reflection: reflection.trim(),
          nextPriorities,
          completedTasksCount: completedPastWeek.length,
          totalEstimatedMinutes: totalEstimatedMins,
          totalFocusSeconds: totalMeasuredSeconds,
        });
      }

      audioEngine.playCompletionChime();
      confetti({ particleCount: 70, spread: 80, origin: { y: 0.5 } });
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="weekly-review-title"
      className="fixed inset-0 z-50 bg-black/60 dark:bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[var(--bg-surface-l1)] border border-[var(--border-subtle)] rounded-xl shadow-2xl p-6 sm:p-7 text-[var(--text-primary)] card-surface relative animate-scale-in max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close Weekly Review"
          className="absolute top-5 right-5 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-lg hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center">
            <Compass size={22} className="stroke-[2.2]" />
          </div>
          <div>
            <h2 id="weekly-review-title" className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
              Weekly Review & Reset
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Step {step} of 3 • {step === 1 ? 'Clear Inboxes' : step === 2 ? 'Celebrate Accomplishments' : 'Reflect & Set Weekly Anchors'}
            </p>
          </div>
        </div>

        {/* STEP 1: CLEAR INBOXES */}
        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
            <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-xs">
              <Inbox size={18} className="text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-amber-900 dark:text-amber-200">
                  Step 1: Process Unorganized Inputs ({inboxTasks.length})
                </p>
                <p className="text-amber-700 dark:text-amber-300 mt-0.5">
                  Assign dates, move to Someday, or check off anything already complete.
                </p>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1 scrollbar-none">
              {inboxTasks.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-muted)] bg-[var(--bg-surface-l2)] rounded-lg border border-[var(--border-hairline)]">
                  <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500" />
                  <p className="text-xs font-semibold text-[var(--text-primary)]">Inbox Zero achieved!</p>
                  <p className="text-[11px] mt-0.5 text-[var(--text-secondary)]">No lingering unorganized inputs.</p>
                </div>
              ) : (
                inboxTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3 rounded-lg bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] flex items-center justify-between gap-3"
                  >
                    <span className="text-xs font-medium truncate min-w-0">{task.title}</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => updateTask(task.id, { plannedDate: todayStr, isSomeday: false })}
                        className="px-2 py-1 text-[10px] font-semibold bg-stone-900 dark:bg-white text-white dark:text-stone-950 rounded-lg shadow-xs hover:opacity-90 min-h-[32px]"
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const tmrw = new Date();
                          tmrw.setDate(tmrw.getDate() + 1);
                          updateTask(task.id, { plannedDate: formatLocalDate(tmrw), isSomeday: false });
                        }}
                        className="px-2 py-1 text-[10px] font-medium bg-[var(--bg-surface-l1)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-lg min-h-[32px]"
                      >
                        Tomorrow
                      </button>
                      <button
                        type="button"
                        onClick={() => updateTask(task.id, { isSomeday: true, plannedDate: undefined })}
                        className="px-2 py-1 text-[10px] font-medium bg-[var(--bg-surface-l1)] text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 border border-[var(--border-hairline)] rounded-lg min-h-[32px]"
                      >
                        Someday
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleTaskStatus(task.id)}
                        className="p-1.5 text-[var(--text-muted)] hover:text-emerald-500 rounded-lg hover:bg-stone-200/50 dark:hover:bg-white/5 min-h-[32px] min-w-[32px] flex items-center justify-center"
                        title="Mark Complete"
                        aria-label="Mark Complete"
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* STEP 2: CELEBRATE ACCOMPLISHMENTS (F33: separates estimates from measured focus) */}
        {step === 2 && (
          <div className="space-y-4 animate-fade-in">
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-emerald-500" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Past 7 Days Accomplishments
                </h3>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                You completed <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{completedPastWeek.length} tasks</strong>.
                {topProject && (
                  <span> Your primary focus area was <strong className="text-[var(--text-primary)] font-bold">{topProject.name}</strong>.</span>
                )}
              </p>

              {/* Explicit distinction between estimated vs measured focus time (F33) */}
              <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                <div className="p-2.5 rounded-lg bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)]">
                  <div className="flex items-center gap-1.5 text-stone-500 dark:text-stone-400 mb-1">
                    <Clock size={13} />
                    <span className="font-semibold text-[11px]">Estimated Effort</span>
                  </div>
                  <span className="text-base font-bold text-[var(--text-primary)]">{estimatedHoursFormatted} hrs</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)]">
                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 mb-1">
                    <Flame size={13} />
                    <span className="font-semibold text-[11px]">Measured Focus Time</span>
                  </div>
                  <span className="text-base font-bold text-amber-600 dark:text-amber-400">{measuredHoursFormatted} hrs</span>
                </div>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 scrollbar-none">
              {completedPastWeek.length === 0 ? (
                <div className="text-center py-6 text-[var(--text-muted)] bg-[var(--bg-surface-l2)] rounded-lg border border-[var(--border-hairline)]">
                  <p className="text-xs font-semibold text-[var(--text-primary)]">No completed tasks logged this week.</p>
                  <p className="text-[11px] mt-0.5 text-[var(--text-secondary)]">Every new week is a fresh opportunity to build momentum.</p>
                </div>
              ) : (
                completedPastWeek.slice(0, 10).map((task) => (
                  <div
                    key={task.id}
                    className="p-3 rounded-lg bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                      <span className="text-xs font-medium line-through text-[var(--text-muted)] truncate">
                        {task.title}
                      </span>
                    </div>
                    {task.timeSpentMinutes ? (
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 shrink-0">
                        {task.timeSpentMinutes}m measured
                      </span>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* STEP 3: REFLECT & SET WEEKLY ANCHORS (F33: durable review artifact) */}
        {step === 3 && (
          <div className="space-y-4 animate-fade-in">
            <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-xs">
              <Star size={18} className="text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-amber-900 dark:text-amber-200">
                  Step 3: Reflection & Strategic Weekly Priorities
                </p>
                <p className="text-amber-700 dark:text-amber-300 mt-0.5">
                  Record your reflections and lock in your top priorities for next week.
                </p>
              </div>
            </div>

            {/* Reflection Input */}
            <div>
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                Weekly Reflection (Wins, Blockers, Lessons)
              </label>
              <textarea
                rows={2}
                placeholder="What went well this week? What will you adjust next week?"
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-l2)] focus:outline-none focus:border-[var(--color-brand)]"
              />
            </div>

            {/* Top 3 Priorities for Next Week */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] block">
                Top Priorities for Next Week
              </label>
              <input
                type="text"
                placeholder="Priority 1: Most essential outcome..."
                value={priorityOne}
                onChange={(e) => setPriorityOne(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-l2)] focus:outline-none"
              />
              <input
                type="text"
                placeholder="Priority 2: Second core objective..."
                value={priorityTwo}
                onChange={(e) => setPriorityTwo(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-l2)] focus:outline-none"
              />
              <input
                type="text"
                placeholder="Priority 3: Third milestone..."
                value={priorityThree}
                onChange={(e) => setPriorityThree(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-l2)] focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-[var(--border-hairline)] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors rounded-lg min-h-[44px]"
          >
            Close
          </button>

          <button
            type="button"
            onClick={handleNextStep}
            className="px-5 py-2 rounded-lg text-xs font-bold bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white shadow-xs flex items-center gap-1.5 transition-all active:scale-95 min-h-[44px]"
          >
            <span>{step === 3 ? 'Save & Complete Review' : 'Next Step'}</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
