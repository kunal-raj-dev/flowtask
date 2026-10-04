import React from 'react';
import { useTaskContext } from '../../../context/TaskContext';
import { useTodayStr, useTomorrowStr } from '../../../hooks/useCurrentDate';
import type { Task, Priority } from '../../../types/task';
import { Folder, Calendar, Clock, Flag } from 'lucide-react';

interface TaskDrawerPropertiesProps {
  task: Task;
}

export const TaskDrawerProperties: React.FC<TaskDrawerPropertiesProps> = ({ task }) => {
  const { projects, updateTask } = useTaskContext();
  const todayStr = useTodayStr();
  const tomorrowStr = useTomorrowStr();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3.5 bg-[var(--bg-surface-l2)]/60 rounded-xl border border-[var(--border-subtle)] text-xs card-surface">
      {/* Project Select */}
      <div className="space-y-1.5">
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

      {/* Planned Date */}
      <div className="space-y-1.5">
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
              className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline"
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
        <div className="flex items-center gap-1 pt-0.5">
          <button
            type="button"
            onClick={() => updateTask(task.id, { plannedDate: todayStr })}
            className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-[var(--bg-surface-l1)] hover:bg-stone-200 dark:hover:bg-stone-700 text-[var(--text-secondary)] border border-[var(--border-hairline)] transition-colors"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => updateTask(task.id, { plannedDate: tomorrowStr })}
            className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-[var(--bg-surface-l1)] hover:bg-stone-200 dark:hover:bg-stone-700 text-[var(--text-secondary)] border border-[var(--border-hairline)] transition-colors"
          >
            Tomorrow
          </button>
          {task.plannedDate && (
            <button
              type="button"
              onClick={() => updateTask(task.id, { plannedDate: undefined })}
              className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-[var(--bg-surface-l1)] hover:bg-stone-200 dark:hover:bg-stone-700 text-rose-500 border border-[var(--border-hairline)] transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Deadline / Due Date */}
      <div className="space-y-1.5">
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
              className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline"
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
        <div className="flex items-center gap-1 pt-0.5">
          <button
            type="button"
            onClick={() => updateTask(task.id, { dueDate: todayStr })}
            className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-[var(--bg-surface-l1)] hover:bg-stone-200 dark:hover:bg-stone-700 text-[var(--text-secondary)] border border-[var(--border-hairline)] transition-colors"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => updateTask(task.id, { dueDate: tomorrowStr })}
            className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-[var(--bg-surface-l1)] hover:bg-stone-200 dark:hover:bg-stone-700 text-[var(--text-secondary)] border border-[var(--border-hairline)] transition-colors"
          >
            Tomorrow
          </button>
          {task.dueDate && (
            <button
              type="button"
              onClick={() => updateTask(task.id, { dueDate: undefined })}
              className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-[var(--bg-surface-l1)] hover:bg-stone-200 dark:hover:bg-stone-700 text-rose-500 border border-[var(--border-hairline)] transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Priority Select */}
      <div className="space-y-1.5">
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
    </div>
  );
};
