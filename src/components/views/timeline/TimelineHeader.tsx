import React from 'react';
import { CalendarDays, RefreshCw, BookOpen, AlertTriangle } from 'lucide-react';
interface TimelineHeaderProps {
  embedded?: boolean;
  scheduledCount: number;
  calendarEventCount: number;
  calendarIcsUrl: string;
  combinedPlannedHours: string;
  targetWorkCapacityHours: number;
  cognitiveTopology: { deepWorkHours: string; adminHours: string; hasHighCognitiveStrain: boolean; strainWarning?: string };
  meetingMinutes: number;
  totalMeetingHours: string;
  taskMinutes: number;
  combinedCapacityPercent: number;
  isRefreshingFeed: boolean;
  taskEffortHours?: string;
  scheduledHours?: string;
  conflictMinutes?: number;
  onOpenStudySession?: () => void;
  onOpenCalendarModal: () => void;
  onRefreshCalendar: () => void;
}
export const TimelineHeader: React.FC<TimelineHeaderProps> = (p) => (
  <header className="desk-plan-header">
    <div className="desk-page-header">
      {!p.embedded && <div>
        <p className="desk-eyebrow">A realistic rhythm</p>
        <h1>
          Plan<span className="desk-title-dot">.</span>
        </h1>
        <p className="desk-page-description">Make space for your priorities, one block at a time.</p>
      </div>}
      <div className="desk-header-actions">
        {p.onOpenStudySession && (
          <button className="desk-button" onClick={p.onOpenStudySession}>
            <BookOpen size={15} />
            Study session
          </button>
        )}
        <button className="desk-button" onClick={p.onOpenCalendarModal}>
          <CalendarDays size={15} />
          {p.calendarIcsUrl ? 'Calendar settings' : 'Calendar overlay (.ics)'}
        </button>
        {p.calendarIcsUrl && (
          <button
            className="desk-icon-button"
            aria-label="Refresh calendar events"
            onClick={p.onRefreshCalendar}
            disabled={p.isRefreshingFeed}
          >
            <RefreshCw size={16} />
          </button>
        )}
      </div>
    </div>
    <div className="desk-plan-budget">
      <div className="flex flex-wrap items-center gap-2">
        <strong>Task Effort: {p.taskEffortHours ?? (p.taskMinutes / 60).toFixed(1)}h</strong>
        <span>· Scheduled: {p.scheduledHours ?? p.combinedPlannedHours}h / {p.targetWorkCapacityHours}h capacity</span>
        {p.conflictMinutes && p.conflictMinutes > 0 ? (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1" data-testid="timeline-conflict-badge">
            <AlertTriangle size={11} />
            {p.conflictMinutes}m conflict
          </span>
        ) : null}
      </div>
      <p>
        {p.scheduledCount} scheduled tasks{p.meetingMinutes > 0 ? ' · ' + p.totalMeetingHours + 'h calendar events' : ''}
      </p>
      <span className={p.combinedCapacityPercent > 100 || (p.conflictMinutes && p.conflictMinutes > 0) ? 'desk-plan-over' : ''}>
        {p.conflictMinutes && p.conflictMinutes > 0
          ? `${p.conflictMinutes}m overlapping reservations`
          : p.combinedCapacityPercent > 100
          ? 'Overbooked by ' + Math.round(p.taskMinutes + p.meetingMinutes - p.targetWorkCapacityHours * 60) + ' minutes'
          : 'Room to adjust your day'}
      </span>
    </div>
  </header>
);
