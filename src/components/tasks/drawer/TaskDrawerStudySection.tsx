import React, { useState } from 'react';
import { useTaskContext } from '../../../context/TaskContext';
import type { Task } from '../../../types/task';
import { Badge } from '../../ui/Badge';
import { Sparkles, Zap, ChevronUp, ChevronDown } from 'lucide-react';

interface TaskDrawerStudySectionProps {
  task: Task;
  onClose: () => void;
  onStartFocus: (taskId: string) => void;
  onStartSprint?: (taskId: string) => void;
}

export const TaskDrawerStudySection: React.FC<TaskDrawerStudySectionProps> = ({
  task,
  onClose,
  onStartFocus,
  onStartSprint,
}) => {
  const { updateTask, showToast } = useTaskContext();
  const [isStudyExpanded, setIsStudyExpanded] = useState(false);

  const completedSubs = task.subtasks?.filter((s) => s.completed).length || 0;

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
      <button
        type="button"
        onClick={() => setIsStudyExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between p-3.5 bg-[var(--bg-surface-l2)]/60 hover:bg-[var(--bg-surface-l2)] transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-emerald-500" />
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            Study Session Metadata
          </span>
          {task.sessionMetadata?.isSession && (
            <Badge variant="success" size="xs">
              Session #{task.sessionMetadata.sessionNumber || 1}
            </Badge>
          )}
        </div>
        {isStudyExpanded ? (
          <ChevronUp size={15} className="text-[var(--text-muted)]" />
        ) : (
          <ChevronDown size={15} className="text-[var(--text-muted)]" />
        )}
      </button>

      {isStudyExpanded && (
        <div className="p-4 bg-[var(--bg-surface-l1)]/50 border-t border-[var(--border-hairline)] space-y-3.5 text-xs">
          {task.sessionMetadata?.isSession ? (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-[var(--text-primary)]">
                    Study Session {task.sessionMetadata.sessionNumber ? `#${task.sessionMetadata.sessionNumber}` : ''}
                    {task.sessionMetadata.focusArea ? ` • ${task.sessionMetadata.focusArea}` : ''}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] font-mono flex items-center gap-2 mt-0.5">
                    {task.sessionMetadata.pacingMinutesPerQuestion && (
                      <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                        ⚡ {task.sessionMetadata.pacingMinutesPerQuestion}m / question
                      </span>
                    )}
                    {task.sessionMetadata.targetCount && (
                      <span>• {completedSubs}/{task.sessionMetadata.targetCount} targets solved</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onStartSprint) {
                      onStartSprint(task.id);
                    } else {
                      onStartFocus(task.id);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all shrink-0 active:scale-95"
                >
                  <Zap size={13} className="fill-current" />
                  <span>Launch Sprint</span>
                </button>
              </div>

              {task.sessionMetadata.secondaryMilestone && (
                <div className="text-[11px] text-[var(--text-secondary)]">
                  <strong>Milestone:</strong> {task.sessionMetadata.secondaryMilestone}
                </div>
              )}
              {task.sessionMetadata.contingencyGoal && (
                <div className="text-[11px] text-[var(--text-muted)] italic">
                  <strong>Contingency:</strong> {task.sessionMetadata.contingencyGoal}
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] flex items-center justify-between gap-3">
              <span className="text-[11px] text-[var(--text-muted)]">
                Standard task — study session tracking not activated.
              </span>
              <button
                type="button"
                onClick={() => {
                  updateTask(task.id, {
                    sessionMetadata: {
                      isSession: true,
                      sessionTopic: task.title,
                      targetCount: task.subtasks?.length || 5,
                      pacingMinutesPerQuestion: 15,
                    },
                  });
                  showToast('Study session mode enabled');
                }}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
              >
                Enable Study Mode
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
