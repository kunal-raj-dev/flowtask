import React, { useState, useMemo } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { formatLocalDate } from '../../utils/nlpParser';
import { useTodayStr } from '../../hooks/useCurrentDate';
import {
  TrendingUp,
  Flame,
  CheckCircle2,
  Clock,
  Star,
  Zap,
  Brain,
  Gauge,
  Layers,
  Sunrise,
  Sunset,
  Moon,
  BarChart3,
} from 'lucide-react';
import { calculateEstimationAccuracy } from '../../utils/velocityCalibrator';

interface InsightsViewProps {
  onSelectTask: (taskId: string) => void;
}

export const InsightsView: React.FC<InsightsViewProps> = ({ onSelectTask }) => {
  const { tasks, projects } = useTaskContext();

  const [hoveredScatterPoint, setHoveredScatterPoint] = useState<{
    id: string;
    title: string;
    est: number;
    actual: number;
    ratio: number;
  } | null>(null);

  const [hoveredHour, setHoveredHour] = useState<number | null>(null);

  const todayStr = useTodayStr();

  const {
    last30Days,
    completedTasks,
    activityMap,
    currentStreak,
    totalFocusHours,
    focusExecutionRate,
    timedCompletedTasks,
    maxScatterDuration,
    hourlyCounts,
    currentHour,
    chronoBuckets,
    maxHourlyCount,
    totalChronoCount,
    peakChronoKey,
    peakBucket,
    rollingWeeks,
    maxWeeklyTasks,
    wowPercent,
  } = useMemo(() => {
    // Generate 30-day date array
    const dates: string[] = [];
    const baseDate = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - i);
      dates.push(formatLocalDate(d));
    }

    const completed = tasks.filter((t) => !t.deletedAt && !t.archivedAt && t.status === 'done');

    const activity: Record<string, { count: number; minutes: number }> = {};
    dates.forEach((dateStr) => {
      activity[dateStr] = { count: 0, minutes: 0 };
    });

    completed.forEach((t) => {
      const completedDate = t.completedAt
        ? formatLocalDate(new Date(t.completedAt))
        : t.dueDate || todayStr;
      if (activity[completedDate]) {
        activity[completedDate].count += 1;
        activity[completedDate].minutes += t.timeSpentMinutes || 0;
      }
    });

    let streak = 0;
    for (let i = dates.length - 1; i >= 0; i--) {
      const dateStr = dates[i];
      if (activity[dateStr] && activity[dateStr].count > 0) {
        streak++;
      } else if (dateStr !== todayStr) {
        break;
      }
    }

    const totalMinutes = completed.reduce((acc, t) => acc + (t.timeSpentMinutes || 0), 0);
    const focusHours = (totalMinutes / 60).toFixed(1);

    const totalPin = tasks.filter((t) => t.isPinnedToday).length;
    const completedPin = tasks.filter((t) => t.isPinnedToday && !t.deletedAt && !t.archivedAt && t.status === 'done').length;
    const rate = totalPin > 0 ? Math.round((completedPin / totalPin) * 100) : 100;

    const timedTasks = completed.filter(
      (t) => (t.estimatedMinutes || 0) > 0 && (t.timeSpentMinutes || 0) > 0
    );

    const maxScatter = Math.max(
      60,
      ...timedTasks.map((t) => Math.max(t.estimatedMinutes || 0, t.timeSpentMinutes || 0))
    );

    const counts: number[] = Array(24).fill(0);
    const hourMins: number[] = Array(24).fill(0);
    const currHour = new Date().getHours();

    const chrono = {
      morning: { count: 0, minutes: 0, label: 'Morning Surge', time: '06:00 – 12:00', icon: Sunrise, color: 'text-amber-500', barColor: 'bg-amber-500' },
      afternoon: { count: 0, minutes: 0, label: 'Afternoon Focus', time: '12:00 – 17:00', icon: TrendingUp, color: 'text-orange-500', barColor: 'bg-orange-500' },
      evening: { count: 0, minutes: 0, label: 'Evening Wrap-up', time: '17:00 – 22:00', icon: Sunset, color: 'text-indigo-500', barColor: 'bg-indigo-500' },
      night: { count: 0, minutes: 0, label: 'Night Flow', time: '22:00 – 06:00', icon: Moon, color: 'text-purple-500', barColor: 'bg-purple-500' },
    };

    completed.forEach((t) => {
      if (t.completedAt) {
        const h = new Date(t.completedAt).getHours();
        const mins = t.timeSpentMinutes || 0;
        counts[h]++;
        hourMins[h] += mins;
        if (h >= 6 && h < 12) {
          chrono.morning.count++;
          chrono.morning.minutes += mins;
        } else if (h >= 12 && h < 17) {
          chrono.afternoon.count++;
          chrono.afternoon.minutes += mins;
        } else if (h >= 17 && h < 22) {
          chrono.evening.count++;
          chrono.evening.minutes += mins;
        } else {
          chrono.night.count++;
          chrono.night.minutes += mins;
        }
      }
    });

    const maxHourly = Math.max(...counts, 1);
    const totalChrono = Object.values(chrono).reduce((acc, b) => acc + b.count, 0) || 1;
    const peakKey = (Object.keys(chrono) as (keyof typeof chrono)[]).reduce((best, key) =>
      chrono[key].count > chrono[best].count ? key : best,
      'morning' as keyof typeof chrono
    );

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const weeks = [
      { label: 'Current Wk', start: now - 7 * dayMs, end: now, tasks: 0, minutes: 0 },
      { label: '1 Wk Ago', start: now - 14 * dayMs, end: now - 7 * dayMs, tasks: 0, minutes: 0 },
      { label: '2 Wks Ago', start: now - 21 * dayMs, end: now - 14 * dayMs, tasks: 0, minutes: 0 },
      { label: '3 Wks Ago', start: now - 28 * dayMs, end: now - 21 * dayMs, tasks: 0, minutes: 0 },
    ];

    completed.forEach((t) => {
      const time = t.completedAt || t.createdAt;
      for (const w of weeks) {
        if (time >= w.start && time < w.end) {
          w.tasks++;
          w.minutes += t.timeSpentMinutes || 0;
          break;
        }
      }
    });

    const maxWk = Math.max(...weeks.map((w) => w.tasks), 1);
    const diff = weeks[0].tasks - weeks[1].tasks;
    const pct = weeks[1].tasks > 0 ? Math.round((diff / weeks[1].tasks) * 100) : 0;

    return {
      last30Days: dates,
      completedTasks: completed,
      activityMap: activity,
      currentStreak: streak,
      totalFocusHours: focusHours,
      focusExecutionRate: rate,
      timedCompletedTasks: timedTasks,
      maxScatterDuration: maxScatter,
      hourlyCounts: counts,
      currentHour: currHour,
      chronoBuckets: chrono,
      maxHourlyCount: maxHourly,
      totalChronoCount: totalChrono,
      peakChronoKey: peakKey,
      peakBucket: chrono[peakKey],
      rollingWeeks: weeks,
      maxWeeklyTasks: maxWk,
      wowDiff: diff,
      wowPercent: pct,
    };
  }, [tasks, todayStr]);

  // Estimation Accuracy & Velocity Metrics (memoized)
  const accuracyMetrics = useMemo(() => calculateEstimationAccuracy(tasks), [tasks]);

  // Project distribution (memoized)
  const projectStats = useMemo(() => {
    const stats: { id: string; name: string; color: string; count: number; percent: number }[] = [];
    projects.forEach((proj) => {
      const count = tasks.filter((t) => t.projectId === proj.id).length;
      if (count > 0) {
        stats.push({
          id: proj.id,
          name: proj.name,
          color: proj.color,
          count,
          percent: Math.round((count / (tasks.length || 1)) * 100),
        });
      }
    });
    return stats.sort((a, b) => b.count - a.count);
  }, [projects, tasks]);

  const getActivityColor = (count: number) => {
    if (count === 0) return 'bg-stone-200/60 dark:bg-white/[0.04] text-[var(--text-muted)] border-transparent';
    if (count === 1) return 'bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
    if (count <= 3) return 'bg-emerald-500/50 text-white border-emerald-500/60';
    return 'bg-emerald-500 text-white font-bold border-emerald-400 shadow-sm shadow-emerald-500/30';
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header Banner */}
      <div className="p-5 rounded-xl bg-[var(--bg-surface-l1)]/90 border border-stone-200/80 dark:border-white/10 shadow-card card-surface backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 sm:p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs flex-shrink-0">
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
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Streak */}
        <div className="p-4 rounded-xl bg-white dark:bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] shadow-card card-surface">
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
        <div className="p-4 rounded-xl bg-white dark:bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] shadow-card card-surface">
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
        <div className="p-4 rounded-xl bg-white dark:bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] shadow-card card-surface">
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
        <div className="p-4 rounded-xl bg-white dark:bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] shadow-card card-surface">
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

      {/* Estimation Velocity & Cognitive Workload Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Historical Velocity & Calibration Card */}
        <div className="p-5 sm:p-6 rounded-xl bg-white dark:bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] shadow-card card-surface flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Gauge size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    Historical Estimation Velocity
                  </h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Anti-Planning Fallacy Calibration
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                {accuracyMetrics.completedSampleCount ? `${accuracyMetrics.accuracyPercent}% accuracy · ${accuracyMetrics.completedSampleCount} tasks` : 'No timed sample yet'}
              </span>
            </div>

            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-black text-[var(--text-primary)] font-mono">
                {accuracyMetrics.avgRatio.toFixed(2)}x
              </span>
              <span className="text-xs font-semibold text-[var(--text-secondary)]">
                {accuracyMetrics.avgRatio > 1.15
                  ? `Underestimating (+${Math.round((accuracyMetrics.avgRatio - 1) * 100)}% variance)`
                  : accuracyMetrics.avgRatio < 0.85
                  ? `Overestimating (-${Math.round((1 - accuracyMetrics.avgRatio) * 100)}% variance)`
                  : 'Well-calibrated estimates'}
              </span>
            </div>

            <p className="text-xs text-[var(--text-muted)] mt-2 leading-relaxed">
              {accuracyMetrics.completedSampleCount >= 2
                ? `Based on ${accuracyMetrics.completedSampleCount} completed tasks with logged duration. Automatic suggestions calibrate upcoming task estimates in task drawer.`
                : 'Log focus duration on completed tasks to automatically calibrate your estimation velocity.'}
            </p>

            {/* Interactive Anti-Planning Fallacy Calibration Curve */}
            <div className="mt-3.5 p-3 rounded-xl bg-[var(--bg-surface-l1)]/60 border border-[var(--border-hairline)] relative">
              <div className="flex items-center justify-between text-[11px] mb-1.5 font-medium">
                <span className="text-[var(--text-secondary)]">Planned vs Actual (Parity: 1.0x)</span>
                <span className="text-[10px] text-[var(--text-muted)] font-mono">Max: {maxScatterDuration}m</span>
              </div>

              <div className="relative">
                <svg
                  viewBox="0 0 260 110"
                  className="w-full h-24 overflow-visible select-none"
                  aria-label="Estimation Accuracy Scatter Chart"
                >
                  {/* Axis lines */}
                  <line x1="25" y1="10" x2="25" y2="95" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1" />
                  <line x1="25" y1="95" x2="255" y2="95" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1" />

                  {/* 1.0x Parity Diagonal Line */}
                  <line
                    x1="25"
                    y1="95"
                    x2="255"
                    y2="10"
                    stroke="#6366F1"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    strokeOpacity="0.75"
                  />

                  {/* Zone indicators */}
                  <text x="30" y="20" fill="currentColor" fillOpacity="0.35" fontSize="7" fontWeight="600">
                    ▲ Underestimated (+Time)
                  </text>
                  <text x="170" y="90" fill="currentColor" fillOpacity="0.35" fontSize="7" fontWeight="600">
                    ▼ Overestimated
                  </text>

                  {/* Scatter Dots */}
                  {timedCompletedTasks.slice(0, 30).map((t) => {
                    const est = t.estimatedMinutes || 25;
                    const actual = t.timeSpentMinutes || 25;
                    const cx = 25 + (Math.min(est, maxScatterDuration) / maxScatterDuration) * 230;
                    const cy = 95 - (Math.min(actual, maxScatterDuration) / maxScatterDuration) * 85;
                    const ratio = est > 0 ? actual / est : 1;
                    const isHovered = hoveredScatterPoint?.id === t.id;

                    const color =
                      ratio > 1.2
                        ? '#F43F5E'
                        : ratio < 0.8
                        ? '#10B981'
                        : '#6366F1';

                    return (
                      <g key={t.id} className="cursor-pointer">
                        <circle
                          cx={cx}
                          cy={cy}
                          r={isHovered ? 6 : 4}
                          fill={color}
                          stroke="#ffffff"
                          strokeWidth={isHovered ? 2 : 1}
                          className="transition-all duration-150"
                          onMouseEnter={() =>
                            setHoveredScatterPoint({
                              id: t.id,
                              title: t.title,
                              est,
                              actual,
                              ratio,
                            })
                          }
                          onMouseLeave={() => setHoveredScatterPoint(null)}
                        />
                      </g>
                    );
                  })}
                </svg>

                {/* Interactive Tooltip Card */}
                {hoveredScatterPoint && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 pointer-events-none px-2.5 py-1.5 rounded-lg bg-stone-900 text-white text-[10px] shadow-lg border border-white/10 max-w-[220px] text-center animate-fade-in">
                    <p className="font-semibold truncate">{hoveredScatterPoint.title}</p>
                    <p className="text-stone-300 font-mono mt-0.5">
                      Est: {hoveredScatterPoint.est}m → Actual: {hoveredScatterPoint.actual}m ({hoveredScatterPoint.ratio.toFixed(2)}x)
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
            <span className="flex items-center gap-1">
              <Zap size={13} className="text-amber-500" />
              Live Anti-Fallacy Active
            </span>
            <span className="font-mono text-[var(--text-muted)]">
              {accuracyMetrics.completedSampleCount} timed tasks
            </span>
          </div>
        </div>

        {/* Cognitive Workload Ratio Card */}
        <div className="p-5 sm:p-6 rounded-xl bg-white dark:bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] shadow-card card-surface flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                  <Brain size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    Cognitive Workload Ratio
                  </h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Deep Work vs. Administrative Balance
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                {accuracyMetrics.deepWorkPercent}% Deep
              </span>
            </div>

            {/* Stacked bar */}
            <div className="mt-4 space-y-2">
              <div className="h-3 w-full rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden flex">
                <div
                  style={{ width: `${accuracyMetrics.deepWorkPercent}%` }}
                  className="h-full bg-violet-600 transition-all duration-500"
                  title={`Deep Work: ${accuracyMetrics.deepWorkPercent}%`}
                />
                <div
                  style={{
                    width: `${Math.max(
                      0,
                      100 - accuracyMetrics.deepWorkPercent - accuracyMetrics.adminPercent
                    )}%`,
                  }}
                  className="h-full bg-emerald-500 transition-all duration-500"
                  title="Routine Execution"
                />
                <div
                  style={{ width: `${accuracyMetrics.adminPercent}%` }}
                  className="h-full bg-amber-500 transition-all duration-500"
                  title={`Admin / Quick Wins: ${accuracyMetrics.adminPercent}%`}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] font-medium pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-violet-500 inline-block" />
                  <span>Deep Work ({accuracyMetrics.deepWorkPercent}%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  <span>
                    Routine (
                    {Math.max(
                      0,
                      100 - accuracyMetrics.deepWorkPercent - accuracyMetrics.adminPercent
                    )}
                    %)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                  <span>Admin ({accuracyMetrics.adminPercent}%)</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-[var(--text-muted)] mt-3 leading-relaxed">
              {accuracyMetrics.deepWorkPercent >= 50
                ? 'High deep-work ratio: You spend the majority of your energy on high-leverage cognitive tasks.'
                : 'Balanced operational mix: Ensure high-priority initiatives are protected from administrative fragmentation.'}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
            <span className="flex items-center gap-1">
              <Layers size={13} className="text-violet-500" />
              Optimal target: ≥ 40% Deep Work
            </span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              {accuracyMetrics.deepWorkPercent >= 40 ? '✓ On Track' : 'Focus Needed'}
            </span>
          </div>
        </div>
      </div>

      {/* Chronobiological Peak Performance & 4-Week Velocity Trend */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Chronobiological Peak Performance Card */}
        <div className="p-5 sm:p-6 rounded-xl bg-white dark:bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] shadow-card card-surface flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Sunrise size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    Peak Performance Window
                  </h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Chronobiological Execution Curve
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                {completedTasks.length ? peakBucket.label : 'No completion data yet'}
              </span>
            </div>

            <p className="text-xs text-[var(--text-muted)] mt-3 leading-relaxed">
              {completedTasks.length > 0 ? (
                <>
                  Your highest velocity and completion rate concentrates in <strong className="text-[var(--text-primary)]">{peakBucket.label}</strong> ({peakBucket.time}), accounting for <strong className="text-[var(--text-primary)]">{Math.round((peakBucket.count / totalChronoCount) * 100)}%</strong> of finished work.
                </>
              ) : (
                'No recorded observations yet. Complete tasks to uncover your chronobiological peak focus window.'
              )}
            </p>

            {/* 24-Hour Energy Completion Arc */}
            <div className="mt-3.5 p-3 rounded-xl bg-[var(--bg-surface-l1)]/60 border border-[var(--border-hairline)]">
              <div className="flex items-center justify-between text-[11px] mb-2 font-medium">
                <span className="text-[var(--text-secondary)]">24-Hour Hourly Activity Arc</span>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold font-mono">
                  {hoveredHour !== null
                    ? `${hoveredHour.toString().padStart(2, '0')}:00 • ${hourlyCounts[hoveredHour]} task${hourlyCounts[hoveredHour] === 1 ? '' : 's'}`
                    : `Current Hour: ${currentHour.toString().padStart(2, '0')}:00`}
                </span>
              </div>

              <div className="flex items-end gap-0.5 h-12 pt-1 pb-1">
                {hourlyCounts.map((count, h) => {
                  const heightPercent = maxHourlyCount > 0 ? Math.max(8, Math.round((count / maxHourlyCount) * 100)) : 8;
                  const isCurrent = h === currentHour;
                  const isHovered = hoveredHour === h;

                  const zoneColor =
                    h >= 6 && h < 12
                      ? 'bg-amber-500'
                      : h >= 12 && h < 17
                      ? 'bg-orange-500'
                      : h >= 17 && h < 22
                      ? 'bg-indigo-500'
                      : 'bg-purple-500';

                  return (
                    <div
                      key={h}
                      onMouseEnter={() => setHoveredHour(h)}
                      onMouseLeave={() => setHoveredHour(null)}
                      className="flex-1 h-full flex items-end cursor-pointer group relative"
                      title={`${h.toString().padStart(2, '0')}:00 — ${count} tasks`}
                    >
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full rounded-t-sm transition-all duration-150 ${zoneColor} ${
                          isHovered
                            ? 'opacity-100 ring-2 ring-white dark:ring-stone-900 scale-y-105'
                            : isCurrent
                            ? 'opacity-90 ring-1 ring-amber-400'
                            : 'opacity-60 group-hover:opacity-100'
                        }`}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-[9px] text-[var(--text-muted)] font-mono pt-1 border-t border-[var(--border-hairline)]">
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>23:00</span>
              </div>
            </div>

            {/* 4 Periods Distribution */}
            <div className="grid grid-cols-2 gap-2 mt-4">
              {(Object.keys(chronoBuckets) as (keyof typeof chronoBuckets)[]).map((key) => {
                const b = chronoBuckets[key];
                const pct = Math.round((b.count / totalChronoCount) * 100);
                const Icon = b.icon;
                const isPeak = key === peakChronoKey;

                return (
                  <div
                    key={key}
                    className={`p-2.5 rounded-lg border transition-all ${
                      isPeak
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-[var(--bg-surface-l1)]/50 border-[var(--border-hairline)]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Icon size={12} className={b.color} />
                        <span className="truncate">{b.label.split(' ')[0]}</span>
                      </div>
                      <span className="font-mono font-bold">{pct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-stone-200 dark:bg-stone-800 rounded-full mt-2 overflow-hidden">
                      <div
                        className={`h-full ${b.barColor} rounded-full`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] mt-1.5 font-mono">
                      <span>{b.count} tasks</span>
                      <span>{(b.minutes / 60).toFixed(1)}h</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
            <span>Optimal deep work scheduling</span>
            <span className="font-mono text-amber-600 dark:text-amber-400 font-semibold">
              {completedTasks.length > 0 ? peakBucket.time : 'No recorded observations yet'}
            </span>
          </div>
        </div>

        {/* 4-Week Rolling Velocity Trend */}
        <div className="p-5 sm:p-6 rounded-xl bg-white dark:bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] shadow-card card-surface flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                  <BarChart3 size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    4-Week Rolling Velocity
                  </h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Week-over-Week Output Cadence
                  </p>
                </div>
              </div>
              <span
                className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${
                  wowPercent >= 0
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                }`}
              >
                {wowPercent >= 0 ? `+${wowPercent}%` : `${wowPercent}%`} WoW
              </span>
            </div>

            <p className="text-xs text-[var(--text-muted)] mt-3 leading-relaxed">
              Tracking completed volume and logged focus hours over the last 28 days to prevent burnout and spot momentum shifts.
            </p>

            {/* 4-Week Bars */}
            <div className="space-y-2 mt-4">
              {rollingWeeks.map((w, idx) => {
                const barPercent = Math.max(8, Math.round((w.tasks / maxWeeklyTasks) * 100));
                const hours = (w.minutes / 60).toFixed(1);

                return (
                  <div key={w.label} className="p-2.5 rounded-lg bg-[var(--bg-surface-l1)]/50 border border-[var(--border-hairline)]">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-[var(--text-primary)]">{w.label}</span>
                      <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                        <strong className="text-[var(--text-primary)]">{w.tasks}</strong> tasks • {hours}h
                      </span>
                    </div>
                    <div className="w-full h-2 bg-stone-200 dark:bg-stone-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          idx === 0
                            ? 'bg-teal-500'
                            : 'bg-stone-400 dark:bg-stone-600'
                        }`}
                        style={{ width: `${barPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
            <span>28-day cumulative output</span>
            <span className="font-mono font-bold text-[var(--text-primary)]">
              {rollingWeeks.reduce((acc, w) => acc + w.tasks, 0)} completed tasks
            </span>
          </div>
        </div>
      </div>

      {/* 30-Day Activity Heatmap */}
      <div className="p-5 sm:p-6 rounded-xl bg-white dark:bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] shadow-card card-surface space-y-4">
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
                className={`relative group p-2.5 rounded-md border transition-all duration-200 flex flex-col items-center justify-center gap-1 text-center cursor-default ${getActivityColor(
                  data.count
                )} ${isTodayCell ? 'ring-2 ring-[var(--color-brand)] shadow-xs' : ''}`}
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
      <div className="p-5 sm:p-6 rounded-xl bg-white dark:bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] shadow-card card-surface space-y-4">
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
              className="p-2.5 rounded-lg bg-[var(--bg-surface-l1)]/60 border border-[var(--border-hairline)] flex items-center justify-between text-xs"
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
        <div className="p-5 sm:p-6 rounded-xl bg-white dark:bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] shadow-card card-surface space-y-3">
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
                  className="p-3 rounded-lg bg-[var(--bg-surface-l1)]/60 hover:bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] flex items-center justify-between gap-3 text-xs transition-colors cursor-pointer card-surface"
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
