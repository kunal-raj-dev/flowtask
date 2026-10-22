import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTaskContext } from '../../../context/TaskContext';
import { useTodayStr } from '../../../hooks/useCurrentDate';
import { isFocusTask, isTodayTask, isSomedayTask, completedOn } from '../../../utils/taskSelectors';
import { parseTaskInput } from '../../../utils/nlpParser';
import { calculateDayPlanSummary } from '../../../utils/dayPlanSummary';
import { useTotalFocusedTodaySeconds } from '../../../hooks/useTotalFocusedTodaySeconds';
import { formatSecondsToHumanReadable } from '../../../utils/focusTimeFormat';
import {
  parseTimeToMinutes,
  classifyTaskCognitiveIntensity,
} from '../../../utils/timelineUtils';
import { WorkspaceTaskRow } from '../../tasks/WorkspaceTaskRow';
import { VirtualTaskList } from '../../tasks/VirtualTaskList';
import { TodayTimelineRail } from './TodayTimelineRail';
import { DailyPlanning } from '../../workflow/DailyPlanning';
import { Dialog } from '../../ui/Dialog';
import {
  Sun,
  Coffee,
  Moon,
  ChevronDown,
  Plus,
  ArrowRight,
  Compass,
  CheckCircle2,
  Sparkles,
  Archive,
  Target,
  SlidersHorizontal,
  CalendarDays,
} from 'lucide-react';
import type { Task, Priority } from '../../../types/task';

interface HorizonTodayViewProps {
  onSelectTask?: (id: string) => void;
  onStartFocus?: (id: string) => void;
  onStartSprint?: (id: string) => void;
  onSwitchToDashboard?: () => void;
  onCustomize?: () => void;
  introduction?: React.ReactNode;
}

