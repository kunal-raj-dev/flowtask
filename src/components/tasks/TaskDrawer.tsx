import React, { useState } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import type { Priority, RecurrenceFrequency } from '../../types/task';
import {
  X,
  Calendar,
  Clock,
  Flag,
  Folder,
  Repeat,
  Star,
  Timer,
  Trash2,
  Plus,
  Check,
  Sparkles,
} from 'lucide-react';
import { suggestSubtasks, suggestDuration } from '../../utils/aiCopilot';

interface TaskDrawerProps {
  taskId: string;
  onClose: () => void;
  onStartFocus: (taskId: string) => void;
}

export const TaskDrawer: React.FC<TaskDrawerProps> = ({
  taskId,
  onClose,
  onStartFocus,
}) => {
  const {
    tasks,
    projects,
    updateTask,
    deleteTask,
    toggleTaskStatus,
    toggleTaskPinToday,
    toggleSubTask,
    addSubTask,
    deleteSubTask,
  } = useTaskContext();

  const task = tasks.find((t) => t.id === taskId);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  const [isDecomposing, setIsDecomposing] = useState(false);

  if (!task) return null;

  const isDone = task.status === 'done';

  const handleMagicBreakdown = () => {
    setIsDecomposing(true);
    setTimeout(() => {
      const suggested = suggestSubtasks(task.title, task.description);
      suggested.forEach((sub) => {
        const exists = task.subtasks?.some((s) => s.title.toLowerCase() === sub.title.toLowerCase());
        if (!exists) {
          addSubTask(task.id, sub.title);
        }
      });

      if (!task.estimatedMinutes) {
        updateTask(task.id, { estimatedMinutes: suggestDuration(task.title) });
      }
      setIsDecomposing(false);
    }, 200);
  };

  const handleAddSub = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSubtaskTitle.trim()) {
      addSubTask(task.id, newSubtaskTitle.trim());
      setNewSubtaskTitle('');
    }
  };

  const completedSubs = task.subtasks?.filter((s) => s.completed).length || 0;
  const totalSubs = task.subtasks?.length || 0;
  const progressPercent = totalSubs > 0 ? Math.round((completedSubs / totalSubs) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-40 bg-black/60 dark:bg-black/80 backdrop-blur-md flex justify-end"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg h-full bg-[var(--bg-surface-l2)] border-l border-[var(--border-hairline)] shadow-modal flex flex-col overflow-hidden card-surface animate-slide-down"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-[var(--border-hairline)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => toggleTaskStatus(task.id)}
              className={`w-5 h-5 rounded-[7px] flex items-center justify-center border transition-all duration-150 ${
                isDone
                  ? 'bg-gradient-to-br from-stone-900 to-stone-800 dark:from-white dark:to-stone-200 border-stone-800 dark:border-white text-white dark:text-stone-950 shadow-xs'
                  : 'border-stone-300 dark:border-stone-600 hover:border-amber-500 hover:ring-4 hover:ring-amber-500/15'
              }`}
            >
              {isDone && <Check size={12} className="animate-check-spring stroke-[3.5]" />}
            </button>
            <span className="text-xs font-semibold text-[var(--text-secondary)]">
              {isDone ? 'Completed' : 'Active Task'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => toggleTaskPinToday(task.id)}
              title={task.isPinnedToday ? 'Unpin from Top 3 Focus' : 'Pin to Top 3 Focus'}
              className={`p-1.5 rounded-xl transition-all ${
                task.isPinnedToday
                  ? 'text-amber-500 bg-amber-500/15 border border-amber-500/30 shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-amber-500 hover:bg-stone-200/50 dark:hover:bg-white/[0.06]'
              }`}
            >
              <Star size={16} className={task.isPinnedToday ? 'fill-current' : ''} />
            </button>

            <button
              onClick={() => {
                onClose();
                onStartFocus(task.id);
              }}
              title="Start Focus Timer"
              className="p-1.5 text-[var(--text-muted)] hover:text-indigo-500 hover:bg-stone-200/50 dark:hover:bg-white/[0.06] rounded-xl transition-colors"
            >
              <Timer size={16} />
            </button>

            <button
              onClick={() => {
                deleteTask(task.id);
                onClose();
              }}
              title="Delete task"
              className="p-1.5 text-[var(--text-muted)] hover:text-rose-500 hover:bg-stone-200/50 dark:hover:bg-white/[0.06] rounded-xl transition-colors"
            >
              <Trash2 size={16} />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.06] rounded-xl transition-colors ml-2"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Title Editor */}
          <div>
            <input
              type="text"
              value={task.title}
              onChange={(e) => updateTask(task.id, { title: e.target.value })}
              className={`w-full bg-transparent text-xl font-bold outline-none transition-colors tracking-tight ${
                isDone
                  ? 'line-through text-[var(--text-muted)]'
                  : 'text-[var(--text-primary)]'
              }`}
              placeholder="Task title..."
            />
          </div>

          {/* Quick Properties Grid */}
          <div className="grid grid-cols-2 gap-3.5 p-4 bg-[var(--bg-surface-l1)]/60 rounded-2xl border border-[var(--border-hairline)] text-xs card-surface">
            {/* Project Picker */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
                <Folder size={13} /> Project
              </label>
              <select
                value={task.projectId}
                onChange={(e) => updateTask(task.id, { projectId: e.target.value })}
                className="w-full bg-[var(--bg-surface-l2)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-xl px-3 py-1.5 outline-none card-surface cursor-pointer"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority Picker */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
                <Flag size={13} /> Priority
              </label>
              <select
                value={task.priority}
                onChange={(e) => updateTask(task.id, { priority: e.target.value as Priority })}
                className="w-full bg-[var(--bg-surface-l2)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-xl px-3 py-1.5 outline-none card-surface cursor-pointer"
              >
                <option value="p1">P1 Urgent</option>
                <option value="p2">P2 High</option>
                <option value="p3">P3 Medium</option>
                <option value="p4">P4 Normal / Low</option>
              </select>
            </div>

            {/* Due Date Picker */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
                <Calendar size={13} /> Due Date
              </label>
              <input
                type="date"
                value={task.dueDate || ''}
                onChange={(e) => updateTask(task.id, { dueDate: e.target.value || undefined })}
                className="w-full bg-[var(--bg-surface-l2)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-xl px-3 py-1.5 outline-none card-surface"
              />
            </div>

            {/* Recurrence Picker */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
                <Repeat size={13} /> Recurrence
              </label>
              <select
                value={task.recurrence || 'none'}
                onChange={(e) =>
                  updateTask(task.id, { recurrence: e.target.value as RecurrenceFrequency })
                }
                className="w-full bg-[var(--bg-surface-l2)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-xl px-3 py-1.5 outline-none card-surface cursor-pointer"
              >
                <option value="none">No Recurrence</option>
                <option value="daily">Daily</option>
                <option value="weekdays">Weekdays (Mon-Fri)</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            {/* Estimated Duration */}
            <div className="space-y-1.5 col-span-2">
              <label className="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
                <Clock size={13} /> Estimated Time (minutes)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="5"
                  placeholder="e.g. 25"
                  value={task.estimatedMinutes || ''}
                  onChange={(e) =>
                    updateTask(task.id, {
                      estimatedMinutes: e.target.value ? parseInt(e.target.value, 10) : undefined,
                    })
                  }
                  className="w-28 bg-[var(--bg-surface-l2)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-xl px-3 py-1.5 outline-none card-surface"
                />
                <div className="flex items-center gap-1.5">
                  {[15, 25, 45, 60].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => updateTask(task.id, { estimatedMinutes: mins })}
                      className="px-2.5 py-1 text-[11px] rounded-lg bg-[var(--bg-surface-l2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] shadow-xs card-surface transition-colors"
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Subtasks Checklist */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                Subtasks {totalSubs > 0 && `(${completedSubs}/${totalSubs})`}
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleMagicBreakdown}
                  disabled={isDecomposing}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-gradient-to-r from-purple-500/15 via-indigo-500/15 to-pink-500/10 hover:from-purple-500/25 hover:to-pink-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30 shadow-xs transition-all active:scale-95 disabled:opacity-50 card-surface"
                  title="Automatically generate action steps with AI"
                >
                  <Sparkles size={11} className={isDecomposing ? 'animate-spin text-purple-500' : 'text-purple-500'} />
                  <span>{isDecomposing ? 'Decomposing...' : 'Magic Breakdown'}</span>
                </button>

                {totalSubs > 0 && (
                  <span className="text-xs font-mono text-[var(--text-muted)] font-semibold">{progressPercent}%</span>
                )}
              </div>
            </div>

            {/* Progress bar */}
            {totalSubs > 0 && (
              <div className="w-full h-1.5 bg-stone-200/70 dark:bg-stone-800 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300 shadow-xs"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}

            {/* Subtask list */}
            <div className="space-y-1.5">
              {task.subtasks?.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-stone-200/40 dark:hover:bg-white/[0.04] group transition-colors"
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleSubTask(task.id, sub.id)}
                      className={`w-4 h-4 rounded-[5px] flex items-center justify-center border transition-all ${
                        sub.completed
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-stone-300 dark:border-stone-600 hover:border-amber-500'
                      }`}
                    >
                      {sub.completed && <Check size={11} className="stroke-[3]" />}
                    </button>
                    <span
                      className={`text-xs ${
                        sub.completed
                          ? 'line-through text-[var(--text-muted)]'
                          : 'text-[var(--text-primary)]'
                      }`}
                    >
                      {sub.title}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => deleteSubTask(task.id, sub.id)}
                    className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-rose-500 p-1 rounded-lg transition-all"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add subtask input */}
            <form onSubmit={handleAddSub} className="mt-2.5 flex items-center gap-2">
              <input
                type="text"
                placeholder="Add subtask..."
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                className="flex-1 text-xs px-3 py-1.5 bg-[var(--bg-surface-l1)]/60 text-[var(--text-primary)] placeholder-[var(--text-muted)] border border-[var(--border-hairline)] rounded-xl outline-none focus:border-stone-400 dark:focus:border-stone-600 card-surface"
              />
              <button
                type="submit"
                disabled={!newSubtaskTitle.trim()}
                className="p-1.5 bg-[var(--bg-surface-l2)] text-[var(--text-primary)] hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40 rounded-xl border border-[var(--border-hairline)] shadow-xs transition-colors card-surface"
              >
                <Plus size={14} />
              </button>
            </form>
          </div>

          {/* Description & Notes */}
          <div>
            <label className="text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider block mb-2">
              Notes & Description
            </label>
            <textarea
              rows={5}
              value={task.description || ''}
              onChange={(e) => updateTask(task.id, { description: e.target.value })}
              placeholder="Add details, links, or notes..."
              className="w-full text-xs p-3.5 bg-[var(--bg-surface-l1)]/50 text-[var(--text-primary)] placeholder-[var(--text-muted)] border border-[var(--border-hairline)] rounded-2xl outline-none focus:border-stone-400 dark:focus:border-stone-600 resize-none leading-relaxed card-surface"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
