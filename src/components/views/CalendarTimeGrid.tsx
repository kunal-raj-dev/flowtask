import React, { useState, useRef, useMemo, useCallback } from 'react';
import { getTaskEligibility } from '../../utils/taskEligibility';
import type { Task, CalendarEvent } from '../../types/task';
import { useTaskContext } from '../../context/TaskContext';
import { audioEngine } from '../../services/audioEngine';
import {
  parseTimeToMinutes,
  minutesToTimeStr,
  TIMELINE_START_HOUR,
  TIMELINE_END_HOUR,
  TIMELINE_HOUR_HEIGHT_PX,
} from '../../utils/timelineUtils';
import { calculateDeficitBudget, formatDeficitWarning } from '../../services/workBlockService';
import { formatLocalDate } from '../../utils/nlpParser';
import { useTodayStr } from '../../hooks/useCurrentDate';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Clock,
  AlertTriangle,
  GripVertical,
  Maximize2,
  Lock,
  ListTodo,
  X,
} from 'lucide-react';
import { CircadianEnergyCurve } from '../timeline/CircadianEnergyCurve';

export interface CalendarTimeGridProps {
  onSelectTask?: (taskId: string) => void;
  onStartFocus?: (taskId: string) => void;
  initialDate?: string;
  onDateChange?: (newDateStr: string) => void;
}

export type GridViewSpan = '1-day' | '3-day' | '7-day';

