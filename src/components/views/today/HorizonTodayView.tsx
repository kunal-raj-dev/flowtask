import { useTaskAvailabilityClock } from '../../../hooks/useTaskAvailabilityClock';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { DailyNoteButton } from '../../notes/DailyNoteButton';
import { useTaskContext } from '../../../context/TaskContext';
import { useModal } from '../../../context/ModalContext';
import { getOverdueTasks } from '../../../services/cleanSlateService';
import { useTodayStr } from '../../../hooks/useCurrentDate';
import { isFocusTask, isTodayTask, isSomedayTask, completedOn } from '../../../utils/taskSelectors';
import { parseTaskInput } from '../../../utils/nlpParser';
import { generateStarterAction } from '../../../utils/procrastinationSplitter';
import { parseTimeToMinutes } from '../../../utils/timelineUtils';
import { WorkspaceTaskRow } from '../../tasks/WorkspaceTaskRow';
import { VirtualTaskList } from '../../tasks/VirtualTaskList';
import { TodayTimelineRail } from './TodayTimelineRail';
import { TodayFocusProgressBar } from './TodayFocusProgressBar';
import { DailyPlanning } from '../../workflow/DailyPlanning';
import { useGoalAlignment } from '../../../hooks/useGoalAlignment';
import { Dialog } from '../../ui/Dialog';
import {
  Sun,
  Coffee,
  Moon,
  ChevronDown,
  ChevronRight,
  Plus,
  Play,
  ArrowRight,
  Compass,
  CheckCircle2,
  Sparkles,
  Archive,
  Target,
  SlidersHorizontal,
  CalendarDays,
  Headphones,
  Leaf,
} from 'lucide-react';
import { roomImage } from '../../../services/featuredRooms';
import type { Task, Priority } from '../../../types/task';

interface HorizonTodayViewProps {
  onSelectTask?: (id: string) => void;
  onStartFocus?: (id: string) => void;
  onStartSprint?: (id: string) => void;
  onSwitchToDashboard?: () => void;
  onCustomize?: () => void;
  introduction?: React.ReactNode;
  footer?: React.ReactNode;
}

