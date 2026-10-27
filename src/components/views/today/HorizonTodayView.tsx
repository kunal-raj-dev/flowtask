import { useMemo, useState } from 'react';
import { Archive, ArrowRight, CalendarDays, CheckCircle2, ChevronDown, Headphones, LayoutGrid, Play, SlidersHorizontal, Sparkles, Target } from 'lucide-react';
import { useTaskAvailabilityClock } from '../../../hooks/useTaskAvailabilityClock';
import { useTaskContext } from '../../../context/TaskContext';
import { useModal } from '../../../context/ModalContext';
import { useTodayStr } from '../../../hooks/useCurrentDate';
import { useGoalAlignment } from '../../../hooks/useGoalAlignment';
import { getOverdueTasks } from '../../../services/cleanSlateService';
import { roomImage } from '../../../services/featuredRooms';
import { completedOn, isFocusTask, isSomedayTask, isTodayTask } from '../../../utils/taskSelectors';
import { generateStarterAction } from '../../../utils/procrastinationSplitter';
import { normalizeTodayLayout, partitionTodayTasks } from '../../../utils/todayLayout';
import { DailyNoteButton } from '../../notes/DailyNoteButton';
import { WorkspaceTaskRow } from '../../tasks/WorkspaceTaskRow';
import { TaskComposer } from '../../tasks/TaskComposer';
import { VirtualTaskList } from '../../tasks/VirtualTaskList';
import { DailyPlanning } from '../../workflow/DailyPlanning';
import { Dialog } from '../../ui/Dialog';
import { DropdownMenu, DropdownMenuItem } from '../../ui/DropdownMenu';
import { TodayFocusProgressBar } from './TodayFocusProgressBar';
import { TodayTimelineRail } from './TodayTimelineRail';
import type { TodayLayoutPreferences, TodaySectionId, WorkspacePreferences } from '../../../types/dashboard';
import type { Priority, Task } from '../../../types/task';
import '../../../styles/today-workspace.css';

interface HorizonTodayViewProps {
  onSelectTask?: (id: string) => void;
  onStartFocus?: (id: string) => void;
  onStartSprint?: (id: string) => void;
  onSwitchToDashboard?: () => void;
  onCustomize?: () => void;
  introduction?: React.ReactNode;
  footer?: React.ReactNode;
  layout?: TodayLayoutPreferences;
  onLayoutChange?: (layout: TodayLayoutPreferences) => void;
}

