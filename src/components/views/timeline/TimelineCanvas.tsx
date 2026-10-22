import React, { useState, useRef, useEffect } from 'react';
import type { Task, Project, CalendarEvent } from '../../../types/task';
import { TimelineCurrentTimeRail } from '../TimelineCurrentTimeRail';
import {
  parseTimeToMinutes,
  minutesToTimeStr,
  calculateBlockPosition,
  classifyTaskCognitiveIntensity,
  findOverlappingCalendarEvent,
  findNextFreeGap,
  rippleScheduleGaps,
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
  onApplyBatchChanges?: (changes: { id: string; updates: Partial<Task> }[], description?: string) => void;
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
  onUpdateTask: updateUnlockedTask,
  onApplyBatchChanges,
  onStartFocus,
  onStartSprint,
  onQuickAdd,
}) => {
  const onUpdateTask: TimelineCanvasProps['onUpdateTask'] = (id, updates) => {
    if (todayTasks.find(t => t.id === id)?.scheduleLocked && ['scheduledStart','scheduledEnd','estimatedMinutes'].some(key => key in updates)) return;
    updateUnlockedTask(id, updates);
  };
  const [quickAddHour, setQuickAddHour] = useState<number | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');

  // Interactive Drag & Resize State
  const [dragState, setDragState] = useState<{ taskId: string; currentStartMin: number } | null>(null);
  const [resizeState, setResizeState] = useState<{ taskId: string; currentDuration: number } | null>(null);

  const dragStartRef = useRef<{ startY: number; initialStartMin: number; duration: number }>({
    startY: 0,
    initialStartMin: 0,
    duration: 30,
  });
  const resizeStartRef = useRef<{ startY: number; initialDuration: number; initialStartMin: number }>({
    startY: 0,
    initialDuration: 30,
    initialStartMin: 0,
  });
  const hasDraggedRef = useRef(false);

  const onUpdateTaskRef = useRef(onUpdateTask);
  const onApplyBatchChangesRef = useRef(onApplyBatchChanges);
  const todayTasksRef = useRef(todayTasks);
  const calendarEventsRef = useRef(calendarEvents);
  useEffect(() => {
    onUpdateTaskRef.current = onUpdateTask;
    onApplyBatchChangesRef.current = onApplyBatchChanges;
    todayTasksRef.current = todayTasks;
    calendarEventsRef.current = calendarEvents;
  });

  const dragStateRef = useRef(dragState);
  const resizeStateRef = useRef(resizeState);
  useEffect(() => {
    dragStateRef.current = dragState;
    resizeStateRef.current = resizeState;
  }, [dragState, resizeState]);
  const isInteracting = Boolean(dragState || resizeState);

  useEffect(() => {
    if (!isInteracting) return;

    const handleGlobalPointerMove = (e: PointerEvent) => {
      const activeDrag = dragStateRef.current;
      const activeResize = resizeStateRef.current;

      if (activeDrag) {
        const deltaY = e.clientY - dragStartRef.current.startY;
        if (Math.abs(deltaY) > 3) {
          hasDraggedRef.current = true;
        }
        const deltaMinutes = Math.round(((deltaY / hourHeightPx) * 60) / 15) * 15;
        const minStart = startHour * 60;
        const maxStart = Math.min(
          (endHour * 60) - dragStartRef.current.duration,
          1440 - dragStartRef.current.duration
        );
        let clamped = Math.max(minStart, Math.min(maxStart, dragStartRef.current.initialStartMin + deltaMinutes));

        // Magnetic snap to external calendar events if within 10 minutes
        for (const ev of calendarEvents) {
          if (ev.isAllDay) continue;
          const evStart = parseTimeToMinutes(ev.startTime);
          const evEnd = parseTimeToMinutes(ev.endTime);
          if (evEnd !== null && Math.abs(clamped - evEnd) <= 10) {
            clamped = evEnd;
            break;
          }
          if (evStart !== null && Math.abs((clamped + dragStartRef.current.duration) - evStart) <= 10) {
            clamped = Math.max(minStart, evStart - dragStartRef.current.duration);
            break;
          }
        }

        setDragState({ taskId: activeDrag.taskId, currentStartMin: clamped });
      } else if (activeResize) {
        const deltaY = e.clientY - resizeStartRef.current.startY;
        const deltaMinutes = Math.round(((deltaY / hourHeightPx) * 60) / 15) * 15;
        const maxDuration = Math.min(
          (endHour * 60) - resizeStartRef.current.initialStartMin,
          1440 - resizeStartRef.current.initialStartMin
        );
        let clampedDuration = Math.max(15, Math.min(maxDuration, resizeStartRef.current.initialDuration + deltaMinutes));

        // Magnetic snap to external calendar start if within 10 minutes
        const currentEndMin = resizeStartRef.current.initialStartMin + clampedDuration;
        for (const ev of calendarEvents) {
          if (ev.isAllDay) continue;
          const evStart = parseTimeToMinutes(ev.startTime);
          if (evStart !== null && Math.abs(currentEndMin - evStart) <= 10) {
            clampedDuration = Math.max(15, evStart - resizeStartRef.current.initialStartMin);
            break;
          }
        }

        setResizeState({ taskId: activeResize.taskId, currentDuration: clampedDuration });
      }
    };

    const handleGlobalPointerUp = () => {
      const activeDrag = dragStateRef.current;
      const activeResize = resizeStateRef.current;

      if (activeDrag) {
        const { taskId, currentStartMin } = activeDrag;
        const { initialStartMin, duration } = dragStartRef.current;
        setDragState(null);
        if (currentStartMin !== initialStartMin) {
          const ripples = rippleScheduleGaps(
            todayTasksRef.current,
            taskId,
            currentStartMin,
            duration,
            calendarEventsRef.current
          );
          if (onApplyBatchChangesRef.current && ripples.length > 1) {
            onApplyBatchChangesRef.current(
              ripples.map((r) => ({
                id: r.id,
                updates: {
                  scheduledStart: r.scheduledStart,
                  scheduledEnd: r.scheduledEnd,
                  ...(r.bufferMinutes !== undefined ? { bufferMinutes: r.bufferMinutes } : {}),
                },
              })),
              'Move task with collision ripple'
            );
          } else {
            const timeStr = minutesToTimeStr(currentStartMin);
            const endStr = minutesToTimeStr(currentStartMin + duration);
            onUpdateTaskRef.current(taskId, { scheduledStart: timeStr, scheduledEnd: endStr });
          }
        }
      } else if (activeResize) {
        const { taskId, currentDuration } = activeResize;
        const { initialDuration, initialStartMin } = resizeStartRef.current;
        setResizeState(null);
        if (currentDuration !== initialDuration) {
          const ripples = rippleScheduleGaps(
            todayTasksRef.current,
            taskId,
            initialStartMin,
            currentDuration,
            calendarEventsRef.current
          );
          if (onApplyBatchChangesRef.current && ripples.length > 1) {
            onApplyBatchChangesRef.current(
              ripples.map((r) => ({
                id: r.id,
                updates: {
                  scheduledStart: r.scheduledStart,
                  scheduledEnd: r.scheduledEnd,
                  ...(r.id === taskId ? { estimatedMinutes: currentDuration } : {}),
                  ...(r.bufferMinutes !== undefined ? { bufferMinutes: r.bufferMinutes } : {}),
                },
              })),
              'Resize task duration with collision ripple'
            );
          } else {
            const newEndMin = initialStartMin + currentDuration;
            onUpdateTaskRef.current(taskId, {
              estimatedMinutes: currentDuration,
              scheduledEnd: minutesToTimeStr(newEndMin),
            });
          }
        }
      }
    };

    window.addEventListener('pointermove', handleGlobalPointerMove);
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('pointercancel', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, [isInteracting, hourHeightPx, startHour, endHour, calendarEvents]);

  const handleCanvasDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/json')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    try {
      const rawData = e.dataTransfer.getData('application/json');
      if (!rawData) return;
      const { taskId, duration } = JSON.parse(rawData);
      if (!taskId) return;

      e.preventDefault();
      const rect = e.currentTarget?.getBoundingClientRect?.() || { top: 0, left: 0 };
      const clientY = typeof e.clientY === 'number' && !Number.isNaN(e.clientY) ? e.clientY : rect.top;
      const y = clientY - rect.top;
      const dur = duration || 30;
      const rawMin = Math.round(((y / hourHeightPx) * 60) / 15) * 15 + startHour * 60;
      const minStart = startHour * 60;
      const maxStart = Math.min((endHour * 60) - dur, 1440 - dur);
      let clampedStart = Math.max(minStart, Math.min(maxStart, rawMin));

      // Magnetic snap to external calendar events if within 10 minutes
      for (const ev of calendarEvents) {
        if (ev.isAllDay) continue;
        const evStart = parseTimeToMinutes(ev.startTime);
        const evEnd = parseTimeToMinutes(ev.endTime);
        if (evEnd !== null && Math.abs(clampedStart - evEnd) <= 10) {
          clampedStart = evEnd;
          break;
        }
        if (evStart !== null && Math.abs((clampedStart + dur) - evStart) <= 10) {
          clampedStart = Math.max(minStart, evStart - dur);
          break;
        }
      }

      const ripples = rippleScheduleGaps(todayTasks, taskId, clampedStart, dur, calendarEvents);
      if (onApplyBatchChanges && ripples.length > 0) {
        onApplyBatchChanges(
          ripples.map((r) => ({
            id: r.id,
            updates: {
              scheduledStart: r.scheduledStart,
              scheduledEnd: r.scheduledEnd,
              ...(r.id === taskId ? { isSomeday: false } : {}),
              ...(r.bufferMinutes !== undefined ? { bufferMinutes: r.bufferMinutes } : {}),
            },
          })),
          'Schedule task from sidebar'
        );
      } else {
        onUpdateTask(taskId, {
          scheduledStart: minutesToTimeStr(clampedStart),
          scheduledEnd: minutesToTimeStr(clampedStart + dur),
          isSomeday: false,
        });
      }
    } catch (err) {
      console.error('Failed to parse dropped task payload', err);
    }
  };

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

  const handleBlockPointerDown = (
    e: React.PointerEvent,
    task: Task,
    startMin: number,
    duration: number,
    isDone: boolean
  ) => {
    if (isDone || task.scheduleLocked) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if ((e.target as HTMLElement).closest('button, input, [data-resize-handle]')) {
      return;
    }
    hasDraggedRef.current = false;
    dragStartRef.current = {
      startY: e.clientY,
      initialStartMin: startMin,
      duration,
    };
    setDragState({
      taskId: task.id,
      currentStartMin: startMin,
    });
  };

  const handleResizePointerDown = (
    e: React.PointerEvent,
    task: Task,
    startMin: number,
    duration: number,
    isDone: boolean
  ) => {
    if (isDone || task.scheduleLocked) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.stopPropagation();
    resizeStartRef.current = {
      startY: e.clientY,
      initialDuration: duration,
      initialStartMin: startMin,
    };
    setResizeState({
      taskId: task.id,
      currentDuration: duration,
    });
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

      <div
        data-testid="timeline-canvas-grid"
        onDragOver={handleCanvasDragOver}
        onDrop={handleCanvasDrop}
        className="relative"
        style={{ height: `${totalHours * hourHeightPx}px` }}
      >
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
          const isDragging = dragState?.taskId === task.id;
          const isResizing = resizeState?.taskId === task.id;
          const effectiveStartMin = isDragging ? dragState.currentStartMin : startMin;
          const effectiveDuration = isResizing ? resizeState.currentDuration : duration;
          const bufferMin = task.bufferMinutes !== undefined ? task.bufferMinutes : (effectiveDuration >= 45 ? 15 : 0);

          const { topPx, heightPx, bufferHeightPx } = calculateBlockPosition(
            effectiveStartMin,
            effectiveDuration,
            startHour,
            hourHeightPx,
            bufferMin
          );
          const project = projects.find((p) => p.id === task.projectId);
          const isDone = task.status === 'done';
          const overlapEvent = findOverlappingCalendarEvent(effectiveStartMin, effectiveDuration, calendarEvents);

          return (
            <React.Fragment key={task.id}>
              <div
                data-testid={`timeline-task-${task.id}`}
              data-timeline-task={task.id}
              data-dragging={isDragging ? 'true' : undefined}
              data-resizing={isResizing ? 'true' : undefined}
              onPointerDown={(e) => handleBlockPointerDown(e, task, startMin, duration, isDone)}
              onClick={() => {
                if (hasDraggedRef.current) {
                  hasDraggedRef.current = false;
                  return;
                }
                onSelectTask(task.id);
              }}
              className={`absolute left-16 right-2 rounded-lg p-2.5 border transition-all duration-75 select-none ${
                isDragging
                  ? 'cursor-grabbing ring-2 ring-amber-500 shadow-xl opacity-90 z-30 bg-amber-50/90 dark:bg-amber-950/40 border-amber-500'
                  : isResizing
                  ? 'cursor-ns-resize ring-2 ring-indigo-500 shadow-xl z-30 bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-500'
                  : isDone
                  ? 'cursor-pointer bg-stone-100/60 dark:bg-white/[0.03] border-[var(--border-hairline)] opacity-60'
                  : 'cursor-grab shadow-subtle hover:shadow-card hover:-translate-y-[1px]'
              } ${
                !isDragging && !isResizing && !isDone
                  ? overlapEvent
                    ? 'bg-rose-500/[0.08] dark:bg-rose-500/[0.12] border-rose-400/50 dark:border-rose-500/40 shadow-xs ring-1 ring-rose-500/20'
                    : task.isPinnedToday
                    ? 'bg-amber-500/[0.08] dark:bg-amber-500/[0.12] border-amber-400/50 dark:border-amber-500/40 shadow-xs'
                    : 'bg-white dark:bg-[var(--bg-surface-l2)] border-stone-200/90 dark:border-white/10'
                  : ''
              } flex items-center justify-between gap-3 overflow-hidden`}
              style={{
                top: `${topPx}px`,
                height: `${heightPx}px`,
                zIndex: isDragging || isResizing ? 30 : 10,
                touchAction: 'none',
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
                  aria-label={isDone ? `Mark "${task.title}" as incomplete` : `Mark "${task.title}" as complete`}
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
                      {minutesToTimeStr(effectiveStartMin)} – {minutesToTimeStr(effectiveStartMin + effectiveDuration)}
                    </span>
                    <span>({effectiveDuration}m)</span>
                    {isDragging && (
                      <span className="text-[9px] font-bold text-amber-800 dark:text-amber-300 animate-pulse ml-1">
                        Moving
                      </span>
                    )}
                    {isResizing && (
                      <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 animate-pulse ml-1">
                        Resizing
                      </span>
                    )}
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

              {/* Bottom Edge Resize Handle */}
              {!isDone && (
                <div
                  data-resize-handle="true"
                  data-testid={`timeline-resize-handle-${task.id}`}
                  onPointerDown={(e) => handleResizePointerDown(e, task, effectiveStartMin, effectiveDuration, isDone)}
                  title="Drag bottom edge to resize duration (15m increments)"
                  className="absolute left-0 right-0 bottom-0 h-2.5 cursor-ns-resize group/resize flex items-center justify-center hover:bg-amber-500/20 active:bg-amber-500/40 transition-colors z-20"
                >
                  <div className="w-8 h-1 rounded-full bg-stone-300 dark:bg-stone-600 group-hover/resize:bg-amber-500 opacity-60 group-hover/resize:opacity-100 transition-all" />
                </div>
              )}
            </div>
            {/* Rest Buffer Rail for Deep Work / Fatigue Recovery */}
            {bufferHeightPx > 0 && !isDone && (
              <div
                data-testid={`timeline-buffer-${task.id}`}
                className="absolute left-16 right-2 rounded-b-lg border-x border-b border-dashed border-amber-400/40 dark:border-amber-400/25 bg-amber-500/[0.05] dark:bg-amber-500/[0.08] text-amber-800 dark:text-amber-300 text-[10px] font-mono flex items-center justify-between px-3 pointer-events-none select-none z-[5] transition-all"
                style={{
                  top: `${topPx + heightPx}px`,
                  height: `${bufferHeightPx}px`,
                }}
              >
                <span className="flex items-center gap-1 font-semibold">
                  ☕ Rest Buffer (+{bufferMin}m)
                </span>
                <span className="text-[9px] hidden sm:inline">Cognitive recovery</span>
              </div>
            )}
          </React.Fragment>
        );
      })}
      </div>
    </div>
  );
};
