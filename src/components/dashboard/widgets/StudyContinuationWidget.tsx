import { isStudyTask } from '../../../utils/taskSelectors';
import React from 'react';
import { useTaskContext } from '../../../context/TaskContext';
import { BookOpen, Play } from 'lucide-react';
import type { WidgetComponentProps } from '../../../types/dashboard';

export const StudyContinuationWidget: React.FC<WidgetComponentProps> = ({
  onStartSprint,
  onSelectTask,
}) => {
  const { tasks = [], setActiveView } = useTaskContext();

  // Find active study sprint tasks
  const studySessions = tasks
    .filter(
      (t) =>
        t.subtasks?.length &&
        !t.deletedAt &&
        !t.archivedAt &&
        t.status !== 'done' &&
        t.subtasks.some((s) => !s.completed) &&
        isStudyTask(t)
    )
    .slice(0, 3);

  const displaySessions = studySessions;

  return (
    <div className="flex flex-col h-full justify-between">
      {displaySessions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <BookOpen size={22} className="text-amber-500 mb-2" />
          <p className="text-xs font-semibold text-[var(--text-primary)]">
            No active study sprints
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1 max-w-[240px]">
            Parse a study log or set up pacing targets to sprint through practice problems.
          </p>
          <button
            type="button"
            onClick={() => setActiveView('study')}
            className="mt-2.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
          >
            Go to Study Hub
          </button>
        </div>
      ) : (
        <div className="space-y-2.5 flex-1">
          {displaySessions.map((t) => {
            const completedCount = t.subtasks.filter((s) => s.completed).length;
            const totalCount = t.subtasks.length;
            const pct = Math.round((completedCount / totalCount) * 100);
            const nextSubtask = t.subtasks.find((s) => !s.completed);

            return (
              <div
                key={t.id}
                className="p-3 rounded-xl bg-[var(--bg-surface-l1)]/60 border border-[var(--border-hairline)] hover:border-amber-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onSelectTask?.(t.id)}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400">
                      Sprint
                    </span>
                    <h4 className="task-title-text font-bold truncate">
                      {t.title}
                    </h4>
                  </div>

                  <p className="task-meta-text truncate text-emerald-700 dark:text-emerald-400 font-medium">
                    Next: {nextSubtask?.title || 'Finish session'}
                  </p>

                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-[var(--text-muted)]">
                    <span>
                      {completedCount}/{totalCount} targets ({pct}%)
                    </span>
                    <div className="w-20 h-1.5 rounded-full bg-[var(--bg-surface-l2)] overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onStartSprint?.(t.id)}
                  className="self-start sm:self-center flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-xs active:scale-95 shrink-0"
                >
                  <Play size={12} className="fill-current" />
                  <span>Continue</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
