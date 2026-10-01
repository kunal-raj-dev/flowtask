import React, { useState, useRef, useEffect } from 'react';
import type { Task } from '../../types/task';
import { useTaskContext } from '../../context/TaskContext';
import { TaskContextMenu } from './TaskContextMenu';
import {
  Check,
  Calendar,
  Clock,
  Repeat,
  Star,
  Timer,
  Trash2,
  ListTodo,
  MoreHorizontal,
} from 'lucide-react';
import { formatLocalDate } from '../../utils/nlpParser';

interface TaskCardProps {
  task: Task;
  onSelectTask: (taskId: string) => void;
  onStartFocus?: (taskId: string) => void;
  isKeyboardFocused?: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onSelectTask,
  onStartFocus,
  isKeyboardFocused = false,
}) => {
  const {
    toggleTaskStatus,
    toggleTaskPinToday,
    updateTask,
    deleteTask,
    projects,
  } = useTaskContext();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitleDraft(task.title);
  }, [task.title]);

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  const handleSaveTitle = () => {
    if (titleDraft.trim() && titleDraft.trim() !== task.title) {
      updateTask(task.id, { title: titleDraft.trim() });
    } else {
      setTitleDraft(task.title);
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setTitleDraft(task.title);
      setIsEditingTitle(false);
    }
  };

  const isDone = task.status === 'done';
  const todayStr = formatLocalDate(new Date());

  // Determine due date state
  const isOverdue = task.dueDate && task.dueDate < todayStr && !isDone;
  const isToday = task.dueDate === todayStr;

  const project = projects.find((p) => p.id === task.projectId);

  // Subtask progress
  const totalSubtasks = task.subtasks?.length || 0;
  const completedSubtasks = task.subtasks?.filter((s) => s.completed).length || 0;

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'p1':
        return 'text-rose-600 dark:text-rose-400 bg-gradient-to-r from-rose-500/15 to-red-500/10 border-rose-500/30';
      case 'p2':
        return 'text-amber-600 dark:text-amber-400 bg-gradient-to-r from-amber-500/15 to-orange-500/10 border-amber-500/30';
      case 'p3':
        return 'text-sky-600 dark:text-sky-400 bg-gradient-to-r from-sky-500/15 to-blue-500/10 border-sky-500/30';
      default:
        return 'text-[var(--text-muted)] bg-stone-500/10 border-stone-500/20';
    }
  };

  const formatDueDateLabel = (dueDateStr?: string) => {
    if (!dueDateStr) return null;
    if (dueDateStr === todayStr) return 'Today';
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (dueDateStr === formatLocalDate(tomorrow)) return 'Tomorrow';
    return dueDateStr;
  };

  return (
    <div
      id={`task-${task.id}`}
      onClick={() => onSelectTask(task.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
      }}
      className={`group relative flex items-start gap-3.5 p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer ${
        isKeyboardFocused
          ? 'ring-2 ring-amber-500/80 dark:ring-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.22)] -translate-y-[1px]'
          : ''
      } ${
        isDone
          ? 'bg-[var(--bg-surface-l1)]/60 border-[var(--border-hairline)] opacity-60'
          : task.isPinnedToday
          ? 'bg-gradient-to-r from-amber-500/[0.10] via-orange-400/[0.05] to-indigo-500/[0.03] dark:from-amber-500/[0.08] dark:via-amber-500/[0.03] dark:to-transparent border-amber-400/60 dark:border-amber-500/40 shadow-[0_4px_22px_-2px_rgba(245,158,11,0.18)] dark:shadow-glow-amber card-surface hover:border-amber-500/80 hover:-translate-y-[1px]'
          : 'bg-white dark:bg-[var(--bg-surface-l2)] border-stone-200/80 dark:border-[var(--border-hairline)] shadow-card hover:border-stone-300 dark:hover:border-stone-700 hover:shadow-elevated hover:-translate-y-[1px] card-surface'
      }`}
    >
      {/* Tactile Micro-Spring Checkbox Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggleTaskStatus(task.id);
        }}
        className={`mt-0.5 w-5 h-5 rounded-[7px] flex-shrink-0 flex items-center justify-center border transition-all duration-150 ${
          isDone
            ? 'bg-gradient-to-br from-stone-900 to-stone-800 dark:from-white dark:to-stone-200 border-stone-800 dark:border-white text-white dark:text-stone-950 shadow-xs'
            : 'border-stone-300 dark:border-stone-600 hover:border-amber-500 dark:hover:border-amber-400 hover:ring-4 hover:ring-amber-500/15 dark:hover:ring-amber-400/20 group-hover:scale-105 bg-[var(--bg-surface-l2)]'
        }`}
        aria-label={isDone ? 'Mark as incomplete' : 'Mark as complete'}
      >
        {isDone && <Check size={12} className="animate-check-spring stroke-[3.5]" />}
      </button>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={handleTitleKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-transparent text-sm font-semibold text-[var(--text-primary)] outline-none border-b-2 border-amber-500 pb-0.5"
            />
          ) : (
            <span
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (!isDone) setIsEditingTitle(true);
              }}
              title="Double-click to edit title"
              className={`text-sm leading-snug font-semibold transition-all ${
                isDone
                  ? 'line-through text-[var(--text-muted)]'
                  : 'text-[var(--text-primary)]'
              }`}
            >
              {task.title}
            </span>
          )}

          {/* Priority pip */}
          {task.priority !== 'p4' && !isDone && (
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider shadow-xs ${getPriorityStyle(
                task.priority
              )}`}
            >
              {task.priority}
            </span>
          )}

          {/* Pinned Top 3 indicator */}
          {task.isPinnedToday && !isDone && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/35 uppercase tracking-wider shadow-xs">
              <Star size={10} className="fill-amber-500 text-amber-500" />
              Focus
            </span>
          )}
        </div>

        {/* Task description preview if present */}
        {task.description && !isDone && (
          <p className="text-xs text-[var(--text-secondary)] line-clamp-1 mt-1 font-normal">
            {task.description}
          </p>
        )}

        {/* Metadata Badges */}
        <div className="flex flex-wrap items-center gap-2 mt-2.5">
          {/* Project tag */}
          {project && project.id !== 'inbox' && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-secondary)]">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0 ring-1 ring-stone-900/10 dark:ring-white/20"
                style={{ backgroundColor: project.color }}
              />
              {project.name}
            </span>
          )}

          {/* Due date badge */}
          {task.dueDate && (
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                isOverdue
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25'
                  : isToday
                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25 font-semibold'
                  : 'text-[var(--text-secondary)] border-[var(--border-subtle)] bg-[var(--bg-surface-l1)]/50'
              }`}
            >
              <Calendar size={11} />
              {formatDueDateLabel(task.dueDate)}
              {task.dueTime ? ` @ ${task.dueTime}` : ''}
            </span>
          )}

          {/* Subtasks progress pill */}
          {totalSubtasks > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-[var(--bg-surface-l1)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
              <ListTodo size={11} />
              {completedSubtasks}/{totalSubtasks}
            </span>
          )}

          {/* Estimated duration */}
          {task.estimatedMinutes && !isDone && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-muted)]">
              <Clock size={11} />
              {task.estimatedMinutes >= 60
                ? `${task.estimatedMinutes / 60}h`
                : `${task.estimatedMinutes}m`}
            </span>
          )}

          {/* Recurring badge */}
          {task.recurrence && task.recurrence !== 'none' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-600 dark:text-sky-400">
              <Repeat size={11} />
              <span className="capitalize">{task.recurrence}</span>
            </span>
          )}
        </div>
      </div>

      {/* Hover action tools */}
      <div
        className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Rule of 3 Today Pin button */}
        {!isDone && (
          <button
            type="button"
            onClick={() => toggleTaskPinToday(task.id)}
            title={task.isPinnedToday ? 'Unpin from Top 3 Focus' : 'Pin to Top 3 Focus for Today'}
            className={`p-1.5 rounded-lg transition-colors ${
              task.isPinnedToday
                ? 'text-amber-500 hover:text-amber-600 bg-amber-500/10'
                : 'text-stone-400 hover:text-amber-500 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
          >
            <Star size={14} className={task.isPinnedToday ? 'fill-current' : ''} />
          </button>
        )}

        {/* Start Focus Timer button */}
        {!isDone && onStartFocus && (
          <button
            type="button"
            onClick={() => onStartFocus(task.id)}
            title="Start Focus Timer on this task"
            className="p-1.5 rounded-lg text-stone-400 hover:text-indigo-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <Timer size={14} />
          </button>
        )}

        {/* Context Menu Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            setContextMenu({ x: rect.right, y: rect.bottom });
          }}
          title="More options (or right click)"
          className="p-1.5 rounded-lg text-stone-400 hover:text-[var(--text-primary)] hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
        >
          <MoreHorizontal size={14} />
        </button>

        {/* Delete button */}
        <button
          type="button"
          onClick={() => deleteTask(task.id)}
          title="Delete task"
          className="p-1.5 rounded-lg text-stone-400 hover:text-rose-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Floating Right-Click Context Menu */}
      {contextMenu && (
        <TaskContextMenu
          task={task}
          position={contextMenu}
          onClose={() => setContextMenu(null)}
          onStartFocus={onStartFocus}
          onEditTitle={() => setIsEditingTitle(true)}
        />
      )}
    </div>
  );
};
