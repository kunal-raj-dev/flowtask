import { useMemo } from "react";
import { useTaskContext } from "../../context/TaskContext";
import { calculateWeekPlanSummary } from "../../utils/dayPlanSummary";
import { useTodayStr } from "../../hooks/useCurrentDate";
import { formatCapacitySummary } from "../../services/workBlockService";

export function WeeklyWorkload() {
  const { tasks, settings, calendarEvents } = useTaskContext();
  const todayStr = useTodayStr();

  const days = useMemo(() => {
    return calculateWeekPlanSummary({
      startDate: todayStr,
      todayStr,
      tasks,
      settings,
      calendarEvents,
    }).map(({ key, date, summary, deadlinesCount }) => ({
      key,
      date,
      summary,
      minutes: summary.totalDemandMinutes,
      capacity: summary.availableTaskBudgetMinutes,
      overbooked: summary.overbooked,
      deadlinesCount,
    }));
  }, [todayStr, tasks, settings, calendarEvents]);

  return (
    <section className="v2-week" aria-label="Next seven days workload">
      <div>
        <strong>
          {days.some((day) => day.overbooked)
            ? "A little room to make."
            : "The week has room."}
        </strong>
        <p>
          Planned work counts once. Deadlines without a planned date appear on
          their due day. Calendar time reduces your available room.
        </p>
      </div>
      <div className="v2-week-bars">
        {days.map(
          ({ key, date, summary, minutes, capacity, overbooked, deadlinesCount }) => {
            return (
              <div
                key={key}
                title={`${key}: ${formatCapacitySummary(minutes, capacity, summary.timedCalendarMinutes, summary.missingEstimatesCount)} · ${deadlinesCount} deadlines`}
              >
                <small>
                  {date.toLocaleDateString("en", { weekday: "short" })}
                </small>
                <div className="v2-week-track">
                  <i
                    style={{
                      height: `${Math.min(100, (minutes / (capacity || 1)) * 100)}%`,
                      background: overbooked ? "#d45b53" : "var(--color-brand)",
                    }}
                  />
                </div>
                <span>{minutes}m</span>
              </div>
            );
          },
        )}
      </div>
    </section>
  );
}
