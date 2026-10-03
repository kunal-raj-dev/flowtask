import type { Task, Priority } from '../types/task';
import { calculateNextDueDate } from '../utils/storage';
import { parseTaskInput } from '../utils/nlpParser';
import { mergeTaskData, redirectDependencies } from '../utils/dependencyUtils';

export interface CommandResult {
  updatedTasks: Task[];
  description: string;
  inverse: (currentTasks: Task[]) => Task[];
  sideEffects?: {
    nextRecurringTaskId?: string;
    actionType?: 'complete' | 'uncomplete' | 'delete' | 'archive' | 'create';
    toastMessage?: string;
  };
}

export const commandService = {
  /**
   * Create a new task deterministically
   */
  createTask(
    tasks: Task[],
    input: string,
    overrides?: Partial<Task>,
    currentContext?: { defaultProjectId?: string; defaultPlannedDate?: string }
  ): CommandResult & { createdTask: Task } {
    const parsed = parseTaskInput(input);
    const now = Date.now();
    const id = `task-${now}-${Math.random().toString(36).substring(2, 7)}`;

    // Precedence: explicit overrides > parsed tokens > context defaults > fallback
    const projectId =
      overrides?.projectId ||
      parsed.projectTag ||
      currentContext?.defaultProjectId ||
      'inbox';

    const plannedDate =
      overrides?.plannedDate !== undefined
        ? overrides.plannedDate
        : parsed.plannedDate || currentContext?.defaultPlannedDate;

    const dueDate =
      overrides?.dueDate !== undefined ? overrides.dueDate : parsed.dueDate;

    const priority: Priority =
      overrides?.priority || parsed.priority || 'p4';

    const createdTask: Task = {
      id,
      title: overrides?.title || parsed.cleanTitle || input.trim(),
      description: overrides?.description || undefined,
      status: 'todo',
      priority,
      projectId,
      plannedDate,
      dueDate,
      dueTime: overrides?.dueTime || parsed.dueTime,
      scheduledStart: overrides?.scheduledStart,
      scheduledEnd: overrides?.scheduledEnd,
      isEvening: overrides?.isEvening,
      sessionMetadata: overrides?.sessionMetadata,
      estimatedMinutes: overrides?.estimatedMinutes ?? parsed.estimatedMinutes,
      timeSpentMinutes: 0,
      subtasks: overrides?.subtasks || [],
      recurrence: overrides?.recurrence || parsed.recurrence || 'none',
      customRecurrence: overrides?.customRecurrence || parsed.customRecurrence,
      isPinnedToday: overrides?.isPinnedToday || false,
      topThreeDate: overrides?.topThreeDate,
      isSomeday: overrides?.isSomeday || false,
      tags: overrides?.tags || parsed.tags,
      contextTags: overrides?.contextTags || parsed.contextTags,
      revision: 1,
      createdAt: now,
      updatedAt: now,
    };

    const updatedTasks = [createdTask, ...tasks];

    return {
      createdTask,
      updatedTasks,
      description: `Created task "${createdTask.title}"`,
      sideEffects: { actionType: 'create', toastMessage: `Task added` },
      inverse: (currentTasks: Task[]) => currentTasks.filter((t) => t.id !== id),
    };
  },

  /**
   * Update fields on an existing task with surgical field-level inverse
   */
  updateTask(
    tasks: Task[],
    taskId: string,
    updates: Partial<Task>
  ): CommandResult {
    const original = tasks.find((t) => t.id === taskId);
    if (!original) {
      return {
        updatedTasks: tasks,
        description: 'No-op update',
        inverse: (current) => current,
      };
    }

    const previousValues: Partial<Task> = {};
    for (const key of Object.keys(updates) as (keyof Task)[]) {
      previousValues[key] = original[key] as any;
    }

    const now = Date.now();
    const updatedTasks = tasks.map((t) => {
      if (t.id === taskId) {
        return {
          ...t,
          ...updates,
          revision: (t.revision || 1) + 1,
          updatedAt: now,
        };
      }
      return t;
    });

    return {
      updatedTasks,
      description: `Updated "${original.title}"`,
      inverse: (currentTasks: Task[]) =>
        currentTasks.map((t) =>
          t.id === taskId
            ? { ...t, ...previousValues, revision: (t.revision || 1) + 1, updatedAt: Date.now() }
            : t
        ),
    };
  },

  /**
   * Completion with exact once-only recurrence creation and exact inverse
   */
  toggleTaskStatus(tasks: Task[], taskId: string): CommandResult {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) {
      return {
        updatedTasks: tasks,
        description: 'No-op toggle',
        inverse: (current) => current,
      };
    }

    const now = Date.now();
    const isCurrentlyDone = task.status === 'done';

    if (!isCurrentlyDone) {
      // Mark as done
      const completedTask: Task = {
        ...task,
        status: 'done',
        completedAt: now,
        isPinnedToday: task.isPinnedToday, // Preserve historical Top 3 membership
        revision: (task.revision || 1) + 1,
        updatedAt: now,
      };

      let nextRecurringTask: Task | undefined;
      const freq = task.recurrence;

      if (freq && freq !== 'none') {
        const nextDueDate = calculateNextDueDate(
          task.dueDate || task.plannedDate,
          freq,
          task.customRecurrence,
          now
        );

        if (nextDueDate && !tasks.some(t => t.recurrenceSourceId === task.id)) {
          nextRecurringTask = {
            ...task,
            id: `${task.id}-next`,
            recurrenceSourceId: task.id,
            timeSpentMinutes: 0,
            status: 'todo',
            plannedDate: nextDueDate,
            dueDate: task.dueDate ? nextDueDate : undefined,
            completedAt: undefined,
            isPinnedToday: false,
            topThreeDate: undefined,
            revision: 1,
            createdAt: now,
            updatedAt: now,
            subtasks: task.subtasks.map((s) => ({ ...s, completed: false })),
          };
        }
      }

      let updatedTasks = tasks.map((t) => (t.id === taskId ? completedTask : t));
      if (nextRecurringTask) {
        updatedTasks = [nextRecurringTask, ...updatedTasks];
      }

      return {
        updatedTasks,
        description: `Completed "${task.title}"`,
        sideEffects: {
          actionType: 'complete',
          nextRecurringTaskId: nextRecurringTask?.id,
          toastMessage: `Task marked complete`,
        },
        inverse: (currentTasks: Task[]) => {
          let reverted = currentTasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: 'todo' as const,
                  completedAt: undefined,
                  isPinnedToday: task.isPinnedToday,
                  topThreeDate: task.topThreeDate,
                  revision: (t.revision || 1) + 1,
                  updatedAt: Date.now(),
                }
              : t
          );
          if (nextRecurringTask) {
            reverted = reverted.filter((t) => t.id !== nextRecurringTask!.id);
          }
          return reverted;
        },
      };
    } else {
      // Revert to todo
      const uncompletedTask: Task = {
        ...task,
        status: 'todo',
        completedAt: undefined,
        revision: (task.revision || 1) + 1,
        updatedAt: now,
      };

      const updatedTasks = tasks.map((t) => (t.id === taskId ? uncompletedTask : t));

      return {
        updatedTasks,
        description: `Marked "${task.title}" incomplete`,
        sideEffects: { actionType: 'uncomplete' },
        inverse: (currentTasks: Task[]) =>
          currentTasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: 'done' as const,
                  completedAt: task.completedAt || now,
                  revision: (t.revision || 1) + 1,
                  updatedAt: Date.now(),
                }
              : t
          ),
      };
    }
  },

  /**
   * Move task to recoverable trash (deletedAt)
   */
  deleteTask(tasks: Task[], taskId: string): CommandResult {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return { updatedTasks: tasks, description: 'No-op', inverse: (c) => c };

    const now = Date.now();
    // Soft delete moves to trash
    const updatedTasks = tasks.map((t) =>
      t.id === taskId
        ? { ...t, deletedAt: now, revision: (t.revision || 1) + 1, updatedAt: now }
        : t
    );

    return {
      updatedTasks,
      description: `Deleted "${task.title}"`,
      sideEffects: { actionType: 'delete', toastMessage: `Task moved to Trash` },
      inverse: (currentTasks: Task[]) =>
        currentTasks.map((t) =>
          t.id === taskId ? { ...t, deletedAt: undefined, updatedAt: Date.now() } : t
        ),
    };
  },

  /**
   * Permanent deletion removes record completely
   */
  permanentDeleteTask(tasks: Task[], taskId: string): CommandResult {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return { updatedTasks: tasks, description: 'No-op', inverse: (c) => c };

    const updatedTasks = tasks.filter((t) => t.id !== taskId);

    return {
      updatedTasks,
      description: `Permanently deleted "${task.title}"`,
      inverse: (currentTasks: Task[]) => [task, ...currentTasks],
    };
  },

  /**
   * Archive task (distinct from completed work)
   */
  archiveTask(tasks: Task[], taskId: string): CommandResult {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return { updatedTasks: tasks, description: 'No-op', inverse: (c) => c };

    const now = Date.now();
    const updatedTasks = tasks.map((t) =>
      t.id === taskId
        ? { ...t, archivedAt: now, revision: (t.revision || 1) + 1, updatedAt: now }
        : t
    );

    return {
      updatedTasks,
      description: `Archived "${task.title}"`,
      sideEffects: { actionType: 'archive', toastMessage: `Task archived` },
      inverse: (currentTasks: Task[]) =>
        currentTasks.map((t) =>
          t.id === taskId ? { ...t, archivedAt: undefined, updatedAt: Date.now() } : t
        ),
    };
  },

  /**
   * Restore task from Trash or Archive
   */
  restoreTask(tasks: Task[], taskId: string): CommandResult {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return { updatedTasks: tasks, description: 'No-op', inverse: (c) => c };

    const prevDeleted = task.deletedAt;
    const prevArchived = task.archivedAt;

    const updatedTasks = tasks.map((t) =>
      t.id === taskId
        ? { ...t, deletedAt: undefined, archivedAt: undefined, updatedAt: Date.now() }
        : t
    );

    return {
      updatedTasks,
      description: `Restored "${task.title}"`,
      inverse: (currentTasks: Task[]) =>
        currentTasks.map((t) =>
          t.id === taskId ? { ...t, deletedAt: prevDeleted, archivedAt: prevArchived } : t
        ),
    };
  },

  /**
   * Merge sourceTask into targetTask with dependency redirection
   */
  mergeTasks(tasks: Task[], targetTaskId: string, sourceTaskId: string): CommandResult {
    const targetTask = tasks.find((t) => t.id === targetTaskId);
    const sourceTask = tasks.find((t) => t.id === sourceTaskId);

    if (!targetTask || !sourceTask) {
      return { updatedTasks: tasks, description: 'No-op', inverse: (c) => c };
    }

    const mergedData = mergeTaskData(targetTask, sourceTask);
    const now = Date.now();

    // 1. Update target task
    let updatedTasks = tasks.map((t) =>
      t.id === targetTaskId
        ? { ...t, ...mergedData, revision: (t.revision || 1) + 1, updatedAt: now }
        : t
    );

    // 2. Redirect dependencies from sourceTaskId to targetTaskId
    updatedTasks = redirectDependencies(updatedTasks, sourceTaskId, targetTaskId);

    // 3. Mark source task as merged/deleted
    updatedTasks = updatedTasks.map((t) =>
      t.id === sourceTaskId ? { ...t, deletedAt: now, updatedAt: now } : t
    );

    const originalTargetSnapshot = { ...targetTask };
    const originalSourceSnapshot = { ...sourceTask };
    const affectedDependentIds = tasks
      .filter((t) => t.id !== targetTaskId && t.id !== sourceTaskId && t.blockedBy?.includes(sourceTaskId))
      .map((t) => t.id);

    return {
      updatedTasks,
      description: `Merged "${sourceTask.title}" into "${targetTask.title}"`,
      sideEffects: { toastMessage: `Tasks merged successfully` },
      inverse: (currentTasks: Task[]) =>
        currentTasks.map((t) => {
          if (t.id === targetTaskId) {
            return { ...originalTargetSnapshot };
          }
          if (t.id === sourceTaskId) {
            return { ...originalSourceSnapshot };
          }
          if (affectedDependentIds.includes(t.id)) {
            const revertedBlockers = (t.blockedBy || []).map((id) =>
              id === targetTaskId ? sourceTaskId : id
            );
            return { ...t, blockedBy: revertedBlockers };
          }
          return t;
        }),
    };
  },

  /**
   * Batch update multiple tasks
   */
  batchUpdate(tasks: Task[], taskIds: string[], updates: Partial<Task>): CommandResult {
    const idSet = new Set(taskIds);
    const prevSnapshots = new Map<string, Partial<Task>>();

    tasks.forEach((t) => {
      if (idSet.has(t.id)) {
        const snap: Partial<Task> = {};
        for (const k of Object.keys(updates) as (keyof Task)[]) {
          snap[k] = t[k] as any;
        }
        prevSnapshots.set(t.id, snap);
      }
    });

    const now = Date.now();
    const updatedTasks = tasks.map((t) =>
      idSet.has(t.id)
        ? { ...t, ...updates, revision: (t.revision || 1) + 1, updatedAt: now }
        : t
    );

    return {
      updatedTasks,
      description: `Updated ${taskIds.length} tasks`,
      inverse: (currentTasks: Task[]) =>
        currentTasks.map((t) => {
          const prev = prevSnapshots.get(t.id);
          return prev ? { ...t, ...prev, updatedAt: Date.now() } : t;
        }),
    };
  },

  /**
   * Batch soft-delete tasks to Trash
   */
  batchDelete(tasks: Task[], taskIds: string[]): CommandResult {
    const idSet = new Set(taskIds);
    const now = Date.now();

    const updatedTasks = tasks.map((t) =>
      idSet.has(t.id) ? { ...t, deletedAt: now, updatedAt: now } : t
    );

    return {
      updatedTasks,
      description: `Moved ${taskIds.length} tasks to Trash`,
      inverse: (currentTasks: Task[]) =>
        currentTasks.map((t) =>
          idSet.has(t.id) ? { ...t, deletedAt: undefined, updatedAt: Date.now() } : t
        ),
    };
  },
};
