import React, { useRef, useState } from 'react';
import type { Task, CalendarEvent } from '../../../types/task';
import { TimelineCurrentTimeRail } from '../TimelineCurrentTimeRail';
import {
  parseTimeToMinutes,
  minutesToTimeStr,
  calculateBlockPosition,
  classifyTaskCognitiveIntensity,
} from '../../../utils/timelineUtils';
import { SchedulePlannerDialog } from '../../workflow/SchedulePlannerDialog';
import { useTaskContext } from '../../../context/TaskContext';
import { useTodayStr } from '../../../hooks/useCurrentDate';
import {
  Calendar,
  Clock,
  Sparkles,
  ChevronRight,
  Play,
  CheckCircle2,
  Lock,
} from 'lucide-react';

interface TodayTimelineRailProps {
  isOpen: boolean;
  onToggleCollapse: () => void;
  tasks: Task[];
  calendarEvents?: CalendarEvent[];
  onSelectTask?: (id: string) => void;
  onStartFocus?: (id: string) => void;
  onStartSprint?: (id: string) => void;
  startHour?: number;
  endHour?: number;
  hourHeightPx?: number;
}

export const TodayTimelineRail: React.FC<TodayTimelineRailProps> = ({
  isOpen,
  onToggleCollapse,
  tasks,
  calendarEvents = [],
  onSelectTask,
  onStartFocus,
  onStartSprint,
  startHour = 0,
  endHour = 24,
  hourHeightPx = 64,
}) => {
  const { updateTask } = useTaskContext();
  const todayStr = useTodayStr();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [planning, setPlanning] = useState(false);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-label="Expand 24h timeline rail"
        title="Open Timeline Rail (Cmd+\)"
        className="w-8 shrink-0 border-l border-[var(--border-hairline)] bg-[var(--bg-surface-l1)]/50 hover:bg-[var(--bg-surface-hover)] flex flex-col items-center py-4 gap-3 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors group"
      >
        <Calendar size={15} />
        <span
          className="text-[10px] font-bold tracking-widest uppercase origin-center rotate-90 select-none whitespace-nowrap mt-4"
        >
          Timeline
        </span>
      </button>
    );
  }

  // Filter tasks that have a scheduledStart for today
  const scheduledTasks = tasks.filter(
    (t) =>
      !t.deletedAt &&
      !t.archivedAt &&
      t.scheduledStart &&
      (t.plannedDate === todayStr || (!t.plannedDate && t.dueDate === todayStr))
  );

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/json')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (!raw) return;
      const { taskId, duration } = JSON.parse(raw);
      if (!taskId) return;

      e.preventDefault();
      const rect = canvasRef.current?.getBoundingClientRect() || { top: 0, left: 0 };
      const clientY = typeof e.clientY === 'number' && !Number.isNaN(e.clientY) ? e.clientY : rect.top;
      const scrollTop = canvasRef.current?.scrollTop || 0;
      const y = clientY - rect.top + scrollTop;
      const dur = duration || 30;

      // 15-minute magnetic snap
      const rawMin = Math.round(((y / hourHeightPx) * 60) / 15) * 15 + startHour * 60;
      const minStart = startHour * 60;
      const maxStart = Math.min(endHour * 60 - dur, 1440 - dur);
      let clampedStart = Math.max(minStart, Math.min(maxStart, rawMin));

      // Magnetic snap to external calendar events if within 10 minutes
      for (const ev of calendarEvents) {
        if (ev.isAllDay) continue;
        const evEnd = parseTimeToMinutes(ev.endTime);
        if (evEnd !== null && Math.abs(clampedStart - evEnd) <= 10) {
          clampedStart = evEnd;
          break;
        }
      }

      const scheduledStart = minutesToTimeStr(clampedStart);
      const scheduledEnd = minutesToTimeStr(clampedStart + dur);

      updateTask(taskId, {
        scheduledStart,
        scheduledEnd,
        plannedDate: todayStr,
      });
    } catch {
      // Ignore invalid drag payload
    }
  };

  const hoursArray = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

  return (
    <>
    <SchedulePlannerDialog isOpen={planning} onClose={() => setPlanning(false)} date={todayStr} />
    <aside aria-label="Today schedule" className="today-timeline-rail w-[300px] shrink-0 border-l border-[var(--border-hairline)] bg-[var(--bg-surface-l1)]/60 backdrop-blur-sm flex flex-col h-full overflow-hidden select-none">
      {/* Rail Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--border-hairline)] bg-[var(--bg-surface-l1)] shrink-0">
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-amber-500" />
          <span className="text-xs font-bold text-[var(--text-primary)]">Today Timeline</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-stone-200/70 dark:bg-stone-800 text-[var(--text-muted)]">
            24h
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="desk-button primary flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg"
            onClick={() => setPlanning(true)}
            title="Auto-slot unscheduled tasks into open gaps"
            aria-label="Auto-Slot Day"
          >
            <Sparkles size={12} />
            <span>Auto-Slot Day</span>
          </button>
          <button
            type="button"
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-stone-200/50 dark:hover:bg-white/[0.04] transition-colors"
            onClick={onToggleCollapse}
            aria-label="Collapse timeline rail"
            title="Collapse rail (Cmd+\)"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* 24-Hour Visual Schedule Canvas */}
      <div
        ref={canvasRef}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="flex-1 overflow-y-auto relative overscroll-contain"
        style={{ height: `${(endHour - startHour) * hourHeightPx}px` }}
      >
        {/* Hour Grid Lines */}
        {hoursArray.map((hour) => (
          <div
            key={hour}
            className="flex items-start border-b border-[var(--border-hairline)]/40 relative"
            style={{ height: `${hourHeightPx}px` }}
          >
            <span className="w-12 shrink-0 text-[10px] font-mono font-medium text-[var(--text-muted)] px-2 pt-1 select-none">
              {String(hour).padStart(2, '0')}:00
            </span>
            <div className="flex-1 h-full border-l border-[var(--border-hairline)]/30 relative" />
          </div>
        ))}

        {/* Live Red Current Time Indicator */}
        <TimelineCurrentTimeRail
          startHour={startHour}
          endHour={endHour}
          hourHeightPx={hourHeightPx}
          isToday={true}
        />

        {/* Calendar Events */}
        {calendarEvents
          .filter((ev) => !ev.isAllDay && ev.startTime)
          .map((ev) => {
            const evStart = parseTimeToMinutes(ev.startTime);
            if (evStart === null) return null;
            const evEnd = parseTimeToMinutes(ev.endTime) ?? evStart + 30;
            const dur = Math.max(15, evEnd - evStart);
            const { topPx, heightPx } = calculateBlockPosition(evStart, dur, startHour, hourHeightPx);

            return (
              <div
                key={ev.id}
                className="absolute left-14 right-2 rounded-lg bg-sky-500/15 border border-sky-500/30 p-1.5 overflow-hidden text-[11px] pointer-events-none z-10"
                style={{ top: `${topPx}px`, height: `${heightPx}px` }}
              >
                <div className="font-semibold text-sky-800 dark:text-sky-300 truncate">{ev.title}</div>
                <div className="text-[10px] font-mono text-sky-600 dark:text-sky-400">
                  {ev.startTime} – {ev.endTime}
                </div>
              </div>
            );
          })}

        {/* Scheduled Tasks */}
        {scheduledTasks.map((t) => {
          const startMin = parseTimeToMinutes(t.scheduledStart);
          if (startMin === null) return null;
          const dur = t.estimatedMinutes || 30;
          const { topPx, heightPx } = calculateBlockPosition(startMin, dur, startHour, hourHeightPx);
          const intensity = classifyTaskCognitiveIntensity(t);
          const isDone = t.status === 'done';

          return (
            <div
              key={t.id}
              onClick={() => onSelectTask?.(t.id)}
              className={`absolute left-14 right-2 rounded-lg border p-2 cursor-pointer transition-all hover:shadow-xs group z-10 flex flex-col justify-between ${
                isDone
                  ? 'bg-stone-100/70 dark:bg-stone-800/40 border-stone-300 dark:border-stone-700 opacity-60'
                  : intensity === 'deep'
                  ? 'bg-amber-500/15 border-amber-500/35 hover:border-amber-500/60'
                  : 'bg-[var(--bg-surface-l2)] border-[var(--border-hairline)] hover:border-stone-400 dark:hover:border-stone-600'
              }`}
              style={{ top: `${topPx}px`, height: `${heightPx}px` }}
            >
              <div className="flex items-start justify-between gap-1 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  {isDone ? (
                    <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                  ) : (
                    <Clock size={11} className="text-[var(--text-muted)] shrink-0" />
                  )}
                  <span
                    className={`text-xs font-semibold truncate ${
                      isDone ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {t.title}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {t.scheduleLocked && <Lock size={10} className="text-[var(--text-muted)]" />}
                  {!isDone && onStartFocus && (
                    <button
                      type="button"
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-amber-600 dark:text-amber-400 hover:scale-110 transition-all"
                      title={'Focus on ' + t.title}
                      aria-label={'Focus on ' + t.title}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (t.sessionMetadata?.isSession && onStartSprint) {
                          onStartSprint(t.id);
                        } else {
                          onStartFocus(t.id);
                        }
                      }}
                    >
                      <Play size={11} fill="currentColor" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] mt-1">
                <span>
                  {t.scheduledStart}
                  {t.scheduledEnd ? ` – ${t.scheduledEnd}` : ` (${dur}m)`}
                </span>
                {intensity === 'deep' && (
                  <span className="px-1 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-sans font-bold text-[9px]">
                    Deep
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
    </>
  );
};
