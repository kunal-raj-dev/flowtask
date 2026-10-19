import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  CheckSquare,
} from 'lucide-react';

interface TaskContextMenuProps {
  task: Task;
  position: { x: number; y: number; triggerTop?: number; triggerBottom?: number; alignRight?: boolean };
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
    toggleTaskSelection,
    selectedTaskIds,
  } = useTaskContext();

  const menuRef = useRef<HTMLDivElement>(null);

  const todayStr = useTodayStr();
  const tomorrowStr = useTomorrowStr();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);

  const isDone = task.status === 'done';

  // Click outside and Esc listener
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation();
        onClose();
      }
      if (['ArrowDown','ArrowUp','Home','End'].includes(e.key)) {
        const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || [])];
        const index = items.indexOf(document.activeElement as HTMLButtonElement);
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        e.preventDefault(); e.stopPropagation(); items[next]?.focus();
      }
    };

    document.addEventListener('pointerdown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Viewport bounds calculation: ensure menu doesn't overflow screen, clip items, or obstruct trigger button
  const menuWidth = 208;
  const estimatedMenuHeight = 440;

  const rawX = position.alignRight ? position.x - menuWidth : position.x;
  const posX = Math.min(Math.max(16, rawX), window.innerWidth - menuWidth - 16);

  let posY = position.y;
  if (position.triggerTop !== undefined && position.triggerBottom !== undefined) {
    if (position.triggerBottom + estimatedMenuHeight + 8 <= window.innerHeight) {
      posY = position.triggerBottom + 4;
    } else if (position.triggerTop - estimatedMenuHeight - 8 >= 16) {
      posY = position.triggerTop - estimatedMenuHeight - 4;
    } else {
      posY = Math.max(16, window.innerHeight - estimatedMenuHeight - 16);
    }
  } else {
    posY = Math.min(position.y, Math.max(16, window.innerHeight - estimatedMenuHeight - 16));
  }

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={menuRef}
      role="dialog"
      aria-label={`Actions for ${task.title}`}
      data-overlay-open="true"
      style={{ left: `${Math.max(16, posX)}px`, top: `${Math.max(16, posY)}px` }}
      className="fixed z-50 w-52 max-h-[calc(100vh-32px)] overflow-y-auto bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] rounded-2xl shadow-modal p-1.5 text-xs text-[var(--text-primary)] card-surface animate-slide-down select-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Complete toggle */}
      <button
        type="button"
        onClick={() => handleAction(() => toggleTaskStatus(task.id))}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors text-left cursor-pointer active:scale-[0.98]"
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
          type="button"
          onClick={() => handleAction(onEditTitle)}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors text-left cursor-pointer active:scale-[0.98]"
        >
          <span className="text-[var(--text-muted)] font-mono text-[11px]">T</span>
          <span>Rename Title</span>
        </button>
      )}

      {/* Duplicate task */}
      <button
        type="button"
        onClick={() => handleAction(() => duplicateTask(task.id))}
        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors text-left cursor-pointer active:scale-[0.98]"
      >
        <span className="flex items-center gap-2.5">
          <Copy size={14} className="text-indigo-500" />
          <span>Duplicate Task</span>
        </span>
        <kbd className="text-[9px] text-[var(--text-muted)] font-mono">Clone</kbd>
      </button>

      {/* Select task for batch actions */}
      <button
        type="button"
        onClick={() => handleAction(() => toggleTaskSelection(task.id))}
        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors text-left cursor-pointer active:scale-[0.98]"
      >
        <span className="flex items-center gap-2.5">
          <CheckSquare size={14} className="text-[var(--color-brand)]" />
          <span>{selectedTaskIds.includes(task.id) ? 'Deselect Task' : 'Select for Batch'}</span>
        </span>
        <kbd className="text-[9px] text-[var(--text-muted)] font-mono">Space</kbd>
      </button>

      <div className="h-[1px] bg-[var(--border-hairline)] my-1" />

      {/* Date reschedule options */}
      <button
        type="button"
        onClick={() =>
          handleAction(() =>
            updateTask(task.id, {
              plannedDate: todayStr,
              isSomeday: false,
              dueDate: task.dueDate && task.dueDate < todayStr ? todayStr : task.dueDate,
            })
          )
        }
        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors text-left cursor-pointer active:scale-[0.98]"
      >
        <span className="flex items-center gap-2.5">
          <Sun size={14} className="text-amber-500" />
          <span>Move to Today</span>
        </span>
        <kbd className="text-[9px] text-[var(--text-muted)] font-mono">t</kbd>
      </button>

      <button
        type="button"
        onClick={() =>
          handleAction(() =>
            updateTask(task.id, {
              plannedDate: todayStr,
              isSomeday: false,
              isEvening: !task.isEvening,
            })
          )
        }
        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors text-left cursor-pointer active:scale-[0.98]"
      >
        <span className="flex items-center gap-2.5">
          <Moon size={14} className="text-indigo-500" />
          <span>{task.isEvening ? 'Move to Daytime' : 'This Evening'}</span>
        </span>
        <kbd className="text-[9px] text-[var(--text-muted)] font-mono">e</kbd>
      </button>

      <button
        type="button"
        onClick={() =>
          handleAction(() =>
            updateTask(task.id, {
              plannedDate: tomorrowStr,
              isSomeday: false,
              isPinnedToday: false,
              dueDate: task.dueDate && task.dueDate <= todayStr ? tomorrowStr : task.dueDate,
            })
          )
        }
        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors text-left cursor-pointer active:scale-[0.98]"
      >
        <span className="flex items-center gap-2.5">
          <Sunrise size={14} className="text-orange-500" />
          <span>Move to Tomorrow</span>
        </span>
        <kbd className="text-[9px] text-[var(--text-muted)] font-mono">m</kbd>
      </button>

      <button
        type="button"
        onClick={() =>
          handleAction(() =>
            updateTask(task.id, {
              isSomeday: true,
              plannedDate: undefined,
              dueDate: undefined,
              isPinnedToday: false,
            })
          )
        }
        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors text-left cursor-pointer active:scale-[0.98]"
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
        type="button"
        onClick={() => handleAction(() => toggleTaskPinToday(task.id))}
        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors text-left cursor-pointer active:scale-[0.98]"
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
          type="button"
          onClick={() => handleAction(() => onStartFocus(task.id))}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors text-left cursor-pointer active:scale-[0.98]"
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
        <div className="flex items-center gap-1.5">
          {(['p1', 'p2', 'p3', 'p4'] as Priority[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handleAction(() => updateTask(task.id, { priority: p }))}
              title={`Set Priority ${p.toUpperCase()}`}
              aria-label={`Set Priority ${p.toUpperCase()}`}
              className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold uppercase transition-all cursor-pointer active:scale-90 ${
                task.priority === p
                  ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-950 shadow-xs'
                  : 'text-[var(--text-muted)] hover:bg-stone-200/60 dark:hover:bg-white/[0.06] hover:text-[var(--text-primary)]'
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
        type="button"
        onClick={() => handleAction(() => deleteTask(task.id))}
        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 transition-colors text-left cursor-pointer active:scale-[0.98]"
      >
        <span className="flex items-center gap-2.5">
          <Trash2 size={14} />
          <span>Delete Task</span>
        </span>
        <kbd className="text-[9px] text-rose-400 font-mono">Del</kbd>
      </button>
    </div>,
    document.body
  );
};