export const HorizonTodayView: React.FC<HorizonTodayViewProps> = ({ onSelectTask, onStartFocus, onStartSprint, onSwitchToDashboard, onCustomize, introduction, footer, layout: suppliedLayout, onLayoutChange }) => {
  const { tasks, projects = [], startFocusSession, focusSession, calendarEvents = [], workspacePreferences = {} } = useTaskContext();
  const { openModal } = useModal();
  const today = useTodayStr();
  const now = useTaskAvailabilityClock(tasks);
  const { goals, todayAlignment } = useGoalAlignment();
  const workspace = workspacePreferences.workspace as WorkspacePreferences | undefined;
  const layout = normalizeTodayLayout(suppliedLayout || workspace?.todayLayout);
  const [planning, setPlanning] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [backlogOpen, setBacklogOpen] = useState(false);
  const [singleTaskMode, setSingleTaskMode] = useState(false);
  const active = useMemo(() => tasks.filter(task => !task.deletedAt && !task.archivedAt && task.status !== 'done' && (isTodayTask(task, today, { tasks, projects, now }) || isFocusTask(task, today, { tasks, projects, now }))), [tasks, projects, today, now]);
  const priorities = useMemo(() => {
    const weight: Record<Priority, number> = { p1: 1, p2: 2, p3: 3, p4: 4 };
    return active.filter(task => isFocusTask(task, today, { tasks, projects, now })).sort((a, b) => weight[a.priority] - weight[b.priority]).slice(0, 3);
  }, [active, tasks, projects, today, now]);
  const groups = partitionTodayTasks(active, layout, priorities.map(task => task.id));
  const overdue = getOverdueTasks(tasks);
  const completed = tasks.filter(task => !task.deletedAt && !task.archivedAt && (completedOn(task, today) || (task.status === 'done' && isTodayTask(task, today, { tasks, projects, now }))));
  const backlog = tasks.filter(task => !task.deletedAt && !task.archivedAt && task.status !== 'done' && isSomedayTask(task) && !active.some(item => item.id === task.id));
  const dateLabel = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(today + 'T12:00:00'));
  const row = (task: Task) => <WorkspaceTaskRow key={task.id} task={task} onSelectTask={id => onSelectTask?.(id)} onStartFocus={onStartFocus} onStartSprint={onStartSprint} />;
  const first = priorities[0] || active[0];
  const timeline = (close: () => void) => <TodayTimelineRail isOpen onToggleCollapse={close} tasks={tasks} calendarEvents={calendarEvents} onSelectTask={id => { setTimelineOpen(false); onSelectTask?.(id); }} onStartFocus={id => { setTimelineOpen(false); onStartFocus?.(id); }} onStartSprint={onStartSprint} />;
  const taskGroup = (id: 'priorities' | 'morning' | 'tasks' | 'evening', label: string) => {
    const entries = groups[id];
    if (!entries.length && id !== 'tasks') return null;
    if (!entries.length && active.length > 0 && id === 'tasks' && !completed.length && !backlog.length) return null;
    return <section className={`today-task-group ${id === 'priorities' ? 'daily-priorities' : ''} ${id === 'tasks' ? 'daytime-flow-batch' : ''}`} aria-label={id === 'priorities' ? 'Top 3 Priorities' : id === 'tasks' ? 'Daytime Flow' : label} key={id}>
      {(entries.length > 0 || active.length === 0) && <div className="today-group-heading"><h2>{label}</h2><span>{entries.length}{id === 'priorities' ? '/3' : ''}</span></div>}
      {entries.length > 0 ? <VirtualTaskList tasks={entries} renderTask={(task, index) => id === 'priorities' ? <WorkspaceTaskRow key={task.id} task={task} featured rank={index + 1} showNextAction onSelectTask={selected => onSelectTask?.(selected)} onStartFocus={onStartFocus} onStartSprint={onStartSprint} /> : row(task)} estimatedItemHeight={72} className="today-task-rows" /> : active.length === 0 && id === 'tasks' ? <div className="today-empty-message"><h3>A little space for what matters.</h3><p>Add your first task above, or plan your day when you’re ready.</p><button type="button" className="desk-button" onClick={() => setPlanning(true)}>Plan your day<ArrowRight size={14} /></button></div> : null}
      {id === 'tasks' && <div className="today-task-disclosures">
        {completed.length > 0 && <div><button type="button" className="today-disclosure" aria-expanded={completedOpen} onClick={() => setCompletedOpen(!completedOpen)}><ChevronDown size={14} data-open={completedOpen} /><CheckCircle2 size={14} />Completed<span>{completed.length}</span></button>{completedOpen && <div className="today-task-rows">{completed.map(row)}</div>}</div>}
        {backlog.length > 0 && <div><button type="button" className="today-disclosure" aria-expanded={backlogOpen} onClick={() => setBacklogOpen(!backlogOpen)}><ChevronDown size={14} data-open={backlogOpen} /><Archive size={14} />Someday &amp; Backlog<span>{backlog.length}</span></button>{backlogOpen && <div className="today-task-rows">{backlog.map(row)}</div>}</div>}
      </div>}
    </section>;
  };
  const singleTask = () => <section className="today-task-group today-single-task" aria-label="Single-Task Horizon"><div className="today-group-heading"><h2>Single-Task Horizon</h2><span>One thing at a time</span></div>{first ? <>
    <WorkspaceTaskRow task={first} featured rank={1} showNextAction onSelectTask={id => onSelectTask?.(id)} onStartFocus={onStartFocus} onStartSprint={onStartSprint} />
    <div className="today-starter"><div><h3>5-Minute Physical Starter Action</h3><p>{generateStarterAction(first.title, first.description).starterAction}</p><small>Background batch lists collapsed</small></div><button type="button" className="desk-button primary" onClick={() => { if (!focusSession || focusSession.state === 'completed') startFocusSession({ mode: 'countdown', taskId: first.id, taskTitle: first.title, targetDurationSec: 300 }); openModal('pomodoro'); }}><Play size={14} />Start 5m Timer</button></div>
  </> : <p className="today-muted">No active tasks planned for today. Add or plan one to begin.</p>}</section>;
  const section = (id: TodaySectionId) => {
    if (singleTaskMode && ['priorities', 'morning', 'evening'].includes(id)) return null;
    switch (id) {
      case 'capture': return <section key={id} className="daily-capture today-task-composer" aria-label="Add a task to Today"><TaskComposer taskInputLabel="Add a task to this list" /></section>;
      case 'capacity': return <TodayFocusProgressBar key={id} />;
      case 'priorities': return taskGroup('priorities', 'Your top 3');
      case 'morning': return taskGroup('morning', 'Morning Focus');
      case 'tasks': return singleTaskMode ? <div key={id}>{singleTask()}</div> : taskGroup('tasks', 'Today’s tasks');
      case 'evening': return taskGroup('evening', 'This Evening');
      case 'goals': return goals.length > 0 && todayAlignment.totalTodayTasks > 0 ? <section className="today-goal-alignment" key={id} aria-label="Goal alignment"><Target size={18} /><div><strong>{todayAlignment.alignmentPercent}% connected to your goals</strong><p>{todayAlignment.alignedTodayTasks} of {todayAlignment.totalTodayTasks} tasks support active goals.</p></div><button type="button" className="desk-button" onClick={() => openModal('copilotOmnibar')}><Sparkles size={14} />Review</button></section> : null;
      case 'dailyNote': return <section key={id} className="today-daily-note" aria-label="Daily note"><DailyNoteButton /></section>;
      case 'focusCard': return <section key={id} className="today-focus-card"><img src={roomImage('kyoto-rain')} alt="A quiet garden room at dusk" loading="lazy" /><div><p>A little room to focus</p><h2>The world can wait a little while.</h2><button type="button" className="desk-button" onClick={() => openModal('pomodoro')}><Headphones size={15} />Enter Focus Studio<ArrowRight size={14} /></button></div></section>;
    }
  };
  return <div className="horizon-today-view lean-today">
    <div className="today-main desk-page-frame">
      {introduction}
      <header className="desk-page-header today-page-heading"><div><p className="desk-eyebrow">{dateLabel}</p><div className="desk-title-line"><h1>Today<span className="desk-title-dot">.</span></h1><DropdownMenu isOpen={layoutOpen} onClose={() => setLayoutOpen(false)} trigger={<button type="button" className="desk-switcher" aria-label="Layout" aria-expanded={layoutOpen} aria-haspopup="menu" onClick={() => setLayoutOpen(!layoutOpen)}><LayoutGrid size={14} />Layout<ChevronDown size={13} /></button>}><DropdownMenuItem onClick={() => setLayoutOpen(false)}>Today</DropdownMenuItem>{onSwitchToDashboard && <DropdownMenuItem onClick={() => { setLayoutOpen(false); onSwitchToDashboard(); }}>My dashboards</DropdownMenuItem>}{onCustomize && <DropdownMenuItem onClick={() => { setLayoutOpen(false); onCustomize(); }}>Customize Today</DropdownMenuItem>}</DropdownMenu></div></div>
        <div className="today-primary-actions"><button type="button" className="desk-button" onClick={() => setTimelineOpen(true)}><CalendarDays size={15} /><span>Timeline</span></button><button type="button" className="desk-button" aria-label="Today options" onClick={() => setOptionsOpen(true)}><SlidersHorizontal size={15} /><span>Options</span></button><button type="button" className="desk-button primary" aria-label="Plan my day" onClick={() => setPlanning(true)}>Plan my day<ArrowRight size={14} /></button></div>
      </header>
      {overdue.length > 0 && <div className="today-unfinished" role="status"><span>{overdue.length} overdue {overdue.length === 1 ? 'task needs' : 'tasks need'} attention</span><button type="button" onClick={() => openModal('cleanSlate')}>Review unfinished work<ArrowRight size={13} /></button></div>}
      <div className="today-layout-content" data-context-panel={layout.contextPanel}>
        <div className="today-sections today-workflow">{!layout.sections.some(item => item.id === 'capacity' && item.visible) && <TodayFocusProgressBar warningsOnly />}{layout.sections.filter(item => item.visible).map(item => section(item.id))}</div>
        {layout.contextPanel === 'schedule' && <aside className="today-context-panel" aria-label="Schedule context">{timeline(() => onLayoutChange?.({ ...layout, contextPanel: 'none' }))}</aside>}
      </div>
      {layout.contextPanel === 'schedule' && <button type="button" className="desk-button today-mobile-context" onClick={() => setTimelineOpen(true)}><CalendarDays size={15} />Open schedule context</button>}
      {footer}
    </div>
    <Dialog isOpen={optionsOpen} onClose={() => setOptionsOpen(false)} title="Today options" description="Choose how you want to work today."><div className="today-customize-actions"><button type="button" className="desk-button" aria-pressed={singleTaskMode} onClick={() => { setSingleTaskMode(!singleTaskMode); setOptionsOpen(false); }}><Target size={16} />{singleTaskMode ? 'Show all tasks' : 'Single-Task Horizon'}</button><button type="button" className="desk-button" onClick={() => { setOptionsOpen(false); openModal('routineRunner'); }}><Sparkles size={16} />Launch Routine</button>{onCustomize && <button type="button" className="desk-button" onClick={() => { setOptionsOpen(false); onCustomize(); }}><SlidersHorizontal size={16} />Customize Today</button>}<DailyNoteButton /></div></Dialog>
    <DailyPlanning showCard={false} isOpen={planning} onOpenChange={setPlanning} />
    <Dialog isOpen={timelineOpen} onClose={() => setTimelineOpen(false)} title="Today timeline" size="md" className="today-timeline-dialog">{timeline(() => setTimelineOpen(false))}</Dialog>
  </div>;
};
