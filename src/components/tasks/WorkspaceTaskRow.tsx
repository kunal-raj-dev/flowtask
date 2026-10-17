import React, { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Circle, Star, Play, Pause, MoreHorizontal, Flag, Lock, Repeat2, ArrowRight, Clock } from 'lucide-react';
import type { Task } from '../../types/task';
import { useTaskContext } from '../../context/TaskContext';
import { useFocusStore } from '../../store/useFocusStore';
import { useUIStore } from '../../store/useUIStore';
import { useTodayStr } from '../../hooks/useCurrentDate';
import { isFocusTask } from '../../utils/taskSelectors';
import { formatTimerClock } from '../../utils/focusTimeFormat';
import { audioEngine } from '../../utils/audioEngine';
import { TaskContextMenu } from './TaskContextMenu';

export interface WorkspaceTaskRowProps {
  task: Task; onSelectTask: (id: string) => void; onStartFocus?: (id: string) => void;
  onStartSprint?: (id: string) => void; isKeyboardFocused?: boolean; featured?: boolean; showNextAction?: boolean; rank?: number; showEstimates?: boolean;
}
export const WorkspaceTaskRow: React.FC<WorkspaceTaskRowProps> = ({ task, onSelectTask, onStartFocus, onStartSprint, isKeyboardFocused, featured, showNextAction, rank, showEstimates = true }) => {
  const context = useTaskContext(), today = useTodayStr(), domId = useId();
  const { toggleTaskStatus, toggleTaskPinToday, updateTask, projects = [], selectedTaskIds = [], toggleTaskSelection, focusSession, activeTimerTaskId, toggleTaskTimer } = context;
  const keyboardId = useUIStore(s => s.focusedTaskId);
  const seconds = useFocusStore(s => s.activeTimerTaskId === task.id ? s.activeTimerSeconds : 0);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null), [editing, setEditing] = useState(false), [title, setTitle] = useState(task.title);
  const input = useRef<HTMLInputElement>(null);
  const done = task.status === 'done', pinned = isFocusTask(task, today), selected = selectedTaskIds.includes(task.id);
  const active = activeTimerTaskId === task.id, running = active && focusSession?.state === 'running';
  const elapsed = (context as unknown as { activeTimerSeconds?: number }).activeTimerSeconds ?? seconds;
  const duration = task.estimatedMinutes || 0;
  const durationLabel = duration >= 60 ? Math.floor(duration / 60) + 'h' + (duration % 60 ? ' ' + duration % 60 + 'm' : '') : duration + 'm';
  const project = projects.find(p => p.id === task.projectId);
  const commit = () => { const value = title.trim(); if (value && value !== task.title) updateTask(task.id, { title: value }); setTitle(value || task.title); setEditing(false); };
  const beginEdit = () => { setTitle(task.title); setEditing(true); requestAnimationFrame(() => input.current?.select()); };
  const open = (event: React.MouseEvent) => { if (event.shiftKey) toggleTaskSelection?.(task.id); else onSelectTask(task.id); };
  return <div className="desk-task-row" id={domId} data-task-id={task.id} data-featured={featured || undefined} data-done={done || undefined} data-selected={selected || undefined} data-keyboard-focused={isKeyboardFocused || keyboardId === task.id || undefined}
    onContextMenu={event => { event.preventDefault(); setMenu({ x: event.clientX, y: event.clientY }); }}>
    {featured && <span className="desk-task-rank" aria-label={'Priority ' + rank}>{String(rank).padStart(2, '0')}</span>}
    <button className="desk-task-check" role="checkbox" aria-checked={done} aria-label={done ? 'Mark as incomplete' : 'Mark as complete'} title={(done ? 'Reopen ' : 'Complete ') + task.title} onClick={() => { audioEngine.playPopSound(); if (!done) audioEngine.playCompletionChime(); toggleTaskStatus(task.id); }}>{done ? <Check size={14}/> : <Circle size={20}/>}</button>
    <div className="desk-task-content">{editing ? <input ref={input} autoFocus aria-label="Task title" value={title} onChange={e => setTitle(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') { e.stopPropagation(); setTitle(task.title); setEditing(false); } }}/> : <button className={'desk-task-title' + (done ? ' line-through' : '')} onClick={open} onDoubleClick={beginEdit} onKeyDown={e => { if (e.key === 'F2') { e.preventDefault(); beginEdit(); } }}>{task.title}</button>}
      {showNextAction && task.nextAction && !done && <p className="desk-next-action"><ArrowRight size={13}/><span>{task.nextAction}</span></p>}
      <div className="desk-task-meta">
        {project && project.id !== 'inbox' && <span><i style={{ background: project.color }}/>{project.name}</span>}
        {task.priority !== 'p4' && <span data-priority={task.priority}><Flag size={11}/>{task.priority.toUpperCase()}</span>}
        {task.dueDate && <span data-overdue={task.dueDate < today && !done || undefined}>Due {task.dueDate === today ? 'today' : new Date(task.dueDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
        {showEstimates && duration > 0 && <span><Clock size={11}/>{durationLabel}</span>}
        {!!task.subtasks?.length && <span>{task.subtasks.filter(s => s.completed).length}/{task.subtasks.length} subtasks</span>}
        {task.scheduleLocked && <span title="Schedule locked"><Lock size={11}/>Locked</span>}
        {task.recurrence && task.recurrence !== 'none' && <span><Repeat2 size={11}/>{task.recurrence}</span>}
        {task.blockedBy?.length ? <span>Blocked</span> : null}
      </div>
    </div>
    <div className="desk-task-actions">
      {active && <button className="desk-timer-readout" title={running ? 'Timer running. Click to pause.' : 'Timer paused. Click to resume.'} onClick={() => toggleTaskTimer?.(task.id)}>{formatTimerClock(elapsed)}{!running && <span>Paused</span>}</button>}
      {!done && <button className="desk-icon-button desk-row-reveal" aria-label={pinned ? 'Remove from Top 3' : 'Pin to Top 3'} title={pinned ? 'Remove from Top 3' : 'Pin to Top 3'} aria-pressed={pinned} onClick={() => toggleTaskPinToday(task.id)}><Star size={15} fill={pinned ? 'currentColor' : 'none'}/></button>}
      {!done && toggleTaskTimer && <button className="desk-icon-button desk-row-reveal" aria-label={running ? 'Pause tracking time' : active ? 'Resume tracking time' : 'Start live stopwatch'} title={running ? 'Pause tracking time' : active ? 'Resume tracking time' : 'Start live stopwatch'} onClick={() => toggleTaskTimer(task.id)}>{running ? <Pause size={15}/> : <Clock size={15}/>}</button>}
      {!done && onStartFocus && <button className={featured ? 'desk-focus-task' : 'desk-icon-button desk-row-reveal'} aria-label={'Focus on ' + task.title} title={'Start focus on "' + task.title + '"'} onClick={() => task.sessionMetadata?.isSession && onStartSprint ? onStartSprint(task.id) : onStartFocus(task.id)}><Play size={14}/>{featured && <span>Focus</span>}</button>}
      <button className="desk-icon-button desk-row-reveal" aria-label={'More actions for ' + task.title} aria-haspopup="dialog" aria-expanded={!!menu} onClick={e => { const bounds = e.currentTarget.getBoundingClientRect(); setMenu(menu ? null : { x: bounds.right - 200, y: bounds.bottom + 6 }); }}><MoreHorizontal size={17}/></button>
    </div>
    {menu && createPortal(<TaskContextMenu task={task} position={menu} onClose={() => setMenu(null)} onStartFocus={onStartFocus} onEditTitle={beginEdit}/>, document.body)}
  </div>;
};
