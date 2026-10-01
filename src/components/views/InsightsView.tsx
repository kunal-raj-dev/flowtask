import React from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { formatLocalDate } from '../../utils/nlpParser';
import {
  TrendingUp,
  Flame,
  CheckCircle2,
  Clock,
  Star,
  Award,
  Zap,
} from 'lucide-react';

interface InsightsViewProps {
  onSelectTask: (taskId: string) => void;
}

export const InsightsView: React.FC<InsightsViewProps> = ({ onSelectTask }) => {
  const { tasks, projects } = useTaskContext();

  const today = new Date();
  const todayStr = formatLocalDate(today);

  // Generate 30-day date array (from 29 days ago up to today)
  const last30Days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last30Days.push(formatLocalDate(d));
  }

  // Completed tasks
  const completedTasks = tasks.filter((t) => t.status === 'done');

  // Map of dateStr -> completed tasks count
  const activityMap: Record<string, { count: number; minutes: number }> = {};
  last30Days.forEach((dateStr) => {
    activityMap[dateStr] = { count: 0, minutes: 0 };
  });

  completedTasks.forEach((t) => {
    const completedDate = t.completedAt
      ? formatLocalDate(new Date(t.completedAt))
      : t.dueDate || todayStr;
    if (activityMap[completedDate]) {
      activityMap[completedDate].count += 1;
      activityMap[completedDate].minutes += t.timeSpentMinutes || t.estimatedMinutes || 25;
    }
  });

  // Calculate Streak
  let currentStreak = 0;
  for (let i = last30Days.length - 1; i >= 0; i--) {
    const dateStr = last30Days[i];
    if (activityMap[dateStr] && activityMap[dateStr].count > 0) {
      currentStreak++;
    } else if (dateStr !== todayStr) {
      // If today has 0 so far, we don't break streak if yesterday was completed
      break;
    }
  }

  // Total Focus Minutes logged
  const totalFocusMinutes = completedTasks.reduce(
    (acc, t) => acc + (t.timeSpentMinutes || t.estimatedMinutes || 25),
    0
  );
  const totalFocusHours = (totalFocusMinutes / 60).toFixed(1);

  // Rule of 3 Focus Execution Rate
  const totalPinned = tasks.filter((t) => t.isPinnedToday).length;
  const completedPinned = tasks.filter((t) => t.isPinnedToday && t.status === 'done').length;
  const focusExecutionRate = totalPinned > 0 ? Math.round((completedPinned / totalPinned) * 100) : 100;

  // Project distribution
  const projectStats: { id: string; name: string; color: string; count: number; percent: number }[] = [];
  projects.forEach((proj) => {
    const count = tasks.filter((t) => t.projectId === proj.id).length;
    if (count > 0) {
      projectStats.push({
        id: proj.id,
        name: proj.name,
        color: proj.color,
        count,
        percent: Math.round((count / (tasks.length || 1)) * 100),
      });
    }
  });
  projectStats.sort((a, b) => b.count - a.count);

  const getActivityColor = (count: number) => {
    if (count === 0) return 'bg-stone-200/60 dark:bg-white/[0.04] text-[var(--text-muted)] border-transparent';
    if (count === 1) return 'bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
    if (count <= 3) return 'bg-emerald-500/50 text-white border-emerald-500/60';
    return 'bg-emerald-500 text-white font-bold border-emerald-400 shadow-sm shadow-emerald-500/30';
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header Banner */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-emerald-500/[0.08] via-teal-500/[0.05] to-indigo-500/[0.06] border border-stone-200/80 dark:border-white/10 shadow-card card-surface backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-md shadow-emerald-500/20 card-surface flex-shrink-0">
            <TrendingUp size={24} className="stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
              Productivity & Focus Insights
            </h2>
            <p className="text-xs text-[var(--text-secondary)] font-medium">
              Real-time analytics on your execution velocity, consistency, and focus habits
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white/80 dark:bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] shadow-subtle card-surface">
          <Award size={15} className="text-amber-500" />
          <span className="text-xs font-semibold text-[var(--text-primary)]">Pro Analytics</span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Streak */}
        <div className="p-4 rounded-3xl bg-white dark:bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] shadow-card card-surface">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Daily Streak
            </span>
            <Flame size={16} className="text-orange-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] font-mono">
              {currentStreak}
            </span>
            <span className="text-xs text-[var(--text-secondary)] font-semibold">days active</span>
          </div>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
            Consistency compounder
          </p>
        </div>

        {/* Total Tasks Completed */}
        <div className="p-4 rounded-3xl bg-white dark:bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] shadow-card card-surface">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Completed
            </span>
            <CheckCircle2 size={16} className="text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] font-mono">
              {completedTasks.length}
            </span>
            <span className="text-xs text-[var(--text-secondary)] font-semibold">tasks done</span>
          </div>
          <p className="text-[10px] text-[var(--text-muted)] font-medium mt-1">
            Lifetime accomplishments
          </p>
        </div>

        {/* Focus Hours Logged */}
        <div className="p-4 rounded-3xl bg-white dark:bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] shadow-card card-surface">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Deep Work
            </span>
            <Clock size={16} className="text-indigo-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] font-mono">
              {totalFocusHours}h
            </span>
            <span className="text-xs text-[var(--text-secondary)] font-semibold">focused</span>
          </div>
          <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium mt-1">
            High-leverage time logged
          </p>
        </div>

        {/* MIT Focus Rate */}
        <div className="p-4 rounded-3xl bg-white dark:bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] shadow-card card-surface">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Rule of 3 Rate
            </span>
            <Star size={16} className="text-amber-500 fill-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] font-mono">
              {focusExecutionRate}%
            </span>
            <span className="text-xs text-[var(--text-secondary)] font-semibold">target rate</span>
          </div>
          <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-1">
            Priority execution clarity
          </p>
        </div>
      </div>

      {/* 30-Day Activity Heatmap */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] shadow-card card-surface space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              30-Day Execution Heatmap
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Daily completed tasks & focus velocity over the past month
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] font-medium">
            <span>Less</span>
            <div className="w-3 h-3 rounded bg-stone-200/60 dark:bg-white/[0.04]" />
            <div className="w-3 h-3 rounded bg-emerald-500/25" />
            <div className="w-3 h-3 rounded bg-emerald-500/50" />
            <div className="w-3 h-3 rounded bg-emerald-500" />
            <span>More</span>
          </div>
        </div>

        {/* Heatmap Grid: 30 cells */}
        <div className="grid grid-cols-6 sm:grid-cols-10 gap-2 pt-2">
          {last30Days.map((dateStr) => {
            const data = activityMap[dateStr] || { count: 0, minutes: 0 };
            const isTodayCell = dateStr === todayStr;

            return (
              <div
                key={dateStr}
                className={`relative group p-2.5 rounded-2xl border transition-all duration-200 flex flex-col items-center justify-center gap-1 text-center cursor-default ${getActivityColor(
                  data.count
                )} ${isTodayCell ? 'ring-2 ring-amber-500 shadow-xs' : ''}`}
              >
                <span className="text-[10px] font-mono leading-none opacity-80">
                  {dateStr.slice(5)}
                </span>
                <span className="text-xs font-black font-mono">
                  {data.count}
                </span>

                {/* Tooltip on hover */}
                <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 z-30 opacity-0 group-hover:opacity-100 transition-opacity bg-stone-900 text-white text-[10px] px-2 py-1 rounded-lg whitespace-nowrap shadow-lg">
                  {dateStr}: {data.count} tasks ({data.minutes}m focus)
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Project Allocation Breakdown */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] shadow-card card-surface space-y-4">
        <div>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">
            Project Effort Distribution
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            How your tasks and energy are distributed across active domains
          </p>
        </div>

        {/* Multi-color distribution bar */}
        <div className="w-full h-3 rounded-full overflow-hidden flex bg-stone-200 dark:bg-stone-800">
          {projectStats.map((p) => (
            <div
              key={p.id}
              className="h-full transition-all duration-500"
              style={{
                width: `${p.percent}%`,
                backgroundColor: p.color,
              }}
              title={`${p.name}: ${p.percent}%`}
            />
          ))}
        </div>

        {/* Project Legend Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          {projectStats.map((p) => (
            <div
              key={p.id}
              className="p-2.5 rounded-2xl bg-[var(--bg-surface-l1)]/60 border border-[var(--border-hairline)] flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2 truncate">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: p.color }}
                />
                <span className="font-semibold text-[var(--text-primary)] truncate">{p.name}</span>
              </div>
              <span className="font-mono text-[11px] text-[var(--text-muted)] shrink-0">
                {p.percent}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Completed Wins */}
      {completedTasks.length > 0 && (
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] shadow-card card-surface space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <Zap size={15} className="text-amber-500" /> Recent Accomplishments
            </h3>
            <span className="text-[11px] text-[var(--text-muted)] font-mono">
              Showing last 5 completed
            </span>
          </div>

          <div className="space-y-2">
            {completedTasks.slice(0, 5).map((task) => {
              const project = projects.find((p) => p.id === task.projectId);
              return (
                <div
                  key={task.id}
                  onClick={() => onSelectTask(task.id)}
                  className="p-3 rounded-2xl bg-[var(--bg-surface-l1)]/60 hover:bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] flex items-center justify-between gap-3 text-xs transition-colors cursor-pointer card-surface"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                    <span className="font-medium line-through text-[var(--text-muted)] truncate">
                      {task.title}
                    </span>
                  </div>

                  {project && project.id !== 'inbox' && (
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0"
                      style={{
                        backgroundColor: `${project.color}15`,
                        color: project.color,
                      }}
                    >
                      {project.name}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
