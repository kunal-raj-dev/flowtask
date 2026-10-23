import { getEffectiveTaskEstimate } from '../../../utils/taskTimeSummary';
import React, { useState } from 'react';
import { useTaskContext } from '../../../context/TaskContext';
import { useTodayStr, useTomorrowStr } from '../../../hooks/useCurrentDate';
import type { Task, Priority } from '../../../types/task';
import { Folder, Calendar, Clock, Flag, Timer, Plus, X, Pencil } from 'lucide-react';
import { parseTimeToMinutes } from '../../../utils/timelineUtils';
import { TaskSessionEditor, type SessionDraft } from '../TaskSessionEditor';

interface TaskDrawerPropertiesProps {
  task: Task;
}

export const TaskDrawerProperties: React.FC<TaskDrawerPropertiesProps> = ({ task }) => {
  const { projects, updateTask, tasks } = useTaskContext();
  const todayStr = useTodayStr();
  const tomorrowStr = useTomorrowStr();
  const [isEditingSession, setIsEditingSession] = useState(false);

  // Compute next available session number for target date
  const workloadEstimate = getEffectiveTaskEstimate(task);
  const targetDate = task.plannedDate || task.dueDate || todayStr;
  const nextSessionNum = React.useMemo(() => {
    const targetDateSessions = tasks.filter(
      (t) => t.id !== task.id && !t.deletedAt && !t.archivedAt && (t.plannedDate || t.dueDate) === targetDate && t.sessionMetadata?.isSession
    );
    const nums = targetDateSessions.map((t) => t.sessionMetadata?.sessionNumber || 1);
    return nums.length > 0 ? Math.max(...nums) + 1 : 1;
  }, [tasks, targetDate, task.id]);

  const calendarDurationMinutes = React.useMemo(() => {
    const startMin = parseTimeToMinutes(task.scheduledStart);
    const endMin = parseTimeToMinutes(task.scheduledEnd);
    if (startMin === null || endMin === null) return null;
    let diff = endMin - startMin;
    if (diff < 0) diff += 24 * 60;
    return diff;
  }, [task.scheduledStart, task.scheduledEnd]);

  const currentDuration = React.useMemo(() => {
    const startMin = parseTimeToMinutes(task.scheduledStart);
    const endMin = parseTimeToMinutes(task.scheduledEnd);
    if (startMin === null || endMin === null) {
      return workloadEstimate ? `${workloadEstimate}m` : null;
    }
    let diff = endMin - startMin;
    if (diff < 0) diff += 24 * 60;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return h > 0 ? (m > 0 ? `${h}h ${m}m (${diff}m)` : `${h}h (${diff}m)`) : `${m}m`;
  }, [task.scheduledStart, task.scheduledEnd, workloadEstimate]);

  const handleApplySession = (draft: SessionDraft) => {
    updateTask(task.id, {
      scheduledStart: draft.startTime,
      scheduledEnd: draft.endTime,
      plannedDate: draft.plannedDate || task.plannedDate || todayStr,
      sessionMetadata: {
        ...(task.sessionMetadata || {}),
        isSession: true,
        sessionNumber: draft.sessionNumber,
        sessionTopic: task.title,
      },
    });
    setIsEditingSession(false);
  };

  const handleRemoveSession = () => {
    updateTask(task.id, {
      scheduledStart: undefined,
      scheduledEnd: undefined,
      sessionMetadata: task.sessionMetadata ? { ...task.sessionMetadata, isSession: false } : undefined,
    });
    setIsEditingSession(false);
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
          onChange={(e) => updateTask(task.id, { projectId: e.target.value, milestoneId: undefined })}
          className="w-full bg-[var(--bg-surface-l1)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-lg px-2.5 py-1.5 outline-none card-surface cursor-pointer"
        >
          {projects.filter(p => !p.isArchived || p.id === task.projectId).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {!!projects.find(project => project.id === task.projectId)?.milestones?.length && (<div className="space-y-1.5 min-w-0">
        <label htmlFor="task-milestone-select" className="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
          Project milestone
        </label>
        <select
          id="task-milestone-select"
          aria-label="Assign to project milestone"
          value={task.milestoneId || ''}
          disabled={!(projects.find(project => project.id === task.projectId)?.milestones?.length)}
          onChange={event => updateTask(task.id, { milestoneId: event.target.value || undefined })}
          className="w-full bg-[var(--bg-surface-l1)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-lg px-2.5 py-1.5 outline-none card-surface cursor-pointer disabled:opacity-60"
        >
          <option value="">No milestone</option>
          {(projects.find(project => project.id === task.projectId)?.milestones || []).map(milestone => <option key={milestone.id} value={milestone.id}>{milestone.title}</option>)}
        </select>
        {!(projects.find(project => project.id === task.projectId)?.milestones?.length) && <p className="text-[10px] text-[var(--text-muted)]">Add a milestone to this project to link the task.</p>}
      </div>)}

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
              className="text-[10px] text-amber-800 dark:text-amber-300 hover:underline cursor-pointer"
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
              className="text-[10px] text-amber-800 dark:text-amber-300 hover:underline cursor-pointer"
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

      {/* Session & Timeline Schedule Section */}
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
          <div className="flex items-center gap-2">
            {task.scheduledStart || task.sessionMetadata?.isSession ? (
              <>
                {!isEditingSession && (
                  <button
                    type="button"
                    onClick={() => setIsEditingSession(true)}
                    className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <Pencil size={10} />
                    <span>Edit Session</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleRemoveSession}
                  className="text-[10px] font-medium text-rose-500 hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <X size={10} />
                  <span>Remove Session</span>
                </button>
              </>
            ) : (
              !isEditingSession && (
                <button
                  type="button"
                  onClick={() => setIsEditingSession(true)}
                  className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus size={11} />
                  <span>+ Add Session</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* Existing Session summary banner when not editing */}
        {(task.scheduledStart || task.sessionMetadata?.isSession) && !isEditingSession && (
          <div className="p-2.5 rounded-lg bg-[var(--bg-surface-l1)] border border-[var(--border-hairline)] text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Calendar block:</span>
                <span className="font-mono text-[11px] text-[var(--text-primary)] font-bold">
                  {task.scheduledStart || '08:00'} – {task.scheduledEnd || '11:00'}
                </span>
                {currentDuration && (
                  <span className="px-1.5 py-0.2 rounded font-mono text-[10px] font-semibold bg-teal-500/15 text-teal-700 dark:text-teal-300">
                    {currentDuration}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsEditingSession(true)}
                className="text-[11px] text-teal-600 dark:text-teal-400 font-semibold hover:underline cursor-pointer"
              >
                Change
              </button>
            </div>

            {/* Separate Workload Estimate & Mismatch Explanation */}
            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[var(--border-hairline)] text-[var(--text-secondary)]">
              <span>Workload estimate: <strong className="text-[var(--text-primary)] font-mono">{workloadEstimate ? `${workloadEstimate}m` : 'None'}</strong></span>
              {calendarDurationMinutes !== null && workloadEstimate > 0 && calendarDurationMinutes !== workloadEstimate && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                  Note: Calendar slot ({calendarDurationMinutes}m) differs from workload ({workloadEstimate}m)
                </span>
              )}
            </div>
          </div>
        )}

        {/* Draft Editor */}
        {isEditingSession && (
          <TaskSessionEditor
            initialSessionNumber={task.sessionMetadata?.sessionNumber}
            initialPlannedDate={targetDate}
            initialStartTime={task.scheduledStart || '08:00'}
            initialEndTime={task.scheduledEnd || '11:00'}
            suggestedSessionNumber={nextSessionNum}
            tasks={tasks}
            excludeTaskId={task.id}
            onApply={handleApplySession}
            onCancel={() => setIsEditingSession(false)}
          />
        )}
      </div>
    </div>
  );
};
