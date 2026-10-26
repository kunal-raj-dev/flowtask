import { useTaskAvailabilityClock } from '../../../hooks/useTaskAvailabilityClock';
import React from 'react';
import { useTaskContext } from '../../../context/TaskContext';
import { useTodayStr } from '../../../hooks/useCurrentDate';
import { calculateDayPlanSummary } from '../../../utils/dayPlanSummary';
import { useTotalFocusedTodaySeconds } from '../../../hooks/useTotalFocusedTodaySeconds';
import { formatSecondsToHumanReadable } from '../../../utils/focusTimeFormat';
import type { WidgetComponentProps } from '../../../types/dashboard';
export const CapacityProgressWidget: React.FC<WidgetComponentProps> = () => {
  const { tasks, projects, calendarEvents, settings } = useTaskContext(), today = useTodayStr(), seconds = useTotalFocusedTodaySeconds();
  useTaskAvailabilityClock(tasks);
  const summary = calculateDayPlanSummary({ date:today,todayStr:today,tasks,projects,calendarEvents,settings,focusLogsSecondsToday:seconds });
  const pct = summary.availableTaskBudgetMinutes > 0 ? Math.min(100,summary.totalDemandMinutes/summary.availableTaskBudgetMinutes*100) : summary.totalDemandMinutes ? 100 : 0;
  return <div className="desk-capacity">
    <div className="desk-capacity-values"><div><small>Room for tasks</small><strong>{formatSecondsToHumanReadable(summary.availableTaskBudgetMinutes*60)}</strong></div><div><small>Remaining work</small><strong>{formatSecondsToHumanReadable(summary.remainingTaskWorkMinutes*60)}</strong></div></div>
    <div className="desk-capacity-line"><span>Planned</span><span>{summary.totalDemandMinutes}m / {summary.availableTaskBudgetMinutes}m</span></div>
    <div className="desk-capacity-bar" role="progressbar" aria-label="Planning capacity used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}><span data-over={summary.overbooked || undefined} style={{ width:pct+'%' }}/></div>
    <p className="desk-capacity-foot"><span>{summary.completedTaskCount}/{summary.totalTaskCount} completed</span><span>{formatSecondsToHumanReadable(seconds)} focused</span></p>
    {summary.overbooked && <p className="desk-capacity-warning">Overbooked by {summary.overbookedMinutes} minutes. Leave a little room or move a task.</p>}
    {summary.missingEstimatesCount > 0 && <p className="desk-capacity-note">{summary.missingEstimatesCount} tasks use your default estimate.</p>}
    {summary.timedCalendarMinutes > 0 && <p className="desk-capacity-note">{summary.timedCalendarMinutes}m reserved for calendar events.</p>}
  </div>;
};
