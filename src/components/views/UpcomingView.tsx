import React, { useState, useMemo } from 'react';
import { useTaskContext } from '../../context/TaskContext';
import { TaskCard } from '../tasks/TaskCard';
import { Omnibar } from '../tasks/Omnibar';
import { TimelineView } from './TimelineView';
import { formatLocalDate } from '../../utils/nlpParser';
import { useTodayStr } from '../../hooks/useCurrentDate';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { Calendar, CalendarDays, Clock, List } from 'lucide-react';
import { SegmentedControl } from '../ui/SegmentedControl';
import { EmptyState } from '../ui/EmptyState';
import { KeyboardHaloDock } from '../tasks/KeyboardHaloDock';

interface UpcomingViewProps {
  onSelectTask: (taskId: string) => void;
  onStartFocus: (taskId: string) => void;
  onOpenBrainDump?: () => void;
  onStartSprint?: (taskId: string) => void;
  onOpenStudySession?: () => void;
}

export const UpcomingView: React.FC<UpcomingViewProps> = ({
  onSelectTask,
  onStartFocus,
  onStartSprint,
  onOpenStudySession,
}) => {
  const {
    tasks,
    toggleTaskStatus,
    toggleTaskPinToday,
    updateTask,
    deleteTask,
  } = useTaskContext();

  const [presentationMode, setPresentationMode] = useState<'list' | 'timeline'>('list');
  const [selectedHorizonDate, setSelectedHorizonDate] = useState<string | null>(null);

  const todayStr = useTodayStr();

  // Future incomplete tasks (plannedDate > todayStr or fallback dueDate > todayStr)
  const rawUpcomingTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.status === 'done' || t.deletedAt || t.archivedAt) return false;
      const taskDate = t.plannedDate || t.dueDate;
      return Boolean(taskDate && taskDate > todayStr);
    });
  }, [tasks, todayStr]);

  // Generate 7-day horizon (Tomorrow + next 6 days) (memoized)
  const { horizonDays, tomorrowStr, endOfWeekStr, nextWeekEndStr } = useMemo(() => {
    const [y, m, d] = todayStr.split('-').map(Number);
    const today = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + (i + 1));
      const dateStr = formatLocalDate(d);
      const dayTasks = tasks.filter((t) => {
        if (t.status === 'done' || t.deletedAt || t.archivedAt) return false;
        const taskDate = t.plannedDate || t.dueDate;
        return taskDate === dateStr;
      });
      const totalMinutes = dayTasks.reduce((acc, t) => acc + (t.estimatedMinutes || 25), 0);
      return {
        date: d,
        dateStr,
        dayName: i === 0 ? 'Tmrw' : d.toLocaleDateString(undefined, { weekday: 'short' }),
        dayNumber: d.getDate(),
        taskCount: dayTasks.length,
        hoursText: totalMinutes > 0 ? `${(totalMinutes / 60).toFixed(1)}h` : 'Free',
      };
    });

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tmrStr = formatLocalDate(tomorrow);

    const endOfWeek = new Date(today);
    endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
    const eowStr = formatLocalDate(endOfWeek);

    const nextWeekEnd = new Date(endOfWeek);
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);
    const nweStr = formatLocalDate(nextWeekEnd);

    return {
      horizonDays: days,
      tomorrowStr: tmrStr,
      endOfWeekStr: eowStr,
      nextWeekEndStr: nweStr,
    };
  }, [tasks, todayStr]);

  // Filter tasks based on selected horizon date or full list
  const activeTasksToDisplay = useMemo(() => {
    return selectedHorizonDate
      ? rawUpcomingTasks.filter((t) => (t.plannedDate || t.dueDate) === selectedHorizonDate)
      : rawUpcomingTasks;
  }, [rawUpcomingTasks, selectedHorizonDate]);

  const { tomorrowTasks, thisWeekTasks, nextWeekTasks, laterTasks } = useMemo(() => {
    const tomorrowList = activeTasksToDisplay.filter((t) => (t.plannedDate || t.dueDate) === tomorrowStr);
    const thisWeekList = activeTasksToDisplay.filter((t) => {
      const d = t.plannedDate || t.dueDate;
      return Boolean(d && d > tomorrowStr && d <= endOfWeekStr);
    });
    const nextWeekList = activeTasksToDisplay.filter((t) => {
      const d = t.plannedDate || t.dueDate;
      return Boolean(d && d > endOfWeekStr && d <= nextWeekEndStr);
    });
    const laterList = activeTasksToDisplay.filter((t) => {
      const d = t.plannedDate || t.dueDate;
      return Boolean(d && d > nextWeekEndStr);
    });

    return {
      tomorrowTasks: tomorrowList,
      thisWeekTasks: thisWeekList,
      nextWeekTasks: nextWeekList,
      laterTasks: laterList,
    };
  }, [activeTasksToDisplay, tomorrowStr, endOfWeekStr, nextWeekEndStr]);

  const { focusedTaskId, setFocusedIndex } = useKeyboardNavigation({
    tasks: activeTasksToDisplay,
    onSelectTask,
    onToggleStatus: toggleTaskStatus,
    onTogglePinToday: toggleTaskPinToday,
    onUpdateTask: updateTask,
    onDeleteTask: deleteTask,
    onStartFocus,
    enabled: presentationMode === 'list',
  });

  const focusedTask = activeTasksToDisplay.find((t) => t.id === focusedTaskId);

  const renderSection = (title: string, sectionTasks: typeof activeTasksToDisplay, subtitle?: string) => {
    if (sectionTasks.length === 0) return null;
    return (
      <div className="mb-7">
        <div className="flex items-baseline justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              {title}
            </h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-stone-200 dark:bg-stone-800 text-[var(--text-secondary)] font-bold">
              {sectionTasks.length}
            </span>
          </div>
          {subtitle && (
            <span className="text-[11px] text-[var(--text-muted)] font-medium">
              {subtitle}
            </span>
          )}
        </div>

        <div className="space-y-2">
          {sectionTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isKeyboardFocused={focusedTaskId === task.id}
              onSelectTask={() => onSelectTask(task.id)}
              onStartFocus={() => onStartFocus(task.id)}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-3.5 sm:px-4 py-4 sm:py-8">
      {/* View Header with Presentation Toggle */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-[var(--bg-surface-l1)] border border-[var(--border-subtle)] shadow-subtle">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
            <CalendarDays size={20} className="stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
              Upcoming
            </h1>
            <p className="text-xs text-[var(--text-secondary)] font-medium">
              {rawUpcomingTasks.length} planned future task{rawUpcomingTasks.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        {/* List vs Timeline Presentation Switcher */}
        <SegmentedControl<'list' | 'timeline'>
          items={[
            { id: 'list', label: 'List', icon: <List size={14} /> },
            { id: 'timeline', label: 'Timeline', icon: <Clock size={14} /> },
          ]}
          value={presentationMode}
          onChange={(mode) => setPresentationMode(mode)}
        />
      </div>

      {/* 7-Day Planning Horizon Strip */}
      <div className="mb-6 overflow-x-auto pb-1">
        <div className="flex items-center gap-2 min-w-max">
          <button
            type="button"
            onClick={() => setSelectedHorizonDate(null)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              selectedHorizonDate === null
                ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                : 'bg-[var(--bg-surface-l1)] hover:bg-[var(--bg-surface-l2)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-hairline)]'
            }`}
          >
            All Dates
          </button>

          {horizonDays.map((hd) => {
            const isSelected = selectedHorizonDate === hd.dateStr;
            return (
              <button
                key={hd.dateStr}
                type="button"
                onClick={() => setSelectedHorizonDate(isSelected ? null : hd.dateStr)}
                className={`flex flex-col items-center px-3.5 py-1.5 rounded-xl text-xs transition-all border min-w-[70px] cursor-pointer ${
                  isSelected
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-[var(--bg-surface-l1)] hover:bg-[var(--bg-surface-l2)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-hairline)]'
                }`}
              >
                <span className={`text-[10px] font-semibold uppercase ${isSelected ? 'text-purple-200' : 'text-[var(--text-muted)]'}`}>
                  {hd.dayName}
                </span>
                <span className="text-sm font-bold my-0.5">{hd.dayNumber}</span>
                <span className={`text-[10px] ${isSelected ? 'text-purple-200' : 'text-[var(--text-secondary)]'}`}>
                  {hd.taskCount > 0 ? `${hd.taskCount} tasks` : hd.hoursText}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Presentation: Timeline vs List */}
      {presentationMode === 'timeline' ? (
        <div className="rounded-2xl bg-[var(--bg-surface-l1)] border border-[var(--border-subtle)] p-4 sm:p-6 shadow-subtle">
          <TimelineView
            selectedDateStr={selectedHorizonDate || tomorrowStr}
            onSelectTask={onSelectTask}
            onStartFocus={onStartFocus}
            onStartSprint={onStartSprint}
            onOpenStudySession={onOpenStudySession}
          />
        </div>
      ) : (
        <>
          {/* Quick Capture */}
          <Omnibar />

          {/* Grouped Planning Sections */}
          {selectedHorizonDate ? (
            renderSection(
              `Planned for ${selectedHorizonDate}`,
              activeTasksToDisplay,
              `${activeTasksToDisplay.length} tasks`
            )
          ) : (
            <>
              {renderSection('Tomorrow', tomorrowTasks, 'Next 24h')}
              {renderSection('This Week', thisWeekTasks, 'Through Sunday')}
              {renderSection('Next Week', nextWeekTasks, 'Following week')}
              {renderSection('Later & Backlog', laterTasks, 'Future roadmap')}
            </>
          )}

          {activeTasksToDisplay.length === 0 && (
            <EmptyState
              title={selectedHorizonDate ? 'No tasks on this date' : 'No upcoming tasks'}
              description="Capture future work or schedule tasks from your Inbox."
              icon={<Calendar size={28} className="text-purple-500" />}
            />
          )}

          {/* Keyboard Halo Dock */}
          {focusedTask && (
            <KeyboardHaloDock
              task={focusedTask}
              onSelect={() => onSelectTask(focusedTask.id)}
              onToggleStatus={() => toggleTaskStatus(focusedTask.id)}
              onStartFocus={() => onStartFocus(focusedTask.id)}
              onRescheduleToday={() => updateTask(focusedTask.id, { plannedDate: todayStr })}
              onRescheduleTomorrow={() => updateTask(focusedTask.id, { plannedDate: tomorrowStr })}
              onRescheduleSomeday={() => updateTask(focusedTask.id, { isSomeday: true, plannedDate: undefined })}
              onSetPriority={(p) => updateTask(focusedTask.id, { priority: p })}
              onDismiss={() => setFocusedIndex(-1)}
            />
          )}
        </>
      )}
    </div>
  );
};
