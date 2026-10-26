import React, { useRef, useState, useEffect, useMemo } from 'react';
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
  const [dragOverGhost, setDragOverGhost] = useState<{
    topPx: number;
    heightPx: number;
    timeStr: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen || !canvasRef.current || canvasRef.current.clientHeight <= 0) return;
    const hour = new Date().getHours();
    canvasRef.current.scrollTop = Math.max(0, (hour - startHour - 1) * hourHeightPx);
  }, [isOpen, startHour, hourHeightPx]);

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

  // Calculate open interstitial windows between scheduled blocks >= 15m
  const gaps = useMemo(() => {
    const occupied: Array<[number, number]> = [];

    // Timed calendar events
    for (const ev of calendarEvents) {
      if (ev.isAllDay || !ev.startTime) continue;
      const s = parseTimeToMinutes(ev.startTime);
      if (s === null) continue;
      const e = parseTimeToMinutes(ev.endTime) ?? s + 30;
      if (e > s) {
        occupied.push([Math.max(startHour * 60, s), Math.min(endHour * 60, e)]);
      }
    }

    // Scheduled tasks
    for (const t of scheduledTasks) {
      const s = parseTimeToMinutes(t.scheduledStart);
      if (s === null) continue;
      const dur = t.estimatedMinutes || 30;
      const e = s + dur;
      if (e > s) {
        occupied.push([Math.max(startHour * 60, s), Math.min(endHour * 60, e)]);
      }
    }

    if (occupied.length === 0) {
      const totalSpan = (endHour - startHour) * 60;
      return totalSpan >= 15
        ? [{ startMin: startHour * 60, endMin: endHour * 60, gapMinutes: totalSpan }]
        : [];
    }

    occupied.sort((a, b) => a[0] - b[0]);
    const merged: Array<[number, number]> = [];
    for (const [start, end] of occupied) {
      if (merged.length === 0) {
        merged.push([start, end]);
      } else {
        const last = merged[merged.length - 1];
        if (start <= last[1]) {
          last[1] = Math.max(last[1], end);
        } else {
          merged.push([start, end]);
        }
      }
    }

    const freeGaps: Array<{ startMin: number; endMin: number; gapMinutes: number }> = [];
    let cursor = startHour * 60;

    for (const [start, end] of merged) {
      if (start - cursor >= 15) {
        freeGaps.push({ startMin: cursor, endMin: start, gapMinutes: start - cursor });
      }
      cursor = Math.max(cursor, end);
    }

    if (endHour * 60 - cursor >= 15) {
      freeGaps.push({ startMin: cursor, endMin: endHour * 60, gapMinutes: endHour * 60 - cursor });
    }

    return freeGaps;
  }, [calendarEvents, scheduledTasks, startHour, endHour]);

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/json')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      const rect = canvasRef.current?.getBoundingClientRect() || { top: 0, left: 0 };
      const clientY = typeof e.clientY === 'number' && !Number.isNaN(e.clientY) ? e.clientY : rect.top;
      const scrollTop = canvasRef.current?.scrollTop || 0;
      const y = clientY - rect.top + scrollTop;
      const dur = 30;

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

      const { topPx, heightPx } = calculateBlockPosition(clampedStart, dur, startHour, hourHeightPx);
      const scheduledStart = minutesToTimeStr(clampedStart);
      const scheduledEnd = minutesToTimeStr(clampedStart + dur);

      setDragOverGhost({
        topPx,
        heightPx,
        timeStr: `${scheduledStart} – ${scheduledEnd}`,
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    setDragOverGhost(null);
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const taskId = parsed?.taskId;
      if (!taskId) return;
      const dur = parsed.duration || 30;

      e.preventDefault();
      const rect = canvasRef.current?.getBoundingClientRect() || { top: 0, left: 0 };
      const clientY = typeof e.clientY === 'number' && !Number.isNaN(e.clientY) ? e.clientY : rect.top;
      const scrollTop = canvasRef.current?.scrollTop || 0;
      const y = clientY - rect.top + scrollTop;

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
        onDragLeave={() => setDragOverGhost(null)}
        onDrop={handleDrop}
        tabIndex={0}
        role="region"
        aria-label="Day timeline schedule"
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

        {/* Interstitial Duration Gap Pills */}
        {gaps.map((gap) => {
          const { topPx, heightPx } = calculateBlockPosition(gap.startMin, gap.gapMinutes, startHour, hourHeightPx);
          if (heightPx < 20) return null;
          return (
            <div
              key={`gap-${gap.startMin}-${gap.endMin}`}
              className="timeline-gap-pill absolute left-14 right-2 flex items-center justify-center pointer-events-none z-0"
              style={{ top: `${topPx}px`, height: `${heightPx}px` }}
            >
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-stone-200/50 dark:bg-stone-800/60 text-[var(--text-muted)] border border-[var(--border-hairline)]/60">
                {gap.gapMinutes}m free window
              </span>
            </div>
          );
        })}

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
        {/* 15-Minute Magnetic Ghost Drag-Over Preview */}
        {dragOverGhost && (
          <div
            className="dragOverGhost absolute left-14 right-2 rounded-lg border-2 border-dashed border-amber-500/80 bg-amber-500/15 pointer-events-none z-20 flex items-center px-2.5 text-xs font-mono font-bold text-amber-700 dark:text-amber-300 transition-all duration-75 shadow-xs"
            style={{ top: `${dragOverGhost.topPx}px`, height: `${dragOverGhost.heightPx}px` }}
          >
            <span>{dragOverGhost.timeStr}</span>
          </div>
        )}
      </div>
    </aside>
    </>
  );
};
