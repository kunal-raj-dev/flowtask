import React, { useState } from 'react';
import { useTaskContext } from '../../../context/TaskContext';
import type { Task } from '../../../types/task';
import { getMergePreview } from '../../../utils/dependencyUtils';
import { GitMerge, X } from 'lucide-react';

interface TaskDrawerMergeModalProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
}

export const TaskDrawerMergeModal: React.FC<TaskDrawerMergeModalProps> = ({
  task,
  isOpen,
  onClose,
}) => {
  const { tasks, mergeTasks, showToast } = useTaskContext();
  const [selectedSourceTaskId, setSelectedSourceTaskId] = useState<string>('');

  if (!isOpen) return null;

  const selectedSourceTask = tasks.find((t) => t.id === selectedSourceTaskId);
  const mergePreview = selectedSourceTask ? getMergePreview(task, selectedSourceTask, tasks) : null;

  const handleClose = () => {
    setSelectedSourceTaskId('');
    onClose();
  };

  const handleConfirmMerge = () => {
    if (!selectedSourceTaskId) return;
    const srcTitle = selectedSourceTask?.title || 'task';
    mergeTasks(task.id, selectedSourceTaskId);
    showToast(`Merged "${srcTitle}" into "${task.title}"`);
    handleClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Merge Tasks"
        className="w-full max-w-lg bg-[var(--bg-surface-l1)] border border-[var(--border-subtle)] rounded-2xl shadow-modal overflow-hidden flex flex-col max-h-[85vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-[var(--border-hairline)] flex items-center justify-between bg-[var(--bg-surface-l2)]/40">
          <div className="flex items-center gap-2">
            <GitMerge size={16} className="text-[var(--color-brand)]" />
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Merge Tasks</h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-l2)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200">
            <p className="font-semibold mb-1">Target Task (Retained):</p>
            <p className="font-medium text-xs text-[var(--text-primary)] truncate">&quot;{task.title}&quot;</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="merge-source-select" className="font-semibold text-[var(--text-secondary)]">
              Select source task to merge into this task:
            </label>
            <select
              id="merge-source-select"
              value={selectedSourceTaskId}
              onChange={(e) => setSelectedSourceTaskId(e.target.value)}
              className="w-full bg-[var(--bg-surface-l2)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-xl px-3 py-2 outline-none text-xs cursor-pointer"
            >
              <option value="">-- Choose a task to merge --</option>
              {tasks
                .filter((t) => t.id !== task.id && !t.deletedAt && !t.archivedAt)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} {t.dueDate ? `(Due ${t.dueDate})` : ''}
                  </option>
                ))}
            </select>
          </div>

          {/* Merge Preview Details */}
          {selectedSourceTask && mergePreview && (
            <div className="space-y-3 pt-2 border-t border-[var(--border-hairline)]">
              <h4 className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                <span>Merge Preview & Resolution</span>
              </h4>

              {/* Field Conflicts */}
              {mergePreview.conflicts.length > 0 ? (
                <div className="space-y-1.5">
                  <span className="font-medium text-[var(--text-secondary)] text-[11px]">Field Resolution:</span>
                  <div className="rounded-lg border border-[var(--border-subtle)] overflow-hidden divide-y divide-[var(--border-hairline)]">
                    {mergePreview.conflicts.map((c) => (
                      <div
                        key={c.field}
                        className="p-2 bg-[var(--bg-surface-l2)]/30 flex items-center justify-between text-[11px]"
                      >
                        <span className="font-semibold text-[var(--text-primary)]">{c.field}</span>
                        <div className="flex items-center gap-1.5 text-right font-mono">
                          <span className="text-[var(--text-muted)] line-through">{String(c.sourceValue)}</span>
                          <span>→</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {String(c.resolvedValue)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px]">
                  No field conflicts detected. Attributes cleanly merge.
                </div>
              )}

              {/* Subtasks and Notes Rollup */}
              <div className="p-2.5 rounded-lg bg-[var(--bg-surface-l2)]/40 border border-[var(--border-hairline)] space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Subtasks to append:</span>
                  <span className="font-semibold font-mono">
                    {selectedSourceTask.subtasks?.length || 0} subtasks
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Notes:</span>
                  <span className="font-semibold">Concatenated with divider</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Dependency redirects:</span>
                  <span className="font-semibold font-mono">
                    {mergePreview.redirectedTasks.length} task(s) redirected
                  </span>
                </div>
              </div>

              {mergePreview.redirectedTasks.length > 0 && (
                <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-[11px] text-sky-800 dark:text-sky-300">
                  <span className="font-semibold">Dependent tasks updated:</span>
                  <ul className="list-disc pl-4 mt-1 space-y-0.5">
                    {mergePreview.redirectedTasks.map((rt) => (
                      <li key={rt.taskId} className="truncate">
                        {rt.title}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-[11px] text-[var(--text-muted)] italic">
                Note: &quot;{selectedSourceTask.title}&quot; will be marked as merged and archived.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[var(--border-hairline)] flex items-center justify-end gap-2 bg-[var(--bg-surface-l2)]/40">
          <button
            type="button"
            onClick={handleClose}
            className="px-3.5 py-1.5 rounded-xl border border-[var(--border-hairline)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-l2)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedSourceTaskId}
            onClick={handleConfirmMerge}
            className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white text-xs font-bold shadow-xs transition-colors"
          >
            Confirm Merge
          </button>
        </div>
      </div>
    </div>
  );
};
