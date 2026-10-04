import React, { useState } from 'react';
import type { Task } from '../../../types/task';
import { Badge } from '../../ui/Badge';
import { History, Check, ChevronUp, ChevronDown } from 'lucide-react';

interface TaskDrawerAuditSectionProps {
  task: Task;
}

export const TaskDrawerAuditSection: React.FC<TaskDrawerAuditSectionProps> = ({ task }) => {
  const [isAuditExpanded, setIsAuditExpanded] = useState(false);

  const formatAuditDate = (timestamp?: number) => {
    if (!timestamp) return 'Not recorded';
    const d = new Date(timestamp);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const calculateTurnaround = (startMs: number, endMs?: number) => {
    if (!endMs) return null;
    const diffMin = Math.max(1, Math.round((endMs - startMs) / (1000 * 60)));
    if (diffMin < 60) return `${diffMin}m`;
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
  };

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
      <button
        type="button"
        onClick={() => setIsAuditExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between p-3.5 bg-[var(--bg-surface-l2)]/60 hover:bg-[var(--bg-surface-l2)] transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <History size={14} className="text-amber-500" />
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            Task details
          </span>
          <span className="text-[11px] text-[var(--text-muted)] font-mono">
            {task.status === 'done' ? 'Completed' : 'Active'}
          </span>
        </div>
        {isAuditExpanded ? (
          <ChevronUp size={15} className="text-[var(--text-muted)]" />
        ) : (
          <ChevronDown size={15} className="text-[var(--text-muted)]" />
        )}
      </button>

      {isAuditExpanded && (
        <div className="p-4 bg-[var(--bg-surface-l1)]/50 border-t border-[var(--border-hairline)] text-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border-hairline)]">
            <span className="text-[var(--text-muted)]">Status</span>
            <Badge variant={task.status === 'done' ? 'success' : 'focus'} size="xs">
              {task.status === 'done' ? 'Completed' : 'Active'}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[var(--text-muted)]">Created</span>
            <span className="font-mono text-[var(--text-primary)] text-[11px]">
              {formatAuditDate(task.createdAt)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[var(--text-muted)]">Progress</span>
            <span className="inline-flex items-center gap-1 font-medium capitalize">
              {task.status === 'done' ? (
                <span className="text-emerald-500 flex items-center gap-1">
                  <Check size={12} strokeWidth={3} /> Done
                </span>
              ) : (
                <span className="text-amber-500">In Progress</span>
              )}
            </span>
          </div>

          {task.completedAt && (
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-muted)]">Completed At</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 text-[11px]">
                {formatAuditDate(task.completedAt)}
              </span>
            </div>
          )}

          {task.completedAt && task.createdAt && (
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-muted)]">Turnaround Time</span>
              <span className="font-mono text-[var(--text-primary)] text-[11px] font-semibold">
                {calculateTurnaround(task.createdAt, task.completedAt)}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-[var(--border-hairline)]">
            <span className="text-[var(--text-muted)]">Time Logged vs Est.</span>
            <span className="font-mono text-[11px]">
              <span className="text-amber-500 font-semibold">{task.timeSpentMinutes || 0}m</span>
              <span className="text-[var(--text-muted)]">
                {' '}
                / {task.estimatedMinutes ? `${task.estimatedMinutes}m` : 'none'}
              </span>
            </span>
          </div>

          {task.subtasks && task.subtasks.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-muted)]">Subtask Progress</span>
              <span className="font-mono text-[11px] text-[var(--text-primary)]">
                {task.subtasks.filter((s) => s.completed).length} / {task.subtasks.length} (
                {Math.round(
                  (task.subtasks.filter((s) => s.completed).length / task.subtasks.length) * 100
                )}
                %)
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
