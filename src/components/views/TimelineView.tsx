import React, { useState, useEffect } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import type { Task } from '../../types/task';
import { formatLocalDate } from '../../utils/nlpParser';
import {
  parseTimeToMinutes,
  minutesToTimeStr,
  calculateBlockPosition,
  classifyTaskCognitiveIntensity,
  analyzeCognitiveTopology,
  findOverlappingCalendarEvent,
  findNextFreeGap,
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
  RefreshCw,
  X,
  ExternalLink,
  Sparkles,
  Zap,
} from 'lucide-react';

interface TimelineViewProps {
  onSelectTask: (taskId: string) => void;
  onStartFocus: (taskId: string) => void;
  onStartSprint?: (taskId: string) => void;
  onOpenStudySession?: () => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  onSelectTask,
  onStartFocus,
  onStartSprint,
  onOpenStudySession,
}) => {
  const {
    tasks,
    updateTask,
    toggleTaskStatus,
    projects,
    addTask,
    calendarEvents,
    calendarIcsUrl,
    setCalendarIcsUrl,
    refreshCalendarEvents,
  } = useTaskContext();

  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [icsUrlInput, setIcsUrlInput] = useState(calendarIcsUrl);
  const [isRefreshingFeed, setIsRefreshingFeed] = useState(false);

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

  // Calculate Meeting Minutes from Calendar events
  const meetingMinutes = calendarEvents.reduce((acc, ev) => {
    if (ev.isAllDay) return acc;
    const startMin = parseTimeToMinutes(ev.startTime);
    const endMin = parseTimeToMinutes(ev.endTime);
    if (startMin === null) return acc;
    const duration = endMin ? Math.max(15, endMin - startMin) : 30;
    return acc + duration;
  }, 0);
  const totalMeetingHours = (meetingMinutes / 60).toFixed(1);

  // Calculate Capacity
  const targetWorkCapacityHours = 6.0;

  const taskMinutes = todayTasks.reduce((acc, t) => acc + (t.estimatedMinutes || 30), 0);
  const totalCombinedMinutes = taskMinutes + meetingMinutes;
  const combinedPlannedHours = (totalCombinedMinutes / 60).toFixed(1);
  const combinedCapacityPercent = Math.min(
    150,
    Math.round((totalCombinedMinutes / (targetWorkCapacityHours * 60)) * 100)
  );

  const cognitiveTopology = analyzeCognitiveTopology(todayTasks, calendarEvents);

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
                  {scheduledTasks.length} scheduled
                </span>
                {calendarIcsUrl && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                    {calendarEvents.length} calendar events
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
                onClick={() => {
                  setIcsUrlInput(calendarIcsUrl);
                  setIsCalendarModalOpen(true);
                }}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition-all ${
                  calendarIcsUrl
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                    : 'bg-stone-100 dark:bg-stone-800 text-[var(--text-secondary)] hover:text-amber-500 border-[var(--border-hairline)]'
                }`}
              >
                <Calendar size={13} />
                <span>{calendarIcsUrl ? 'Calendar Connected' : 'Sync Calendar (.ics)'}</span>
              </button>
              {calendarIcsUrl && (
                <button
                  onClick={async () => {
                    setIsRefreshingFeed(true);
                    await refreshCalendarEvents();
                    setTimeout(() => setIsRefreshingFeed(false), 600);
                  }}
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


      {/* Main Grid: Unscheduled Sidebar + Hourly Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Unscheduled Tasks Tray (Desktop: 4 cols) */}
        <div className="lg:col-span-4 bg-[var(--bg-surface-l1)] border border-stone-200/80 dark:border-white/10 rounded-xl p-4 card-surface space-y-3">
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
                    className="group p-3 rounded-lg bg-white dark:bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] hover:border-amber-500/40 transition-all card-surface cursor-pointer text-xs"
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
                          {task.sessionMetadata?.isSession && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/25">
                              🎯 Session {task.sessionMetadata.sessionNumber || ''}
                            </span>
                          )}
                          {task.sessionMetadata?.pacingMinutesPerQuestion && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                              ⚡ {task.sessionMetadata.pacingMinutesPerQuestion}m/Q
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
                      <div className="absolute top-1 left-2 right-2 z-30 p-2 rounded-lg bg-white dark:bg-[var(--bg-surface-l2)] border border-[var(--color-brand)] shadow-lg animate-scale-up">
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

            {/* Calendar Meeting Overlay Blocks */}
            {calendarEvents
              .filter((ev) => !ev.isAllDay)
              .map((ev) => {
                const startMin = parseTimeToMinutes(ev.startTime);
                const endMin = parseTimeToMinutes(ev.endTime);
                if (startMin === null) return null;
                const duration = endMin ? Math.max(15, endMin - startMin) : 30;

                if (startMin < START_HOUR * 60 || startMin >= END_HOUR * 60) return null;

                const { topPx, heightPx } = calculateBlockPosition(
                  startMin,
                  duration,
                  START_HOUR,
                  HOUR_HEIGHT_PX
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
              const { topPx, heightPx } = calculateBlockPosition(startMin, duration, START_HOUR, HOUR_HEIGHT_PX);
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
                            const newMin = Math.max(START_HOUR * 60, startMin - 15);
                            const timeStr = minutesToTimeStr(newMin);
                            updateTask(task.id, { scheduledStart: timeStr, dueTime: timeStr });
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
                            const newMin = Math.min((END_HOUR * 60) - duration, startMin + 15);
                            const timeStr = minutesToTimeStr(newMin);
                            updateTask(task.id, { scheduledStart: timeStr, dueTime: timeStr });
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
                            updateTask(task.id, { scheduledStart: timeStr, dueTime: timeStr });
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
                        onClick={() => onStartFocus(task.id)}
                        title="Start Focus Timer"
                        className="p-1 rounded-lg text-stone-400 hover:text-indigo-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                      >
                        <Timer size={13} />
                      </button>
                    ) : null}
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

      {/* External Calendar Overlay Modal */}
      {isCalendarModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setIsCalendarModalOpen(false)}
        >
          <div
            className="bg-[var(--bg-surface-l1)] border border-stone-200/90 dark:border-white/10 rounded-xl p-6 max-w-lg w-full shadow-modal space-y-4 animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <Calendar size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)]">
                    Private Calendar Overlay
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Sync via iCal / Webcal (.ics link)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCalendarModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-[var(--text-primary)] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Overlay your work or personal meetings alongside your tasks. This connection is{' '}
                <strong className="text-[var(--text-primary)]">read-only and 100% private</strong>—no OAuth permissions required, and events never leave your browser.
              </p>

              <div>
                <label htmlFor="calendar-ics-url-input" className="block text-xs font-semibold text-[var(--text-primary)] mb-1">
                  iCal / .ics Feed URL
                </label>
                <input
                  type="url"
                  id="calendar-ics-url-input"
                  name="calendarIcsUrl"
                  aria-label="iCal or .ics feed URL"
                  placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                  value={icsUrlInput}
                  onChange={(e) => setIcsUrlInput(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] focus:border-[var(--color-brand)] text-[var(--text-primary)] outline-none font-mono"
                />
              </div>

              {/* Instructions Callout */}
              <div className="p-3 rounded-lg bg-amber-500/[0.06] border border-amber-500/15 text-[11px] text-[var(--text-secondary)] space-y-1.5">
                <div className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                  <ExternalLink size={12} />
                  Where to find your private link:
                </div>
                <ul className="list-disc pl-4 space-y-1 text-stone-600 dark:text-stone-300">
                  <li><strong>Google Calendar:</strong> Settings → Click your calendar → scroll to &quot;Secret address in iCal format&quot;.</li>
                  <li><strong>Outlook / Office 365:</strong> Settings → Calendar → Shared calendars → Publish a calendar → copy ICS.</li>
                  <li><strong>Apple Calendar:</strong> Share Calendar → toggle Public/Webcal → copy URL.</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[var(--border-hairline)]">
              {calendarIcsUrl ? (
                <button
                  type="button"
                  onClick={() => {
                    setCalendarIcsUrl('');
                    setIcsUrlInput('');
                    setIsCalendarModalOpen(false);
                  }}
                  className="text-xs text-rose-500 hover:text-rose-600 font-semibold px-2 py-1"
                >
                  Disconnect Feed
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCalendarModalOpen(false)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const trimmed = icsUrlInput.trim();
                    setCalendarIcsUrl(trimmed);
                    setIsCalendarModalOpen(false);
                    if (trimmed) {
                      await refreshCalendarEvents();
                    }
                  }}
                  className="text-xs font-bold px-4 py-1.5 rounded-lg bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white transition-colors shadow-sm"
                >
                  Save & Sync
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