export const CalendarTimeGrid: React.FC<CalendarTimeGridProps> = ({
  onSelectTask,
  onStartFocus,
  initialDate,
  onDateChange,
}) => {
  const {
    tasks,
    projects = [],
    updateTask,
    calendarEvents: allCalendarEvents,
    settings,
  } = useTaskContext();

  const todayStr = useTodayStr();
  const [activeDateStr, setActiveDateStr] = useState<string>(
    () => initialDate || todayStr
  );

  const [prevInitialDate, setPrevInitialDate] = useState(initialDate);
  if (initialDate && initialDate !== prevInitialDate) {
    setPrevInitialDate(initialDate);
    setActiveDateStr(initialDate);
  }

  const updateActiveDate = useCallback((newDateStr: string) => {
    setActiveDateStr(newDateStr);
    onDateChange?.(newDateStr);
  }, [onDateChange]);

  const [viewSpan, setViewSpan] = useState<GridViewSpan>('1-day');
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [snapInterval, setSnapInterval] = useState<15 | 30>(15);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

  // Mobile drawer state for unscheduled tasks (F20)
  const [isMobileShelfOpen, setIsMobileShelfOpen] = useState(false);

  // Drag resize preview state - commits once on release (F24)
  const [resizePreview, setResizePreview] = useState<{
    taskId: string;
    scheduledStart?: string;
    scheduledEnd?: string;
  } | null>(null);

  // 15-minute magnetic ghost bounding box preview on dragOver
  const [dragOverGhost, setDragOverGhost] = useState<{
    dateStr: string;
    top: number;
    height: number;
    timeStr: string;
  } | null>(null);

  const gridScrollRef = useRef<HTMLDivElement | null>(null);

  const startHour = settings?.timelineStartHour ?? TIMELINE_START_HOUR;
  const endHour = Math.max(startHour + 2, settings?.timelineEndHour ?? TIMELINE_END_HOUR);
  const hourHeight = TIMELINE_HOUR_HEIGHT_PX * zoomScale;
  const totalHours = endHour - startHour;
  const gridTotalHeight = totalHours * hourHeight;

  // Compute dates array based on viewSpan
  const dates = useMemo(() => {
    const base = new Date(activeDateStr + 'T00:00:00');
    const count = viewSpan === '1-day' ? 1 : viewSpan === '3-day' ? 3 : 7;
    const res: string[] = [];
    for (let i = 0; i < count; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      res.push(formatLocalDate(d));
    }
    return res;
  }, [activeDateStr, viewSpan]);

  // Unscheduled backlog / brain dump shelf tasks for the primary active date
  const unscheduledTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.deletedAt || t.archivedAt || t.status === 'done') return false;
      const isForDay =
        t.plannedDate === activeDateStr ||
        (!t.plannedDate && t.dueDate === activeDateStr) ||
        (t.isPinnedToday && !t.plannedDate);
      return isForDay && !t.scheduledStart && getTaskEligibility(t, { tasks, projects, date: activeDateStr }).actionable;
    });
  }, [tasks, projects, activeDateStr]);

  // Scheduled tasks mapped by date
  const scheduledTasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    dates.forEach((d) => map.set(d, []));
    tasks.forEach((t) => {
      if (t.deletedAt || t.archivedAt) return;
      if (t.workBlocks && t.workBlocks.length > 0) {
        t.workBlocks.forEach((b) => {
          if (b.status === 'cancelled') return;
          const blockDate = b.date || (b.startInstant ? new Date(b.startInstant).toISOString().slice(0, 10) : null);
          if (blockDate && map.has(blockDate)) {
            const blockTask: Task = {
              ...t,
              scheduledStart: b.startTime || t.scheduledStart,
              scheduledEnd: b.endTime || t.scheduledEnd,
            };
            map.get(blockDate)!.push(blockTask);
          }
        });
      } else if (t.scheduledStart) {
        const targetDate = t.plannedDate || t.dueDate || activeDateStr;
        if (map.has(targetDate)) {
          map.get(targetDate)!.push(t);
        }
      }
    });
    return map;
  }, [tasks, dates, activeDateStr]);

  // Calendar events mapped by date
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    dates.forEach((d) => map.set(d, []));
    allCalendarEvents.forEach((ev) => {
      const evDate = ev.date || activeDateStr;
      if (map.has(evDate)) {
        map.get(evDate)!.push(ev);
      }
    });
    return map;
  }, [allCalendarEvents, dates, activeDateStr]);

  // Deficit Budget calculation for primary active date
  const deficitBudget = useMemo(() => {
    const dayTasks = scheduledTasksByDate.get(activeDateStr) || [];
    const dayEvents = eventsByDate.get(activeDateStr) || [];

    const tasksMinutes = dayTasks.reduce((sum, t) => {
      const s = parseTimeToMinutes(t.scheduledStart) ?? 0;
      const e = parseTimeToMinutes(t.scheduledEnd);
      const dur = e && e > s ? e - s : t.estimatedMinutes || 30;
      return sum + dur;
    }, 0);

    const calendarEventsMinutes = dayEvents.reduce((sum, ev) => {
      const s = parseTimeToMinutes(ev.startTime) ?? 0;
      const e = parseTimeToMinutes(ev.endTime) ?? s + 60;
      return sum + Math.max(0, e - s);
    }, 0);

    return calculateDeficitBudget({
      workdayStartHour: startHour,
      workdayEndHour: endHour,
      calendarEventsMinutes,
      bufferMinutes: settings?.autoSlotBufferMinutes ?? 15,
      tasksMinutes,
    });
  }, [scheduledTasksByDate, eventsByDate, activeDateStr, startHour, endHour, settings]);

  // Focal-point scroll preservation during zoom scaling
  const handleZoom = useCallback(
    (delta: number) => {
      const container = gridScrollRef.current;
      if (!container) {
        setZoomScale((prev) => Math.min(3.0, Math.max(0.5, prev + delta)));
        return;
      }

      const prevScale = zoomScale;
      const nextScale = Math.min(3.0, Math.max(0.5, prevScale + delta));
      if (nextScale === prevScale) return;

      const viewportCenter = container.scrollTop + container.clientHeight / 2;
      const timeFocalMinutes = (viewportCenter / (TIMELINE_HOUR_HEIGHT_PX * prevScale)) * 60;

      setZoomScale(nextScale);

      requestAnimationFrame(() => {
        if (container) {
          const nextHourHeight = TIMELINE_HOUR_HEIGHT_PX * nextScale;
          const targetCenter = (timeFocalMinutes / 60) * nextHourHeight;
          container.scrollTop = Math.max(0, targetCenter - container.clientHeight / 2);
        }
      });
    },
    [zoomScale]
  );

  // Magnetic snap calculations
  const snapToInterval = useCallback(
    (minutes: number, interval: 15 | 30 = snapInterval): number => {
      const snapped = Math.round(minutes / interval) * interval;
      return Math.min((endHour - startHour) * 60 - interval, Math.max(0, snapped));
    },
    [snapInterval, startHour, endHour]
  );

  // Drag over calendar column
  const handleDragOver = (e: React.DragEvent, dateStr?: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!dateStr) return;

    const clientY = typeof e.clientY === 'number' && !Number.isNaN(e.clientY) ? e.clientY : 0;
    const targetEl = (e.currentTarget || e.target) as HTMLElement;
    const columnRect = targetEl?.getBoundingClientRect ? targetEl.getBoundingClientRect() : { top: 0 };
    const colTop = typeof columnRect?.top === 'number' && !Number.isNaN(columnRect.top) ? columnRect.top : 0;
    const relativeY = Math.max(0, clientY - colTop);
    const effectiveHourHeight = hourHeight > 0 ? hourHeight : TIMELINE_HOUR_HEIGHT_PX;
    const minutesFromStart = (relativeY / effectiveHourHeight) * 60;
    const snappedMinutes = snapToInterval(Number.isNaN(minutesFromStart) ? 0 : minutesFromStart);

    const dur = 30;
    const top = (snappedMinutes / 60) * effectiveHourHeight;
    const height = Math.max(24, (dur / 60) * effectiveHourHeight);
    const startMins = startHour * 60 + snappedMinutes;

    setDragOverGhost({
      dateStr,
      top,
      height,
      timeStr: `${minutesToTimeStr(startMins)} – ${minutesToTimeStr(startMins + dur)}`,
    });
  };

  // Drop onto a specific column and time slot (respects scheduleLocked, F21)
  const handleDrop = (e: React.DragEvent, targetDate: string) => {
    e.preventDefault();
    setDragOverGhost(null);
    const taskId = e.dataTransfer.getData('text/plain') || draggingTaskId;
    if (!taskId) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    if (task.scheduleLocked) {
      audioEngine.playNotification();
      return;
    }

    const clientY = typeof e.clientY === 'number' && !Number.isNaN(e.clientY) ? e.clientY : 0;
    const targetEl = (e.currentTarget || e.target) as HTMLElement;
    const columnRect = targetEl?.getBoundingClientRect ? targetEl.getBoundingClientRect() : { top: 0 };
    const colTop = typeof columnRect?.top === 'number' && !Number.isNaN(columnRect.top) ? columnRect.top : 0;
    const relativeY = Math.max(0, clientY - colTop);
    const effectiveHourHeight = hourHeight > 0 ? hourHeight : TIMELINE_HOUR_HEIGHT_PX;
    const minutesFromStart = (relativeY / effectiveHourHeight) * 60;
    const snappedMinutes = snapToInterval(Number.isNaN(minutesFromStart) ? 0 : minutesFromStart);
    const startTotalMinutes = startHour * 60 + snappedMinutes;

    const duration = task?.estimatedMinutes || 30;
    const endTotalMinutes = startTotalMinutes + duration;

    const scheduledStart = minutesToTimeStr(startTotalMinutes);
    const scheduledEnd = minutesToTimeStr(endTotalMinutes);

    audioEngine.playMagneticSnap();

    updateTask(taskId, {
      plannedDate: targetDate,
      scheduledStart,
      scheduledEnd,
      isSomeday: false,
    });

    setDraggingTaskId(null);
    setIsMobileShelfOpen(false);
  };

  // Resize duration handle (previews locally, single commit on release, F24)
  const handleResizePointerDown = (
    e: React.PointerEvent,
    task: Task,
    edge: 'top' | 'bottom',
    _targetDate: string
  ) => {
    e.stopPropagation();
    e.preventDefault();

    if (task.scheduleLocked) return;

    const startMinutes = parseTimeToMinutes(task.scheduledStart) ?? startHour * 60;
    const currentEnd = parseTimeToMinutes(task.scheduledEnd) ?? startMinutes + (task.estimatedMinutes || 30);
    const initialDuration = Math.max(15, currentEnd - startMinutes);
    const initialY = e.clientY;

    let latestPatch: { scheduledStart?: string; scheduledEnd?: string } | null = null;

    const onPointerMove = (moveEv: PointerEvent) => {
      const deltaY = moveEv.clientY - initialY;
      const deltaMinutes = (deltaY / hourHeight) * 60;

      if (edge === 'bottom') {
        const rawNewDuration = initialDuration + deltaMinutes;
        const snappedNewDuration = Math.max(15, Math.round(rawNewDuration / snapInterval) * snapInterval);
        const newEndTotal = startMinutes + snappedNewDuration;
        latestPatch = {
          scheduledEnd: minutesToTimeStr(newEndTotal),
        };
      } else {
        const rawNewStart = startMinutes + deltaMinutes;
        const snappedNewStart = Math.min(
          currentEnd - 15,
          Math.max(startHour * 60, Math.round(rawNewStart / snapInterval) * snapInterval)
        );
        latestPatch = {
          scheduledStart: minutesToTimeStr(snappedNewStart),
        };
      }

      setResizePreview({
        taskId: task.id,
        ...latestPatch,
      });
    };

    const onPointerUp = () => {
      audioEngine.playMagneticSnap();
      setResizePreview(null);
      if (latestPatch) {
        updateTask(task.id, latestPatch);
      }
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Date step helpers
  const handlePrev = () => {
    const d = new Date(activeDateStr + 'T00:00:00');
    const step = viewSpan === '1-day' ? 1 : viewSpan === '3-day' ? 3 : 7;
    d.setDate(d.getDate() - step);
    updateActiveDate(formatLocalDate(d));
  };

  const handleNext = () => {
    const d = new Date(activeDateStr + 'T00:00:00');
    const step = viewSpan === '1-day' ? 1 : viewSpan === '3-day' ? 3 : 7;
    d.setDate(d.getDate() + step);
    updateActiveDate(formatLocalDate(d));
  };

  const handleToday = () => {
    updateActiveDate(todayStr);
  };

  return (
    <div
      className="flex flex-col h-full bg-[var(--bg-main)] select-none animate-fadeIn"
      data-testid="calendar-time-grid"
    >
      {/* Top Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:px-5 border-b border-[var(--border-color)] bg-[var(--bg-surface-l1)]">
        {/* Date Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleToday}
            className="px-3 py-1 text-xs font-semibold rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-l2)] hover:border-[var(--color-brand)] transition enabled:active:scale-[0.96] min-h-[36px]"
          >
            Today
          </button>
          <div className="flex items-center gap-0.5">
            <button
              onClick={handlePrev}
              aria-label="Previous Day"
              className="p-1.5 rounded-lg hover:bg-[var(--bg-surface-l2)] text-[var(--text-secondary)] min-h-[36px] min-w-[36px] flex items-center justify-center enabled:active:scale-[0.96]"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={handleNext}
              aria-label="Next Day"
              className="p-1.5 rounded-lg hover:bg-[var(--bg-surface-l2)] text-[var(--text-secondary)] min-h-[36px] min-w-[36px] flex items-center justify-center enabled:active:scale-[0.96]"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <span className="font-bold text-sm tracking-tight ml-1 font-mono tabular-nums">
            {dates[0]}
            {dates.length > 1 && ` – ${dates[dates.length - 1]}`}
          </span>
        </div>

        {/* View Span, Snap Interval, Mobile Backlog Toggle & Zoom */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Mobile Backlog Toggle Button (F20) */}
          <button
            onClick={() => setIsMobileShelfOpen((v) => !v)}
            className="md:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-l2)] text-xs font-medium min-h-[36px]"
            aria-label="Toggle Staged Tasks"
          >
            <ListTodo size={14} className="text-[var(--color-brand)]" />
            <span>Staged ({unscheduledTasks.length})</span>
          </button>

          {/* Magnetic snap toggle */}
          <div className="flex items-center rounded-lg border border-[var(--border-color)] p-0.5 bg-[var(--bg-surface-l2)] text-xs">
            <button
              onClick={() => setSnapInterval(15)}
              className={`px-2 py-1 rounded min-h-[32px] ${
                snapInterval === 15 ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--text-secondary)]'
              }`}
            >
              15m snap
            </button>
            <button
              onClick={() => setSnapInterval(30)}
              className={`px-2 py-1 rounded min-h-[32px] ${
                snapInterval === 30 ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--text-secondary)]'
              }`}
            >
              30m snap
            </button>
          </div>

          {/* View Span Switcher */}
          <div className="flex items-center rounded-lg border border-[var(--border-color)] p-0.5 bg-[var(--bg-surface-l2)] text-xs">
            {(['1-day', '3-day', '7-day'] as GridViewSpan[]).map((span) => (
              <button
                key={span}
                onClick={() => setViewSpan(span)}
                className={`px-2.5 py-1 rounded capitalize font-medium min-h-[32px] ${
                  viewSpan === span
                    ? 'bg-[var(--color-brand)] text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {span}
              </button>
            ))}
          </div>

          {/* Zoom scaling controls */}
          <div className="flex items-center gap-1 border border-[var(--border-color)] rounded-lg p-0.5 bg-[var(--bg-surface-l2)]">
            <button
              onClick={() => handleZoom(-0.25)}
              aria-label="Zoom Out"
              className="p-1.5 hover:bg-[var(--bg-surface-l3)] rounded min-h-[32px] min-w-[32px] flex items-center justify-center"
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-[11px] font-mono px-1">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              onClick={() => handleZoom(0.25)}
              aria-label="Zoom In"
              className="p-1.5 hover:bg-[var(--bg-surface-l3)] rounded min-h-[32px] min-w-[32px] flex items-center justify-center"
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Deficit Alert Warning Banner */}
      {deficitBudget.isOverallocated && (
        <div
          className="flex items-center gap-2 px-4 py-2 bg-amber-500/15 border-b border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs font-medium"
          data-testid="deficit-warning-banner"
        >
          <AlertTriangle size={15} className="flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <span>{formatDeficitWarning(deficitBudget.deficitMinutes)}</span>
        </div>
      )}

      {/* Main Grid Body: Staged Brain Dump Shelf + Time-Block Canvas */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* Mobile Backdrop when shelf open (F20) */}
        {isMobileShelfOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-30 md:hidden"
            onClick={() => setIsMobileShelfOpen(false)}
          />
        )}

        {/* Left Staged Brain Dump Shelf (Backlog) - Collapsible on mobile (F20) */}
        <div
          className={`border-r border-[var(--border-color)] bg-[var(--bg-surface-l1)] flex flex-col min-h-0 ${
            isMobileShelfOpen
              ? 'fixed inset-y-0 left-0 z-40 w-72 shadow-2xl flex md:relative md:w-64 md:shadow-none'
              : 'hidden md:flex w-64'
          }`}
          data-testid="brain-dump-shelf"
        >
          <div className="px-3 py-2 border-b border-[var(--border-color)] text-xs font-semibold text-[var(--text-secondary)] flex items-center justify-between">
            <span>Staged Tasks ({unscheduledTasks.length})</span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[var(--text-muted)] hidden sm:inline">Drag into calendar</span>
              {isMobileShelfOpen && (
                <button
                  onClick={() => setIsMobileShelfOpen(false)}
                  className="md:hidden p-1 rounded hover:bg-[var(--bg-surface-l2)]"
                  aria-label="Close Staged Shelf"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {unscheduledTasks.length === 0 ? (
              <div className="p-4 text-center text-xs text-[var(--text-muted)]">
                No unscheduled tasks. All clear!
              </div>
            ) : (
              unscheduledTasks.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', task.id);
                    setDraggingTaskId(task.id);
                  }}
                  onClick={() => onSelectTask?.(task.id)}
                  className="p-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-l2)] hover:border-[var(--color-brand)] cursor-grab active:cursor-grabbing text-xs transition-shadow shadow-sm hover:shadow"
                  data-testid={`shelf-task-${task.id}`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-medium line-clamp-2 leading-tight">{task.title}</span>
                    <GripVertical size={13} className="text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-[10px] text-[var(--text-secondary)] font-mono">
                    <Clock size={11} />
                    <span>{task.estimatedMinutes || 30}m</span>
                    {task.priority && (
                      <span className="uppercase font-bold text-amber-600 dark:text-amber-400">
                        {task.priority}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Time-Block Scrollable Canvas */}
        <div ref={gridScrollRef} className="flex-1 overflow-y-auto flex flex-col relative">
          {/* Header Row for Day Names */}
          <div className="sticky top-0 z-20 flex border-b border-[var(--border-color)] bg-[var(--bg-surface-l1)] shadow-xs">
            {/* Hour labels gutter spacer */}
            <div className="w-14 flex-shrink-0 border-r border-[var(--border-color)]" />
            {dates.map((dateStr) => {
              const d = new Date(dateStr + 'T00:00:00');
              const isToday = dateStr === todayStr;
              return (
                <div
                  key={dateStr}
                  className={`flex-1 py-2 px-3 text-center border-r border-[var(--border-color)] last:border-r-0 ${
                    isToday ? 'bg-[var(--color-brand)]/5 font-bold' : ''
                  }`}
                >
                  <div className="text-[11px] font-semibold uppercase text-[var(--text-secondary)]">
                    {d.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div className={`text-base font-bold ${isToday ? 'text-[var(--color-brand)]' : ''}`}>
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time Canvas Body */}
          <div className="flex flex-1 relative" style={{ height: `${gridTotalHeight}px` }}>
            {/* Left hour labels gutter */}
            <div className="w-14 flex-shrink-0 relative border-r border-[var(--border-color)] bg-[var(--bg-surface-l1)]/50">
              <CircadianEnergyCurve
                tasks={scheduledTasksByDate.get(activeDateStr) || []}
                startHour={startHour}
                endHour={endHour}
                hourHeight={hourHeight}
                onRescheduleTask={(taskId, newStart) => {
                  updateTask(taskId, { scheduledStart: newStart });
                  audioEngine.playMagneticSnap();
                }}
                className="absolute inset-0 z-0 pointer-events-none"
              />
              {Array.from({ length: totalHours }).map((_, i) => {
                const hour = startHour + i;
                const timeLabel = `${hour.toString().padStart(2, '0')}:00`;
                return (
                  <div
                    key={hour}
                    className="absolute w-full pr-2 text-right text-[10px] font-mono text-[var(--text-muted)] -translate-y-2 z-10"
                    style={{ top: `${i * hourHeight}px` }}
                  >
                    {timeLabel}
                  </div>
                );
              })}
            </div>

            {/* Columns per date */}
            {dates.map((dateStr) => {
              const scheduled = scheduledTasksByDate.get(dateStr) || [];
              const events = eventsByDate.get(dateStr) || [];

              return (
                <div
                  key={dateStr}
                  onDragOver={(e) => handleDragOver(e, dateStr)}
                  onDragLeave={() => setDragOverGhost(null)}
                  onDrop={(e) => handleDrop(e, dateStr)}
                  className="flex-1 relative border-r border-[var(--border-color)] last:border-r-0"
                  data-testid={`calendar-column-${dateStr}`}
                >
                  {/* 15-minute magnetic ghost bounding box preview on dragOver */}
                  {dragOverGhost && dragOverGhost.dateStr === dateStr && (
                    <div
                      className="dragOverGhost absolute left-1.5 right-1.5 rounded-lg border-2 border-dashed border-[var(--color-brand)] bg-[var(--color-brand)]/15 pointer-events-none z-20 flex items-center px-2 text-xs font-mono font-bold text-[var(--color-brand)] transition-all duration-75 shadow-xs"
                      style={{ top: `${dragOverGhost.top}px`, height: `${dragOverGhost.height}px` }}
                    >
                      <span>{dragOverGhost.timeStr}</span>
                    </div>
                  )}
                  {/* Horizontal grid lines */}
                  {Array.from({ length: totalHours }).map((_, i) => (
                    <div
                      key={i}
                      className="absolute w-full border-t border-[var(--border-color)]/30"
                      style={{ top: `${i * hourHeight}px` }}
                    />
                  ))}

                  {/* 30-min subtle dashed lines */}
                  {Array.from({ length: totalHours }).map((_, i) => (
                    <div
                      key={`half-${i}`}
                      className="absolute w-full border-t border-dashed border-[var(--border-color)]/15"
                      style={{ top: `${i * hourHeight + hourHeight / 2}px` }}
                    />
                  ))}

                  {/* Render external calendar events */}
                  {events.map((ev) => {
                    const s = parseTimeToMinutes(ev.startTime) ?? startHour * 60;
                    const e = parseTimeToMinutes(ev.endTime) ?? s + 60;
                    const top = ((s - startHour * 60) / 60) * hourHeight;
                    const height = Math.max(20, ((e - s) / 60) * hourHeight);

                    return (
                      <div
                        key={ev.id}
                        className="absolute left-1 right-1 rounded px-2 py-1 bg-stone-500/15 border border-stone-500/30 text-stone-700 dark:text-stone-300 pointer-events-none text-[11px] overflow-hidden z-10"
                        style={{ top: `${top}px`, height: `${height}px` }}
                      >
                        <div className="font-semibold truncate">{ev.title}</div>
                        <div className="font-mono text-[9px] opacity-75">
                          {ev.startTime} – {ev.endTime}
                        </div>
                      </div>
                    );
                  })}

                  {/* Render scheduled task blocks */}
                  {scheduled.map((task) => {
                    // Check if this block has a local drag-resize preview (F24)
                    const isPreviewing = resizePreview && resizePreview.taskId === task.id;
                    const activeStart = (isPreviewing && resizePreview.scheduledStart) || task.scheduledStart;
                    const activeEnd = (isPreviewing && resizePreview.scheduledEnd) || task.scheduledEnd;

                    const s = parseTimeToMinutes(activeStart) ?? startHour * 60;
                    const e =
                      parseTimeToMinutes(activeEnd) ??
                      s + (task.estimatedMinutes || 30);
                    const dur = Math.max(15, e - s);
                    const top = ((s - startHour * 60) / 60) * hourHeight;
                    const height = Math.max(24, (dur / 60) * hourHeight);

                    return (
                      <div
                        key={`${task.id}-${activeStart || ''}-${activeEnd || ''}`}
                        onClick={() => onSelectTask?.(task.id)}
                        className={`absolute left-1.5 right-1.5 rounded-lg border px-2 py-1 shadow-sm transition-all z-10 group overflow-hidden cursor-pointer ${
                          task.status === 'done'
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-900 dark:text-emerald-200 opacity-75'
                            : isPreviewing
                            ? 'bg-[var(--color-brand)]/20 border-dashed border-[var(--color-brand)]'
                            : 'bg-[var(--bg-surface-l2)] border-[var(--color-brand)] text-[var(--text-primary)] hover:shadow-md'
                        }`}
                        style={{ top: `${top}px`, height: `${height}px` }}
                        data-testid={`grid-block-${task.id}`}
                      >
                        {/* Top resize handle */}
                        <div
                          data-testid={`resize-top-${task.id}`}
                          onPointerDown={(ev) => handleResizePointerDown(ev, task, 'top', dateStr)}
                          className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-[var(--color-brand)]/40 z-20"
                          title="Drag to resize start time"
                        />

                        {/* Block content */}
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-medium text-xs leading-tight truncate">
                            {task.title}
                          </span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {task.scheduleLocked && (
                              <Lock size={10} className="text-amber-500" />
                            )}
                            {onStartFocus && task.status !== 'done' && (
                              <button
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  onStartFocus(task.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-[var(--color-brand)]"
                                title="Start Focus Session"
                              >
                                <Maximize2 size={11} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Monospace tabular time indicator */}
                        <div className="font-mono text-[10px] text-[var(--text-secondary)] mt-0.5 tabular-nums truncate">
                          {activeStart} – {minutesToTimeStr(e)} ({dur}m)
                        </div>

                        {/* Bottom resize handle */}
                        <div
                          data-testid={`resize-bottom-${task.id}`}
                          onPointerDown={(ev) => handleResizePointerDown(ev, task, 'bottom', dateStr)}
                          className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-[var(--color-brand)]/40 z-20"
                          title="Drag to resize duration"
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
