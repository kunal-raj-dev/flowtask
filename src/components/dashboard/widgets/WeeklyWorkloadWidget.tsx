import React, { useMemo } from 'react';
import { useTaskContext } from '../../../context/TaskContext';
import { calculateWeekPlanSummary } from '../../../utils/dayPlanSummary';
import { useTodayStr } from '../../../hooks/useCurrentDate';
import type { WidgetComponentProps } from '../../../types/dashboard';

export const WeeklyWorkloadWidget: React.FC<WidgetComponentProps> = () => {
  const { tasks, settings, calendarEvents } = useTaskContext();
  const capacity = (settings?.targetWorkCapacityHours || 6) * 60;
  const todayStr = useTodayStr();

  const daysData = useMemo(() => {
    return calculateWeekPlanSummary({startDate:todayStr,todayStr,tasks,settings,calendarEvents}).map(({date,key,summary,deadlinesCount},i)=>{
      const plannedMinutes = summary.totalDemandMinutes;
      return {
        key,
        dayLabel: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dateLabel: date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
        isToday: i === 0,
        plannedMinutes,
        deadlinesCount,
        availableMinutes: summary.availableTaskBudgetMinutes,
        overbooked: summary.overbooked,
      };
    });
  }, [tasks, settings, calendarEvents, todayStr]);

  return (
    <div className="flex flex-col h-full justify-between">
      {/* 7-day workload chart bars */}
      <div className="grid grid-cols-7 gap-2 flex-1 items-end pt-3 pb-2">
        {daysData.map((d) => {
          const heightPct = Math.min(100, Math.round((d.plannedMinutes / (d.availableMinutes || 1)) * 100));

          return (
            <div
              key={d.key}
              title={`${d.key}: ${d.plannedMinutes}m planned (${d.deadlinesCount} deadlines)`}
              className="flex flex-col items-center gap-1.5 h-full justify-end group"
            >
              {/* Deadline dot */}
              {d.deadlinesCount > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mb-0.5 shrink-0" />
              )}

              {/* Bar track */}
              <div className="w-full max-w-[28px] flex-1 bg-[var(--bg-surface-l1)] rounded-lg overflow-hidden flex flex-col justify-end relative">
                <div
                  className={`w-full rounded-lg transition-all duration-300 ${
                    d.overbooked
                      ? 'bg-rose-500'
                      : d.isToday
                      ? 'bg-amber-500'
                      : 'bg-emerald-600'
                  }`}
                  style={{ height: `${Math.max(6, heightPct)}%` }}
                />
              </div>

              {/* Labels */}
              <div className="text-center">
                <span
                  className={`text-[10px] block font-semibold truncate ${
                    d.isToday ? 'text-amber-700 dark:text-amber-400 font-bold' : 'text-[var(--text-secondary)]'
                  }`}
                >
                  {d.dayLabel}
                </span>
                <span className="text-[9px] font-mono text-[var(--text-muted)] block">
                  {d.plannedMinutes}m
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
        <span>Capacity: {Math.round(capacity / 60)}h / day</span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-rose-500" /> Deadline
        </span>
      </div>
    </div>
  );
};