export const HorizonTodayView: React.FC<HorizonTodayViewProps> = ({
  onSelectTask,
  onStartFocus,
  onStartSprint,
  onSwitchToDashboard,
  onCustomize,
  introduction,
  footer,
}) => {
  const {
    tasks,
    projects = [],
    startFocusSession,
    focusSession,
    calendarEvents = [],
  } = useTaskContext();

  const { openModal } = useModal();
  const today = useTodayStr();
  const { todayAlignment } = useGoalAlignment();
  const availabilityNow = useTaskAvailabilityClock(tasks);
  const overdueTasks = useMemo(() => getOverdueTasks(tasks), [tasks]);
  const [planning, setPlanning] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const [timelineDrawer, setTimelineDrawer] = useState(false);
  const [wide, setWide] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const measure = () => setWide(element.clientWidth >= 1500);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [somedayOpen, setSomedayOpen] = useState(false);
  const [singleTaskMode, setSingleTaskMode] = useState(false);
  const [shelfOpen, setShelfOpen] = useState(false);

  // Filter tasks
  const activeTodayTasks = useMemo(() => {
    return tasks.filter((t) => !t.deletedAt && !t.archivedAt && isTodayTask(t, today, { tasks, projects, now: availabilityNow }) && t.status !== 'done');
  }, [tasks, projects, today, availabilityNow]);

  // Top 3 Priorities: pinned to today, active, sorted by priority weight
  const topThreeTasks = useMemo(() => {
    const list = tasks.filter((t) => !t.deletedAt && !t.archivedAt && isFocusTask(t, today, { tasks, projects, now: availabilityNow }));
    const priorityWeight: Record<Priority, number> = { p1: 1, p2: 2, p3: 3, p4: 4 };
    return list.sort((a, b) => priorityWeight[a.priority] - priorityWeight[b.priority]).slice(0, 3);
  }, [tasks, projects, today, availabilityNow]);

  // Non-Top 3 today tasks
  const topThreeIds = useMemo(() => new Set(topThreeTasks.map((t) => t.id)), [topThreeTasks]);
  const daytimeCandidates = useMemo(() => {
    return activeTodayTasks.filter((t) => !topThreeIds.has(t.id));
  }, [activeTodayTasks, topThreeIds]);

  // Batches
  // Explicit time placement wins; task title/intensity never invents a morning commitment.
  const morningBatch = useMemo(() => {
    return daytimeCandidates.filter((t) => {
      const startMin = parseTimeToMinutes(t.scheduledStart);
      return !t.isEvening && startMin !== null && startMin < 12 * 60;
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
    return tasks.filter((t) => !t.deletedAt && !t.archivedAt && (completedOn(t, today) || (t.status === 'done' && isTodayTask(t, today, { tasks, projects, now: availabilityNow }))));
  }, [tasks, projects, today, availabilityNow]);

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
              <span className="sr-only">Horizon View</span>
              {onSwitchToDashboard && (
                <button
                  type="button"
                  className="desk-switcher flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-l1)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-hairline)] transition-all shadow-2xs"
                  onClick={onSwitchToDashboard}
                  aria-label="Switch dashboard"
                  title="Switch to Modular Dashboard Grid"
                >
                  <Compass size={13} className="text-amber-500" />
                  <span>Daily desk</span>
                  <ChevronDown size={12} className="text-[var(--text-muted)]" />
                </button>
              )}
            </div>
            <p className="desk-page-description text-xs text-[var(--text-secondary)] mt-1">
              Your priorities, with room to breathe.
            </p>
          </div>

          <div className="desk-header-actions today-primary-actions">
            {!wide && <button type="button" className="desk-button" onClick={() => setTimelineDrawer(true)}><CalendarDays size={16} />Timeline</button>}
            <button type="button" className="desk-button" onClick={() => setOptionsOpen(true)} aria-label="Today options"><SlidersHorizontal size={16} /><span>Options</span></button>
            <button type="button" className="desk-button primary" onClick={() => setPlanning(true)} aria-label="Plan my day"><span>Plan my day</span><ArrowRight size={15} className="hidden sm:block" /></button>
          </div>
        </header>

        <div className="today-workspace-grid">
        <div className="today-workflow">
        {optionsOpen && <Dialog isOpen onClose={() => setOptionsOpen(false)} title="Today options" description="Choose how you want to work today.">
          <div className="today-customize-actions">
            <button type="button" className="desk-button" aria-pressed={singleTaskMode} onClick={() => { setSingleTaskMode(!singleTaskMode); setOptionsOpen(false); }}><Target size={16} />{singleTaskMode ? 'Show all tasks' : 'Single-Task Horizon'}</button>
            <button type="button" className="desk-button" onClick={() => { setOptionsOpen(false); openModal('routineRunner'); }}><Sparkles size={16} />Launch Routine</button>
            {onSwitchToDashboard && <button type="button" className="desk-button" onClick={() => { setOptionsOpen(false); (onCustomize || onSwitchToDashboard)(); }}><SlidersHorizontal size={16} />Customize Today</button>}
            <DailyNoteButton />
          </div>
        </Dialog>}

        {/* Mounted Today Focus Progress Bar with Capacity Guardrail & Finish Time */}
        <TodayFocusProgressBar />

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

        {/* Clean Slate Backlog De-escalation Prompt */}
        {overdueTasks.length > 0 && (
          <div className="today-gentle-reset flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
            <div className="flex items-center gap-2.5">
              <Sparkles size={16} className="text-amber-500 shrink-0" />
              <div>
                <p className="font-semibold text-[var(--text-primary)]">
                  {overdueTasks.length} overdue {overdueTasks.length === 1 ? 'task needs' : 'tasks need'} attention
                </p>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  A fresh start is always an option. Review and move what can wait.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => openModal('cleanSlate')}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-stone-900 font-bold text-xs transition cursor-pointer shrink-0"
            >
              Clean Slate
            </button>
          </div>
        )}


        {/* Single-Task Horizon Mode (ADHD Executive Shield) */}
        {singleTaskMode ? (
          <div className="single-task-horizon-container p-6 rounded-2xl bg-[var(--bg-surface-l1)] border-2 border-amber-500/40 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                <Target size={15} />
                <span>Single-Task Horizon</span>
              </span>
              <span className="text-[11px] text-[var(--text-muted)] font-mono">
                Background batch lists collapsed
              </span>
            </div>

            {topThreeTasks[0] || activeTodayTasks[0] ? (() => {
              const task = topThreeTasks[0] || activeTodayTasks[0];
              const starter = generateStarterAction(task.title, task.description);
              return (
                <div className="space-y-4">
                  <WorkspaceTaskRow
                    task={task}
                    featured
                    rank={1}
                    showNextAction={true}
                    onSelectTask={(id) => onSelectTask?.(id)}
                    onStartFocus={onStartFocus}
                    onStartSprint={onStartSprint}
                  />

                  {/* 5-minute Micro Starter Step Card */}
                  <div className="starter-action-card p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                        <Sparkles size={14} className="text-amber-500" />
                        <span>5-Minute Physical Starter Action</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 font-mono">
                          {starter.suggestedMinutes}m
                        </span>
                      </div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {starter.starterAction}
                      </p>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        {starter.rationale}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (!focusSession || focusSession.state === 'completed') {
                          startFocusSession({ mode: 'countdown', taskId: task.id, taskTitle: task.title, targetDurationSec: 300 });
                        }
                        openModal('pomodoro');
                      }}
                      className="desk-button primary text-xs font-bold px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-900 shrink-0 flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
                    >
                      <Play size={13} fill="currentColor" />
                      <span>Start 5m Timer</span>
                    </button>
                  </div>
                </div>
              );
            })() : (
              <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                No active tasks planned for today. Add or plan one to begin.
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Life OS Strategic Goal Alignment Meter */}
            {todayAlignment.totalTodayTasks > 0 && (
              <div className="flex items-center justify-between p-3.5 px-4 rounded-2xl bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] text-xs text-[var(--text-secondary)] shadow-subtle mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500">
                    <Target size={14} />
                  </div>
                  <div>
                    <span className="font-bold text-[var(--text-primary)]">
                      {todayAlignment.alignmentPercent}% Strategic Alignment
                    </span>
                    <span className="text-[var(--text-muted)] ml-1.5 hidden sm:inline">
                      • {todayAlignment.alignedTodayTasks} of {todayAlignment.totalTodayTasks} planned tasks drive active goals
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-[var(--bg-surface-l3)] rounded-full overflow-hidden hidden sm:block">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full transition-all duration-500"
                      style={{ width: `${todayAlignment.alignmentPercent}%` }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => openModal('copilotOmnibar')}
                    className="text-[11px] font-semibold text-[var(--color-brand)] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles size={12} />
                    <span>AI Plan</span>
                  </button>
                </div>
              </div>
            )}

            {/* Top 3 Priorities Deck */}
            <section className="daily-priorities p-5 sm:p-6 rounded-2xl bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] shadow-2xs hover:shadow-xs transition-all space-y-4" aria-label="Top 3 Priorities">
              <div className="daily-section-heading flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-500 shadow-2xs">
                    <Target size={15} />
                  </div>
                  <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                    Your top 3
                  </h2>
                </div>
                <span className="text-xs text-[var(--text-muted)] font-medium px-2.5 py-1 rounded-full bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] shadow-2xs">
                  {topThreeTasks.length}/3 · Keep it intentional
                </span>
              </div>

              <div className="desk-priorities space-y-2">
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
                      <p className="desk-priority-space text-xs text-[var(--text-muted)] p-3.5 rounded-xl border border-dashed border-[var(--border-hairline)] text-center bg-[var(--bg-surface-l2)]/40 transition-colors">
                        {3 - topThreeTasks.length} {topThreeTasks.length === 2 ? 'space' : 'spaces'} left. Leave room for what matters.
                      </p>
                    )}
                  </>
                ) : (
                  <div className="desk-widget-empty p-10 rounded-2xl border border-dashed border-[var(--border-hairline)] bg-[var(--bg-surface-l2)]/50 text-center flex flex-col items-center justify-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/15 flex items-center justify-center text-amber-500 shadow-xs mb-1">
                      <Target size={24} />
                    </div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">What matters most today?</h3>
                    <p className="text-xs text-[var(--text-secondary)] max-w-sm leading-relaxed">
                      Star up to three tasks below. Give your day a clear place to start.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Daytime Task Batches */}
            <div className="today-task-batches space-y-6 sm:space-y-8">
              {/* 1. Morning Focus Batch */}
              {morningBatch.length > 0 && (
                <section className="morning-focus-batch space-y-3.5 p-5 sm:p-6 rounded-2xl" aria-label="Morning Focus">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                      <span className="w-6 h-6 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-500 shadow-2xs">
                        <Sun size={14} />
                      </span>
                      <h3>Morning Focus</h3>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 shadow-2xs">
                      {morningBatch.length}
                    </span>
                  </div>
                  <VirtualTaskList tasks={morningBatch} renderTask={renderRow} estimatedItemHeight={78} />
                </section>
              )}

              {/* 2. Daytime Flow Batch */}
              <section className="daytime-flow-batch space-y-3.5 p-5 sm:p-6 rounded-2xl" aria-label="Daytime Flow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                    <span className="w-6 h-6 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-2xs">
                      <Coffee size={14} />
                    </span>
                    <h3>Daytime Flow</h3>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-stone-200/70 dark:bg-stone-800 text-[var(--text-secondary)] shadow-2xs">
                    {daytimeFlowBatch.length}
                  </span>
                </div>
                {daytimeFlowBatch.length > 0 ? (
                  <VirtualTaskList tasks={daytimeFlowBatch} renderTask={renderRow} estimatedItemHeight={78} />
                ) : morningBatch.length === 0 ? (
                  <div className="p-5 rounded-xl border border-dashed border-[var(--border-hairline)] text-center text-xs text-[var(--text-muted)] bg-[var(--bg-surface-l2)]/40">
                    A clear space to begin. Add a task above, or pull in from your backlog.
                  </div>
                ) : null}
              </section>

              {/* 3. This Evening Batch */}
              {eveningBatch.length > 0 && (
                <section className="this-evening-batch space-y-3.5 p-5 sm:p-6 rounded-2xl" aria-label="This Evening">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                      <span className="w-6 h-6 rounded-lg bg-indigo-500/15 flex items-center justify-center text-indigo-500 shadow-2xs">
                        <Moon size={14} />
                      </span>
                      <h3>This Evening</h3>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 shadow-2xs">
                      {eveningBatch.length}
                    </span>
                  </div>
                  <VirtualTaskList tasks={eveningBatch} renderTask={renderRow} estimatedItemHeight={78} />
                </section>
              )}

              {/* 4. Someday / Backlog Section (Inline when not wide) */}
              {!wide && somedayBatch.length > 0 && (
                <section className="someday-backlog-batch pt-2">
                  <button
                    type="button"
                    className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors py-1 cursor-pointer"
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
                    className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors py-1 cursor-pointer"
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
          </>
        )}
        </div>
        {!wide && <aside className="today-companion" aria-label="Your quiet corner">
          <section className="quiet-corner-card">
            <div className="quiet-corner-scene">
              <img src={roomImage('kyoto-rain')} alt="A cozy Japanese room overlooking a garden at dusk" loading="lazy" />
              <span><Headphones size={13} /> Focus Studio</span>
            </div>
            <div className="quiet-corner-copy">
              <p className="desk-eyebrow">A little room to focus</p>
              <h2>The world can wait<br />a little while.</h2>
              <p>One task. A quiet space.<br />A rhythm that feels like you.</p>
              <button type="button" className="desk-button" onClick={() => openModal('pomodoro')}><Headphones size={15} />Enter Focus Studio<ArrowRight size={14} /></button>
            </div>
          </section>
          <section className="desk-kind-note">
            <div className="desk-sprout" aria-hidden="true"><Leaf size={24} strokeWidth={1.3} /></div>
            <p>Room to breathe.<br /><strong>Space to grow.</strong></p>
            <span>Small steps count, too.</span>
          </section>
          <div className="desk-daily-note"><DailyNoteButton /></div>
        </aside>}
        </div>
        {footer}
      </div>

      {/* Side-Docked Brain Dump Shelf on Wide Viewports */}
      {wide && (
        <aside
          aria-label="Brain Dump Shelf"
          className={`brain-dump-shelf ${
            shelfOpen ? 'w-72' : 'w-9'
          } shrink-0 border-l border-[var(--border-hairline)] bg-[var(--bg-surface-l1)]/70 backdrop-blur-sm flex flex-col h-full overflow-hidden transition-all duration-200 select-none`}
        >
          {shelfOpen ? (
            <>
              <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--border-hairline)] bg-[var(--bg-surface-l1)] shrink-0">
                <div className="flex items-center gap-2">
                  <Archive size={14} className="text-amber-500" />
                  <span className="text-xs font-bold text-[var(--text-primary)]">Brain Dump Shelf</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-stone-200/70 dark:bg-stone-800 text-[var(--text-muted)]">
                    {somedayBatch.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShelfOpen(false)}
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-stone-200/50 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
                  aria-label="Collapse Brain Dump Shelf"
                  title="Collapse Shelf"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {somedayBatch.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)] text-center p-4">No Someday tasks.</p>
                ) : (
                  somedayBatch.map((task) => (
                    <WorkspaceTaskRow
                      key={task.id}
                      task={task}
                      onSelectTask={(id) => onSelectTask?.(id)}
                      onStartFocus={onStartFocus}
                      onStartSprint={onStartSprint}
                    />
                  ))
                )}
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShelfOpen(true)}
              aria-label="Expand Brain Dump Shelf"
              title="Expand Brain Dump Shelf"
              className="w-full h-full flex flex-col items-center py-4 gap-3 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors group cursor-pointer"
            >
              <Archive size={15} />
              <span className="text-[10px] font-bold tracking-widest uppercase origin-center rotate-90 select-none whitespace-nowrap mt-6">
                Brain Dump ({somedayBatch.length})
              </span>
            </button>
          )}
        </aside>
      )}

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
  // The shared parser falls back to raw input when every word was metadata.
  // A shortcut alone should not accidentally create a task named "~25m".
  const hasTaskTitle = Boolean(parsed.cleanTitle.trim()) && !(parsed.cleanTitle === input.trim() &&
    (parsed.priority || parsed.estimatedMinutes || parsed.projectTag || parsed.plannedDate || parsed.dueDate));

  const handleCaptureSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = input.trim();
    if (!clean || !hasTaskTitle) return;

    const targetPlannedDate = parsed.plannedDate || (!parsed.dueDate || parsed.dueDate === today ? today : undefined);

    addTask(clean, {
      plannedDate: targetPlannedDate,
      projectId: parsed.projectTag || 'inbox',
      priority: parsed.priority,
      dueDate: parsed.dueDate,
      estimatedMinutes: parsed.estimatedMinutes,
    });

    if (parsed.plannedDate && parsed.plannedDate !== today) {
      showToast(`Task captured for ${parsed.plannedDate}. Find it in Upcoming.`);
    } else if (parsed.dueDate && parsed.dueDate !== today && !parsed.plannedDate) {
      showToast(`Task captured with deadline ${parsed.dueDate}. Find it in Upcoming.`);
    }

    setInput('');
  };

  return (
    <section className="daily-capture" aria-label="Add a task">
      <form
        className="desk-inline-capture relative p-4 sm:p-5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface-l1)] focus-within:border-[var(--color-brand)] focus-within:ring-2 focus-within:ring-[var(--color-brand)]/20 transition-all shadow-2xs hover:shadow-xs"
        onSubmit={handleCaptureSubmit}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
            <Plus size={18} />
          </div>
          <input
            aria-label="Add a task to this list"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="What needs your attention today?"
            className="w-full bg-transparent text-sm sm:text-base focus:outline-none placeholder:text-[var(--text-muted)] text-[var(--text-primary)]"
          />
          <button
            type="submit"
            disabled={!hasTaskTitle}
            aria-label="Add task"
            className="w-8 h-8 rounded-xl bg-amber-500/15 hover:bg-amber-500 text-amber-700 dark:text-amber-300 hover:text-stone-900 disabled:opacity-30 disabled:hover:bg-amber-500/15 disabled:hover:text-amber-700 flex items-center justify-center font-bold text-sm transition-all active:scale-95 cursor-pointer shrink-0"
          >
            ↵
          </button>
        </div>
        {input.trim() ? (
          <div className="desk-capture-preview flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border-hairline)] text-[10px] text-[var(--text-muted)] font-mono flex-wrap" aria-label="Recognized task details">
            <span className="px-2 py-0.5 rounded-md bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)]">Planned · {parsed.plannedDate || (!parsed.dueDate || parsed.dueDate === today ? 'Today' : 'Inbox')}</span>
            {parsed.dueDate && <span className="px-2 py-0.5 rounded-md bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)]">Deadline · {parsed.dueDate}</span>}
            {parsed.projectTag && <span className="px-2 py-0.5 rounded-md bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)]">Project · {parsed.projectTag}</span>}
            {parsed.estimatedMinutes && <span className="px-2 py-0.5 rounded-md bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)]">⏱️ {parsed.estimatedMinutes}m</span>}
            {parsed.priority && <span className="px-2 py-0.5 rounded-md bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] font-bold text-amber-600 dark:text-amber-400">⚡ {parsed.priority.toUpperCase()}</span>}
          </div>
        ) : (
          <details className="desk-capture-shortcuts">
          <summary><SlidersHorizontal size={12} />Task shortcuts<span>Dates, duration & tags</span><ChevronDown size={12} /></summary>
          <div className="desk-capture-tags flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border-hairline)] overflow-x-auto text-[11px] text-[var(--text-muted)]">
            <span className="text-[10px] font-bold tracking-wider uppercase text-[var(--text-secondary)] shrink-0">Quick tags:</span>
            <button
              type="button"
              className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface-l2)] hover:bg-[var(--bg-surface-hover)] hover:scale-105 active:scale-95 border border-[var(--border-hairline)] text-[11px] font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-all flex items-center gap-1 shrink-0"
              onClick={() => setInput(prev => `${prev.trim()} p1 `.trimStart())}
            >
              <span>Priority · P1</span>
            </button>
            <button
              type="button"
              className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface-l2)] hover:bg-[var(--bg-surface-hover)] hover:scale-105 active:scale-95 border border-[var(--border-hairline)] text-[11px] font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-all flex items-center gap-1 shrink-0"
              onClick={() => setInput(prev => `${prev.trim()} ~25m `.trimStart())}
            >
              <span>25 minutes</span>
            </button>
            <button
              type="button"
              className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface-l2)] hover:bg-[var(--bg-surface-hover)] hover:scale-105 active:scale-95 border border-[var(--border-hairline)] text-[11px] font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-all flex items-center gap-1 shrink-0"
              onClick={() => setInput(prev => `${prev.trim()} today `.trimStart())}
            >
              <span>Today</span>
            </button>
            <button
              type="button"
              className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface-l2)] hover:bg-[var(--bg-surface-hover)] hover:scale-105 active:scale-95 border border-[var(--border-hairline)] text-[11px] font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-all flex items-center gap-1 shrink-0"
              onClick={() => setInput(prev => `${prev.trim()} #work `.trimStart())}
            >
              <span>#work</span>
            </button>
            <button
              type="button"
              className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface-l2)] hover:bg-[var(--bg-surface-hover)] hover:scale-105 active:scale-95 border border-[var(--border-hairline)] text-[11px] font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-all flex items-center gap-1 shrink-0"
              onClick={() => setInput(prev => `${prev.trim()} #personal `.trimStart())}
            >
              <span>#personal</span>
            </button>
          </div>
          </details>
        )}
      </form>
    </section>
  );
}
