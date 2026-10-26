import { appShortcutAllowed } from '../../services/shortcutRuntime';
import { WorkspaceStoreContext } from '../../services/workspaceStore';
import { useTaskStore } from '../../store/useTaskStore';
import React, { useId, useRef, useState, useEffect, useCallback, useContext, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Star, Play, Pause, MoreHorizontal, Flag, Lock, Repeat2, ArrowRight, Clock, Wand2 } from 'lucide-react';
import { MorphCheckbox } from '../ui/MorphCheckbox';
import type { Task } from '../../types/task';
import { useTaskContext } from '../../context/TaskContext';
import { useFocusStore } from '../../store/useFocusStore';
import { useUIStore } from '../../store/useUIStore';
import { useTodayStr } from '../../hooks/useCurrentDate';
import { isTaskPinnedForDate } from '../../utils/taskSelectors';
import { formatTimerClock } from '../../utils/focusTimeFormat';
import { getEffectiveTaskEstimate } from '../../utils/taskTimeSummary';
import { TaskContextMenu } from './TaskContextMenu';
import celebrate from '../../utils/celebrate';
import { PriorityPickerPopover, DatePickerPopover, GranularitySliderPopover } from './popovers';

export interface TaskRowTimerProps {
  taskId: string;
  isRunning: boolean;
  onToggle?: () => void;
  fallbackSeconds?: number;
}

export const TaskRowTimer: React.FC<TaskRowTimerProps> = React.memo(({ taskId, isRunning, onToggle, fallbackSeconds = 0 }) => {
  const storeSeconds = useFocusStore((s) => (s.activeTimerTaskId === taskId ? s.activeTimerSeconds : 0));
  const seconds = storeSeconds || fallbackSeconds;
  return (
    <button
      className="desk-timer-readout"
      title={isRunning ? 'Timer running. Click to pause.' : 'Timer paused. Click to resume.'}
      onClick={onToggle}
    >
      {formatTimerClock(seconds)}
      {!isRunning && <span>Paused</span>}
    </button>
  );
});
TaskRowTimer.displayName = 'TaskRowTimer';

export interface WorkspaceTaskRowProps {
  task: Task;
  onSelectTask: (id: string) => void;
  onStartFocus?: (id: string) => void;
  onStartSprint?: (id: string) => void;
  isKeyboardFocused?: boolean;
  featured?: boolean;
  showNextAction?: boolean;
  rank?: number;
  showEstimates?: boolean;
}

type RowContext = Pick<ReturnType<typeof useTaskContext>, 'toggleTaskStatus' | 'toggleTaskPinToday' | 'updateTask' | 'projects' | 'selectedTaskIds' | 'toggleTaskSelection' | 'focusSession' | 'activeTimerTaskId' | 'toggleTaskTimer' | 'settings'>;

