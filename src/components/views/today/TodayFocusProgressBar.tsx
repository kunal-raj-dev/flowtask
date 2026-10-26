import React, { useState, useEffect } from 'react';
import { useTaskContext } from '../../../context/TaskContext';
import { useTodayStr } from '../../../hooks/useCurrentDate';
import { calculateDayPlanSummary, calculateFinishForecast } from '../../../utils/dayPlanSummary';
import { identifySurplusTasksToRollover } from '../../../utils/rolloverEngine';
import { useTotalFocusedTodaySeconds } from '../../../hooks/useTotalFocusedTodaySeconds';
import { formatSecondsToHumanReadable } from '../../../utils/focusTimeFormat';
import { Check, Flame, AlertCircle, Scale } from 'lucide-react';
import { Dialog } from '../../ui/Dialog';

function getTomorrowDateStr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10);
}

interface TodayFocusProgressBarProps {
  onPlanMyDay?: () => void;
  className?: string;
}

export const TodayFocusProgressBar: React.FC<TodayFocusProgressBarProps> = ({
  onPlanMyDay,
  className = '',
}) => {
  const { tasks, projects = [], calendarEvents = [], settings, applyTaskChanges, showToast, undoLastAction } = useTaskContext();
  const [balanceOpen, setBalanceOpen] = useState(false);
  const today = useTodayStr();
  const tomorrowStr = getTomorrowDateStr(today);
  const focusedSeconds = useTotalFocusedTodaySeconds();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const summary = calculateDayPlanSummary({
    date: today,
    todayStr: today,
    tasks,
    projects,
    calendarEvents,
    settings,
    focusLogsSecondsToday: focusedSeconds,
  });

  const forecast = calculateFinishForecast(
    now,
    summary.remainingTaskWorkMinutes,
    summary.timedCalendarEvents,
    settings?.timelineEndHour ?? 22
  );

  const surplusTasks = summary.overbooked
    ? identifySurplusTasksToRollover(tasks, today, summary.overbookedMinutes, projects)
    : [];

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
      <div className="daily-planning-summary flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] shadow-2xs">
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
            in daily budget{' '}
            <span className="text-[var(--text-muted)]">·</span>{' '}
            <span title="Estimate assumes continuous work around today's calendar events.">
              Estimated finish{' '}
              <strong className="text-[var(--text-primary)] font-bold">{forecast.time}{forecast.dayOffset > 0 ? ` (+${forecast.dayOffset}d)` : ''}</strong>
            </span>
          </p>
          {forecast.outsideWorkHours && <p role="status" className="today-finish-warning">Remaining work extends past your planning hours. Review your plan.</p>}
        </div>

        <div className="daily-summary-actions flex items-center gap-3">
          <section className="daily-progress flex items-center gap-3 text-xs text-[var(--text-secondary)] font-medium">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20 font-semibold">
              <Check size={13} strokeWidth={2.5} />
              {summary.completedTaskCount} completed
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20 font-semibold">
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

      {/* Overbooked Warning with Balance Day Button */}
      {summary.overbooked && (
        <div
          className="daily-overload flex items-center justify-between gap-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-300 text-xs font-medium"
          role="status"
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0 text-rose-600 dark:text-rose-400" />
            <span>
              Overbooked by {summary.overbookedMinutes} minutes. Move a task or adjust your plan.
            </span>
          </div>
          {surplusTasks.length > 0 && (
            <button
              type="button"
              className="balance-day-btn text-xs font-bold px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-800 dark:text-rose-200 border border-rose-500/30 transition-all shrink-0 cursor-pointer shadow-2xs active:scale-95 flex items-center gap-1.5"
              onClick={() => setBalanceOpen(true)}
              aria-label="Balance Day"
            >
              <Scale size={13} />
              <span>Balance Day</span>
            </button>
          )}
        </div>
      )}
      {balanceOpen && (
        <Dialog isOpen onClose={() => setBalanceOpen(false)} title="Review day balance"
          description="Move flexible, unscheduled tasks to tomorrow. Priorities, scheduled work and today's deadlines stay in place."
          footer={<>
            <button className="desk-button" onClick={() => setBalanceOpen(false)}>Keep today's plan</button>
            <button className="desk-button primary" disabled={!surplusTasks.length} onClick={() => {
              // Recomputed from live tasks each render; apply one reversible workspace command.
              applyTaskChanges(surplusTasks.map(t => ({ id: t.id, updates: {
                plannedDate: tomorrowStr, isSomeday: false, isPinnedToday: false,
                topThreeDate: undefined, scheduledStart: undefined, scheduledEnd: undefined,
              } })), 'Balance daily plan');
              showToast('Flexible tasks moved to tomorrow.', 'Undo', undoLastAction);
              setBalanceOpen(false);
            }}>Move {surplusTasks.length} {surplusTasks.length === 1 ? 'task' : 'tasks'} to tomorrow</button>
          </>}>
          <ul className="space-y-3">{surplusTasks.map(t => <li key={t.id}>{t.title}</li>)}</ul>
          {!surplusTasks.length && <p>No flexible tasks can move. Your plan has changed.</p>}
          <p className="mt-4 text-sm text-[var(--text-secondary)]">This is a planning suggestion. Your task deadlines stay unchanged.</p>
        </Dialog>
      )}
    </div>
  );
};

