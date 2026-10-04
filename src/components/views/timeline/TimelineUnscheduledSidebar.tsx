import React from 'react';
import type { Task, Project } from '../../../types/task';
import { Calendar, CheckCircle2, Zap } from 'lucide-react';

interface TimelineUnscheduledSidebarProps {
  unscheduledTasks: Task[];
  scheduledTasksCount: number;
  projects: Project[];
  startHour: number;
  totalHours: number;
  onSelectTask: (taskId: string) => void;
  onAutoSlotDay: () => void;
  onClearAllScheduledTimes: () => void;
  onScheduleUnscheduled: (task: Task, hour: number) => void;
}

export const TimelineUnscheduledSidebar: React.FC<TimelineUnscheduledSidebarProps> = ({
  unscheduledTasks,
  scheduledTasksCount,
  projects,
  startHour,
  totalHours,
  onSelectTask,
  onAutoSlotDay,
  onClearAllScheduledTimes,
  onScheduleUnscheduled,
}) => {
  return (
    <div className="lg:col-span-4 bg-[var(--bg-surface-l1)] border border-stone-200/80 dark:border-white/10 rounded-xl p-4 card-surface space-y-3">
      <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-2.5">
        <div className="flex items-center gap-1.5">
          <Calendar size={14} className="text-amber-500" />
          <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
            Unscheduled ({unscheduledTasks.length})
          </h4>
        </div>
        <div className="flex items-center gap-1.5">
          {unscheduledTasks.length > 0 ? (
            <button
              type="button"
              onClick={onAutoSlotDay}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-[11px] font-bold transition-all shadow-xs active:scale-95"
              title="Automatically distribute unscheduled tasks into free timeline gaps without conflicts"
            >
              <Zap size={11} className="fill-current text-amber-500" />
              <span>Auto-Slot Day</span>
            </button>
          ) : scheduledTasksCount > 0 ? (
            <button
              type="button"
              onClick={onClearAllScheduledTimes}
              className="text-[10px] font-semibold text-stone-400 hover:text-rose-500 transition-colors px-1 py-0.5 rounded hover:bg-rose-500/10"
              title="Clear all scheduled times for today"
            >
              Clear Times
            </button>
          ) : (
            <span className="text-[10px] text-[var(--text-muted)]">Click slot to assign</span>
          )}
        </div>
      </div>

      {unscheduledTasks.length === 0 ? (
        <div className="text-center py-8 text-[var(--text-muted)] text-xs">
          <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-500/60" />
          All today&apos;s tasks are scheduled on your timeline!
        </div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {unscheduledTasks.map((task) => {
            const project = projects.find((p) => p.id === task.projectId);
            return (
              <div
                key={task.id}
                onClick={() => onSelectTask(task.id)}
                className="group p-3 rounded-lg bg-white dark:bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] hover:border-amber-500/40 transition-all card-surface cursor-pointer text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-[var(--text-primary)] truncate">
                      {task.title}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-[var(--text-muted)]">
                      {project && project.id !== 'inbox' && (
                        <span className="flex items-center gap-1">
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: project.color }}
                          />
                          {project.name}
                        </span>
                      )}
                      {task.sessionMetadata?.isSession && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/25">
                          🎯 Session {task.sessionMetadata.sessionNumber || ''}
                        </span>
                      )}
                      {task.sessionMetadata?.pacingMinutesPerQuestion && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25">
                          ⚡ {task.sessionMetadata.pacingMinutesPerQuestion}m/Q
                        </span>
                      )}
                      <span>~{task.estimatedMinutes || 30}m</span>
                      {task.priority !== 'p4' && (
                        <span className="uppercase font-bold text-amber-600 dark:text-amber-400">
                          {task.priority}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick Assign Dropdown */}
                  <select
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const h = parseInt(e.target.value, 10);
                      if (!isNaN(h)) onScheduleUnscheduled(task, h);
                    }}
                    defaultValue=""
                    className="text-[10px] bg-[var(--bg-surface-l1)] text-[var(--text-secondary)] border border-[var(--border-hairline)] rounded-lg px-2 py-1 outline-none cursor-pointer hover:border-amber-500"
                  >
                    <option value="" disabled>
                      + Time
                    </option>
                    {Array.from({ length: totalHours }, (_, i) => startHour + i).map((h) => (
                      <option key={h} value={h}>
                        {h.toString().padStart(2, '0')}:00
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