export const WorkspaceTaskRow: React.FC<WorkspaceTaskRowProps> = React.memo(props => {
  const store = useContext(WorkspaceStoreContext);
  return store ? <ConnectedTaskRow {...props}/> : <ContextTaskRow {...props}/>;
});
const ContextTaskRow = (props: WorkspaceTaskRowProps) => <TaskRowContent {...props} context={useTaskContext()}/>;
const ConnectedTaskRow = React.memo((props: WorkspaceTaskRowProps) => {
  const projects = useTaskStore(state => state.projects);
  const settings = useTaskStore(state => state.settings);
  const selected = useUIStore(state => state.selectedTaskIds.includes(props.task.id));
  const focusSession = useFocusStore(state => state.focusSession?.taskId === props.task.id ? state.focusSession : null);
  const activeTimerTaskId = useFocusStore(state => state.activeTimerTaskId === props.task.id ? props.task.id : null);
  const context = useMemo<RowContext>(() => ({ ...useTaskStore.getState(), projects, settings, selectedTaskIds: selected ? [props.task.id] : [], toggleTaskSelection: useUIStore.getState().toggleTaskSelection, focusSession, activeTimerTaskId, toggleTaskTimer: (id: string) => window.dispatchEvent(new CustomEvent('flowtask:toggle-task-timer', { detail: id })) }), [projects, settings, selected, props.task.id, focusSession, activeTimerTaskId]);
  return <TaskRowContent {...props} context={context}/>;
});
ConnectedTaskRow.displayName = 'ConnectedTaskRow';
const TaskRowContent: React.FC<WorkspaceTaskRowProps & { context: RowContext }> = React.memo(({
  task,
  onSelectTask,
  onStartFocus,
  onStartSprint,
  isKeyboardFocused,
  featured,
  showNextAction,
  rank,
  showEstimates = true,
  context,
}) => {
  const today = useTodayStr();
  const domId = useId();
  const {
    toggleTaskStatus,
    toggleTaskPinToday,
    updateTask,
    projects = [],
    selectedTaskIds = [],
    toggleTaskSelection,
    focusSession,
    activeTimerTaskId,
    toggleTaskTimer,
  } = context;

  const isKeyboardFocusedRow = useUIStore((s) => s.focusedTaskId === task.id);
  const activePopover = useUIStore((s) => s.activePopover);
  const setActivePopover = useUIStore((s) => s.setActivePopover);
  const isTimerActive = useFocusStore((s) => s.activeTimerTaskId === task.id);
  const isTimerRunning = useFocusStore((s) => s.activeTimerTaskId === task.id && s.focusSession?.state === 'running');

  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const input = useRef<HTMLInputElement>(null);

  const done = task.status === 'done';
  const pinned = isTaskPinnedForDate(task, today);
  const selected = selectedTaskIds.includes(task.id);

  const active = isTimerActive || activeTimerTaskId === task.id;
  const running = isTimerRunning || (active && focusSession?.state === 'running');
  const fallbackSeconds = (context as unknown as { activeTimerSeconds?: number }).activeTimerSeconds ?? 0;

  const effectiveEstimate = getEffectiveTaskEstimate(task);
  const duration = effectiveEstimate || context.settings?.defaultTaskDuration || 30;
  const durationLabel =
    duration >= 60
      ? Math.floor(duration / 60) + 'h' + (duration % 60 ? ' ' + (duration % 60) + 'm' : '')
      : duration + 'm';
  const project = projects.find((p) => p.id === task.projectId);

  const commit = () => {
    const value = title.trim();
    if (value && value !== task.title) updateTask(task.id, { title: value });
    setTitle(value || task.title);
    setEditing(false);
  };

  const beginEdit = useCallback(() => {
    setTitle(task.title);
    setEditing(true);
    requestAnimationFrame(() => input.current?.select());
  }, [task.title]);

  useEffect(() => {
    const handleEditEvent = (e: Event) => {
      const custom = e as CustomEvent<string>;
      if (custom.detail === task.id) {
        beginEdit();
      }
    };
    window.addEventListener('flowtask:edit-task', handleEditEvent);
    return () => window.removeEventListener('flowtask:edit-task', handleEditEvent);
  }, [task.id, beginEdit]);

  const open = (event: React.MouseEvent) => {
    if (event.shiftKey) toggleTaskSelection?.(task.id);
    else onSelectTask(task.id);
  };

  const isFocused = Boolean(
    context.settings?.keyboardShortcutsEnabled !== false &&
    (isKeyboardFocused || isKeyboardFocusedRow)
  );

  return (
    <div
      className={`desk-task-row ${
        isFocused ? 'ring-2 ring-amber-500/80 border-amber-500/50 shadow-sm bg-[var(--bg-surface-hover)]' : ''
      }`}
      id={domId}
      data-task-id={task.id}
      data-featured={featured || undefined}
      data-done={done || undefined}
      data-selected={selected || undefined}
      data-keyboard-focused={isFocused ? 'true' : undefined}
      draggable={!task.scheduleLocked}
      onDragStart={(e) => {
        e.dataTransfer.setData(
          'application/json',
          JSON.stringify({ taskId: task.id, duration: effectiveEstimate || 30 })
        );
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        setMenu({ x: event.clientX, y: event.clientY });
      }}
    >
      {featured && (
        <span className="desk-task-rank" aria-label={'Priority ' + rank}>
          {String(rank).padStart(2, '0')}
        </span>
      )}
      <div className="desk-task-check touch-target-accessible flex items-center justify-center">
        <MorphCheckbox
          checked={done}
          onChange={() => {
            const willBeDone = !done;
            toggleTaskStatus(task.id);
            if (willBeDone && pinned) {
              celebrate({
                particleCount: 45,
                spread: 60,
                origin: { y: 0.7 },
                colors: ['#F59E0B', '#10B981', '#6366F1', '#EC4899', '#3B82F6'],
              });
            }
          }}
          priority={task.priority}
          ariaLabel={done ? 'Mark as incomplete' : 'Mark as complete'}
          size={18}
        />
      </div>
      <div className="desk-task-content">
        {editing ? (
          <input
            ref={input}
            autoFocus
            aria-label="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              }
              if (e.key === 'Escape') {
                e.stopPropagation();
                setTitle(task.title);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button
            className={'desk-task-title' + (done ? ' line-through' : '')}
            onClick={open}
            onDoubleClick={beginEdit}
            onKeyDown={(e) => {
              if (e.key === 'F2' && appShortcutAllowed(e.nativeEvent)) {
                e.preventDefault();
                beginEdit();
              }
            }}
          >
            {task.title}
          </button>
        )}
        {showNextAction && task.nextAction && !done && (
          <p className="desk-next-action">
            <ArrowRight size={13} />
            <span>{task.nextAction}</span>
          </p>
        )}
        <div className="desk-task-meta">
          {project && project.id !== 'inbox' && (
            <span>
              <i style={{ background: project.color }} />
              {project.name}
            </span>
          )}
          {task.priority && task.priority !== 'p4' && (
            <span
              data-priority={task.priority}
              role="button"
              tabIndex={0}
              className="cursor-pointer select-none"
              title="Change priority"
              onClick={(e) => {
                e.stopPropagation();
                setActivePopover({ type: 'priority', taskId: task.id });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  setActivePopover({ type: 'priority', taskId: task.id });
                }
              }}
            >
              <Flag size={11} />
              {task.priority.toUpperCase()}
            </span>
          )}
          {task.dueDate && (
            <span
              data-overdue={(task.dueDate < today && !done) || undefined}
              role="button"
              tabIndex={0}
              className="cursor-pointer select-none"
              title="Reschedule date"
              onClick={(e) => {
                e.stopPropagation();
                setActivePopover({ type: 'date', taskId: task.id });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  setActivePopover({ type: 'date', taskId: task.id });
                }
              }}
            >
              Due{' '}
              {task.dueDate === today
                ? 'today'
                : new Date(task.dueDate + 'T12:00:00').toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
            </span>
          )}
          {showEstimates && duration > 0 && (
            <span>
              <Clock size={11} />
              {durationLabel}
            </span>
          )}
          {!!task.subtasks?.length && (
            <span>
              {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length} subtasks
            </span>
          )}
          {task.scheduleLocked && (
            <span title="Schedule locked">
              <Lock size={11} />
              Locked
            </span>
          )}
          {task.recurrence && task.recurrence !== 'none' && (
            <span>
              <Repeat2 size={11} />
              {task.recurrence}
            </span>
          )}
          {task.blockedBy?.length ? <span>Blocked</span> : null}
        </div>
      </div>
      <div className="desk-task-actions">
        {active && (
          <TaskRowTimer
            taskId={task.id}
            isRunning={running}
            onToggle={() => toggleTaskTimer?.(task.id)}
            fallbackSeconds={fallbackSeconds}
          />
        )}
        {!done && (
          <button
            className="desk-icon-button desk-row-reveal touch-target-accessible"
            aria-label={pinned ? 'Remove from Top 3' : 'Pin to Top 3'}
            title={pinned ? 'Remove from Top 3' : 'Pin to Top 3'}
            aria-pressed={pinned}
            onClick={() => toggleTaskPinToday(task.id)}
          >
            <Star size={15} fill={pinned ? 'currentColor' : 'none'} />
          </button>
        )}
        {!done && toggleTaskTimer && (
          <button
            className="desk-icon-button desk-row-reveal touch-target-accessible"
            aria-label={running ? 'Pause tracking time' : active ? 'Resume tracking time' : 'Start live stopwatch'}
            title={running ? 'Pause tracking time' : active ? 'Resume tracking time' : 'Start live stopwatch'}
            onClick={() => toggleTaskTimer(task.id)}
          >
            {running ? <Pause size={15} /> : <Clock size={15} />}
          </button>
        )}
        {!done && onStartFocus && (
          <button
            className={featured ? 'desk-focus-task' : 'desk-icon-button desk-row-reveal touch-target-accessible'}
            aria-label={'Focus on ' + task.title}
            title={'Start focus on "' + task.title + '"'}
            onClick={() =>
              task.sessionMetadata?.isSession && onStartSprint ? onStartSprint(task.id) : onStartFocus(task.id)
            }
          >
            <Play size={14} />
            {featured && <span>Focus</span>}
          </button>
        )}
        {!done && (
          <button
            className="desk-icon-button desk-row-reveal touch-target-accessible"
            aria-label={'Break into steps: ' + task.title}
            title="Break into steps / Granularity slider"
            onClick={(e) => {
              e.stopPropagation();
              setActivePopover({ type: 'granularity', taskId: task.id });
            }}
          >
            <Wand2 size={14} className="text-amber-500" />
          </button>
        )}
        <button
          className="desk-icon-button desk-row-reveal touch-target-accessible"
          aria-label={'More actions for ' + task.title}
          aria-haspopup="dialog"
          aria-expanded={!!menu}
          onClick={(e) => {
            const bounds = e.currentTarget.getBoundingClientRect();
            setMenu(menu ? null : { x: bounds.right - 200, y: bounds.bottom + 6 });
          }}
        >
          <MoreHorizontal size={17} />
        </button>
      </div>
      {menu &&
        createPortal(
          <TaskContextMenu
            task={task}
            position={menu}
            onClose={() => setMenu(null)}
            onStartFocus={onStartFocus}
            onEditTitle={beginEdit}
          />,
          document.body
        )}
      {activePopover?.taskId === task.id && activePopover.type === 'priority' &&
        createPortal(
          <PriorityPickerPopover
            taskId={task.id}
            currentPriority={task.priority}
            onSelect={(priority) => updateTask(task.id, { priority })}
            onClose={() => setActivePopover(null)}
            anchorRect={document.getElementById(domId)?.getBoundingClientRect()}
          />,
          document.body
        )}
      {activePopover?.taskId === task.id && activePopover.type === 'date' &&
        createPortal(
          <DatePickerPopover
            taskId={task.id}
            currentDate={task.plannedDate || task.dueDate}
            onSelectDate={(date, isSomeday) =>
              updateTask(task.id, {
                plannedDate: date,
                isSomeday: !!isSomeday,
                ...(isSomeday ? { isPinnedToday: false } : {}),
              })
            }
            onClose={() => setActivePopover(null)}
            anchorRect={document.getElementById(domId)?.getBoundingClientRect()}
          />,
          document.body
        )}
      {activePopover?.taskId === task.id && activePopover.type === 'granularity' &&
        createPortal(
          <GranularitySliderPopover
            taskId={task.id}
            taskTitle={task.title}
            onApplySubtasks={(subtasks) => {
              const existing = task.subtasks || [];
              updateTask(task.id, { subtasks: [...existing, ...subtasks] });
            }}
            onClose={() => setActivePopover(null)}
            anchorRect={document.getElementById(domId)?.getBoundingClientRect()}
          />,
          document.body
        )}
    </div>
  );
});
TaskRowContent.displayName = 'TaskRowContent';
WorkspaceTaskRow.displayName = 'WorkspaceTaskRow';
