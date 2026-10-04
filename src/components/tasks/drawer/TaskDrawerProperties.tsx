import React, { useState } from 'react';
import { useTaskContext } from '../../../context/TaskContext';
import { useTodayStr, useTomorrowStr } from '../../../hooks/useCurrentDate';
import type { Task, Priority } from '../../../types/task';
import { Folder, Calendar, Clock, Flag, Timer, Plus, X } from 'lucide-react';
import { parseTimeToMinutes, minutesToTimeStr } from '../../../utils/timelineUtils';

interface TaskDrawerPropertiesProps {
  task: Task;
}

export const TaskDrawerProperties: React.FC<TaskDrawerPropertiesProps> = ({ task }) => {
  const { projects, updateTask, tasks } = useTaskContext();
  const todayStr = useTodayStr();
  const tomorrowStr = useTomorrowStr();
  const [isSessionExpanded, setIsSessionExpanded] = useState(Boolean(task.scheduledStart || task.sessionMetadata?.isSession));

  // Compute next available session number for today
  const nextSessionNum = React.useMemo(() => {
    const todaySessions = tasks.filter(
      (t) => (t.plannedDate === todayStr || t.dueDate === todayStr) && t.sessionMetadata?.isSession
    );
    const nums = todaySessions.map((t) => t.sessionMetadata?.sessionNumber || 1);
    return nums.length > 0 ? Math.max(...nums) + 1 : 1;
  }, [tasks, todayStr]);

  const currentDuration = React.useMemo(() => {
    const startMin = parseTimeToMinutes(task.scheduledStart);
    const endMin = parseTimeToMinutes(task.scheduledEnd);
    if (startMin === null || endMin === null) {
      return task.estimatedMinutes ? `${task.estimatedMinutes}m` : null;
    }
    let diff = endMin - startMin;
    if (diff < 0) diff += 24 * 60;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return h > 0 ? (m > 0 ? `${h}h ${m}m (${diff}m)` : `${h}h (${diff}m)`) : `${m}m`;
  }, [task.scheduledStart, task.scheduledEnd, task.estimatedMinutes]);

  const handleApplySession = (startTime: string, endTime: string, sessionNum?: number) => {
    const startMin = parseTimeToMinutes(startTime);
    const endMin = parseTimeToMinutes(endTime);
    let duration = 180;
    if (startMin !== null && endMin !== null) {
      duration = endMin - startMin;
      if (duration < 0) duration += 24 * 60;
    }

    const sNum = sessionNum ?? task.sessionMetadata?.sessionNumber ?? nextSessionNum;

    updateTask(task.id, {
      scheduledStart: startTime,
      scheduledEnd: endTime,
      estimatedMinutes: duration,
      plannedDate: task.plannedDate || todayStr,
      sessionMetadata: {
        ...(task.sessionMetadata || {}),
        isSession: true,
        sessionNumber: sNum,
        sessionTopic: task.title,
      },
    });
  };

  const handleRemoveSession = () => {
    updateTask(task.id, {
      scheduledStart: undefined,
      scheduledEnd: undefined,
      sessionMetadata: task.sessionMetadata ? { ...task.sessionMetadata, isSession: false } : undefined,
    });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 bg-[var(--bg-surface-l2)]/60 rounded-xl border border-[var(--border-subtle)] text-xs card-surface">
      {/* Project Select */}
      <div className="space-y-1.5 min-w-0">
        <label
          htmlFor="task-project-select"
          className="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1.5"
        >
          <Folder size={13} /> Project
        </label>
        <select
          id="task-project-select"
          name="taskProject"
          aria-label="Assign to project"
          value={task.projectId}
          onChange={(e) => updateTask(task.id, { projectId: e.target.value })}
          className="w-full bg-[var(--bg-surface-l1)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-lg px-2.5 py-1.5 outline-none card-surface cursor-pointer"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Priority Select */}
      <div className="space-y-1.5 min-w-0">
        <label
          htmlFor="task-priority-select"
          className="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1.5"
        >
          <Flag size={13} /> Priority
        </label>
        <select
          id="task-priority-select"
          name="taskPriority"
          aria-label="Set priority"
          value={task.priority}
          onChange={(e) => updateTask(task.id, { priority: e.target.value as Priority })}
          className="w-full bg-[var(--bg-surface-l1)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-lg px-2.5 py-1.5 outline-none card-surface cursor-pointer"
        >
          <option value="p1">P1 Urgent</option>
          <option value="p2">P2 High</option>
          <option value="p3">P3 Medium</option>
          <option value="p4">P4 Normal / Low</option>
        </select>
      </div>

      {/* Planned Date */}
      <div className="space-y-1.5 min-w-0">
        <div className="flex items-center justify-between">
          <label
            htmlFor="task-planned-date-input"
            className="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1.5"
          >
            <Calendar size={13} /> Planned Date
          </label>
          {task.plannedDate && (
            <button
              type="button"
              onClick={() => updateTask(task.id, { plannedDate: undefined })}
              className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
        <input
          id="task-planned-date-input"
          name="taskPlannedDate"
          aria-label="Planned date"
          type="date"
          value={task.plannedDate || ''}
          onChange={(e) => updateTask(task.id, { plannedDate: e.target.value || undefined })}
          className="w-full bg-[var(--bg-surface-l1)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-lg px-2.5 py-1.5 outline-none card-surface"
        />
        <div className="flex items-center flex-wrap gap-1.5 pt-0.5 min-w-0">
          <button
            type="button"
            onClick={() => updateTask(task.id, { plannedDate: todayStr })}
            className={`px-2 py-0.5 text-[10px] font-medium rounded-md border transition-colors cursor-pointer ${
              task.plannedDate === todayStr
                ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/30 font-semibold'
                : 'bg-[var(--bg-surface-l1)] hover:bg-stone-200 dark:hover:bg-stone-700 text-[var(--text-secondary)] border-[var(--border-hairline)]'
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => updateTask(task.id, { plannedDate: tomorrowStr })}
            className={`px-2 py-0.5 text-[10px] font-medium rounded-md border transition-colors cursor-pointer ${
              task.plannedDate === tomorrowStr
                ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/30 font-semibold'
                : 'bg-[var(--bg-surface-l1)] hover:bg-stone-200 dark:hover:bg-stone-700 text-[var(--text-secondary)] border-[var(--border-hairline)]'
            }`}
          >
            Tomorrow
          </button>
        </div>
      </div>

      {/* Deadline / Due Date */}
      <div className="space-y-1.5 min-w-0">
        <div className="flex items-center justify-between">
          <label
            htmlFor="task-due-date-input"
            className="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1.5"
          >
            <Clock size={13} /> Deadline
          </label>
          {task.dueDate && (
            <button
              type="button"
              onClick={() => updateTask(task.id, { dueDate: undefined })}
              className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
        <input
          id="task-due-date-input"
          name="taskDueDate"
          aria-label="Due date"
          type="date"
          value={task.dueDate || ''}
          onChange={(e) => updateTask(task.id, { dueDate: e.target.value || undefined })}
          className="w-full bg-[var(--bg-surface-l1)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-lg px-2.5 py-1.5 outline-none card-surface"
        />
        <div className="flex items-center flex-wrap gap-1.5 pt-0.5 min-w-0">
          <button
            type="button"
            onClick={() => updateTask(task.id, { dueDate: todayStr })}
            className={`px-2 py-0.5 text-[10px] font-medium rounded-md border transition-colors cursor-pointer ${
              task.dueDate === todayStr
                ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/30 font-semibold'
                : 'bg-[var(--bg-surface-l1)] hover:bg-stone-200 dark:hover:bg-stone-700 text-[var(--text-secondary)] border-[var(--border-hairline)]'
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => updateTask(task.id, { dueDate: tomorrowStr })}
            className={`px-2 py-0.5 text-[10px] font-medium rounded-md border transition-colors cursor-pointer ${
              task.dueDate === tomorrowStr
                ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/30 font-semibold'
                : 'bg-[var(--bg-surface-l1)] hover:bg-stone-200 dark:hover:bg-stone-700 text-[var(--text-secondary)] border-[var(--border-hairline)]'
            }`}
          >
            Tomorrow
          </button>
        </div>
      </div>

      {/* Session Duration Generator & Timeline Schedule */}
      <div className="sm:col-span-2 pt-2.5 border-t border-[var(--border-hairline)] space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-primary)]">
            <Timer size={13} className="text-teal-500" />
            <span>Session & Timeline Schedule</span>
            {task.sessionMetadata?.isSession && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-teal-500/15 text-teal-800 dark:text-teal-300 border border-teal-500/30">
                🎯 Session {task.sessionMetadata.sessionNumber || 1}
              </span>
            )}
          </div>
          {task.scheduledStart ? (
            <button
              type="button"
              onClick={handleRemoveSession}
              className="text-[10px] font-medium text-rose-500 hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <X size={10} />
              <span>Remove Session</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsSessionExpanded(true);
                handleApplySession('08:00', '11:00');
              }}
              className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <Plus size={11} />
              <span>+ Add Session (08:00 – 11:00)</span>
            </button>
          )}
        </div>

        {(isSessionExpanded || task.scheduledStart) && (
          <div className="p-2.5 rounded-lg bg-[var(--bg-surface-l1)] border border-teal-500/20 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {/* Session Number */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-medium text-[var(--text-muted)]">Session #</span>
                <input
                  type="number"
                  min="1"
                  max="99"
                  aria-label="Session number"
                  value={task.sessionMetadata?.sessionNumber ?? nextSessionNum}
                  onChange={(e) => {
                    const num = parseInt(e.target.value, 10) || 1;
                    updateTask(task.id, {
                      sessionMetadata: {
                        ...(task.sessionMetadata || { isSession: true }),
                        isSession: true,
                        sessionNumber: num,
                        sessionTopic: task.title,
                      },
                    });
                  }}
                  className="w-12 bg-[var(--bg-surface-l2)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded px-1.5 py-1 text-xs text-center font-bold"
                />
              </div>

              {/* Start Time */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-medium text-[var(--text-muted)]">Start</span>
                <input
                  type="time"
                  aria-label="Scheduled start time"
                  value={task.scheduledStart || '08:00'}
                  onChange={(e) => {
                    const newStart = e.target.value;
                    const end = task.scheduledEnd || '11:00';
                    handleApplySession(newStart, end);
                  }}
                  className="bg-[var(--bg-surface-l2)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded px-1.5 py-1 text-xs font-mono font-medium cursor-pointer"
                />
              </div>

              {/* End Time */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-medium text-[var(--text-muted)]">End</span>
                <input
                  type="time"
                  aria-label="Scheduled end time"
                  value={task.scheduledEnd || '11:00'}
                  onChange={(e) => {
                    const newEnd = e.target.value;
                    const start = task.scheduledStart || '08:00';
                    handleApplySession(start, newEnd);
                  }}
                  className="bg-[var(--bg-surface-l2)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded px-1.5 py-1 text-xs font-mono font-medium cursor-pointer"
                />
              </div>

              {/* Live Duration pill */}
              {currentDuration && (
                <div className="ml-auto px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-800 dark:text-teal-300 font-mono text-[10px] font-bold border border-teal-500/30">
                  {currentDuration}
                </div>
              )}
            </div>

            {/* Quick Session Presets */}
            <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-[var(--border-hairline)]">
              <span className="text-[10px] text-[var(--text-muted)] mr-1">Presets:</span>
              <button
                type="button"
                onClick={() => handleApplySession('08:00', '11:00')}
                className="px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-surface-l2)] hover:bg-stone-200 dark:hover:bg-stone-700 text-[var(--text-secondary)] border border-[var(--border-hairline)] transition-colors cursor-pointer"
              >
                Morning 08:00–11:00 (3h)
              </button>
              <button
                type="button"
                onClick={() => handleApplySession('12:00', '14:30')}
                className="px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-surface-l2)] hover:bg-stone-200 dark:hover:bg-stone-700 text-[var(--text-secondary)] border border-[var(--border-hairline)] transition-colors cursor-pointer"
              >
                Midday 12:00–14:30 (2.5h)
              </button>
              <button
                type="button"
                onClick={() => handleApplySession('15:00', '18:00')}
                className="px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-surface-l2)] hover:bg-stone-200 dark:hover:bg-stone-700 text-[var(--text-secondary)] border border-[var(--border-hairline)] transition-colors cursor-pointer"
              >
                Afternoon 15:00–18:00 (3h)
              </button>
              <button
                type="button"
                onClick={() => {
                  const startMin = parseTimeToMinutes(task.scheduledStart || '08:00') || 480;
                  const newEnd = minutesToTimeStr((startMin + 60) % 1440);
                  handleApplySession(task.scheduledStart || '08:00', newEnd);
                }}
                className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-surface-l2)] hover:bg-stone-200 dark:hover:bg-stone-700 text-[var(--text-secondary)] border border-[var(--border-hairline)] transition-colors cursor-pointer"
              >
                +1h
              </button>
              <button
                type="button"
                onClick={() => {
                  const startMin = parseTimeToMinutes(task.scheduledStart || '08:00') || 480;
                  const newEnd = minutesToTimeStr((startMin + 120) % 1440);
                  handleApplySession(task.scheduledStart || '08:00', newEnd);
                }}
                className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-surface-l2)] hover:bg-stone-200 dark:hover:bg-stone-700 text-[var(--text-secondary)] border border-[var(--border-hairline)] transition-colors cursor-pointer"
              >
                +2h
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