export const HorizonTodayView: React.FC<HorizonTodayViewProps> = ({
  onSelectTask,
  onStartFocus,
  onStartSprint,
  onSwitchToDashboard,
  onCustomize,
  introduction,
}) => {
  const {
    tasks,
    calendarEvents = [],
    settings,
  } = useTaskContext();

  const today = useTodayStr();
  const focusedSeconds = useTotalFocusedTodaySeconds();
  const [planning, setPlanning] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const [timelineDrawer, setTimelineDrawer] = useState(false);
  const [wide, setWide] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const measure = () => setWide(element.clientWidth >= 1200);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [somedayOpen, setSomedayOpen] = useState(false);

  // Daily capacity summary
  const summary = calculateDayPlanSummary({
    date: today,
    todayStr: today,
    tasks,
    calendarEvents,
    settings,
    focusLogsSecondsToday: focusedSeconds,
  });

  const hours = (minutes: number) => `${Math.round(minutes / 6) / 10}h`;

  // Filter tasks
  const activeTodayTasks = useMemo(() => {
    return tasks.filter((t) => !t.deletedAt && !t.archivedAt && isTodayTask(t, today) && t.status !== 'done');
  }, [tasks, today]);

  // Top 3 Priorities: pinned to today, active, sorted by priority weight
  const topThreeTasks = useMemo(() => {
    const list = tasks.filter((t) => !t.deletedAt && !t.archivedAt && isFocusTask(t, today));
    const priorityWeight: Record<Priority, number> = { p1: 1, p2: 2, p3: 3, p4: 4 };
    return list.sort((a, b) => priorityWeight[a.priority] - priorityWeight[b.priority]).slice(0, 3);
  }, [tasks, today]);

  // Non-Top 3 today tasks
  const topThreeIds = useMemo(() => new Set(topThreeTasks.map((t) => t.id)), [topThreeTasks]);
  const daytimeCandidates = useMemo(() => {
    return activeTodayTasks.filter((t) => !topThreeIds.has(t.id));
  }, [activeTodayTasks, topThreeIds]);

  // Batches
  // 1. Morning Focus: scheduled < 12:00 or cognitive deep work
  const morningBatch = useMemo(() => {
    return daytimeCandidates.filter((t) => {
      const startMin = parseTimeToMinutes(t.scheduledStart);
      return (startMin !== null && startMin < 12 * 60) || classifyTaskCognitiveIntensity(t) === 'deep';
    });
  }, [daytimeCandidates]);

  // 2. This Evening: isEvening flag or scheduled >= 18:00
  const eveningBatch = useMemo(() => {
    return daytimeCandidates.filter((t) => {
      if (morningBatch.some((m) => m.id === t.id)) return false;
      const startMin = parseTimeToMinutes(t.scheduledStart);
      return Boolean(t.isEvening || (startMin !== null && startMin >= 18 * 60));
    });
  }, [daytimeCandidates, morningBatch]);

  // 3. Daytime Flow: remainder of daytime tasks
  const daytimeFlowBatch = useMemo(() => {
    const morningIds = new Set(morningBatch.map((m) => m.id));
    const eveningIds = new Set(eveningBatch.map((e) => e.id));
    return daytimeCandidates.filter((t) => !morningIds.has(t.id) && !eveningIds.has(t.id) && !t.isSomeday);
  }, [daytimeCandidates, morningBatch, eveningBatch]);

  // 4. Someday / Backlog tasks
  const somedayBatch = useMemo(() => {
    return tasks.filter((t) => !t.deletedAt && !t.archivedAt && isSomedayTask(t) && t.status !== 'done');
  }, [tasks]);

  // 5. Completed tasks for today
  const completedBatch = useMemo(() => {
    return tasks.filter((t) => !t.deletedAt && !t.archivedAt && (completedOn(t, today) || (t.status === 'done' && isTodayTask(t, today))));
  }, [tasks, today]);

  const renderRow = (task: Task) => (
    <WorkspaceTaskRow
      key={task.id}
      task={task}
      onSelectTask={(id) => onSelectTask?.(id)}
      onStartFocus={onStartFocus}
      onStartSprint={onStartSprint}
    />
  );

  const dateObj = new Date(today + 'T12:00:00');
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(dateObj);

  return (
    <div ref={frameRef} className="horizon-today-view" data-wide={wide || undefined}>
      {/* Main Scrollable Content */}
      <div className="today-main desk-page-frame">
        {introduction}
        {/* Horizon Page Header */}
        <header className="desk-page-header shrink-0">
          <div>
            <p className="desk-eyebrow text-xs font-semibold text-[var(--text-muted)] tracking-wider uppercase mb-1">
              {formattedDate}
            </p>
            <div className="desk-title-line flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
                Today<span className="desk-title-dot text-amber-500">.</span>
              </h1>
              {onSwitchToDashboard && (
                <button
                  type="button"
                  className="desk-switcher flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-l1)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-hairline)] transition-all shadow-2xs"
                  onClick={onSwitchToDashboard}
                  aria-label="Switch dashboard"
                  title="Switch to Modular Dashboard Grid"
                >
                  <Compass size={13} className="text-amber-500" />
                  <span>Horizon View</span>
                  <ChevronDown size={12} className="text-[var(--text-muted)]" />
                </button>
              )}
            </div>
            <p className="desk-page-description text-xs text-[var(--text-secondary)] mt-1">
              Your priorities, with room to breathe.
            </p>
          </div>

          <div className="desk-header-actions flex items-center gap-2">
            {!wide && <button type="button" className="desk-button" onClick={() => setTimelineDrawer(true)}><CalendarDays size={16} />Timeline</button>}
            {onSwitchToDashboard && (
              <button
                type="button"
                className="desk-button text-xs font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-hairline)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] transition-colors"
                onClick={onCustomize || onSwitchToDashboard}
                title="Customize Today"
              >
                <SlidersHorizontal size={14} />
                <span>Customize</span>
              </button>
            )}
            <button
              type="button"
              className="desk-button primary text-xs font-semibold flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-900 font-bold shadow-xs transition-all active:scale-95"
              onClick={() => setPlanning(true)}
              aria-label="Plan my day"
            >
              <span>Plan my day</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </header>

        {/* Guided Daily Planning Dialog */}
        {planning && (
          <DailyPlanning
            showCard={false}
            isOpen={true}
            onOpenChange={setPlanning}
          />
        )}

        {/* Inline Task Capture */}
        <TodayTaskCapture />


        {/* Top 3 Priorities Deck */}
        <section className="daily-priorities space-y-2.5" aria-label="Top 3 Priorities">
          <div className="daily-section-heading flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-amber-500" />
              <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                Your Top 3
              </h2>
            </div>
            <span className="text-xs text-[var(--text-muted)] font-medium">
              {topThreeTasks.length}/3 · Keep it intentional
            </span>
          </div>

          <div className="desk-priorities space-y-1.5">
            {topThreeTasks.length > 0 ? (
              <>
                {topThreeTasks.map((task, i) => (
                  <WorkspaceTaskRow
                    key={task.id}
                    task={task}
                    featured
                    rank={i + 1}
                    showNextAction={true}
                    onSelectTask={(id) => onSelectTask?.(id)}
                    onStartFocus={onStartFocus}
                    onStartSprint={onStartSprint}
                  />
                ))}
                {topThreeTasks.length < 3 && (
                  <p className="desk-priority-space text-xs text-[var(--text-muted)] p-2.5 rounded-xl border border-dashed border-[var(--border-hairline)] text-center">
                    {3 - topThreeTasks.length} {topThreeTasks.length === 2 ? 'space' : 'spaces'} left. Leave room for what matters.
                  </p>
                )}
              </>
            ) : (
              <div className="desk-widget-empty p-6 rounded-2xl border border-dashed border-[var(--border-hairline)] bg-[var(--bg-surface-l1)]/40 text-center flex flex-col items-center justify-center space-y-2">
                <Target size={24} className="text-amber-500/80" />
                <h3 className="text-xs font-bold text-[var(--text-primary)]">What matters most today?</h3>
                <p className="text-[11px] text-[var(--text-secondary)] max-w-sm">
                  Star up to three tasks below. Give your day a clear place to start.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Daytime Task Batches */}
        <div className="today-task-batches space-y-6">
          {/* 1. Morning Focus Batch */}
          {morningBatch.length > 0 && (
            <section className="morning-focus-batch space-y-2" aria-label="Morning Focus">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                <Sun size={15} />
                <h3>Morning Focus</h3>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300">
                  {morningBatch.length}
                </span>
              </div>
              <VirtualTaskList tasks={morningBatch} renderTask={renderRow} estimatedItemHeight={78} />
            </section>
          )}

          {/* 2. Daytime Flow Batch */}
          <section className="daytime-flow-batch space-y-2" aria-label="Daytime Flow">
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
              <Coffee size={15} className="text-amber-500" />
              <h3>Daytime Flow</h3>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-stone-200/70 dark:bg-stone-800 text-[var(--text-secondary)]">
                {daytimeFlowBatch.length}
              </span>
            </div>
            {daytimeFlowBatch.length > 0 ? (
              <VirtualTaskList tasks={daytimeFlowBatch} renderTask={renderRow} estimatedItemHeight={78} />
            ) : morningBatch.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-[var(--border-hairline)] text-center text-xs text-[var(--text-muted)]">
                A clear space to begin. Add a task above, or pull in from your backlog.
              </div>
            ) : null}
          </section>

          {/* 3. This Evening Batch */}
          {eveningBatch.length > 0 && (
            <section className="this-evening-batch space-y-2" aria-label="This Evening">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">
                <Moon size={15} />
                <h3>This Evening</h3>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300">
                  {eveningBatch.length}
                </span>
              </div>
              <VirtualTaskList tasks={eveningBatch} renderTask={renderRow} estimatedItemHeight={78} />
            </section>
          )}

          {/* 4. Someday / Backlog Section */}
          {somedayBatch.length > 0 && (
            <section className="someday-backlog-batch pt-2">
              <button
                type="button"
                className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors py-1"
                onClick={() => setSomedayOpen(!somedayOpen)}
                aria-expanded={somedayOpen}
              >
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${somedayOpen ? '' : '-rotate-90'}`}
                />
                <Archive size={14} />
                <span>Someday & Backlog</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-stone-200/60 dark:bg-stone-800">
                  {somedayBatch.length}
                </span>
              </button>
              {somedayOpen && (
                <div className="mt-2 space-y-1.5 pl-4 border-l-2 border-[var(--border-hairline)]">
                  {somedayBatch.map(renderRow)}
                </div>
              )}
            </section>
          )}

          {/* 5. Completed Tasks Section */}
          {completedBatch.length > 0 && (
            <section className="completed-batch pt-2">
              <button
                type="button"
                className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors py-1"
                onClick={() => setCompletedOpen(!completedOpen)}
                aria-expanded={completedOpen}
              >
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${completedOpen ? '' : '-rotate-90'}`}
                />
                <CheckCircle2 size={14} className="text-emerald-500" />
                <span>Completed</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  {completedBatch.length}
                </span>
              </button>
              {completedOpen && (
                <div className="mt-2 space-y-1.5 pl-4 border-l-2 border-emerald-500/20">
                  {completedBatch.map(renderRow)}
                </div>
              )}
            </section>
          )}
        </div>
        {/* Daily Planning Budget Banner */}
        <section
          className="daily-planning-summary p-4 sm:p-5 rounded-2xl bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          aria-label="Daily capacity budget"
        >
          <div>
            <span className="daily-summary-label text-[10px] font-bold tracking-wider uppercase text-[var(--text-muted)] block mb-1">
              A DAY THAT FITS
            </span>
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              <strong className="text-[var(--text-primary)] font-bold">{hours(summary.totalDemandMinutes)}</strong> planned{' '}
              <span className="text-[var(--text-muted)]">·</span>{' '}
              <strong className="text-[var(--text-primary)] font-bold">
                {hours(Math.max(0, summary.availableTaskBudgetMinutes - summary.totalDemandMinutes))}
              </strong>{' '}
              available
            </p>
          </div>

          <div className="daily-summary-actions flex items-center gap-3">
            <section className="daily-progress flex items-center gap-2.5 text-xs text-[var(--text-secondary)] font-medium">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20 font-semibold">
                <CheckCircle2 size={13} strokeWidth={2.5} />
                {summary.completedTaskCount} completed
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20 font-semibold">
                <Sparkles size={13} strokeWidth={2} />
                {formatSecondsToHumanReadable(focusedSeconds)} focused
              </span>
            </section>
          </div>
        </section>

        {/* Overbooked Warning Banner */}
        {summary.overbooked && (
          <p className="daily-overload p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-300 text-xs font-semibold" role="status">
            Overbooked by {summary.overbookedMinutes} minutes. Move a task or adjust your plan.
          </p>
        )}


      </div>

      {/* Embedded 24h Collapsible Timeline Rail */}
      {wide && <TodayTimelineRail
        isOpen={railOpen}
        onToggleCollapse={() => setRailOpen(!railOpen)}
        tasks={tasks}
        calendarEvents={calendarEvents}
        onSelectTask={onSelectTask}
        onStartFocus={onStartFocus}
        onStartSprint={onStartSprint}
      />}
      <Dialog isOpen={timelineDrawer && !wide} onClose={() => setTimelineDrawer(false)} title="Today timeline" size="md" className="today-timeline-dialog">
        <TodayTimelineRail isOpen onToggleCollapse={() => setTimelineDrawer(false)} tasks={tasks} calendarEvents={calendarEvents} onSelectTask={id => { setTimelineDrawer(false); onSelectTask?.(id); }} onStartFocus={id => { setTimelineDrawer(false); onStartFocus?.(id); }} onStartSprint={onStartSprint} />
      </Dialog>
    </div>
  );
};

