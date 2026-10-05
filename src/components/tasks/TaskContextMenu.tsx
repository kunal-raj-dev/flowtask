import React, { useEffect, useRef } from 'react';
import type { Task, Priority } from '../../types/task';
import { useTaskContext } from '../../context/TaskContext';
import { useTodayStr, useTomorrowStr } from '../../hooks/useCurrentDate';
import {
  Sun,
  Moon,
  Sunrise,
  Lightbulb,
  Star,
  Timer,
  Trash2,
  Flag,
  CheckCircle2,
  Circle,
  Copy,
} from 'lucide-react';

interface TaskContextMenuProps {
  task: Task;
  position: { x: number; y: number };
  onClose: () => void;
  onStartFocus?: (taskId: string) => void;
  onEditTitle?: () => void;
}

export const TaskContextMenu: React.FC<TaskContextMenuProps> = ({
  task,
  position,
  onClose,
  onStartFocus,
  onEditTitle,
}) => {
  const {
    updateTask,
    deleteTask,
    toggleTaskStatus,
    toggleTaskPinToday,
    duplicateTask,
  } = useTaskContext();

  const menuRef = useRef<HTMLDivElement>(null);

  const todayStr = useTodayStr();
  const tomorrowStr = useTomorrowStr();

  const isDone = task.status === 'done';

  // Click outside and Esc listener
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Viewport bounds calculation
  const menuWidth = 200;
  const menuHeight = 280;
  const posX = Math.min(position.x, window.innerWidth - menuWidth - 16);
  const posY = Math.min(position.y, window.innerHeight - menuHeight - 16);

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      style={{ left: `${Math.max(16, posX)}px`, top: `${Math.max(16, posY)}px` }}
      className="fixed z-50 w-52 bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] rounded-2xl shadow-modal p-1.5 text-xs text-[var(--text-primary)] card-surface animate-slide-down select-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Complete toggle */}
      <button
        onClick={() => handleAction(() => toggleTaskStatus(task.id))}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors text-left"
      >
        {isDone ? (
          <>
            <Circle size={14} className="text-[var(--text-muted)]" />
            <span>Mark Incomplete</span>
          </>
        ) : (
          <>
            <CheckCircle2 size={14} className="text-emerald-500" />
            <span>Mark Complete</span>
          </>
        )}
      </button>

      {/* Rename title inline */}
      {onEditTitle && (
        <button
          onClick={() => handleAction(onEditTitle)}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors text-left"
        >
          <span className="text-[var(--text-muted)] font-mono text-[11px]">T</span>
          <span>Rename Title</span>
        </button>
      )}

      {/* Duplicate task */}
      <button
        onClick={() => handleAction(() => duplicateTask(task.id))}
        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors text-left"
      >
        <span className="flex items-center gap-2.5">
          <Copy size={14} className="text-indigo-500" />
          <span>Duplicate Task</span>
        </span>
        <kbd className="text-[9px] text-[var(--text-muted)] font-mono">Clone</kbd>
      </button>

      <div className="h-[1px] bg-[var(--border-hairline)] my-1" />

      {/* Date reschedule options */}
      <button
        onClick={() => handleAction(() => updateTask(task.id, { plannedDate: todayStr }))}
        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors text-left"
      >
        <span className="flex items-center gap-2.5">
          <Sun size={14} className="text-amber-500" />
          <span>Move to Today</span>
        </span>
        <kbd className="text-[9px] text-[var(--text-muted)] font-mono">t</kbd>
      </button>

      <button
        onClick={() =>
          handleAction(() =>
            updateTask(task.id, {
              plannedDate: todayStr,
              isEvening: !task.isEvening,
            })
          )
        }
        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors text-left"
      >
        <span className="flex items-center gap-2.5">
          <Moon size={14} className="text-indigo-500" />
          <span>{task.isEvening ? 'Move to Daytime' : 'This Evening'}</span>
        </span>
        <kbd className="text-[9px] text-[var(--text-muted)] font-mono">e</kbd>
      </button>

      <button
        onClick={() => handleAction(() => updateTask(task.id, { plannedDate: tomorrowStr }))}
        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors text-left"
      >
        <span className="flex items-center gap-2.5">
          <Sunrise size={14} className="text-orange-500" />
          <span>Move to Tomorrow</span>
        </span>
        <kbd className="text-[9px] text-[var(--text-muted)] font-mono">m</kbd>
      </button>

      <button
        onClick={() =>
          handleAction(() =>
            updateTask(task.id, { isSomeday: true, plannedDate: undefined, isPinnedToday: false })
          )
        }
        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors text-left"
      >
        <span className="flex items-center gap-2.5">
          <Lightbulb size={14} className="text-yellow-500" />
          <span>Move to Someday</span>
        </span>
        <kbd className="text-[9px] text-[var(--text-muted)] font-mono">s</kbd>
      </button>

      <div className="h-[1px] bg-[var(--border-hairline)] my-1" />

      {/* Top 3 Focus */}
      <button
        onClick={() => handleAction(() => toggleTaskPinToday(task.id))}
        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors text-left"
      >
        <span className="flex items-center gap-2.5">
          <Star
            size={14}
            className={task.isPinnedToday ? 'fill-amber-500 text-amber-500' : 'text-amber-500'}
          />
          <span>{task.isPinnedToday ? 'Unpin from Top 3' : 'Pin to Top 3 Focus'}</span>
        </span>
        <kbd className="text-[9px] text-[var(--text-muted)] font-mono">f</kbd>
      </button>

      {/* Focus Timer */}
      {onStartFocus && !isDone && (
        <button
          onClick={() => handleAction(() => onStartFocus(task.id))}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors text-left"
        >
          <Timer size={14} className="text-indigo-500" />
          <span>Start Focus Timer</span>
        </button>
      )}

      <div className="h-[1px] bg-[var(--border-hairline)] my-1" />

      {/* Priority Picker Row */}
      <div className="px-2.5 py-1 flex items-center justify-between">
        <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] flex items-center gap-1.5">
          <Flag size={11} />
          Priority
        </span>
        <div className="flex items-center gap-1">
          {(['p1', 'p2', 'p3', 'p4'] as Priority[]).map((p) => (
            <button
              key={p}
              onClick={() => handleAction(() => updateTask(task.id, { priority: p }))}
              title={`Set Priority ${p.toUpperCase()}`}
              className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold uppercase transition-all ${
                task.priority === p
                  ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-950 shadow-xs'
                  : 'text-[var(--text-muted)] hover:bg-stone-200/60 dark:hover:bg-white/[0.06]'
              }`}
            >
              {p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[1px] bg-[var(--border-hairline)] my-1" />

      {/* Delete */}
      <button
        onClick={() => handleAction(() => deleteTask(task.id))}
        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 transition-colors text-left"
      >
        <span className="flex items-center gap-2.5">
          <Trash2 size={14} />
          <span>Delete Task</span>
        </span>
        <kbd className="text-[9px] text-rose-400 font-mono">Del</kbd>
      </button>
    </div>
  );
};
