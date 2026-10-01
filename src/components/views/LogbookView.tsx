import React from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { TaskCard } from '../tasks/TaskCard';
import { CheckCircle2, Trophy, Sparkles } from 'lucide-react';
import { formatLocalDate } from '../../utils/nlpParser';

interface LogbookViewProps {
  onSelectTask: (taskId: string) => void;
}

export const LogbookView: React.FC<LogbookViewProps> = ({ onSelectTask }) => {
  const { tasks } = useTaskContext();

  const completedTasks = tasks
    .filter((t) => t.status === 'done')
    .sort((a, b) => (b.completedAt || b.createdAt) - (a.completedAt || a.createdAt));

  const todayStr = formatLocalDate(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatLocalDate(yesterday);

  const todayCompleted = completedTasks.filter(
    (t) => t.completedAt && formatLocalDate(new Date(t.completedAt)) === todayStr
  );
  const yesterdayCompleted = completedTasks.filter(
    (t) => t.completedAt && formatLocalDate(new Date(t.completedAt)) === yesterdayStr
  );
  const olderCompleted = completedTasks.filter(
    (t) =>
      !t.completedAt ||
      (formatLocalDate(new Date(t.completedAt)) !== todayStr &&
        formatLocalDate(new Date(t.completedAt)) !== yesterdayStr)
  );

  const renderSection = (title: string, sectionTasks: typeof completedTasks) => {
    if (sectionTasks.length === 0) return null;
    return (
      <div className="mb-7">
        <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">
          {title} ({sectionTasks.length})
        </h3>
        <div className="space-y-2.5">
          {sectionTasks.map((task) => (
            <TaskCard key={task.id} task={task} onSelectTask={onSelectTask} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm card-surface">
            <CheckCircle2 size={22} className="stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
              Logbook & Accomplishments
            </h2>
            <p className="text-xs text-[var(--text-secondary)] font-medium">
              {completedTasks.length} tasks completed to date
            </p>
          </div>
        </div>

        {completedTasks.length > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/15 to-orange-500/10 text-amber-700 dark:text-amber-300 text-xs font-semibold border border-amber-500/25 shadow-xs card-surface">
            <Trophy size={14} className="text-amber-500" />
            <span>Well Done!</span>
          </div>
        )}
      </div>

      {completedTasks.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)] bg-[var(--bg-surface-l1)]/20 rounded-2xl border border-[var(--border-hairline)]">
          <Sparkles size={36} className="mx-auto mb-2 text-stone-300 dark:text-stone-700" />
          <p className="text-sm font-semibold text-[var(--text-primary)]">Logbook is empty</p>
          <p className="text-xs mt-1 text-[var(--text-secondary)]">Check off tasks to build your achievement history.</p>
        </div>
      ) : (
        <div>
          {renderSection('Completed Today', todayCompleted)}
          {renderSection('Completed Yesterday', yesterdayCompleted)}
          {renderSection('Earlier Completed', olderCompleted)}
        </div>
      )}
    </div>
  );
};
