import React, { useState } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { formatLocalDate } from '../../utils/nlpParser';
import { audioEngine } from '../../utils/audioEngine';
import confetti from 'canvas-confetti';
import {
  Compass,
  CheckCircle2,
  Calendar,
  X,
  ArrowRight,
  Sparkles,
  Inbox,
  Star,
  Check,
} from 'lucide-react';

interface WeeklyReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTask: (taskId: string) => void;
}

export const WeeklyReviewModal: React.FC<WeeklyReviewModalProps> = ({
  isOpen,
  onClose,
  onOpenTask,
}) => {
  const { tasks, projects, updateTask, toggleTaskStatus } = useTaskContext();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  if (!isOpen) return null;

  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);
  const sevenDaysAgoMs = sevenDaysAgo.getTime();

  // Step 1: Open tasks in Inbox or without dueDate
  const inboxTasks = tasks.filter(
    (t) => t.status !== 'done' && (t.projectId === 'inbox' || !t.dueDate)
  );

  // Step 2: Completed tasks in the past 7 days
  const completedPastWeek = tasks.filter(
    (t) => t.status === 'done' && t.completedAt && t.completedAt >= sevenDaysAgoMs
  );
  const totalWeeklyMinutes = completedPastWeek.reduce(
    (acc, t) => acc + (t.timeSpentMinutes || t.estimatedMinutes || 25),
    0
  );
  const weeklyHoursFormatted = (totalWeeklyMinutes / 60).toFixed(1);

  // Top project worked on
  const projectCounts = new Map<string, number>();
  completedPastWeek.forEach((t) => {
    projectCounts.set(t.projectId, (projectCounts.get(t.projectId) || 0) + 1);
  });
  const topProjectId = Array.from(projectCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topProject = projects.find((p) => p.id === topProjectId);

  // Step 3: Upcoming tasks for the next 7 days
  const todayStr = formatLocalDate(today);
  const nextWeekEnd = new Date(today);
  nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);
  const nextWeekEndStr = formatLocalDate(nextWeekEnd);

  const upcomingNextWeekTasks = tasks.filter(
    (t) => t.status !== 'done' && t.dueDate && t.dueDate >= todayStr && t.dueDate <= nextWeekEndStr
  );

  const handleNextStep = () => {
    if (step === 1) {
      setStep(2);
      audioEngine.playCompletionChime();
      confetti({ particleCount: 45, spread: 60, origin: { y: 0.6 } });
    } else if (step === 2) {
      setStep(3);
    } else {
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
        className="w-full max-w-2xl bg-[var(--bg-surface-l1)] border border-[var(--border-subtle)] rounded-3xl shadow-2xl p-6 sm:p-7 text-[var(--text-primary)] card-surface relative animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Compass size={22} className="stroke-[2.2]" />
          </div>
          <div>
            <h2 id="weekly-review-title" className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
              Weekly Review & Reset
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Step {step} of 3 • {step === 1 ? 'Clear Inboxes' : step === 2 ? 'Celebrate Accomplishments' : 'Set Weekly Anchors'}
            </p>
          </div>
        </div>

        {/* Stepper Progress Indicator */}
        <div className="flex items-center gap-2 mb-6">
          <div
            className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${
              step >= 1 ? 'bg-indigo-600' : 'bg-stone-200 dark:bg-stone-800'
            }`}
          />
          <div
            className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${
              step >= 2 ? 'bg-indigo-600' : 'bg-stone-200 dark:bg-stone-800'
            }`}
          />
          <div
            className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${
              step >= 3 ? 'bg-indigo-600' : 'bg-stone-200 dark:bg-stone-800'
            }`}
          />
        </div>

        {/* STEP 1: CLEAR INBOXES */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-start gap-3 text-xs">
              <Inbox size={18} className="text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-indigo-900 dark:text-indigo-200">
                  Step 1: Clear the Mental Cache
                </p>
                <p className="text-indigo-700 dark:text-indigo-300 mt-0.5">
                  Triage unscheduled inbox tasks. Assign dates or file them away so no open loops linger.
                </p>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1 scrollbar-none">
              {inboxTasks.length === 0 ? (
                <div className="text-center py-10 text-[var(--text-muted)] bg-[var(--bg-surface-l2)] rounded-2xl border border-[var(--border-hairline)]">
                  <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500" />
                  <p className="text-xs font-bold text-[var(--text-primary)]">Inbox Zero achieved!</p>
                  <p className="text-[11px] mt-0.5 text-[var(--text-secondary)]">All captured thoughts are organized.</p>
                </div>
              ) : (
                inboxTasks.slice(0, 8).map((task) => (
                  <div
                    key={task.id}
                    className="p-3 rounded-xl bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    <div
                      className="min-w-0 cursor-pointer group"
                      onClick={() => onOpenTask(task.id)}
                      title="Open task details"
                    >
                      <p className="text-xs font-bold text-[var(--text-primary)] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate transition-colors">{task.title}</p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5 capitalize">
                        Project: {projects.find((p) => p.id === task.projectId)?.name || 'Inbox'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => updateTask(task.id, { dueDate: todayStr })}
                        className="px-2 py-1 text-[10px] font-semibold bg-stone-900 dark:bg-white text-white dark:text-stone-950 rounded-lg shadow-xs hover:opacity-90"
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const tmrw = new Date();
                          tmrw.setDate(tmrw.getDate() + 1);
                          updateTask(task.id, { dueDate: formatLocalDate(tmrw) });
                        }}
                        className="px-2 py-1 text-[10px] font-medium bg-[var(--bg-surface-l1)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-lg"
                      >
                        Tomorrow
                      </button>
                      <button
                        type="button"
                        onClick={() => updateTask(task.id, { projectId: 'ideas', dueDate: undefined })}
                        className="px-2 py-1 text-[10px] font-medium bg-[var(--bg-surface-l1)] text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 border border-[var(--border-hairline)] rounded-lg"
                      >
                        Someday
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleTaskStatus(task.id)}
                        className="p-1 text-[var(--text-muted)] hover:text-emerald-500 rounded-lg hover:bg-stone-200/50 dark:hover:bg-white/5"
                        title="Mark Complete"
                      >
                        <Check size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* STEP 2: CELEBRATE ACCOMPLISHMENTS */}
        {step === 2 && (
          <div className="space-y-4 animate-fade-in">
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-indigo-500/10 border border-emerald-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={18} className="text-emerald-500" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Past 7 Days Accomplishments
                </h3>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                You completed <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{completedPastWeek.length} tasks</strong> representing approximately <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{weeklyHoursFormatted} hours</strong> of focus.
                {topProject && (
                  <span> Your primary focus area was <strong className="text-[var(--text-primary)] font-bold">{topProject.name}</strong>.</span>
                )}
              </p>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1 scrollbar-none">
              {completedPastWeek.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-muted)] bg-[var(--bg-surface-l2)] rounded-2xl border border-[var(--border-hairline)]">
                  <p className="text-xs font-semibold text-[var(--text-primary)]">No completed tasks logged this week.</p>
                  <p className="text-[11px] mt-0.5 text-[var(--text-secondary)]">Every new week is a fresh opportunity to build momentum.</p>
                </div>
              ) : (
                completedPastWeek.slice(0, 10).map((task) => (
                  <div
                    key={task.id}
                    className="p-3 rounded-xl bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                      <span className="text-xs font-medium line-through text-[var(--text-muted)] truncate">
                        {task.title}
                      </span>
                    </div>
                    {task.timeSpentMinutes ? (
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 shrink-0">
                        {task.timeSpentMinutes}m logged
                      </span>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* STEP 3: SET STRATEGIC WEEKLY ANCHORS */}
        {step === 3 && (
          <div className="space-y-4 animate-fade-in">
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-xs">
              <Star size={18} className="text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold text-amber-900 dark:text-amber-200">
                  Step 3: Anchor Priorities for the Week Ahead
                </p>
                <p className="text-amber-700 dark:text-amber-300 mt-0.5">
                  Pin your Most Important Tasks (Rule of 3) so you step into next week with laser focus.
                </p>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1 scrollbar-none">
              {upcomingNextWeekTasks.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-muted)] bg-[var(--bg-surface-l2)] rounded-2xl border border-[var(--border-hairline)]">
                  <Calendar size={28} className="mx-auto mb-2 text-stone-400" />
                  <p className="text-xs font-semibold text-[var(--text-primary)]">No tasks scheduled for the next 7 days.</p>
                  <p className="text-[11px] mt-0.5 text-[var(--text-secondary)]">Schedule key deliverables to protect your focus.</p>
                </div>
              ) : (
                upcomingNextWeekTasks.slice(0, 10).map((task) => (
                  <div
                    key={task.id}
                    className="p-3 rounded-xl bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[var(--text-primary)] truncate">{task.title}</p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                        Due: {task.dueDate} • Priority: {task.priority.toUpperCase()}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => updateTask(task.id, { isPinnedToday: !task.isPinnedToday })}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold flex items-center gap-1 transition-all ${
                        task.isPinnedToday
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-[var(--bg-surface-l1)] text-[var(--text-secondary)] hover:text-amber-500 border border-[var(--border-hairline)]'
                      }`}
                    >
                      <Star size={11} className={task.isPinnedToday ? 'fill-current' : ''} />
                      <span>{task.isPinnedToday ? 'Anchored' : 'Anchor'}</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-[var(--border-hairline)] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors rounded-xl"
          >
            Close
          </button>

          <button
            type="button"
            onClick={handleNextStep}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-1.5 transition-all active:scale-95"
          >
            <span>{step === 3 ? 'Complete Weekly Reset' : 'Next Step'}</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