// Keep typing local to the capture field; the day and timeline do not need to
// recalculate or repaint on each keystroke. Submission still uses the same commands.
function TodayTaskCapture() {
  const { settings, addTask, showToast } = useTaskContext();
  const today = useTodayStr();
  const [input, setInput] = useState('');
  // NLP task parser preview
  const parsed = useMemo(
    () => (settings?.enableSmartSyntaxParsing === false ? { cleanTitle: input.trim() } : parseTaskInput(input)),
    [input, settings?.enableSmartSyntaxParsing]
  );

  const handleCaptureSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = input.trim();
    if (!clean) return;

    addTask(clean, {
      plannedDate: parsed.plannedDate || today,
      projectId: parsed.projectTag || 'inbox',
      priority: parsed.priority,
      dueDate: parsed.dueDate,
      estimatedMinutes: parsed.estimatedMinutes,
    });

    if (parsed.plannedDate && parsed.plannedDate !== today) {
      showToast(`Task captured for ${parsed.plannedDate}. Find it in Upcoming.`);
    }

    setInput('');
  };

  return (
        <section className="daily-capture" aria-label="Add a task">
          <form className="desk-inline-capture relative" onSubmit={handleCaptureSubmit}>
            <Plus size={16} className="text-[var(--text-muted)] shrink-0" />
            <input
              aria-label="Add a task to this list"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="What needs your attention today?"
              className="w-full bg-transparent text-sm focus:outline-none placeholder:text-[var(--text-muted)]"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Add task"
              className="px-2 py-1 text-xs font-bold text-amber-600 dark:text-amber-400 disabled:opacity-40"
            >
              ↵
            </button>
            {input.trim() && (parsed.plannedDate || parsed.dueDate || parsed.projectTag || parsed.estimatedMinutes || parsed.priority) && (
              <div className="desk-capture-preview flex items-center gap-2 mt-2 text-[10px] text-[var(--text-muted)] font-mono" aria-label="Recognized task details">
                {parsed.plannedDate && <span>Planned · {parsed.plannedDate}</span>}
                {parsed.dueDate && <span>Deadline · {parsed.dueDate}</span>}
                {parsed.projectTag && <span>Project · {parsed.projectTag}</span>}
                {parsed.estimatedMinutes && <span>{parsed.estimatedMinutes}m</span>}
                {parsed.priority && <span>{parsed.priority.toUpperCase()}</span>}
              </div>
            )}
          </form>
        </section>
  );
}
