import React, { useState, useEffect } from 'react';
import { useTaskContext } from '../../../context/TaskContext';
import { useTodayStr } from '../../../hooks/useCurrentDate';
import { calculateDayPlanSummary, calculateFinishForecast } from '../../../utils/dayPlanSummary';
import { identifySurplusTasksToRollover } from '../../../utils/rolloverEngine';
import { useTotalFocusedTodaySeconds } from '../../../hooks/useTotalFocusedTodaySeconds';
import { formatSecondsToHumanReadable } from '../../../utils/focusTimeFormat';
import { AlertCircle, ChevronDown, Scale } from 'lucide-react';
import { Dialog } from '../../ui/Dialog';

function getTomorrowDateStr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}
interface TodayFocusProgressBarProps { onPlanMyDay?: () => void; className?: string; warningsOnly?: boolean }
export const TodayFocusProgressBar: React.FC<TodayFocusProgressBarProps> = ({ onPlanMyDay, className = '', warningsOnly = false }) => {
  const { tasks, projects = [], calendarEvents = [], settings, applyTaskChanges, showToast, undoLastAction } = useTaskContext();
  const [balanceOpen, setBalanceOpen] = useState(false);
  const today = useTodayStr();
  const tomorrow = getTomorrowDateStr(today);
  const focused = useTotalFocusedTodaySeconds();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer); }, []);
  const summary = calculateDayPlanSummary({ date: today, todayStr: today, tasks, projects, calendarEvents, settings, focusLogsSecondsToday: focused });
  const forecast = calculateFinishForecast(now, summary.remainingTaskWorkMinutes, summary.timedCalendarEvents, settings?.timelineEndHour ?? 22);
  const surplus = summary.overbooked ? identifySurplusTasksToRollover(tasks, today, summary.overbookedMinutes, projects) : [];
  const hours = (minutes: number) => `${Math.round(minutes / 6) / 10}h`;
  const pct = summary.availableTaskBudgetMinutes > 0 ? Math.min(100, Math.round(summary.totalDemandMinutes / summary.availableTaskBudgetMinutes * 100)) : summary.totalDemandMinutes > 0 ? 100 : 0;
  if (warningsOnly && !summary.overbooked && !forecast.outsideWorkHours) return null;
  return <section className={`today-focus-progress-container daily-planning-summary ${warningsOnly ? 'today-capacity-warnings' : ''} ${className}`} aria-label="Daily capacity">
    {!warningsOnly && <><details className="today-capacity-details"><summary aria-label="Day capacity details"><span><strong>{hours(summary.totalDemandMinutes)}</strong> planned<span className="today-capacity-divider">·</span><strong>{hours(Math.max(0, summary.availableTaskBudgetMinutes - summary.totalDemandMinutes))}</strong> available</span><span className="today-capacity-percentage">{pct}%<ChevronDown size={14} /></span></summary>
      <div className="today-capacity-expanded"><p className="today-capacity-eyebrow">A DAY THAT FITS</p><div className="today-capacity-facts"><span>{summary.completedTaskCount} completed</span><span>{formatSecondsToHumanReadable(focused)} focused</span><span>Estimated finish <strong>{forecast.time}{forecast.dayOffset > 0 ? ` (+${forecast.dayOffset}d)` : ''}</strong></span>{summary.missingEstimatesCount > 0 && <span>{summary.missingEstimatesCount} without an estimate</span>}</div>{onPlanMyDay && <button type="button" className="desk-button" onClick={onPlanMyDay}>Plan my day</button>}</div>
    </details><div className="desk-capacity-bar" role="progressbar" aria-label="Planning capacity used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><span data-over={summary.overbooked || undefined} style={{ width: `${pct}%`, background: summary.overbooked ? 'var(--pastel-coral)' : pct > 80 ? 'var(--color-brand)' : 'var(--pastel-sage)' }} /></div></>}
    {forecast.outsideWorkHours && <p role="status" className="today-finish-warning">Remaining work extends past your planning hours. Review your plan.</p>}
    {summary.overbooked && <div className="daily-overload" role="status"><div><AlertCircle size={16} /><span>Overbooked by {summary.overbookedMinutes} minutes. Move a task or adjust your plan.</span></div>{surplus.length > 0 && <button type="button" className="desk-button" aria-label="Balance Day" onClick={() => setBalanceOpen(true)}><Scale size={14} />Balance Day</button>}</div>}
    {balanceOpen && <Dialog isOpen onClose={() => setBalanceOpen(false)} title="Review day balance" description="Move flexible, unscheduled tasks to tomorrow. Priorities, scheduled work and today's deadlines stay in place."
      footer={<><button type="button" className="desk-button" onClick={() => setBalanceOpen(false)}>Keep today's plan</button><button type="button" className="desk-button primary" disabled={!surplus.length} onClick={() => {
        applyTaskChanges(surplus.map(task => ({ id: task.id, updates: { plannedDate: tomorrow, isSomeday: false, isPinnedToday: false, topThreeDate: undefined, scheduledStart: undefined, scheduledEnd: undefined } })), 'Balance daily plan');
        showToast('Flexible tasks moved to tomorrow.', 'Undo', undoLastAction); setBalanceOpen(false);
      }}>Move {surplus.length} {surplus.length === 1 ? 'task' : 'tasks'} to tomorrow</button></>}>
      <ul>{surplus.map(task => <li key={task.id}>{task.title}</li>)}</ul>{!surplus.length && <p>No flexible tasks can move. Your plan has changed.</p>}<p className="today-muted">This is a planning suggestion. Your task deadlines stay unchanged.</p>
    </Dialog>}
  </section>;
};
