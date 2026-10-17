import { TaskExecutionDetails } from './TaskExecutionDetails';
import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTaskContext } from '../../context/TaskContext';
import { SPRING_TACTILE } from '../../utils/springPhysics';
import { RecurrenceModal } from '../modals/RecurrenceModal';
import {
  TaskDrawerHeader,
  TaskDrawerProperties,
  TaskDrawerSubtasks,
  TaskDrawerNotes,
  TaskDrawerRecurrence,
  TaskDrawerDependencies,
  TaskDrawerTags,
  TaskDrawerStudySection,
  TaskDrawerAuditSection,
  TaskDrawerMergeModal,
} from './drawer';

interface TaskDrawerProps {
  taskId: string;
  onClose: () => void;
  onStartFocus: (taskId: string) => void;
  onStartSprint?: (taskId: string) => void;
}

export const TaskDrawer: React.FC<TaskDrawerProps> = ({
  taskId,
  onClose,
  onStartFocus,
  onStartSprint,
}) => {
  const { tasks, updateTask } = useTaskContext();

  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isRecurrenceModalOpen, setIsRecurrenceModalOpen] = useState(false);

  const task = tasks.find((t) => t.id === taskId);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  const [localTitle, setLocalTitle] = useState(task?.title || '');
  const lastTitleTaskIdRef = useRef(task?.id);
  const lastCommittedTitleRef = useRef(task?.title || '');
  const titleDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTitleRef = useRef<(() => void) | null>(null);

  const currentTaskId = task?.id;
  const currentTaskTitle = task?.title;

  useEffect(() => {
    if (currentTaskId && currentTaskTitle !== undefined) {
      if (lastTitleTaskIdRef.current !== currentTaskId) {
        clearTimeout(titleDebounceTimerRef.current || undefined);
        pendingTitleRef.current?.(); pendingTitleRef.current = null;
        lastTitleTaskIdRef.current = currentTaskId;
        lastCommittedTitleRef.current = currentTaskTitle;
        setLocalTitle(currentTaskTitle);
      } else if (currentTaskTitle !== lastCommittedTitleRef.current) {
        if (pendingTitleRef.current) return;
        lastCommittedTitleRef.current = currentTaskTitle;
        setLocalTitle(currentTaskTitle);
      }
    }
  }, [currentTaskId, currentTaskTitle]);

  useEffect(() => {
    return () => {
      if (titleDebounceTimerRef.current) {
        clearTimeout(titleDebounceTimerRef.current);
      }
      pendingTitleRef.current?.(); pendingTitleRef.current = null;
    };
  }, []);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalTitle(val);
    if (!task) return;
    if (titleDebounceTimerRef.current) {
      clearTimeout(titleDebounceTimerRef.current);
    }
    pendingTitleRef.current = () => {
      if (val.trim()) {
        lastCommittedTitleRef.current = val;
        updateTask(task.id, { title: val });
      }
    };
    titleDebounceTimerRef.current = setTimeout(() => { const save = pendingTitleRef.current; pendingTitleRef.current = null; save?.(); }, 300);
  };

  const handleTitleBlur = () => {
    if (!task) return;
    if (titleDebounceTimerRef.current) {
      clearTimeout(titleDebounceTimerRef.current);
      titleDebounceTimerRef.current = null;
    }
    const trimmed = localTitle.trim();
    pendingTitleRef.current = null;
    if (trimmed && trimmed !== task.title) {
      lastCommittedTitleRef.current = trimmed;
      updateTask(task.id, { title: trimmed });
    } else if (!trimmed) {
      setLocalTitle(task.title);
    }
  };

  // Mobile drag-to-dismiss gesture state
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartY = useRef(0);

  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // On desktop, clicking blank canvas closes the drawer, while clicking other task cards selects them
  useEffect(() => {
    if (isMobile) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (drawerRef.current && drawerRef.current.contains(target)) {
        return;
      }

      // If clicked on an interactive task element or modal, allow task selection to proceed
      if (
        target.closest(
          '[id^="task-"], button, a, input, textarea, select, [role="button"], [role="menu"], [role="dialog"]'
        )
      ) {
        return;
      }

      onCloseRef.current();
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [isMobile]);

  // Accessibility: store active element on mount and focus container if not focused; restore focus on unmount
  useEffect(() => {
    previousActiveElementRef.current = document.activeElement as HTMLElement | null;
    if (drawerRef.current && !drawerRef.current.contains(document.activeElement)) {
      drawerRef.current.focus();
    }

    return () => {
      if (
        previousActiveElementRef.current &&
        typeof previousActiveElementRef.current.focus === 'function'
      ) {
        previousActiveElementRef.current.focus();
      }
    };
  }, []);

  // Keyboard shortcut listener (Escape to close sub-modals or drawer)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isMergeModalOpen) {
          setIsMergeModalOpen(false);
          return;
        }
        if (isRecurrenceModalOpen) {
          setIsRecurrenceModalOpen(false);
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMergeModalOpen, isRecurrenceModalOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY.current;
    setDragY(Math.max(0, diff));
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (dragY > 110) {
      onClose();
    }
    setDragY(0);
  };

  if (!task) return null;

  const isDone = task.status === 'done';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      className="fixed inset-0 z-40 pointer-events-none flex items-end md:items-stretch md:justify-end"
    >
      {/* Mobile Backdrop Overlay (dismiss on tap) */}
      <motion.div
        className="md:hidden fixed inset-0 bg-black/25 dark:bg-black/45 backdrop-blur-[2px] pointer-events-auto"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
      />

      <motion.div
        ref={drawerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Task Details"
        data-task-drawer="true"
        initial={isMobile ? { y: '100%' } : { x: '100%' }}
        animate={isMobile ? { y: dragY > 0 ? dragY : 0 } : { x: 0 }}
        exit={isMobile ? { y: '100%' } : { x: '100%' }}
        transition={
          isDragging
            ? { duration: 0 }
            : SPRING_TACTILE
        }
        className="relative z-10 pointer-events-auto w-full sm:w-[460px] md:w-[480px] lg:w-[540px] h-[100dvh] md:h-full max-h-[100dvh] md:max-h-full bg-[var(--bg-surface-l1)] rounded-t-2xl md:rounded-l-2xl md:rounded-r-none border-t md:border-t-0 md:border-l border-[var(--border-subtle)] shadow-cute-modal flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header & Gesture handles */}
        <TaskDrawerHeader
          task={task}
          onClose={onClose}
          onStartFocus={onStartFocus}
          onOpenMergeModal={() => setIsMergeModalOpen(true)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />

        {/* Scrollable Drawer Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Title Input */}
          <div className="space-y-1">
            <input
              id="task-drawer-title-input"
              name="taskTitle"
              aria-label="Task title"
              type="text"
              value={localTitle}
              onChange={handleTitleChange}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                }
              }}
              className={`w-full bg-transparent text-lg font-bold outline-none transition-all tracking-tight pb-1 border-b-2 border-transparent focus:border-amber-500/80 ${
                isDone ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'
              }`}
              placeholder="Task title..."
            />
          </div>

          <TaskExecutionDetails key={task.id} task={task} />
          {/* Properties Grid (Project, Dates, Priority) */}
          <TaskDrawerProperties task={task} />

          {/* Subtasks Section */}
          <TaskDrawerSubtasks task={task} />

          {/* Notes & Description Section */}
          <TaskDrawerNotes task={task} />

          {/* Recurrence & Schedule Section */}
          <details className="desk-inspector-details"><summary>Repeat and schedule</summary><TaskDrawerRecurrence
            task={task}
            onOpenRecurrenceModal={() => setIsRecurrenceModalOpen(true)}
          /></details>

          {/* Dependencies & Blockers Section */}
          <details className="desk-inspector-details"><summary>Dependencies and related tasks</summary><TaskDrawerDependencies
            task={task}
            onOpenMergeModal={() => setIsMergeModalOpen(true)}
          /></details>

          {/* Tags & Contexts Section */}
          <details className="desk-inspector-details"><summary>Tags and context</summary><TaskDrawerTags task={task} /></details>

          {/* Study Session Metadata Section */}
          <TaskDrawerStudySection
            task={task}
            onClose={onClose}
            onStartFocus={onStartFocus}
            onStartSprint={onStartSprint}
          />

          {/* Activity & Audit Trail Section */}
          <details className="desk-inspector-details"><summary>Activity and history</summary><TaskDrawerAuditSection task={task} /></details>
        </div>

        {/* Custom Recurrence Modal */}
        <RecurrenceModal
          isOpen={isRecurrenceModalOpen}
          onClose={() => setIsRecurrenceModalOpen(false)}
          currentRule={task.customRecurrence}
          onSave={(rule) => {
            updateTask(task.id, {
              recurrence: 'custom',
              customRecurrence: rule,
            });
          }}
        />

        {/* Merge Task Preview Modal */}
        <TaskDrawerMergeModal
          task={task}
          isOpen={isMergeModalOpen}
          onClose={() => setIsMergeModalOpen(false)}
        />
      </motion.div>
    </motion.div>
  );
};
