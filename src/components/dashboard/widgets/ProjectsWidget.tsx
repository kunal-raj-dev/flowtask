import React, { useMemo } from 'react';
import { useTaskContext } from '../../../context/TaskContext';
import { Folder, Calendar, ArrowRight } from 'lucide-react';
import type { WidgetComponentProps } from '../../../types/dashboard';

interface ProjectsConfig {
  projectIds?: string[];
}

export const ProjectsWidget: React.FC<WidgetComponentProps<ProjectsConfig>> = ({
  widget,
}) => {
  const { projects, tasks, setActiveView } = useTaskContext();

  const selectedProjects = useMemo(() => {
    const list = projects.filter(
      (p) => p.id !== 'inbox' && p.id !== 'ideas' && !p.isArchived
    );
    if (widget.config?.projectIds?.length) {
      return list.filter((p) => widget.config.projectIds!.includes(p.id));
    }
    return list.slice(0, 4);
  }, [projects, widget.config]);

  // Compute stats per project
  const projectStats = useMemo(() => {
    const map = new Map<
      string,
      { total: number; done: number; remainingMinutes: number }
    >();

    tasks.forEach((t) => {
      if (t.deletedAt || t.archivedAt) return;
      const stats = map.get(t.projectId) || { total: 0, done: 0, remainingMinutes: 0 };
      stats.total++;
      if (t.status === 'done') {
        stats.done++;
      } else {
        stats.remainingMinutes += t.estimatedMinutes || 30;
      }
      map.set(t.projectId, stats);
    });

    return map;
  }, [tasks]);

  return (
    <div className="flex flex-col h-full">
      {selectedProjects.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <Folder size={24} className="text-[var(--text-muted)] mb-2" />
          <p className="text-xs font-semibold text-[var(--text-primary)]">
            No active projects to display
          </p>
          <button
            type="button"
            onClick={() => setActiveView('projects')}
            className="mt-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
          >
            Create or browse projects
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 flex-1">
          {selectedProjects.map((p) => {
            const stats = projectStats.get(p.id) || { total: 0, done: 0, remainingMinutes: 0 };
            const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

            return (
              <div
                key={p.id}
                onClick={() => setActiveView(`project:${p.id}` as any)}
                className="group flex flex-col justify-between p-3 rounded-xl bg-[var(--bg-surface-l1)]/50 hover:bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] hover:border-[var(--border-strong)] transition-all cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: p.color || '#10B981' }}
                      />
                      <h4 className="task-title-text font-bold truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                        {p.name}
                      </h4>
                    </div>
                    <ArrowRight size={13} className="text-[var(--text-muted)] group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </div>

                  {p.outcome && (
                    <p className="text-xs text-[var(--text-secondary)] line-clamp-2 italic mb-2">
                      "{p.outcome}"
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-[var(--border-subtle)] space-y-1.5 task-meta-text">
                  <div className="flex items-center justify-between text-[11px]">
                    <span>
                      {stats.done}/{stats.total} done ({pct}%)
                    </span>
                    <span className="font-mono">{stats.remainingMinutes}m left</span>
                  </div>

                  {/* Progress track */}
                  <div className="w-full h-1.5 rounded-full bg-[var(--bg-surface-l2)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {p.targetDate && (
                    <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] pt-0.5">
                      <Calendar size={11} />
                      <span>Target: {p.targetDate}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
