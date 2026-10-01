import React from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { TaskCard } from '../tasks/TaskCard';
import { Omnibar } from '../tasks/Omnibar';
import { formatLocalDate } from '../../utils/nlpParser';
import { Calendar, CalendarDays } from 'lucide-react';

interface UpcomingViewProps {
  onSelectTask: (taskId: string) => void;
  onStartFocus: (taskId: string) => void;
  onOpenBrainDump: () => void;
}

export const UpcomingView: React.FC<UpcomingViewProps> = ({
  onSelectTask,
  onStartFocus,
  onOpenBrainDump,
}) => {
  const { tasks } = useTaskContext();

  const today = new Date();
  const todayStr = formatLocalDate(today);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatLocalDate(tomorrow);

  const endOfWeek = new Date(today);
  endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
  const endOfWeekStr = formatLocalDate(endOfWeek);

  const nextWeekEnd = new Date(endOfWeek);
  nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);
  const nextWeekEndStr = formatLocalDate(nextWeekEnd);

  // Future incomplete tasks
  const upcomingTasks = tasks.filter(
    (t) => t.status !== 'done' && t.dueDate && t.dueDate > todayStr
  );

  const tomorrowTasks = upcomingTasks.filter((t) => t.dueDate === tomorrowStr);
  const thisWeekTasks = upcomingTasks.filter(
    (t) => t.dueDate && t.dueDate > tomorrowStr && t.dueDate <= endOfWeekStr
  );
  const nextWeekTasks = upcomingTasks.filter(
    (t) => t.dueDate && t.dueDate > endOfWeekStr && t.dueDate <= nextWeekEndStr
  );
  const laterTasks = upcomingTasks.filter(
    (t) => t.dueDate && t.dueDate > nextWeekEndStr
  );

  const renderSection = (title: string, sectionTasks: typeof upcomingTasks, subtitle?: string) => {
    if (sectionTasks.length === 0) return null;
    return (
      <div className="mb-7">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
            {title} ({sectionTasks.length})
          </h3>
          {subtitle && <span className="text-[11px] font-mono text-[var(--text-muted)]">{subtitle}</span>}
        </div>
        <div className="space-y-2.5">
          {sectionTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onSelectTask={onSelectTask}
              onStartFocus={onStartFocus}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-sm card-surface">
          <CalendarDays size={22} className="stroke-[2.2]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
            Upcoming Schedule
          </h2>
          <p className="text-xs text-[var(--text-secondary)] font-medium">
            {upcomingTasks.length} scheduled tasks ahead
          </p>
        </div>
      </div>

      <Omnibar onOpenBrainDump={onOpenBrainDump} />

      {upcomingTasks.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)] bg-[var(--bg-surface-l1)]/20 rounded-2xl border border-[var(--border-hairline)]">
          <Calendar size={36} className="mx-auto mb-2 text-stone-300 dark:text-stone-700" />
          <p className="text-sm font-semibold text-[var(--text-primary)]">No upcoming tasks scheduled</p>
          <p className="text-xs mt-1 text-[var(--text-secondary)]">
            Try adding a task like "Prepare slides next Monday at 10am #work"
          </p>
        </div>
      ) : (
        <div>
          {renderSection('Tomorrow', tomorrowTasks, tomorrowStr)}
          {renderSection('Later This Week', thisWeekTasks)}
          {renderSection('Next Week', nextWeekTasks)}
          {renderSection('Later & Future', laterTasks)}
        </div>
      )}
    </div>
  );
};
