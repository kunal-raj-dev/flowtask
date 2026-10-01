import React, { useState, useEffect } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import type { Task } from '../../types/task';
import { formatLocalDate } from '../../utils/nlpParser';
import {
  parseTimeToMinutes,
  minutesToTimeStr,
  calculateCapacityMetrics,
  calculateBlockPosition,
  TIMELINE_START_HOUR,
  TIMELINE_END_HOUR,
  TIMELINE_HOUR_HEIGHT_PX,
} from '../../utils/timelineUtils';
import {
  Clock,
  CheckCircle2,
  Timer,
  Plus,
  AlertCircle,
  Calendar,
  Check,
} from 'lucide-react';

interface TimelineViewProps {
  onSelectTask: (taskId: string) => void;
  onStartFocus: (taskId: string) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  onSelectTask,
  onStartFocus,
}) => {
  const { tasks, updateTask, toggleTaskStatus, projects, addTask } = useTaskContext();

  const [currentTimeMinutes, setCurrentTimeMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  const [quickAddHour, setQuickAddHour] = useState<number | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');

  // Update current time indicator every minute
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTimeMinutes(now.getHours() * 60 + now.getMinutes());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = formatLocalDate(new Date());

  // Filter tasks belonging to Today
  const todayTasks = tasks.filter((t) => {
    const isDueToday = t.dueDate === todayStr;
    const isPinned = t.isPinnedToday;
    return isDueToday || isPinned;
  });

  const START_HOUR = TIMELINE_START_HOUR;
  const END_HOUR = TIMELINE_END_HOUR;
  const TOTAL_HOURS = END_HOUR - START_HOUR;
  const HOUR_HEIGHT_PX = TIMELINE_HOUR_HEIGHT_PX;

  // Categorize scheduled vs unscheduled
  const scheduledTasks: { task: Task; startMin: number; duration: number }[] = [];
  const unscheduledTasks: Task[] = [];

  todayTasks.forEach((task) => {
    const effectiveTimeStr = task.scheduledStart || task.dueTime;
    const startMin = parseTimeToMinutes(effectiveTimeStr);
    const duration = task.estimatedMinutes || 30;

    if (startMin !== null && startMin >= START_HOUR * 60 && startMin < END_HOUR * 60) {
      scheduledTasks.push({ task, startMin, duration });
    } else {
      unscheduledTasks.push(task);
    }
  });

  // Calculate Capacity using pure utility
  const targetWorkCapacityHours = 6.0;
  const {
    totalPlannedHours,
    capacityPercent,
  } = calculateCapacityMetrics(todayTasks, targetWorkCapacityHours);

  const handleQuickAdd = (hour: number) => {
    if (!quickAddTitle.trim()) {
      setQuickAddHour(null);
      return;
    }
    const timeStr = `${hour.toString().padStart(2, '0')}:00`;
    addTask(quickAddTitle.trim(), {
      dueDate: todayStr,
      dueTime: timeStr,
      scheduledStart: timeStr,
      estimatedMinutes: 45,
    });
    setQuickAddTitle('');
    setQuickAddHour(null);
  };

  const handleScheduleUnscheduled = (task: Task, hour: number) => {
    const timeStr = `${hour.toString().padStart(2, '0')}:00`;
    updateTask(task.id, {
      scheduledStart: timeStr,
      dueTime: timeStr,
    });
  };

  const handleUnschedule = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    updateTask(task.id, {
      scheduledStart: undefined,
      dueTime: undefined,
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 space-y-6">
      {/* Executive Workload Capacity Gauge Header */}
      <div className="p-4 sm:p-5 rounded-3xl bg-[var(--bg-surface-l1)]/90 border border-stone-200/80 dark:border-white/10 shadow-card card-surface backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Clock size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[var(--text-primary)]">Day Timeline & Time-blocking</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                  {scheduledTasks.length} scheduled
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Protect your calendar by allocating realistic time blocks.
              </p>
            </div>
          </div>

          {/* Workload Health Bar */}
          <div className="sm:text-right min-w-[220px]">
            <div className="flex items-center justify-between sm:justify-end gap-2 text-xs font-semibold text-[var(--text-primary)] font-mono">
              <span>{totalPlannedHours}h planned</span>
              <span className="text-[var(--text-muted)]">/ {targetWorkCapacityHours}h target</span>
            </div>

            <div className="w-full bg-stone-200 dark:bg-stone-800 h-2 rounded-full overflow-hidden mt-1.5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  capacityPercent > 100
                    ? 'bg-rose-500'
                    : capacityPercent > 75
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${capacityPercent}%` }}
              />
            </div>

            <div className="text-[10px] font-medium text-[var(--text-secondary)] mt-1 flex items-center justify-between sm:justify-end gap-1">
              {capacityPercent > 100 ? (
                <span className="text-rose-500 flex items-center gap-1 font-semibold">
                  <AlertCircle size={10} /> Overbooked ({capacityPercent}%)
                </span>
              ) : capacityPercent > 75 ? (
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

      {/* Main Grid: Unscheduled Sidebar + Hourly Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Unscheduled Tasks Tray (Desktop: 4 cols) */}
        <div className="lg:col-span-4 bg-[var(--bg-surface-l1)] border border-stone-200/80 dark:border-white/10 rounded-3xl p-4 card-surface space-y-3">
          <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-2.5">
            <div className="flex items-center gap-1.5">
              <Calendar size={14} className="text-amber-500" />
              <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                Unscheduled ({unscheduledTasks.length})
              </h4>
            </div>
            <span className="text-[10px] text-[var(--text-muted)]">Click slot to assign</span>
          </div>

          {unscheduledTasks.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-muted)] text-xs">
              <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-500/60" />
              All today&apos;s tasks are scheduled on your timeline!
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {unscheduledTasks.map((task) => {
                const project = projects.find((p) => p.id === task.projectId);
                return (
                  <div
                    key={task.id}
                    onClick={() => onSelectTask(task.id)}
                    className="group p-3 rounded-2xl bg-white dark:bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] hover:border-amber-500/40 transition-all card-surface cursor-pointer text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-[var(--text-primary)] truncate">
                          {task.title}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-[var(--text-muted)]">
                          {project && project.id !== 'inbox' && (
                            <span className="flex items-center gap-1">
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: project.color }}
                              />
                              {project.name}
                            </span>
                          )}
                          <span>~{task.estimatedMinutes || 30}m</span>
                          {task.priority !== 'p4' && (
                            <span className="uppercase font-bold text-amber-600 dark:text-amber-400">
                              {task.priority}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quick Assign Dropdown or Button */}
                      <select
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const h = parseInt(e.target.value, 10);
                          if (!isNaN(h)) handleScheduleUnscheduled(task, h);
                        }}
                        defaultValue=""
                        className="text-[10px] bg-[var(--bg-surface-l1)] text-[var(--text-secondary)] border border-[var(--border-hairline)] rounded-lg px-2 py-1 outline-none cursor-pointer hover:border-amber-500"
                      >
                        <option value="" disabled>
                          + Time
                        </option>
                        {Array.from({ length: TOTAL_HOURS }, (_, i) => START_HOUR + i).map((h) => (
                          <option key={h} value={h}>
                            {h.toString().padStart(2, '0')}:00
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Hourly Timeline (Desktop: 8 cols) */}
        <div className="lg:col-span-8 bg-[var(--bg-surface-l1)] border border-stone-200/80 dark:border-white/10 rounded-3xl p-4 sm:p-6 card-surface overflow-hidden relative">
          <div className="relative" style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT_PX}px` }}>
            {/* Hour Rows */}
            {Array.from({ length: TOTAL_HOURS }, (_, i) => {
              const hour = START_HOUR + i;
              const timeLabel = `${hour.toString().padStart(2, '0')}:00`;
              return (
                <div
                  key={hour}
                  className="absolute left-0 right-0 border-t border-stone-200/60 dark:border-white/[0.06] flex items-start group"
                  style={{ top: `${i * HOUR_HEIGHT_PX}px`, height: `${HOUR_HEIGHT_PX}px` }}
                >
                  {/* Time Label on Left Rail */}
                  <span className="w-14 text-[11px] font-mono font-medium text-[var(--text-muted)] -mt-2.5 select-none shrink-0">
                    {timeLabel}
                  </span>

                  {/* Empty Slot Interactive Area */}
                  <div className="flex-1 h-full relative pl-3">
                    {/* Hover "+ Add block" trigger */}
                    <button
                      onClick={() => setQuickAddHour(hour)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-1.5 left-4 flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-amber-500 hover:bg-amber-500/10 px-2 py-1 rounded-md"
                    >
                      <Plus size={11} />
                      Schedule at {timeLabel}
                    </button>

                    {/* Inline Quick Add form */}
                    {quickAddHour === hour && (
                      <div className="absolute top-1 left-2 right-2 z-30 p-2 rounded-xl bg-white dark:bg-[var(--bg-surface-l2)] border border-amber-500 shadow-lg animate-scale-up">
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleQuickAdd(hour);
                          }}
                          className="flex items-center gap-2"
                        >
                          <input
                            type="text"
                            autoFocus
                            placeholder={`Task at ${timeLabel}...`}
                            value={quickAddTitle}
                            onChange={(e) => setQuickAddTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') setQuickAddHour(null);
                            }}
                            className="flex-1 text-xs px-2 py-1 rounded-lg bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] text-[var(--text-primary)] outline-none"
                          />
                          <button
                            type="submit"
                            className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-500 text-white hover:bg-amber-600"
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

            {/* Current Time Indicator Red Pulsing Line */}
            {currentTimeMinutes >= START_HOUR * 60 && currentTimeMinutes <= END_HOUR * 60 && (
              <div
                className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                style={{
                  top: `${((currentTimeMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT_PX}px`,
                }}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-4 ring-rose-500/20 -ml-1 shrink-0 animate-pulse" />
                <div className="flex-1 h-[2px] bg-rose-500/80 shadow-xs" />
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-500 text-white shrink-0 shadow-xs">
                  {minutesToTimeStr(currentTimeMinutes)}
                </span>
              </div>
            )}

            {/* Scheduled Task Blocks */}
            {scheduledTasks.map(({ task, startMin, duration }) => {
              const { topPx, heightPx } = calculateBlockPosition(startMin, duration, START_HOUR, HOUR_HEIGHT_PX);
              const project = projects.find((p) => p.id === task.projectId);
              const isDone = task.status === 'done';

              return (
                <div
                  key={task.id}
                  onClick={() => onSelectTask(task.id)}
                  className={`absolute left-16 right-2 rounded-2xl p-2.5 border transition-all duration-150 cursor-pointer shadow-subtle hover:shadow-card hover:-translate-y-[1px] flex items-center justify-between gap-3 overflow-hidden ${
                    isDone
                      ? 'bg-stone-100/60 dark:bg-white/[0.03] border-[var(--border-hairline)] opacity-60'
                      : task.isPinnedToday
                      ? 'bg-gradient-to-r from-amber-500/[0.12] via-orange-400/[0.06] to-indigo-500/[0.04] border-amber-400/50 dark:border-amber-500/40 shadow-glow-amber'
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
                        toggleTaskStatus(task.id);
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
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-xs font-semibold truncate ${
                            isDone
                              ? 'line-through text-[var(--text-muted)]'
                              : 'text-[var(--text-primary)]'
                          }`}
                        >
                          {task.title}
                        </span>
                        {task.isPinnedToday && !isDone && (
                          <span className="text-[9px] font-bold text-amber-500 shrink-0">
                            ★ Focus
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
                    {!isDone && (
                      <button
                        onClick={() => onStartFocus(task.id)}
                        title="Start Focus Timer"
                        className="p-1 rounded-lg text-stone-400 hover:text-indigo-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                      >
                        <Timer size={13} />
                      </button>
                    )}
                    <button
                      onClick={(e) => handleUnschedule(task, e)}
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
      </div>
    </div>
  );
};
