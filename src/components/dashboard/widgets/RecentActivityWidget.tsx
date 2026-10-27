import React, { useMemo } from 'react';
import { useTaskContext } from '../../../context/TaskContext';
import { CheckCircle2, Timer, Clock } from 'lucide-react';
import type { WidgetComponentProps } from '../../../types/dashboard';

interface ActivityItem {
  id: string;
  type: 'task_done' | 'focus_session';
  title: string;
  timestamp: number;
  subtitle: string;
}

export const RecentActivityWidget: React.FC<WidgetComponentProps> = ({
  onSelectTask,
}) => {
  const { tasks, focusLogs = [] } = useTaskContext();

  const activity: ActivityItem[] = useMemo(() => {
    const list: ActivityItem[] = [];

    // Completed tasks
    tasks.forEach((t) => {
      if (t.status === 'done' && t.completedAt) {
        list.push({
          id: `task-${t.id}`,
          type: 'task_done',
          title: t.title,
          timestamp: t.completedAt,
          subtitle: 'Task completed',
        });
      }
    });

    // Focus sessions
    focusLogs.forEach((log) => {
      if (log.endedAt) {
        const mins = Math.max(1, Math.round(log.seconds / 60));
        list.push({
          id: `log-${log.id}`,
          type: 'focus_session',
          title: log.taskTitle || 'Focus sprint',
          timestamp: log.endedAt,
          subtitle: `${mins} min focus session`,
        });
      }
    });

    return list.sort((a, b) => b.timestamp - a.timestamp).slice(0, 6);
  }, [tasks, focusLogs]);

  return (
    <div className="flex flex-col h-full">
      {activity.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-xs text-[var(--text-muted)]">
          <Clock size={22} className="mb-2 opacity-50" />
          No recent completions or focus logs. Start a task to see momentum!
        </div>
      ) : (
        <div className="space-y-2 flex-1 overflow-y-auto pr-0.5">
          {activity.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                if (item.type === 'task_done') {
                  onSelectTask?.(item.id.replace('done-', ''));
                }
              }}
              className={`flex items-center gap-2.5 p-2 rounded-xl bg-[var(--bg-surface-l1)]/40 hover:bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] transition-all ${
                item.type === 'task_done' && onSelectTask ? 'cursor-pointer' : ''
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  item.type === 'task_done'
                    ? 'bg-[var(--pastel-sage-subtle)] text-[var(--pastel-sage)] dark:text-[var(--pastel-sage)]'
                    : 'bg-[var(--color-brand-subtle)] text-[var(--color-brand)] dark:text-[var(--color-brand)]'
                }`}
              >
                {item.type === 'task_done' ? (
                  <CheckCircle2 size={14} />
                ) : (
                  <Timer size={14} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="task-title-text font-semibold truncate text-[var(--text-primary)]">
                  {item.title}
                </p>
                <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                  <span>{item.subtitle}</span>
                  <span>·</span>
                  <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
