import React from 'react';
import {
  Clock,
  Calendar,
  Sparkles,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

interface TimelineHeaderProps {
  scheduledCount: number;
  calendarEventCount: number;
  calendarIcsUrl: string;
  combinedPlannedHours: string;
  targetWorkCapacityHours: number;
  cognitiveTopology: {
    deepWorkHours: string;
    adminHours: string;
    hasHighCognitiveStrain: boolean;
    strainWarning?: string;
  };
  meetingMinutes: number;
  totalMeetingHours: string;
  taskMinutes: number;
  combinedCapacityPercent: number;
  isRefreshingFeed: boolean;
  onOpenStudySession?: () => void;
  onOpenCalendarModal: () => void;
  onRefreshCalendar: () => void;
}

export const TimelineHeader: React.FC<TimelineHeaderProps> = ({
  scheduledCount,
  calendarEventCount,
  calendarIcsUrl,
  combinedPlannedHours,
  targetWorkCapacityHours,
  cognitiveTopology,
  meetingMinutes,
  totalMeetingHours,
  taskMinutes,
  combinedCapacityPercent,
  isRefreshingFeed,
  onOpenStudySession,
  onOpenCalendarModal,
  onRefreshCalendar,
}) => {
  return (
    <div className="p-4 sm:p-5 rounded-xl bg-[var(--bg-surface-l1)]/90 border border-stone-200/80 dark:border-white/10 shadow-card card-surface backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs">
            <Clock size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-[var(--text-primary)]">Day Timeline & Time-blocking</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                {scheduledCount} scheduled
              </span>
              {calendarIcsUrl && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                  {calendarEventCount} calendar events
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Protect your calendar by allocating realistic time blocks.
            </p>
          </div>
        </div>

        {/* Sync Calendar & Workload Health Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Calendar Sync Button & Study Sessions Button */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {onOpenStudySession && (
              <button
                type="button"
                onClick={onOpenStudySession}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-semibold transition-all shadow-xs active:scale-95"
                title="Plan Study & Deep Work Sessions (DSA, LeetCode, Web Dev)"
              >
                <Sparkles size={13} className="text-emerald-600 dark:text-emerald-400" />
                <span>Study Sessions</span>
              </button>
            )}

            <button
              onClick={onOpenCalendarModal}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition-all ${
                calendarIcsUrl
                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                  : 'bg-stone-100 dark:bg-stone-800 text-[var(--text-secondary)] hover:text-amber-500 border-[var(--border-hairline)]'
              }`}
            >
              <Calendar size={13} />
              <span>{calendarIcsUrl ? 'Calendar overlay connected' : 'Calendar overlay (.ics)'}</span>
            </button>
            {calendarIcsUrl && (
              <button
                onClick={onRefreshCalendar}
                title="Refresh calendar events"
                className="p-1.5 rounded-xl text-stone-500 hover:text-amber-600 hover:bg-amber-500/10 border border-[var(--border-hairline)] transition-colors"
              >
                <RefreshCw size={13} className={isRefreshingFeed ? 'animate-spin' : ''} />
              </button>
            )}
          </div>

          {/* Workload Health Bar */}
          <div className="sm:text-right min-w-[220px]">
            <div className="flex items-center justify-between sm:justify-end gap-2 text-xs font-semibold text-[var(--text-primary)] font-mono">
              <span>{combinedPlannedHours}h planned</span>
              <span className="text-[var(--text-muted)]">/ {targetWorkCapacityHours}h target</span>
            </div>
            <div className="text-[10px] text-[var(--text-muted)] font-mono flex items-center justify-between sm:justify-end gap-1.5 mt-0.5 flex-wrap">
              <span>🧠 Deep: {cognitiveTopology.deepWorkHours}h</span>
              <span>•</span>
              <span>⚡ Admin: {cognitiveTopology.adminHours}h</span>
              {meetingMinutes > 0 && (
                <>
                  <span>•</span>
                  <span className="text-indigo-600 dark:text-indigo-400">📅 Mtgs: {totalMeetingHours}h</span>
                </>
              )}
            </div>

            <div className="w-full bg-stone-200 dark:bg-stone-800 h-2 rounded-full overflow-hidden mt-1.5 flex">
              <div
                className={`h-full transition-all duration-500 ${
                  combinedCapacityPercent > 100
                    ? 'bg-rose-500'
                    : combinedCapacityPercent > 75
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, Math.round((taskMinutes / (targetWorkCapacityHours * 60)) * 100))}%` }}
              />
              {meetingMinutes > 0 && (
                <div
                  className="h-full bg-indigo-500/70 transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round((meetingMinutes / (targetWorkCapacityHours * 60)) * 100))}%` }}
                />
              )}
            </div>

            <div className="text-[10px] font-medium text-[var(--text-secondary)] mt-1 flex items-center justify-between sm:justify-end gap-1">
              {combinedCapacityPercent > 100 ? (
                <span className="text-rose-500 flex items-center gap-1 font-semibold">
                  <AlertCircle size={10} /> Overbooked ({combinedCapacityPercent}%)
                </span>
              ) : combinedCapacityPercent > 75 ? (
                <span className="text-amber-600 dark:text-amber-400 font-semibold">
                  Full Day Capacity ⚡
                </span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  Healthy & Balanced 🌱
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Buffer Guard Strain Alert */}
      {cognitiveTopology.hasHighCognitiveStrain && (
        <div className="mt-3.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-xs text-amber-900 dark:text-amber-200 animate-slide-down">
          <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="font-medium">{cognitiveTopology.strainWarning}</span>
        </div>
      )}
    </div>
  );
};
