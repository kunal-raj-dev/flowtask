import React from 'react';
import { useTaskContext } from '../../../context/TaskContext';
import { useTodayStr } from '../../../hooks/useCurrentDate';
import { calculateDayPlanSummary } from '../../../utils/dayPlanSummary';
import { useTotalFocusedTodaySeconds } from '../../../hooks/useTotalFocusedTodaySeconds';
import { formatSecondsToHumanReadable } from '../../../utils/focusTimeFormat';
import { Check, Flame, AlertCircle } from 'lucide-react';

interface TodayFocusProgressBarProps {
  onPlanMyDay?: () => void;
  className?: string;
}

export const TodayFocusProgressBar: React.FC<TodayFocusProgressBarProps> = ({
  onPlanMyDay,
  className = '',
}) => {
  const { tasks, calendarEvents = [], settings } = useTaskContext();
  const today = useTodayStr();
  const focusedSeconds = useTotalFocusedTodaySeconds();

  const summary = calculateDayPlanSummary({
    date: today,
    todayStr: today,
    tasks,
    calendarEvents,
    settings,
    focusLogsSecondsToday: focusedSeconds,
  });

  const hours = (minutes: number) => `${Math.round(minutes / 6) / 10}h`;
  const pct =
    summary.availableTaskBudgetMinutes > 0
      ? Math.min(100, Math.round((summary.totalDemandMinutes / summary.availableTaskBudgetMinutes) * 100))
      : summary.totalDemandMinutes > 0
      ? 100
      : 0;

  return (
    <div className={`today-focus-progress-container space-y-3 ${className}`}>
      {/* Daily Planning Budget Banner */}
      <div className="daily-planning-summary flex items-center justify-between p-4 rounded-2xl bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] shadow-2xs">
        <div>
          <span className="daily-summary-label text-[10px] font-bold tracking-wider uppercase text-[var(--text-muted)] block mb-1">
            A DAY THAT FITS
          </span>
          <p className="text-sm font-medium text-[var(--text-secondary)]">
            <strong className="text-[var(--text-primary)] font-bold">{hours(summary.totalDemandMinutes)}</strong> planned{' '}
            <span className="text-[var(--text-muted)]">·</span>{' '}
            <strong className="text-[var(--text-primary)] font-bold">
              {hours(Math.max(0, summary.availableTaskBudgetMinutes - summary.totalDemandMinutes))}
            </strong>{' '}
            available
          </p>
        </div>

        <div className="daily-summary-actions flex items-center gap-3">
          <section className="daily-progress flex items-center gap-3 text-xs text-[var(--text-secondary)] font-medium">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
              <Check size={13} strokeWidth={2.5} />
              {summary.completedTaskCount} completed
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-semibold">
              <Flame size={13} strokeWidth={2} />
              {formatSecondsToHumanReadable(focusedSeconds)} focused
            </span>
          </section>

          {onPlanMyDay && (
            <button
              type="button"
              className="desk-button primary text-xs font-semibold px-3 py-1.5 rounded-xl flex items-center gap-1"
              onClick={onPlanMyDay}
              aria-label="Plan my day"
            >
              Plan my day
            </button>
          )}
        </div>
      </div>

      {/* Visual Progress Bar */}
      <div className="px-1">
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1">
          <span>Capacity load</span>
          <span className="font-mono font-medium">{pct}%</span>
        </div>
        <div
          className="desk-capacity-bar w-full h-2 rounded-full bg-stone-200/70 dark:bg-stone-800 overflow-hidden relative"
          role="progressbar"
          aria-label="Planning capacity used"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              summary.overbooked
                ? 'bg-rose-500 dark:bg-rose-400'
                : pct > 80
                ? 'bg-amber-500 dark:bg-amber-400'
                : 'bg-emerald-500 dark:bg-emerald-400'
            }`}
            data-over={summary.overbooked || undefined}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Overbooked Warning */}
      {summary.overbooked && (
        <p
          className="daily-overload flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-300 text-xs font-medium"
          role="status"
        >
          <AlertCircle size={15} className="shrink-0 text-rose-600 dark:text-rose-400" />
          <span>
            Overbooked by {summary.overbookedMinutes} minutes. Move a task or adjust your plan.
          </span>
        </p>
      )}
    </div>
  );
};
