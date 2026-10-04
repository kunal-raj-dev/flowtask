import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTaskContext } from '../../context/TaskContext';
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

  // Accessibility: store active element and bind Escape key
  useEffect(() => {
    previousActiveElementRef.current = document.activeElement as HTMLElement | null;

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
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (
        previousActiveElementRef.current &&
        typeof previousActiveElementRef.current.focus === 'function'
      ) {
        previousActiveElementRef.current.focus();
      }
    };
  }, [isMergeModalOpen, isRecurrenceModalOpen, onClose]);

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
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-40 bg-black/30 dark:bg-black/50 backdrop-blur-[2px] flex items-end md:items-stretch md:justify-end"
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Task Details"
        initial={isMobile ? { y: '100%' } : { x: '100%' }}
        animate={isMobile ? { y: dragY > 0 ? dragY : 0 } : { x: 0 }}
        exit={isMobile ? { y: '100%' } : { x: '100%' }}
        transition={
          isDragging
            ? { duration: 0 }
            : { type: 'spring', damping: 30, stiffness: 350 }
        }
        className="w-full md:max-w-xl lg:max-w-2xl h-[100dvh] md:h-full max-h-[100dvh] md:max-h-full bg-[var(--bg-surface-l1)] rounded-t-2xl md:rounded-none border-t md:border-t-0 md:border-l border-[var(--border-subtle)] shadow-modal flex flex-col overflow-hidden"
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
              value={task.title}
              onChange={(e) => updateTask(task.id, { title: e.target.value })}
              className={`w-full bg-transparent text-lg font-bold outline-none transition-colors tracking-tight ${
                isDone ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'
              }`}
              placeholder="Task title..."
            />
          </div>

          {/* Properties Grid (Project, Dates, Priority) */}
          <TaskDrawerProperties task={task} />

          {/* Subtasks Section */}
          <TaskDrawerSubtasks task={task} />

          {/* Notes & Description Section */}
          <TaskDrawerNotes task={task} />

          {/* Recurrence & Schedule Section */}
          <TaskDrawerRecurrence
            task={task}
            onOpenRecurrenceModal={() => setIsRecurrenceModalOpen(true)}
          />

          {/* Dependencies & Blockers Section */}
          <TaskDrawerDependencies
            task={task}
            onOpenMergeModal={() => setIsMergeModalOpen(true)}
          />

          {/* Tags & Contexts Section */}
          <TaskDrawerTags task={task} />

          {/* Study Session Metadata Section */}
          <TaskDrawerStudySection
            task={task}
            onClose={onClose}
            onStartFocus={onStartFocus}
            onStartSprint={onStartSprint}
          />

          {/* Activity & Audit Trail Section */}
          <TaskDrawerAuditSection task={task} />
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
