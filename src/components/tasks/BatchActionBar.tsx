import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTaskContext } from '../../context/TaskContext';
import { useTodayStr, useTomorrowStr } from '../../hooks/useCurrentDate';
import type { Priority } from '../../types/task';
import {
  CheckCircle2,
  Calendar,
  ArrowRight,
  Trash2,
  X,
  Folder,
  Flag,
  Inbox,
} from 'lucide-react';
import { MoveToProjectPicker } from './MoveToProjectPicker';

export const BatchActionBar: React.FC = () => {
  const {
    selectedTaskIds,
    clearTaskSelection,
    batchUpdateTasks,
    batchDeleteTasks,
    batchToggleStatus,
    projects,
    tasks,
    showToast,
    undoLastAction,
    setActiveView,
  } = useTaskContext();

  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [isPriorityDropdownOpen, setIsPriorityDropdownOpen] = useState(false);

  const priorityBtnRef = useRef<HTMLButtonElement>(null);
  const projectBtnRef = useRef<HTMLButtonElement>(null);
  const priorityMenuRef = useRef<HTMLDivElement>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const [priorityPos, setPriorityPos] = useState<{ x: number; y: number } | null>(null);
  const [projectPos, setProjectPos] = useState<{ x: number; y: number } | null>(null);

  const count = selectedTaskIds.length;
  const todayStr = useTodayStr();
  const tomorrowStr = useTomorrowStr();

  const handleSetToday = () => {
    batchUpdateTasks(selectedTaskIds, { plannedDate: todayStr, dueDate: todayStr, isSomeday: false });
  };

  const handleSetTomorrow = () => {
    batchUpdateTasks(selectedTaskIds, { plannedDate: tomorrowStr, dueDate: tomorrowStr, isPinnedToday: false, isSomeday: false });
  };

  const handleSetSomeday = () => {
    batchUpdateTasks(selectedTaskIds, { plannedDate: undefined, dueDate: undefined, isPinnedToday: false, isSomeday: true });
  };

  const handleSetPriority = (p: Priority) => {
    batchUpdateTasks(selectedTaskIds, { priority: p });
    setIsPriorityDropdownOpen(false);
  };

  const handleSetProject = (projectId: string) => {
    const targetProject = projects.find((p) => p.id === projectId);
    const selected = new Set(selectedTaskIds);
    const moving = tasks.filter(task => selected.has(task.id) && task.projectId !== projectId).map(task => task.id);
    const movedCount = moving.length;
    if (movedCount > 0) batchUpdateTasks(moving, { projectId });
    setIsProjectDropdownOpen(false);
    clearTaskSelection();
    if (!movedCount) return;
    showToast(
      `Moved ${movedCount} task${movedCount > 1 ? 's' : ''} to ${targetProject?.name || 'project'}`,
      'Undo',
      undoLastAction,
      'View project',
      () => setActiveView(('project:' + projectId) as any)
    );
  };

  const togglePriorityDropdown = () => {
    if (!isPriorityDropdownOpen) {
      const rect = priorityBtnRef.current?.getBoundingClientRect();
      if (rect) {
        setPriorityPos({ x: Math.min(rect.left, window.innerWidth - 140), y: rect.top });
      }
      setIsProjectDropdownOpen(false);
      setIsPriorityDropdownOpen(true);
    } else {
      setIsPriorityDropdownOpen(false);
    }
  };

  const toggleProjectDropdown = () => {
    if (!isProjectDropdownOpen) {
      const rect = projectBtnRef.current?.getBoundingClientRect();
      if (rect) {
        setProjectPos({ x: Math.min(rect.left, window.innerWidth - 268), y: rect.top });
      }
      setIsPriorityDropdownOpen(false);
      setIsProjectDropdownOpen(true);
    } else {
      setIsProjectDropdownOpen(false);
    }
  };

  // Click outside and Esc listener
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | PointerEvent) => {
      const target = e.target as Node;
      if (
        isPriorityDropdownOpen &&
        priorityMenuRef.current &&
        !priorityMenuRef.current.contains(target) &&
        priorityBtnRef.current &&
        !priorityBtnRef.current.contains(target)
      ) {
        setIsPriorityDropdownOpen(false);
      }
      if (
        isProjectDropdownOpen &&
        projectMenuRef.current &&
        !projectMenuRef.current.contains(target) &&
        projectBtnRef.current &&
        !projectBtnRef.current.contains(target)
      ) {
        setIsProjectDropdownOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isPriorityDropdownOpen || isProjectDropdownOpen) {
          setIsPriorityDropdownOpen(false);
          setIsProjectDropdownOpen(false);
        } else if (selectedTaskIds.length > 0) {
          clearTaskSelection();
        }
      }
    };

    document.addEventListener('pointerdown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPriorityDropdownOpen, isProjectDropdownOpen, selectedTaskIds.length, clearTaskSelection]);

  return (
    <>
      <AnimatePresence>
      {selectedTaskIds.length > 0 && (
        <motion.div
          key="batch-action-bar"
          role="region"
          aria-label="Bulk task actions"
          initial={{ opacity: 0, y: 30, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 24, x: '-50%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:bottom-6 left-1/2 z-40"
        >
          <div className="bg-[var(--bg-surface-l1)]/95 backdrop-blur-2xl border border-stone-200/90 dark:border-white/10 shadow-2xl rounded-xl py-1.5 px-3 flex items-center gap-2 max-w-[95vw] overflow-x-auto card-surface">
            {/* Count pill */}
            <div className="flex items-center gap-1.5 pr-2 border-r border-[var(--border-hairline)] shrink-0">
              <span className="w-5 h-5 rounded-full bg-[var(--color-brand)] text-white font-mono font-bold text-[11px] flex items-center justify-center">
                {count}
              </span>
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                {count === 1 ? 'task' : 'tasks'} selected
              </span>
            </div>

            {/* Complete Toggle */}
            <button
              type="button"
              onClick={() => batchToggleStatus(selectedTaskIds)}
              title="Toggle completion status"
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-white/[0.08] text-[var(--text-secondary)] hover:text-emerald-500 transition-colors font-medium shrink-0 cursor-pointer active:scale-95"
            >
              <CheckCircle2 size={14} className="text-emerald-500" />
              <span>Status</span>
            </button>

            {/* Reschedule: Today */}
            <button
              type="button"
              onClick={handleSetToday}
              title="Reschedule to Today"
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-white/[0.08] text-[var(--text-secondary)] hover:text-[var(--color-brand)] transition-colors font-medium shrink-0 cursor-pointer active:scale-95"
            >
              <Calendar size={14} className="text-[var(--color-brand)]" />
              <span>Today</span>
            </button>

            {/* Reschedule: Tomorrow */}
            <button
              type="button"
              onClick={handleSetTomorrow}
              title="Reschedule to Tomorrow"
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-white/[0.08] text-[var(--text-secondary)] hover:text-[var(--color-brand)] transition-colors font-medium shrink-0 cursor-pointer active:scale-95"
            >
              <ArrowRight size={14} className="text-[var(--color-brand)]" />
              <span>Tomorrow</span>
            </button>

            {/* Reschedule: Someday */}
            <button
              type="button"
              onClick={handleSetSomeday}
              title="Move to Someday (remove date)"
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-white/[0.08] text-[var(--text-secondary)] hover:text-purple-500 transition-colors font-medium shrink-0 cursor-pointer active:scale-95"
            >
              <Inbox size={14} className="text-purple-500" />
              <span>Someday</span>
            </button>

            {/* Priority Dropdown Trigger */}
            <div className="relative shrink-0">
              <button
                ref={priorityBtnRef}
                type="button"
                onClick={togglePriorityDropdown}
                title="Set priority"
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-white/[0.08] text-[var(--text-secondary)] hover:text-[var(--color-brand)] transition-colors font-medium cursor-pointer active:scale-95"
              >
                <Flag size={14} />
                <span>Priority</span>
              </button>
            </div>

            {/* Project Dropdown Trigger */}
            <div className="relative shrink-0">
              <button
                ref={projectBtnRef}
                type="button"
                onClick={toggleProjectDropdown}
                title="Move to project"
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-white/[0.08] text-[var(--text-secondary)] hover:text-[var(--color-brand)] transition-colors font-medium cursor-pointer active:scale-95"
              >
                <Folder size={14} />
                <span>Move</span>
              </button>
            </div>

            {/* Delete */}
            <button
              type="button"
              onClick={() => batchDeleteTasks(selectedTaskIds)}
              title="Delete selected tasks"
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg hover:bg-rose-500/10 text-stone-400 hover:text-rose-500 transition-colors font-medium shrink-0 cursor-pointer active:scale-95"
            >
              <Trash2 size={14} />
              <span>Delete</span>
            </button>

            {/* Clear selection */}
            <button
              type="button"
              onClick={clearTaskSelection}
              title="Deselect all (Esc)"
              className="p-1 rounded-lg text-stone-400 hover:text-[var(--text-primary)] hover:bg-stone-100 dark:hover:bg-white/[0.08] transition-colors ml-1 shrink-0 cursor-pointer active:scale-95"
            >
              <X size={15} />
            </button>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Portaled Priority Menu */}
      {isPriorityDropdownOpen && priorityPos && typeof document !== 'undefined' && createPortal(
        <div
          ref={priorityMenuRef}
          style={{
            left: `${Math.max(12, priorityPos.x)}px`,
            bottom: `${Math.max(16, window.innerHeight - priorityPos.y + 8)}px`,
          }}
          className="fixed z-50 w-32 p-1.5 rounded-xl bg-[var(--bg-surface-l1)] border border-stone-200/90 dark:border-white/10 shadow-modal space-y-1 animate-scale-up card-surface"
          onClick={(e) => e.stopPropagation()}
        >
          {(['p1', 'p2', 'p3', 'p4'] as Priority[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handleSetPriority(p)}
              className="w-full text-left text-xs px-2.5 py-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-white/[0.08] flex items-center justify-between cursor-pointer active:scale-95 transition-all"
            >
              <span className="uppercase font-bold text-[11px] text-[var(--text-primary)]">
                {p}
              </span>
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor:
                    p === 'p1'
                      ? 'var(--pastel-coral)'
                      : p === 'p2'
                      ? 'var(--pastel-amber)'
                      : p === 'p3'
                      ? 'var(--pastel-sky)'
                      : 'var(--text-muted)',
                }}
              />
            </button>
          ))}
        </div>,
        document.body
      )}

      {/* Portaled Project Menu */}
      {isProjectDropdownOpen && projectPos && typeof document !== 'undefined' && createPortal(
        <div
          ref={projectMenuRef}
          style={{
            left: `${Math.max(12, projectPos.x)}px`,
            bottom: `${Math.max(16, window.innerHeight - projectPos.y + 8)}px`,
          }}
          className="fixed z-50 w-64 max-w-[calc(100vw-24px)] animate-scale-up"
          onClick={(e) => e.stopPropagation()}
        >
          <MoveToProjectPicker
            projects={projects}
            onSelectProject={handleSetProject}
            onClose={() => setIsProjectDropdownOpen(false)}
            title="Move selected tasks"
          />
        </div>,
        document.body
      )}
    </>
  );
};
