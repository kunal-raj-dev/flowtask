import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTaskContext } from '../../context/TaskContext';
import { formatLocalDate } from '../../utils/nlpParser';
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

export const BatchActionBar: React.FC = () => {
  const {
    selectedTaskIds,
    clearTaskSelection,
    batchUpdateTasks,
    batchDeleteTasks,
    batchToggleStatus,
    projects,
  } = useTaskContext();

  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [isPriorityDropdownOpen, setIsPriorityDropdownOpen] = useState(false);

  const count = selectedTaskIds.length;
  const todayStr = formatLocalDate(new Date());

  const handleSetToday = () => {
    batchUpdateTasks(selectedTaskIds, { dueDate: todayStr });
  };

  const handleSetTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    batchUpdateTasks(selectedTaskIds, { dueDate: formatLocalDate(tomorrow) });
  };

  const handleSetSomeday = () => {
    batchUpdateTasks(selectedTaskIds, { dueDate: undefined, isPinnedToday: false });
  };

  const handleSetPriority = (p: Priority) => {
    batchUpdateTasks(selectedTaskIds, { priority: p });
    setIsPriorityDropdownOpen(false);
  };

  const handleSetProject = (projectId: string) => {
    batchUpdateTasks(selectedTaskIds, { projectId });
    setIsProjectDropdownOpen(false);
  };

  return (
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
          className="fixed bottom-6 left-1/2 z-40"
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
          onClick={() => batchToggleStatus(selectedTaskIds)}
          title="Toggle completion status"
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-white/[0.08] text-[var(--text-secondary)] hover:text-emerald-500 transition-colors font-medium shrink-0"
        >
          <CheckCircle2 size={14} className="text-emerald-500" />
          <span>Status</span>
        </button>

        {/* Reschedule: Today */}
        <button
          onClick={handleSetToday}
          title="Reschedule to Today"
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-white/[0.08] text-[var(--text-secondary)] hover:text-[var(--color-brand)] transition-colors font-medium shrink-0"
        >
          <Calendar size={14} className="text-[var(--color-brand)]" />
          <span>Today</span>
        </button>

        {/* Reschedule: Tomorrow */}
        <button
          onClick={handleSetTomorrow}
          title="Reschedule to Tomorrow"
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-white/[0.08] text-[var(--text-secondary)] hover:text-[var(--color-brand)] transition-colors font-medium shrink-0"
        >
          <ArrowRight size={14} className="text-[var(--color-brand)]" />
          <span>Tomorrow</span>
        </button>

        {/* Reschedule: Someday */}
        <button
          onClick={handleSetSomeday}
          title="Move to Someday (remove date)"
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-white/[0.08] text-[var(--text-secondary)] hover:text-purple-500 transition-colors font-medium shrink-0"
        >
          <Inbox size={14} className="text-purple-500" />
          <span>Someday</span>
        </button>

        {/* Priority Dropdown */}
        <div className="relative shrink-0">
          <button
            onClick={() => {
              setIsPriorityDropdownOpen(!isPriorityDropdownOpen);
              setIsProjectDropdownOpen(false);
            }}
            title="Set priority"
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-white/[0.08] text-[var(--text-secondary)] hover:text-[var(--color-brand)] transition-colors font-medium"
          >
            <Flag size={14} />
            <span>Priority</span>
          </button>

          {isPriorityDropdownOpen && (
            <div className="absolute bottom-full mb-2 left-0 w-32 p-1.5 rounded-lg bg-[var(--bg-surface-l1)] border border-stone-200/90 dark:border-white/10 shadow-modal space-y-1 animate-scale-up">
              {(['p1', 'p2', 'p3', 'p4'] as Priority[]).map((p) => (
                <button
                  key={p}
                  onClick={() => handleSetPriority(p)}
                  className="w-full text-left text-xs px-2.5 py-1.5 rounded-md hover:bg-stone-100 dark:hover:bg-white/[0.08] flex items-center justify-between"
                >
                  <span className="uppercase font-bold text-[11px] text-[var(--text-primary)]">
                    {p}
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      p === 'p1'
                        ? 'bg-rose-500'
                        : p === 'p2'
                        ? 'bg-amber-500'
                        : p === 'p3'
                        ? 'bg-blue-500'
                        : 'bg-stone-400'
                    }`}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Project Dropdown */}
        <div className="relative shrink-0">
          <button
            onClick={() => {
              setIsProjectDropdownOpen(!isProjectDropdownOpen);
              setIsPriorityDropdownOpen(false);
            }}
            title="Move to project"
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-white/[0.08] text-[var(--text-secondary)] hover:text-[var(--color-brand)] transition-colors font-medium"
          >
            <Folder size={14} />
            <span>Move</span>
          </button>

          {isProjectDropdownOpen && (
            <div className="absolute bottom-full mb-2 left-0 w-40 p-1.5 rounded-lg bg-[var(--bg-surface-l1)] border border-stone-200/90 dark:border-white/10 shadow-modal space-y-1 animate-scale-up max-h-48 overflow-y-auto">
              {projects.map((proj) => (
                <button
                  key={proj.id}
                  onClick={() => handleSetProject(proj.id)}
                  className="w-full text-left text-xs px-2.5 py-1.5 rounded-md hover:bg-stone-100 dark:hover:bg-white/[0.08] flex items-center gap-2 truncate"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: proj.color }}
                  />
                  <span className="truncate text-[var(--text-primary)] font-medium">
                    {proj.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Delete */}
        <button
          onClick={() => batchDeleteTasks(selectedTaskIds)}
          title="Delete selected tasks"
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg hover:bg-rose-500/10 text-stone-400 hover:text-rose-500 transition-colors font-medium shrink-0"
        >
          <Trash2 size={14} />
          <span>Delete</span>
        </button>

        {/* Clear selection */}
        <button
          onClick={clearTaskSelection}
          title="Deselect all (Esc)"
          className="p-1 rounded-lg text-stone-400 hover:text-[var(--text-primary)] hover:bg-stone-100 dark:hover:bg-white/[0.08] transition-colors ml-1 shrink-0"
        >
          <X size={15} />
        </button>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);
};
