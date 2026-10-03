import React, { useState } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { TaskCard } from '../tasks/TaskCard';
import { Omnibar } from '../tasks/Omnibar';
import { formatLocalDate } from '../../utils/nlpParser';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { Calendar, CalendarDays, Sparkles } from 'lucide-react';
import { KeyboardHaloDock } from '../tasks/KeyboardHaloDock';

interface UpcomingViewProps {
  onSelectTask: (taskId: string) => void;
  onStartFocus: (taskId: string) => void;
  onOpenBrainDump: () => void;
  onStartSprint?: (taskId: string) => void;
}

export const UpcomingView: React.FC<UpcomingViewProps> = ({
  onSelectTask,
  onStartFocus,
  onOpenBrainDump,
  onStartSprint,
}) => {
  const {
    tasks,
    toggleTaskStatus,
    toggleTaskPinToday,
    updateTask,
    deleteTask,
  } = useTaskContext();

  const [selectedHorizonDate, setSelectedHorizonDate] = useState<string | null>(null);
  const [selectedContextTag, setSelectedContextTag] = useState<string | null>(null);

  const today = new Date();
  const todayStr = formatLocalDate(today);

  // Future incomplete tasks
  const rawUpcomingTasks = tasks.filter(
    (t) => t.status !== 'done' && t.dueDate && t.dueDate > todayStr
  );

  // Extract available context tags for upcoming tasks
  const availableContextTags = React.useMemo(() => {
    const map = new Map<string, number>();
    rawUpcomingTasks.forEach((t) => {
      if (t.contextTags) {
        t.contextTags.forEach((ctx) => {
          map.set(ctx, (map.get(ctx) || 0) + 1);
        });
      }
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [rawUpcomingTasks]);

  const upcomingTasks = selectedContextTag
    ? rawUpcomingTasks.filter((t) => t.contextTags && t.contextTags.includes(selectedContextTag))
    : rawUpcomingTasks;

  // Generate 7-day horizon (Today + next 6 days)
  const next7Days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dateStr = formatLocalDate(d);
    const dayTasks = tasks.filter((t) => {
      if (t.status === 'done' || t.dueDate !== dateStr) return false;
      if (selectedContextTag && (!t.contextTags || !t.contextTags.includes(selectedContextTag))) return false;
      return true;
    });
    const totalMinutes = dayTasks.reduce((acc, t) => acc + (t.estimatedMinutes || 25), 0);
    return {
      date: d,
      dateStr,
      dayName: i === 0 ? 'Today' : i === 1 ? 'Tmrw' : d.toLocaleDateString(undefined, { weekday: 'short' }),
      dayNumber: d.getDate(),
      taskCount: dayTasks.length,
      hoursText: totalMinutes > 0 ? `${(totalMinutes / 60).toFixed(1)}h` : 'Free',
    };
  });

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatLocalDate(tomorrow);

  const endOfWeek = new Date(today);
  endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
  const endOfWeekStr = formatLocalDate(endOfWeek);

  const nextWeekEnd = new Date(endOfWeek);
  nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);
  const nextWeekEndStr = formatLocalDate(nextWeekEnd);

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

  const { focusedTaskId, setFocusedIndex } = useKeyboardNavigation({
    tasks: upcomingTasks,
    onSelectTask,
    onToggleStatus: toggleTaskStatus,
    onTogglePinToday: toggleTaskPinToday,
    onUpdateTask: updateTask,
    onDeleteTask: deleteTask,
    onStartFocus,
    enabled: true,
  });

  const focusedTask = upcomingTasks.find((t) => t.id === focusedTaskId);

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
              onStartSprint={onStartSprint}
              isKeyboardFocused={focusedTaskId === task.id}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto px-3.5 sm:px-4 py-4 sm:py-8">
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <div className="p-2 sm:p-2.5 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-sm card-surface flex-shrink-0">
          <CalendarDays size={20} className="stroke-[2.2]" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] tracking-tight">
            Upcoming Schedule
          </h2>
          <p className="text-xs text-[var(--text-secondary)] font-medium">
            {upcomingTasks.length} scheduled tasks ahead
          </p>
        </div>
      </div>

      <Omnibar onOpenBrainDump={onOpenBrainDump} />

      {/* GTD Context Filter Rail */}
      {availableContextTags.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 mb-5 text-xs scrollbar-none animate-fade-in">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mr-1 shrink-0">
            Context:
          </span>
          <button
            type="button"
            onClick={() => setSelectedContextTag(null)}
            className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              selectedContextTag === null
                ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-950 shadow-xs'
                : 'bg-stone-100 dark:bg-white/5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            All Contexts
          </button>
          {availableContextTags.map(([tag, count]) => (
            <button
              key={tag}
              type="button"
              onClick={() => setSelectedContextTag(selectedContextTag === tag ? null : tag)}
              className={`px-2.5 py-1 rounded-xl font-mono text-xs flex items-center gap-1 transition-all shrink-0 ${
                selectedContextTag === tag
                  ? 'bg-teal-600 text-white font-bold shadow-xs'
                  : 'bg-teal-500/10 text-teal-700 dark:text-teal-300 hover:bg-teal-500/20 border border-teal-500/20'
              }`}
            >
              <span>@{tag}</span>
              <span className="text-[10px] opacity-75 font-sans font-semibold">({count})</span>
            </button>
          ))}
        </div>
      )}

      {/* 7-Day Horizon Strip (Mini Week Planner) */}
      <div className="mb-6 p-3 sm:p-4 rounded-3xl bg-[var(--bg-surface-l2)] border border-[var(--border-hairline)] shadow-card card-surface">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-indigo-500" />
            <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
              7-Day Horizon
            </span>
          </div>
          {selectedHorizonDate && (
            <button
              type="button"
              onClick={() => setSelectedHorizonDate(null)}
              className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Show All Upcoming
            </button>
          )}
        </div>

        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {next7Days.map((day) => {
            const isSelected = selectedHorizonDate === day.dateStr;
            const isCurrentDay = day.dateStr === todayStr;

            return (
              <button
                key={day.dateStr}
                type="button"
                onClick={() => {
                  setSelectedHorizonDate(isSelected ? null : day.dateStr);
                }}
                className={`flex flex-col items-center py-2 sm:py-2.5 px-1 rounded-2xl border transition-all duration-150 ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-102'
                    : isCurrentDay
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                    : 'bg-[var(--bg-surface-l1)]/50 hover:bg-[var(--bg-surface-l1)] border-[var(--border-hairline)] text-[var(--text-secondary)]'
                }`}
              >
                <span className={`text-[10px] sm:text-[11px] font-semibold ${isSelected ? 'text-white/80' : 'opacity-70'}`}>
                  {day.dayName}
                </span>
                <span className={`text-sm sm:text-base font-black font-mono my-0.5 ${isSelected ? 'text-white' : 'text-[var(--text-primary)]'}`}>
                  {day.dayNumber}
                </span>
                <span
                  className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : day.taskCount > 0
                      ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                      : 'text-[var(--text-muted)]'
                  }`}
                >
                  {day.taskCount > 0 ? `${day.taskCount}t` : '—'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedHorizonDate ? (
        <div>
          {renderSection(
            `Tasks for ${selectedHorizonDate}`,
            tasks.filter((t) => {
              if (t.status === 'done' || t.dueDate !== selectedHorizonDate) return false;
              if (selectedContextTag && (!t.contextTags || !t.contextTags.includes(selectedContextTag))) return false;
              return true;
            }),
            selectedHorizonDate
          )}
          {tasks.filter((t) => {
            if (t.status === 'done' || t.dueDate !== selectedHorizonDate) return false;
            if (selectedContextTag && (!t.contextTags || !t.contextTags.includes(selectedContextTag))) return false;
            return true;
          }).length === 0 && (
            <div className="text-center py-12 text-[var(--text-muted)] bg-[var(--bg-surface-l1)]/20 rounded-2xl border border-[var(--border-hairline)]">
              <Sparkles size={28} className="mx-auto mb-2 text-stone-300 dark:text-stone-700" />
              <p className="text-xs font-semibold text-[var(--text-primary)]">No tasks scheduled for this day</p>
              <p className="text-[11px] mt-1 text-[var(--text-secondary)]">Use the Omnibar above to schedule a task.</p>
            </div>
          )}
        </div>
      ) : upcomingTasks.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)] bg-[var(--bg-surface-l1)]/20 rounded-2xl border border-[var(--border-hairline)]">
          <Calendar size={36} className="mx-auto mb-2 text-stone-300 dark:text-stone-700" />
          {selectedContextTag ? (
            <>
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                No upcoming tasks matching @{selectedContextTag}
              </p>
              <button
                type="button"
                onClick={() => setSelectedContextTag(null)}
                className="mt-3 px-3 py-1.5 text-xs font-semibold rounded-xl bg-stone-900 dark:bg-white text-white dark:text-stone-950 transition-all card-surface"
              >
                Clear Context Filter
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-[var(--text-primary)]">No upcoming tasks scheduled</p>
              <p className="text-xs mt-1 text-[var(--text-secondary)]">
                Try adding a task like "Prepare slides next Monday at 10am #work"
              </p>
            </>
          )}
        </div>
      ) : (
        <div>
          {renderSection('Tomorrow', tomorrowTasks, tomorrowStr)}
          {renderSection('Later This Week', thisWeekTasks)}
          {renderSection('Next Week', nextWeekTasks)}
          {renderSection('Later & Future', laterTasks)}
        </div>
      )}

      {/* Keyboard Halo Dock for j/k spatial navigation */}
      {focusedTask && (
        <KeyboardHaloDock
          task={focusedTask}
          onSelect={() => onSelectTask(focusedTask.id)}
          onToggleStatus={() => toggleTaskStatus(focusedTask.id)}
          onStartFocus={() => onStartFocus(focusedTask.id)}
          onRescheduleToday={() => updateTask(focusedTask.id, { dueDate: todayStr })}
          onRescheduleTomorrow={() => updateTask(focusedTask.id, { dueDate: tomorrowStr })}
          onRescheduleSomeday={() => updateTask(focusedTask.id, { dueDate: undefined, projectId: 'ideas' })}
          onSetPriority={(priority) => updateTask(focusedTask.id, { priority })}
          onDismiss={() => setFocusedIndex(-1)}
        />
      )}
    </div>
  );
};
