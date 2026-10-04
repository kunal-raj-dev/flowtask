import React, { useState } from 'react';
import { useTaskContext } from '../../../context/TaskContext';
import type { Task } from '../../../types/task';
import { Badge } from '../../ui/Badge';
import {
  isTaskBlocked,
  getPotentialBlockingCandidates,
  wouldCreateCycle,
} from '../../../utils/dependencyUtils';
import { findPotentialDuplicates } from '../../../utils/duplicateDetector';
import {
  Lock,
  Unlock,
  AlertTriangle,
  GitMerge,
  X,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

interface TaskDrawerDependenciesProps {
  task: Task;
  onOpenMergeModal: () => void;
}

export const TaskDrawerDependencies: React.FC<TaskDrawerDependenciesProps> = ({
  task,
  onOpenMergeModal,
}) => {
  const { tasks, updateTask, mergeTasks, showToast } = useTaskContext();
  const [isDependenciesExpanded, setIsDependenciesExpanded] = useState(false);
  const [dismissedDuplicateId, setDismissedDuplicateId] = useState<string | null>(null);

  const isDone = task.status === 'done';
  const blockedInfo = isTaskBlocked(task, tasks);
  const blockingCandidates = getPotentialBlockingCandidates(task.id, tasks);

  const potentialDuplicates = findPotentialDuplicates(task, tasks).filter(
    (d) => d.task.id !== dismissedDuplicateId
  );
  const topDup = potentialDuplicates.length > 0 ? potentialDuplicates[0] : null;

  const handleMergeDuplicate = (duplicateTask: typeof task) => {
    mergeTasks(task.id, duplicateTask.id);
    setDismissedDuplicateId(duplicateTask.id);
    showToast(`Merged duplicate "${duplicateTask.title}"`);
  };

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
      <button
        type="button"
        onClick={() => setIsDependenciesExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between p-3.5 bg-[var(--bg-surface-l2)]/60 hover:bg-[var(--bg-surface-l2)] transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Lock
            size={14}
            className={blockedInfo.isBlocked ? 'text-rose-500' : 'text-[var(--text-secondary)]'}
          />
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            Dependencies & Blockers
          </span>
          {blockedInfo.isBlocked ? (
            <Badge variant="danger" size="xs">
              Blocked ({blockedInfo.blockingTasks.length})
            </Badge>
          ) : task.blockedBy && task.blockedBy.length > 0 ? (
            <Badge variant="success" size="xs">
              Unblocked
            </Badge>
          ) : (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Ready</span>
          )}
        </div>
        {isDependenciesExpanded ? (
          <ChevronUp size={15} className="text-[var(--text-muted)]" />
        ) : (
          <ChevronDown size={15} className="text-[var(--text-muted)]" />
        )}
      </button>

      {isDependenciesExpanded && (
        <div className="p-4 bg-[var(--bg-surface-l1)]/50 border-t border-[var(--border-hairline)] space-y-3.5 text-xs">
          {/* Potential Duplicate Warning */}
          {topDup && !isDone && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-slide-down">
              <div className="flex items-start gap-2.5 min-w-0">
                <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div className="text-xs">
                  <p className="font-semibold text-amber-800 dark:text-amber-200">
                    Similar Task Detected ({Math.round(topDup.similarityScore * 100)}% match)
                  </p>
                  <p className="text-amber-700 dark:text-amber-300 truncate font-mono text-[11px] mt-0.5 max-w-xs sm:max-w-sm">
                    &quot;{topDup.task.title}&quot;
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => handleMergeDuplicate(topDup.task)}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs transition-colors"
                  title="Merge subtasks, tags, and notes into this task, and remove the duplicate"
                >
                  <GitMerge size={12} />
                  <span>Merge Duplicate</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDismissedDuplicateId(topDup.task.id)}
                  className="px-2 py-1 rounded-lg text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-stone-200/50 dark:hover:bg-white/[0.06] transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Blocked Status Badge */}
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[var(--text-secondary)]">Blocking Status:</span>
            {blockedInfo.isBlocked ? (
              <Badge variant="danger" size="xs">
                🔒 Blocked by {blockedInfo.blockingTasks.length} task{blockedInfo.blockingTasks.length > 1 ? 's' : ''}
              </Badge>
            ) : (
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Unlock size={12} /> Ready to work
              </span>
            )}
          </div>

          {/* Current Blockers List */}
          {task.blockedBy && task.blockedBy.length > 0 && (
            <div className="space-y-1.5">
              {task.blockedBy.map((blockerId) => {
                const blocker = tasks.find((t) => t.id === blockerId);
                if (!blocker) return null;
                const isBlockerDone = blocker.status === 'done';
                return (
                  <div
                    key={blockerId}
                    className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isBlockerDone ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'
                        }`}
                      />
                      <span
                        className={`truncate font-medium ${
                          isBlockerDone ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'
                        }`}
                      >
                        {blocker.title}
                      </span>
                      {isBlockerDone && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
                          (Completed)
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = (task.blockedBy || []).filter((id) => id !== blockerId);
                        updateTask(task.id, { blockedBy: updated });
                      }}
                      title="Remove blocker"
                      className="p-1 text-[var(--text-muted)] hover:text-rose-500 rounded-md transition-colors ml-2 shrink-0"
                    >
                      <X size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add Blocker Dropdown Selector with Cycle Detection Validation */}
          <div className="pt-0.5 space-y-1">
            <select
              id="task-blocker-select"
              name="taskBlocker"
              aria-label="Add blocking task dependency"
              value=""
              onChange={(e) => {
                const selectedId = e.target.value;
                if (!selectedId) return;
                const currentBlockedBy = task.blockedBy || [];
                if (!currentBlockedBy.includes(selectedId)) {
                  if (wouldCreateCycle(task.id, selectedId, tasks)) {
                    showToast('Cannot add dependency: circular cycle detected!');
                    return;
                  }
                  updateTask(task.id, { blockedBy: [...currentBlockedBy, selectedId] });
                  showToast('Blocking dependency added');
                }
              }}
              className="w-full bg-[var(--bg-surface-l1)] text-xs text-[var(--text-secondary)] border border-[var(--border-hairline)] rounded-lg px-3 py-2 outline-none card-surface cursor-pointer"
            >
              <option value="">+ Add blocking task dependency...</option>
              {blockingCandidates
                .filter((c) => !(task.blockedBy || []).includes(c.id))
                .map((cand) => (
                  <option key={cand.id} value={cand.id}>
                    {cand.title} {cand.dueDate ? `(Due ${cand.dueDate})` : ''}
                  </option>
                ))}
            </select>
          </div>

          {/* Merge Helper Button */}
          <div className="pt-1 flex items-center justify-end">
            <button
              type="button"
              onClick={onOpenMergeModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[var(--color-brand)] hover:bg-[var(--color-brand)]/10 border border-[var(--color-brand)]/25 transition-all shadow-xs"
            >
              <GitMerge size={12} />
              <span>Open Merge Tool</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
