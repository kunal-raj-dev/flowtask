import React, { useState } from 'react';
import type { Task, Project, CalendarEvent } from '../../../types/task';
import { TimelineCurrentTimeRail } from '../TimelineCurrentTimeRail';
import {
  parseTimeToMinutes,
  minutesToTimeStr,
  calculateBlockPosition,
  classifyTaskCognitiveIntensity,
  findOverlappingCalendarEvent,
  findNextFreeGap,
} from '../../../utils/timelineUtils';
import {
  Calendar,
  Plus,
  Check,
  Clock,
  AlertCircle,
  Zap,
  Timer,
} from 'lucide-react';

interface TimelineCanvasProps {
  startHour: number;
  endHour: number;
  hourHeightPx: number;
  isToday: boolean;
  calendarEvents: CalendarEvent[];
  scheduledTasks: { task: Task; startMin: number; duration: number }[];
  todayTasks: Task[];
  projects: Project[];
  onSelectTask: (taskId: string) => void;
  onToggleTaskStatus: (taskId: string) => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onStartFocus: (taskId: string) => void;
  onStartSprint?: (taskId: string) => void;
  onQuickAdd: (title: string, hour: number) => void;
}

export const TimelineCanvas: React.FC<TimelineCanvasProps> = ({
  startHour,
  endHour,
  hourHeightPx,
  isToday,
  calendarEvents,
  scheduledTasks,
  todayTasks,
  projects,
  onSelectTask,
  onToggleTaskStatus,
  onUpdateTask,
  onStartFocus,
  onStartSprint,
  onQuickAdd,
}) => {
  const [quickAddHour, setQuickAddHour] = useState<number | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');

  const totalHours = endHour - startHour;

  const handleQuickAddSubmit = (hour: number) => {
    if (!quickAddTitle.trim()) {
      setQuickAddHour(null);
      return;
    }
    onQuickAdd(quickAddTitle.trim(), hour);
    setQuickAddTitle('');
    setQuickAddHour(null);
  };

  const handleUnschedule = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateTask(taskId, { scheduledStart: undefined });
  };

  return (
    <div className="lg:col-span-8 bg-[var(--bg-surface-l1)] border border-stone-200/80 dark:border-white/10 rounded-xl p-4 sm:p-6 card-surface overflow-hidden relative">
      {/* All-Day Calendar Events if present */}
      {calendarEvents.some((e) => e.isAllDay) && (
        <div className="mb-4 p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 pl-1">
            All-Day Events:
          </span>
          {calendarEvents
            .filter((e) => e.isAllDay)
            .map((ev) => (
              <span
                key={ev.id}
                title={ev.description || ev.title}
                className="text-xs px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-700 dark:text-indigo-200 font-semibold border border-indigo-500/20 flex items-center gap-1.5"
              >
                <Calendar size={11} />
                {ev.title}
              </span>
            ))}
        </div>
      )}

      <div className="relative" style={{ height: `${totalHours * hourHeightPx}px` }}>
        {/* Hour Rows */}
        {Array.from({ length: totalHours }, (_, i) => {
          const hour = startHour + i;
          const timeLabel = `${hour.toString().padStart(2, '0')}:00`;
          return (
            <div
              key={hour}
              className="absolute left-0 right-0 border-t border-stone-200/60 dark:border-white/[0.06] flex items-start group"
              style={{ top: `${i * hourHeightPx}px`, height: `${hourHeightPx}px` }}
            >
              {/* Time Label on Left Rail */}
              <span className="w-14 text-[11px] font-mono font-medium text-[var(--text-muted)] -mt-2.5 select-none shrink-0">
                {timeLabel}
              </span>

              {/* Empty Slot Interactive Area */}
              <div className="flex-1 h-full relative pl-3">
                {/* Hover "+ Add block" trigger */}
                <button
                  type="button"
                  onClick={() => setQuickAddHour(hour)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-1.5 left-4 flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-amber-500 hover:bg-amber-500/10 px-2 py-1 rounded-md"
                >
                  <Plus size={11} />
                  Schedule at {timeLabel}
                </button>

                {/* Inline Quick Add form */}
                {quickAddHour === hour && (
                  <div className="absolute top-1 left-2 right-2 z-30 p-2 rounded-lg bg-white dark:bg-[var(--bg-surface-l2)] border border-[var(--color-brand)] shadow-lg animate-scale-up">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleQuickAddSubmit(hour);
                      }}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="text"
                        autoFocus
                        id="timeline-quick-add-input"
                        name="quickAddTimeline"
                        aria-label={`Task at ${timeLabel}`}
                        placeholder={`Task at ${timeLabel}...`}
                        value={quickAddTitle}
                        onChange={(e) => setQuickAddTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setQuickAddHour(null);
                        }}
                        className="flex-1 text-xs px-2 py-1 rounded-lg bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] text-[var(--text-primary)] outline-none focus:border-[var(--color-brand)]"
                      />
                      <button
                        type="submit"
                        className="px-2.5 py-1 text-xs font-bold rounded-lg bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-hover)]"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickAddHour(null)}
                        className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] px-1"
                      >
                        Cancel
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Current Time Indicator Red Pulsing Line (Isolated 60s Timer) */}
        <TimelineCurrentTimeRail
          startHour={startHour}
          endHour={endHour}
          hourHeightPx={hourHeightPx}
          isToday={isToday}
        />

        {/* Calendar Meeting Overlay Blocks */}
        {calendarEvents
          .filter((ev) => !ev.isAllDay)
          .map((ev) => {
            const startMin = parseTimeToMinutes(ev.startTime);
            const endMin = parseTimeToMinutes(ev.endTime);
            if (startMin === null) return null;
            const duration = endMin ? Math.max(15, endMin - startMin) : 30;

            if (startMin < startHour * 60 || startMin >= endHour * 60) return null;

            const { topPx, heightPx } = calculateBlockPosition(
              startMin,
              duration,
              startHour,
              hourHeightPx
            );

            return (
              <div
                key={ev.id}
                title={`${ev.title}${ev.location ? ' • ' + ev.location : ''}${ev.description ? '\n' + ev.description : ''}`}
                className="absolute left-16 right-2 rounded-lg p-2.5 border border-dashed border-indigo-400/50 dark:border-indigo-400/30 bg-indigo-500/[0.08] dark:bg-indigo-500/[0.14] text-indigo-950 dark:text-indigo-200 flex items-start justify-between gap-3 overflow-hidden transition-all shadow-xs"
                style={{
                  top: `${topPx}px`,
                  height: `${heightPx}px`,
                  zIndex: 6,
                }}
              >
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-500/70" />
                <div className="min-w-0 pl-2">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={11} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span className="text-xs font-semibold truncate text-indigo-900 dark:text-indigo-100">
                      {ev.title}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 shrink-0">
                      Calendar
                    </span>
                  </div>
                  <div className="text-[10px] text-indigo-700/80 dark:text-indigo-300/80 font-mono flex items-center gap-2 mt-0.5">
                    <span>
                      {ev.startTime} – {ev.endTime}
                    </span>
                    <span>({duration}m)</span>
                    {ev.location && (
                      <span className="truncate max-w-[140px] text-[9px] opacity-80">
                        📍 {ev.location}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

        {/* Scheduled Task Blocks */}
        {scheduledTasks.map(({ task, startMin, duration }) => {
          const { topPx, heightPx } = calculateBlockPosition(startMin, duration, startHour, hourHeightPx);
          const project = projects.find((p) => p.id === task.projectId);
          const isDone = task.status === 'done';
          const overlapEvent = findOverlappingCalendarEvent(startMin, duration, calendarEvents);

          return (
            <div
              key={task.id}
              onClick={() => onSelectTask(task.id)}
              className={`absolute left-16 right-2 rounded-lg p-2.5 border transition-all duration-150 cursor-pointer shadow-subtle hover:shadow-card hover:-translate-y-[1px] flex items-center justify-between gap-3 overflow-hidden ${
                isDone
                  ? 'bg-stone-100/60 dark:bg-white/[0.03] border-[var(--border-hairline)] opacity-60'
                  : overlapEvent
                  ? 'bg-rose-500/[0.08] dark:bg-rose-500/[0.12] border-rose-400/50 dark:border-rose-500/40 shadow-xs ring-1 ring-rose-500/20'
                  : task.isPinnedToday
                  ? 'bg-amber-500/[0.08] dark:bg-amber-500/[0.12] border-amber-400/50 dark:border-amber-500/40 shadow-xs'
                  : 'bg-white dark:bg-[var(--bg-surface-l2)] border-stone-200/90 dark:border-white/10'
              }`}
              style={{
                top: `${topPx}px`,
                height: `${heightPx}px`,
                zIndex: 10,
              }}
            >
              {/* Left accent bar matching project */}
              <div
                className="absolute left-0 top-0 bottom-0 w-1.5"
                style={{ backgroundColor: project?.color || '#F59E0B' }}
              />

              <div className="flex items-center gap-2.5 min-w-0 pl-2">
                {/* Checkbox */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleTaskStatus(task.id);
                  }}
                  className={`w-4 h-4 rounded-[6px] flex-shrink-0 flex items-center justify-center border transition-all ${
                    isDone
                      ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-950 border-transparent'
                      : 'border-stone-300 dark:border-stone-600 hover:border-amber-500'
                  }`}
                >
                  {isDone && <Check size={10} className="stroke-[3]" />}
                </button>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`text-xs font-semibold truncate ${
                        isDone
                          ? 'line-through text-[var(--text-muted)]'
                          : 'text-[var(--text-primary)]'
                      }`}
                    >
                      {task.title}
                    </span>
                    {task.sessionMetadata?.isSession && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-800 dark:text-teal-300 border border-teal-500/30 shrink-0">
                        🎯 Session {task.sessionMetadata.sessionNumber || ''}
                      </span>
                    )}
                    {task.sessionMetadata?.pacingMinutesPerQuestion && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 shrink-0">
                        ⚡ {task.sessionMetadata.pacingMinutesPerQuestion}m/Q
                      </span>
                    )}
                    {task.isPinnedToday && !isDone && (
                      <span className="text-[9px] font-bold text-amber-500 shrink-0">
                        ★ Focus
                      </span>
                    )}
                    {!isDone && classifyTaskCognitiveIntensity(task) === 'deep' && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 shrink-0">
                        🧠 Deep
                      </span>
                    )}
                    {!isDone && classifyTaskCognitiveIntensity(task) === 'admin' && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-stone-500/15 text-stone-600 dark:text-stone-300 shrink-0">
                        ⚡ Admin
                      </span>
                    )}
                    {overlapEvent && !isDone && (
                      <span
                        title={`Overlaps with external calendar meeting: ${overlapEvent.title}`}
                        className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 shrink-0 flex items-center gap-0.5 animate-pulse"
                      >
                        <AlertCircle size={9} />
                        Meeting Conflict: {overlapEvent.title}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] font-mono flex items-center gap-1 mt-0.5">
                    <Clock size={10} />
                    <span>
                      {minutesToTimeStr(startMin)} – {minutesToTimeStr(startMin + duration)}
                    </span>
                    <span>({duration}m)</span>
                  </div>
                </div>
              </div>

              {/* Right actions */}
              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                {/* 15m Nudge Controls */}
                {!isDone && (
                  <div className="hidden sm:flex items-center gap-0.5 mr-0.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const newMin = Math.max(startHour * 60, startMin - 15);
                        const timeStr = minutesToTimeStr(newMin);
                        onUpdateTask(task.id, { scheduledStart: timeStr });
                      }}
                      title="Nudge 15m earlier"
                      className="px-1 py-0.5 text-[9px] font-mono font-bold rounded bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 transition-colors"
                    >
                      -15m
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const newMin = Math.min((endHour * 60) - duration, startMin + 15);
                        const timeStr = minutesToTimeStr(newMin);
                        onUpdateTask(task.id, { scheduledStart: timeStr });
                      }}
                      title="Nudge 15m later"
                      className="px-1 py-0.5 text-[9px] font-mono font-bold rounded bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 transition-colors"
                    >
                      +15m
                    </button>
                  </div>
                )}

                {/* Auto-Slot into Free Gap if conflict */}
                {overlapEvent && !isDone && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const nextGap = findNextFreeGap(
                        duration,
                        todayTasks.filter((t) => t.id !== task.id),
                        calendarEvents,
                        startMin
                      );
                      if (nextGap !== null) {
                        const timeStr = minutesToTimeStr(nextGap);
                        onUpdateTask(task.id, { scheduledStart: timeStr });
                      }
                    }}
                    title="Auto-slot into next free gap without conflicts"
                    className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-500/20 text-amber-800 dark:text-amber-200 hover:bg-amber-500/30 border border-amber-500/30 transition-colors shrink-0"
                  >
                    Auto-Slot Free
                  </button>
                )}

                {!isDone && task.sessionMetadata?.isSession && onStartSprint ? (
                  <button
                    type="button"
                    onClick={() => onStartSprint(task.id)}
                    title="Launch Study Sprint Cockpit"
                    className="px-1.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 text-[10px] font-bold flex items-center gap-1 transition-all shadow-xs"
                  >
                    <Zap size={11} className="fill-current text-emerald-500" />
                    <span>Sprint</span>
                  </button>
                ) : !isDone ? (
                  <button
                    type="button"
                    onClick={() => onStartFocus(task.id)}
                    title="Start Focus Timer"
                    className="p-1 rounded-lg text-stone-400 hover:text-indigo-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                  >
                    <Timer size={13} />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={(e) => handleUnschedule(task.id, e)}
                  title="Remove from timeline (unschedule)"
                  className="p-1 rounded-lg text-stone-400 hover:text-rose-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-[10px]"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
