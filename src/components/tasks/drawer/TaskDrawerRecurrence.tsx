import React, { useState } from 'react';
import { useTaskContext } from '../../../context/TaskContext';
import type { Task, RecurrenceFrequency } from '../../../types/task';
import { Badge } from '../../ui/Badge';
import { getVelocityCalibration } from '../../../utils/velocityCalibrator';
import { Repeat, Clock, Play, Pause, ChevronUp, ChevronDown } from 'lucide-react';

interface TaskDrawerRecurrenceProps {
  task: Task;
  onOpenRecurrenceModal: () => void;
}

export const TaskDrawerRecurrence: React.FC<TaskDrawerRecurrenceProps> = ({
  task,
  onOpenRecurrenceModal,
}) => {
  const {
    tasks,
    projects,
    updateTask,
    focusSession,
    activeTimerTaskId,
    activeTimerSeconds,
    toggleTaskTimer,
  } = useTaskContext();

  const [isRecurrenceExpanded, setIsRecurrenceExpanded] = useState(false);

  const isDone = task.status === 'done';
  const isActiveTimer = activeTimerTaskId === task.id;
  const isTimerRunning = isActiveTimer && focusSession?.state === 'running';
  const isTimerPaused = isActiveTimer && focusSession?.state === 'paused';
  const primaryTag = task.contextTags && task.contextTags.length > 0 ? task.contextTags[0] : undefined;
  const calibration = getVelocityCalibration(tasks, task.estimatedMinutes, task.projectId, primaryTag);

  const currentProject = projects.find((p) => p.id === task.projectId);
  const domainLabel =
    calibration?.scope === 'tag' && primaryTag
      ? `#${primaryTag.replace(/^#/, '')}`
      : currentProject && currentProject.id !== 'inbox'
      ? `#${currentProject.name}`
      : 'similar';

  const formatStopwatch = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
      <button
        type="button"
        onClick={() => setIsRecurrenceExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between p-3.5 bg-[var(--bg-surface-l2)]/60 hover:bg-[var(--bg-surface-l2)] transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Repeat size={14} className="text-sky-500" />
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            Recurrence & Schedule Blocks
          </span>
          {task.recurrence && task.recurrence !== 'none' && (
            <Badge variant="focus" size="xs">
              {task.recurrence}
            </Badge>
          )}
          {task.estimatedMinutes && (
            <span className="text-[10px] font-mono text-[var(--text-muted)]">
              {task.estimatedMinutes}m est
            </span>
          )}
        </div>
        {isRecurrenceExpanded ? (
          <ChevronUp size={15} className="text-[var(--text-muted)]" />
        ) : (
          <ChevronDown size={15} className="text-[var(--text-muted)]" />
        )}
      </button>

      {isRecurrenceExpanded && (
        <div className="p-4 bg-[var(--bg-surface-l1)]/50 border-t border-[var(--border-hairline)] space-y-3.5 text-xs">
          {/* Recurrence Rule */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="task-recurrence-select"
                className="text-[11px] font-semibold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5"
              >
                <Repeat size={13} className="text-sky-500" /> Recurrence Rule
              </label>
              {task.recurrence === 'custom' && task.customRecurrence && (
                <button
                  type="button"
                  onClick={onOpenRecurrenceModal}
                  className="text-[10px] font-semibold text-[var(--color-brand)] hover:underline"
                >
                  Edit Rule
                </button>
              )}
            </div>
            <select
              id="task-recurrence-select"
              name="taskRecurrence"
              aria-label="Recurrence rule"
              value={task.recurrence || 'none'}
              onChange={(e) => {
                const val = e.target.value as RecurrenceFrequency;
                if (val === 'custom') {
                  onOpenRecurrenceModal();
                } else {
                  updateTask(task.id, { recurrence: val, customRecurrence: undefined });
                }
              }}
              className="w-full bg-[var(--bg-surface-l1)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-lg px-3 py-1.5 outline-none card-surface cursor-pointer"
            >
              <option value="none">No Recurrence</option>
              <option value="daily">Daily</option>
              <option value="weekdays">Weekdays (Mon-Fri)</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Every 2 Weeks (Biweekly)</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="custom">Custom Rule...</option>
            </select>
            {task.recurrence === 'custom' && task.customRecurrence && (
              <div className="mt-1 text-[11px] text-[var(--color-brand)] font-medium">
                Repeats every {task.customRecurrence.interval === 1 ? '' : task.customRecurrence.interval + ' '}
                {task.customRecurrence.unit}
                {task.customRecurrence.mode === 'completion' ? ' (after completion)' : ''}
              </div>
            )}
          </div>

          {/* Estimated Duration Presets & Stopwatch */}
          <div className="space-y-2 pt-2 border-t border-[var(--border-hairline)]">
            <div className="flex items-center justify-between">
              <label
                htmlFor="task-estimated-minutes-input"
                className="text-[11px] font-semibold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5"
              >
                <Clock size={13} className="text-amber-500" /> Estimated Duration (minutes)
              </label>
              {!isDone && (
                <button
                  type="button"
                  onClick={() => toggleTaskTimer(task.id)}
                  title={
                    isTimerRunning
                      ? 'Pause tracking time'
                      : isTimerPaused
                      ? 'Resume tracking time'
                      : 'Start live stopwatch'
                  }
                  aria-label={
                    isTimerRunning
                      ? 'Pause tracking time'
                      : isTimerPaused
                      ? 'Resume tracking time'
                      : 'Start live stopwatch'
                  }
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                    isTimerRunning
                      ? 'bg-amber-500 text-white shadow-xs animate-pulse'
                      : isTimerPaused
                      ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-dashed border-amber-500/50 shadow-2xs'
                      : 'bg-[var(--bg-surface-l1)] text-[var(--text-secondary)] hover:text-amber-500 border border-[var(--border-hairline)]'
                  }`}
                >
                  {isTimerRunning ? (
                    <Pause size={12} className="fill-current" />
                  ) : (
                    <Play size={12} className="fill-current" />
                  )}
                  <span>
                    {isTimerRunning
                      ? formatStopwatch(activeTimerSeconds)
                      : isTimerPaused
                      ? `Paused (${formatStopwatch(activeTimerSeconds)})`
                      : 'Live Stopwatch'}
                  </span>
                </button>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <input
                  id="task-estimated-minutes-input"
                  name="taskEstimatedMinutes"
                  aria-label="Estimated duration in minutes"
                  type="number"
                  min="0"
                  step="5"
                  placeholder="e.g. 25"
                  value={task.estimatedMinutes || ''}
                  onChange={(e) =>
                    updateTask(task.id, {
                      estimatedMinutes: e.target.value ? parseInt(e.target.value, 10) : undefined,
                    })
                  }
                  className="w-24 bg-[var(--bg-surface-l1)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-lg px-3 py-1.5 outline-none card-surface"
                />
                <div className="flex items-center gap-1.5">
                  {[15, 25, 45, 60].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => updateTask(task.id, { estimatedMinutes: mins })}
                      className="px-2.5 py-1 text-[11px] rounded-lg bg-[var(--bg-surface-l1)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] shadow-xs card-surface transition-colors"
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>
              {task.timeSpentMinutes && task.timeSpentMinutes > 0 ? (
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                  {task.timeSpentMinutes}m spent
                </span>
              ) : null}
            </div>

            {/* Velocity Calibrator */}
            {calibration && (
              <div className="mt-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-xs shadow-xs">
                <div className="min-w-0 pr-1 flex items-start gap-2">
                  <span className="text-amber-500 font-bold shrink-0 mt-0.5">🎯</span>
                  <div className="text-[11px] text-amber-900 dark:text-amber-200 leading-snug">
                    <span>
                      You usually take <strong>~{calibration.recommendedMinutes}m</strong> on{' '}
                      <strong>{domainLabel}</strong> tasks ({calibration.ratio}x variance across{' '}
                      {calibration.sampleCount} tasks).
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => updateTask(task.id, { estimatedMinutes: calibration.recommendedMinutes })}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-[11px] shrink-0 transition-all shadow-xs flex items-center gap-1"
                  title="Apply calibrated estimate based on historical performance"
                >
                  <span>Adjust to {calibration.recommendedMinutes}m</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
