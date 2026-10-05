import React, { useState, useRef, useEffect } from 'react';
import { useTaskContext } from '../../../context/TaskContext';
import type { Task } from '../../../types/task';
import {
  X,
  Star,
  Moon,
  Timer,
  Trash2,
  Copy,
  GitMerge,
  Archive,
  MoreHorizontal,
} from 'lucide-react';

interface TaskDrawerHeaderProps {
  task: Task;
  onClose: () => void;
  onStartFocus: (taskId: string) => void;
  onOpenMergeModal: () => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchMove?: (e: React.TouchEvent) => void;
  onTouchEnd?: () => void;
}

export const TaskDrawerHeader: React.FC<TaskDrawerHeaderProps> = ({
  task,
  onClose,
  onStartFocus,
  onOpenMergeModal,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}) => {
  const {
    updateTask,
    deleteTask,
    archiveTask,
    toggleTaskStatus,
    toggleTaskPinToday,
    duplicateTask,
  } = useTaskContext();

  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const isDone = task.status === 'done';

  // Click outside to close action menu
  useEffect(() => {
    if (!isActionMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setIsActionMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isActionMenuOpen]);

  return (
    <>
      {/* Mobile Pull Handle */}
      <div
        className="w-full pt-3 pb-1 flex justify-center md:hidden cursor-grab active:cursor-grabbing select-none"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="w-12 h-1.5 rounded-full bg-stone-300 dark:bg-stone-600" />
      </div>

      {/* Drawer Header */}
      <div
        className="px-4 py-3 border-b border-[var(--border-hairline)] flex items-center justify-between bg-[var(--bg-surface-l1)]"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => toggleTaskStatus(task.id)}
            className={`w-5 h-5 rounded-full flex items-center justify-center border active:scale-85 transition-all duration-150 ${
              isDone
                ? 'bg-stone-900 dark:bg-white border-stone-900 dark:border-white text-white dark:text-stone-950 shadow-xs'
                : 'border-stone-400/80 dark:border-stone-500/80 hover:border-amber-500 hover:ring-2 hover:ring-amber-500/20 bg-transparent'
            }`}
            aria-label={isDone ? 'Mark as incomplete' : 'Mark as complete'}
          >
            {isDone && (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-3 h-3 animate-check-spring"
              >
                <polyline points="20 6 9 17 4 12" className="animate-check-draw" />
              </svg>
            )}
          </button>
          <span className="text-xs font-semibold text-[var(--text-secondary)]">
            {isDone ? 'Completed Task' : 'Active Task'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Top 3 Star Pin button */}
          <button
            type="button"
            onClick={() => toggleTaskPinToday(task.id)}
            title={task.isPinnedToday ? 'Unpin from Top 3 Focus' : 'Pin to Top 3 Focus'}
            aria-label={task.isPinnedToday ? 'Unpin from Top 3 Focus' : 'Pin to Top 3 Focus'}
            className={`p-1.5 rounded-lg transition-all ${
              task.isPinnedToday
                ? 'text-amber-500 bg-amber-500/15 border border-amber-500/30 shadow-xs'
                : 'text-[var(--text-muted)] hover:text-amber-500 hover:bg-[var(--bg-surface-l2)]'
            }`}
          >
            <Star size={15} className={task.isPinnedToday ? 'fill-current' : ''} />
          </button>

          {/* Things 3-style This Evening Toggle button */}
          <button
            type="button"
            onClick={() => updateTask(task.id, { isEvening: !task.isEvening })}
            title={task.isEvening ? 'Move to Daytime' : 'Move to This Evening'}
            aria-label={task.isEvening ? 'Move to Daytime' : 'Move to This Evening'}
            className={`p-1.5 rounded-lg transition-all ${
              task.isEvening
                ? 'text-indigo-500 bg-indigo-500/15 border border-indigo-500/30 shadow-xs'
                : 'text-[var(--text-muted)] hover:text-indigo-500 hover:bg-[var(--bg-surface-l2)]'
            }`}
          >
            <Moon size={15} className={task.isEvening ? 'fill-indigo-500/30' : ''} />
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onStartFocus(task.id);
            }}
            title="Start Focus Timer"
            aria-label="Start Focus Timer"
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--color-brand)] hover:bg-[var(--bg-surface-l2)] rounded-lg transition-colors"
          >
            <Timer size={15} />
          </button>

          {/* Header Action Menu (...) */}
          <div className="relative" ref={actionMenuRef}>
            <button
              type="button"
              onClick={() => setIsActionMenuOpen((prev) => !prev)}
              title="More task actions"
              aria-label="More task actions"
              aria-expanded={isActionMenuOpen}
              className={`p-1.5 rounded-lg transition-colors ${
                isActionMenuOpen
                  ? 'bg-[var(--bg-surface-l2)] text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-l2)]'
              }`}
            >
              <MoreHorizontal size={16} />
            </button>

            {isActionMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl bg-[var(--bg-surface-l1)] border border-[var(--border-subtle)] shadow-modal py-1 z-50 animate-fade-in text-xs font-medium">
                <button
                  type="button"
                  onClick={() => {
                    setIsActionMenuOpen(false);
                    duplicateTask(task.id);
                    onClose();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors text-left"
                >
                  <Copy size={14} className="text-[var(--text-muted)]" />
                  <span>Duplicate Task</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsActionMenuOpen(false);
                    onOpenMergeModal();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors text-left"
                >
                  <GitMerge size={14} className="text-[var(--text-muted)]" />
                  <span>Merge with Task</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsActionMenuOpen(false);
                    archiveTask(task.id);
                    onClose();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors text-left"
                >
                  <Archive size={14} className="text-[var(--text-muted)]" />
                  <span>Archive Task</span>
                </button>

                <div className="my-1 border-t border-[var(--border-hairline)]" />

                <button
                  type="button"
                  onClick={() => {
                    setIsActionMenuOpen(false);
                    deleteTask(task.id);
                    onClose();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors text-left"
                >
                  <Trash2 size={14} />
                  <span>Delete Task</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close task details"
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-l2)] rounded-lg transition-colors ml-1"
          >
            <X size={17} />
          </button>
        </div>
      </div>
    </>
  );
};
