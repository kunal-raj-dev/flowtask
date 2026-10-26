import type { Task, Priority, Project, WorkBlock, CommandType } from '../types/task';
import { calculateNextDueDate } from '../utils/storage';
import { parseTaskInput } from '../utils/nlpParser';
import { mergeTaskData, redirectDependencies } from '../utils/dependencyUtils';
import { getDerivedSubtaskEstimate } from '../utils/taskTimeSummary';
import { wallTimeToInstant } from '../utils/zonedTime';
import { parseTimeToMinutes, minutesToTimeStr } from '../utils/timelineUtils';
import { syncTaskLegacySchedule } from './scheduleAdapter';

export interface CommandResult {
  checkpoint?: boolean;
  updatedTasks: Task[];
  description: string;
  inverse: (currentTasks: Task[]) => Task[];
  forward?: (currentTasks: Task[]) => Task[];
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
    currentContext?: { defaultProjectId?: string; defaultPlannedDate?: string; defaultPriority?: Priority; enableParsing?: boolean; projects?: Pick<Project, 'id' | 'name'>[] }
  ): CommandResult & { createdTask: Task } {
    const parsed = currentContext?.enableParsing === false ? { cleanTitle: input.trim() } : parseTaskInput(input);
    const now = Date.now();
    const id = `task-${now}-${Math.random().toString(36).substring(2, 7)}`;

    // Precedence: explicit overrides > parsed tokens > context defaults > fallback
    const requestedProject =
      overrides?.projectId ||
      parsed.projectTag ||
      currentContext?.defaultProjectId ||
      'inbox';
    const availableProjects = currentContext?.projects;
    const projectId = availableProjects
      ? (availableProjects.find(project => project.id === requestedProject)
        || availableProjects.find(project => project.name.toLowerCase() === requestedProject.toLowerCase())
        || availableProjects.find(project => project.id === 'inbox'))?.id || 'inbox'
      : requestedProject;

    const plannedDate =
      (overrides && 'plannedDate' in overrides)
        ? overrides.plannedDate
        : parsed.plannedDate || (!parsed.dueDate ? currentContext?.defaultPlannedDate : undefined);

    const dueDate =
      overrides?.dueDate !== undefined ? overrides.dueDate : parsed.dueDate;

    const priority: Priority =
      overrides?.priority || parsed.priority || currentContext?.defaultPriority || 'p4';

    const subtasks = overrides?.subtasks || [];
    const derivedSubEstimate = getDerivedSubtaskEstimate(subtasks);
    const estimatedMinutes = derivedSubEstimate !== null
      ? derivedSubEstimate
      : (overrides?.estimatedMinutes ?? parsed.estimatedMinutes);

    const createdTask: Task = {
      ...(overrides?.originNoteId ? { originNoteId: overrides.originNoteId } : {}),
      id,
      title: overrides?.title || parsed.cleanTitle || input.trim(),
      description: overrides?.description || undefined,
      nextAction: overrides?.nextAction,
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
      estimatedMinutes,
      timeSpentMinutes: 0,
      subtasks,
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
      forward: (currentTasks: Task[]) => [createdTask, ...currentTasks.filter((t) => t.id !== id)],
    };
  },

  /**
   * Update fields on an existing task with surgical field-level inverse
   */
  updateTask(
    tasks: Task[],
    taskId: string,
    updates: Partial<Task>,
    options?: { allowLocked?: boolean }
  ): CommandResult {
    const original = tasks.find((t) => t.id === taskId);
    if (!original) {
      return {
        updatedTasks: tasks,
        description: 'No-op update',
        inverse: (current) => current,
      };
    }

    // Schedule lock guard (F03 / Contract 5.2)
    if (
      original.scheduleLocked &&
      !options?.allowLocked &&
      updates.scheduleLocked !== false
    ) {
      const altersSchedule =
        ('scheduledStart' in updates && updates.scheduledStart !== original.scheduledStart) ||
        ('scheduledEnd' in updates && updates.scheduledEnd !== original.scheduledEnd) ||
        ('plannedDate' in updates && updates.plannedDate !== original.plannedDate);

      if (altersSchedule) {
        throw new Error(
          `Cannot modify schedule of locked task "${original.title}". Unlock the task before modifying its schedule.`
        );
      }
    }

    if (updates.projectId && updates.projectId !== original.projectId && !('milestoneId' in updates)) {
      updates = { ...updates, milestoneId: undefined };
    }

    const derived = getDerivedSubtaskEstimate(updates.subtasks ?? original.subtasks);
    if (derived !== null) updates = { ...updates, estimatedMinutes: derived };
    else if (updates.subtasks !== undefined && getDerivedSubtaskEstimate(original.subtasks) !== null) {
      updates = { ...updates, estimatedMinutes: undefined };
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
      forward: (currentTasks: Task[]) =>
        currentTasks.map((t) =>
          t.id === taskId
            ? { ...t, ...updates, revision: (t.revision || 1) + 1, updatedAt: Date.now() }
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
      const updatedWorkBlocks = task.workBlocks?.map((b) => {
        if (b.status === 'scheduled' && b.startInstant >= now) {
          return { ...b, status: 'cancelled' as const, updatedAt: now };
        }
        return b;
      });

      // Mark as done
      const completedTask: Task = {
        ...task,
        status: 'done',
        completedAt: now,
        isPinnedToday: task.isPinnedToday, // Preserve historical Top 3 membership
        workBlocks: updatedWorkBlocks,
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
        forward: (currentTasks: Task[]) => {
          let applied = currentTasks.map((t) => (t.id === taskId ? completedTask : t));
          if (nextRecurringTask && !applied.some((t) => t.id === nextRecurringTask!.id)) {
            applied = [nextRecurringTask, ...applied];
          }
          return applied;
        },
      };
    } else {
      const restoredWorkBlocks = task.workBlocks?.map((b) => {
        if (b.status === 'cancelled') {
          return { ...b, status: 'scheduled' as const, updatedAt: now };
        }
        return b;
      });

      // Revert to todo
      const uncompletedTask: Task = {
        ...task,
        status: 'todo',
        completedAt: undefined,
        workBlocks: restoredWorkBlocks,
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
        forward: (currentTasks: Task[]) =>
          currentTasks.map((t) => (t.id === taskId ? uncompletedTask : t)),
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
      forward: (currentTasks: Task[]) =>
        currentTasks.map((t) =>
          t.id === taskId ? { ...t, deletedAt: now, revision: (t.revision || 1) + 1, updatedAt: Date.now() } : t
        ),
    };
  },

  /**
   * Permanent deletion removes record completely
   */
  permanentDeleteTask(tasks: Task[], taskId: string): CommandResult {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return { updatedTasks: tasks, description: 'No-op', inverse: (c) => c };

    const dependents = tasks.filter(t => t.blockedBy?.includes(taskId));
    const remove = (list: Task[]) => list.filter(t => t.id !== taskId).map(t =>
      t.blockedBy?.includes(taskId) ? { ...t, blockedBy: t.blockedBy.filter(id => id !== taskId) } : t);
    const updatedTasks = remove(tasks);

    return {
      updatedTasks,
      description: `Permanently deleted "${task.title}"`,
      checkpoint: true,
      inverse: (currentTasks: Task[]) => [task, ...currentTasks.map(t => {
        const original = dependents.find(value => value.id === t.id);
        return original ? { ...t, blockedBy: original.blockedBy } : t;
      })],
      forward: remove,
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
      forward: (currentTasks: Task[]) =>
        currentTasks.map((t) =>
          t.id === taskId ? { ...t, archivedAt: now, revision: (t.revision || 1) + 1, updatedAt: Date.now() } : t
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
      forward: (currentTasks: Task[]) =>
        currentTasks.map((t) =>
          t.id === taskId ? { ...t, deletedAt: undefined, archivedAt: undefined, updatedAt: Date.now() } : t
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
    const operations = new Map(tasks.filter(task => idSet.has(task.id)).map(task =>
      [task.id, commandService.updateTask([task], task.id, updates)]));
    const apply = (current: Task[], direction: 'forward' | 'inverse') => current.map(task => {
      const operation = operations.get(task.id);
      return operation ? operation[direction]!([task])[0] : task;
    });
    const updatedTasks = tasks.map(task => operations.get(task.id)?.updatedTasks[0] || task);
    return {
      updatedTasks,
      description: `Updated ${operations.size} tasks`,
      inverse: current => apply(current, 'inverse'),
      forward: current => apply(current, 'forward'),
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
      checkpoint: true,
      inverse: (currentTasks: Task[]) =>
        currentTasks.map((t) =>
          idSet.has(t.id) ? { ...t, deletedAt: undefined, updatedAt: Date.now() } : t
        ),
      forward: (currentTasks: Task[]) =>
        currentTasks.map((t) =>
          idSet.has(t.id) ? { ...t, deletedAt: now, updatedAt: Date.now() } : t
        ),
    };
  },

  /**
   * Canonical scheduling mutation with atomic rollback/inverse
   */
  scheduleTask(
    tasks: Task[],
    taskId: string,
    schedule: {
      date: string;
      startTime: string;
      endTime?: string;
      durationMinutes?: number;
      isLocked?: boolean;
      timezone?: string;
    },
    options?: { allowLocked?: boolean }
  ): CommandResult {
    const original = tasks.find((t) => t.id === taskId);
    if (!original) {
      return { updatedTasks: tasks, description: 'No-op schedule', inverse: (c) => c };
    }

    if (original.scheduleLocked && !options?.allowLocked && schedule.isLocked !== false) {
      throw new Error(
        `Cannot modify schedule of locked task "${original.title}". Unlock the task before modifying its schedule.`
      );
    }

    const tz = schedule.timezone || original.timezone || (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' : 'UTC');
    const startMin = parseTimeToMinutes(schedule.startTime) ?? 9 * 60;
    const explicitEndMin = schedule.endTime ? parseTimeToMinutes(schedule.endTime) : null;
    const durationMinutes =
      explicitEndMin && explicitEndMin > startMin
        ? explicitEndMin - startMin
        : schedule.durationMinutes && schedule.durationMinutes > 0
        ? schedule.durationMinutes
        : original.estimatedMinutes && original.estimatedMinutes > 0
        ? original.estimatedMinutes
        : 30;

    const endTime = schedule.endTime || minutesToTimeStr(startMin + durationMinutes);

    let startInstant: number;
    let endInstant: number;
    try {
      startInstant = wallTimeToInstant(schedule.date, schedule.startTime, tz, 'earlier');
      endInstant = startInstant + durationMinutes * 60000;
    } catch {
      const fallback = Date.parse(`${schedule.date}T${schedule.startTime}:00Z`);
      startInstant = Number.isFinite(fallback) ? fallback : Date.now();
      endInstant = startInstant + durationMinutes * 60000;
    }

    const existingWorkBlocks = original.workBlocks || [];
    const preservedBlocks = existingWorkBlocks.filter((b) => b.status === 'completed');
    const existingScheduledBlock = existingWorkBlocks.find((b) => b.status === 'scheduled');

    const blockId = existingScheduledBlock?.id || crypto.randomUUID();
    const newBlock: WorkBlock = {
      id: blockId,
      taskId: original.id,
      startInstant,
      endInstant,
      timezone: tz,
      status: original.status === 'done' ? 'completed' : 'scheduled',
      date: schedule.date,
      startTime: schedule.startTime,
      endTime,
      durationMinutes,
      title: original.title,
      isLocked: schedule.isLocked ?? original.scheduleLocked ?? false,
      source: 'canonical',
      revision: (existingScheduledBlock?.revision || 0) + 1,
      createdAt: existingScheduledBlock?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    const nextBlocks = [...preservedBlocks, newBlock];
    const sync = syncTaskLegacySchedule(original, nextBlocks);
    const now = Date.now();

    const updatedTask: Task = {
      ...original,
      workBlocks: nextBlocks,
      plannedDate: schedule.date || sync.plannedDate,
      scheduledStart: sync.scheduledStart || schedule.startTime,
      scheduledEnd: sync.scheduledEnd || endTime,
      scheduleLocked: sync.scheduleLocked,
      revision: (original.revision || 1) + 1,
      updatedAt: now,
    };

    const previousSnapshot = { ...original, workBlocks: original.workBlocks ? [...original.workBlocks] : undefined };

    const updatedTasks = tasks.map((t) => (t.id === taskId ? updatedTask : t));

    return {
      updatedTasks,
      description: `Scheduled "${original.title}" for ${schedule.date} at ${schedule.startTime}`,
      sideEffects: { toastMessage: `Scheduled "${original.title}"` },
      inverse: (currentTasks: Task[]) =>
        currentTasks.map((t) => (t.id === taskId ? { ...previousSnapshot } : t)),
      forward: (currentTasks: Task[]) =>
        currentTasks.map((t) => (t.id === taskId ? { ...updatedTask, updatedAt: Date.now() } : t)),
    };
  },

  /**
   * Move task reservation with atomic rollback/inverse
   */
  moveTask(
    tasks: Task[],
    taskId: string,
    newDate: string,
    newStartTime?: string,
    options?: { allowLocked?: boolean }
  ): CommandResult {
    const original = tasks.find((t) => t.id === taskId);
    if (!original) {
      return { updatedTasks: tasks, description: 'No-op move', inverse: (c) => c };
    }

    if (original.scheduleLocked && !options?.allowLocked) {
      throw new Error(
        `Cannot modify schedule of locked task "${original.title}". Unlock the task before modifying its schedule.`
      );
    }

    const tz = original.timezone || (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' : 'UTC');
    const startTime = newStartTime || original.scheduledStart || '09:00';
    const startMin = parseTimeToMinutes(startTime) ?? 9 * 60;
    const durationMinutes = (original.workBlocks && original.workBlocks[0]?.durationMinutes)
      || (original.estimatedMinutes && original.estimatedMinutes > 0 ? original.estimatedMinutes : 30);
    const endTime = minutesToTimeStr(startMin + durationMinutes);

    let startInstant: number;
    let endInstant: number;
    try {
      startInstant = wallTimeToInstant(newDate, startTime, tz, 'earlier');
      endInstant = startInstant + durationMinutes * 60000;
    } catch {
      const fallback = Date.parse(`${newDate}T${startTime}:00Z`);
      startInstant = Number.isFinite(fallback) ? fallback : Date.now();
      endInstant = startInstant + durationMinutes * 60000;
    }

    const existingWorkBlocks = original.workBlocks || [];
    const preservedBlocks = existingWorkBlocks.filter((b) => b.status === 'completed');
    const activeBlock = existingWorkBlocks.find((b) => b.status === 'scheduled') || existingWorkBlocks[0];

    const blockId = activeBlock?.id || crypto.randomUUID();
    const updatedBlock: WorkBlock = {
      id: blockId,
      taskId: original.id,
      startInstant,
      endInstant,
      timezone: tz,
      status: original.status === 'done' ? 'completed' : 'scheduled',
      date: newDate,
      startTime,
      endTime,
      durationMinutes,
      title: original.title,
      isLocked: original.scheduleLocked ?? false,
      source: 'canonical',
      revision: (activeBlock?.revision || 0) + 1,
      createdAt: activeBlock?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    const nextBlocks = [...preservedBlocks.filter((b) => b.id !== blockId), updatedBlock];
    const sync = syncTaskLegacySchedule(original, nextBlocks);
    const now = Date.now();

    const updatedTask: Task = {
      ...original,
      workBlocks: nextBlocks,
      plannedDate: newDate,
      scheduledStart: sync.scheduledStart || startTime,
      scheduledEnd: sync.scheduledEnd || endTime,
      scheduleLocked: sync.scheduleLocked,
      revision: (original.revision || 1) + 1,
      updatedAt: now,
    };

    const previousSnapshot = { ...original, workBlocks: original.workBlocks ? [...original.workBlocks] : undefined };

    const updatedTasks = tasks.map((t) => (t.id === taskId ? updatedTask : t));

    return {
      updatedTasks,
      description: `Moved "${original.title}" to ${newDate}`,
      sideEffects: { toastMessage: `Moved "${original.title}" to ${newDate}` },
      inverse: (currentTasks: Task[]) =>
        currentTasks.map((t) => (t.id === taskId ? { ...previousSnapshot } : t)),
      forward: (currentTasks: Task[]) =>
        currentTasks.map((t) => (t.id === taskId ? { ...updatedTask, updatedAt: Date.now() } : t)),
    };
  },

  /**
   * Unschedule task with atomic rollback/inverse
   */
  unscheduleTask(
    tasks: Task[],
    taskId: string,
    options?: { allowLocked?: boolean; keepPlannedDate?: boolean }
  ): CommandResult {
    const original = tasks.find((t) => t.id === taskId);
    if (!original) {
      return { updatedTasks: tasks, description: 'No-op unschedule', inverse: (c) => c };
    }

    if (original.scheduleLocked && !options?.allowLocked) {
      throw new Error(
        `Cannot unschedule locked task "${original.title}". Unlock the task before unscheduling.`
      );
    }

    const now = Date.now();
    // Only cancel scheduled sessions; preserve completed sessions history!
    const updatedBlocks = (original.workBlocks || []).map((b) => {
      if (b.status === 'scheduled') {
        return {
          ...b,
          status: 'cancelled' as const,
          updatedAt: now,
        };
      }
      return b;
    });

    const sync = syncTaskLegacySchedule(original, updatedBlocks);

    const updatedTask: Task = {
      ...original,
      workBlocks: updatedBlocks,
      scheduledStart: sync.scheduledStart,
      scheduledEnd: sync.scheduledEnd,
      scheduleLocked: false,
      plannedDate: options?.keepPlannedDate ? (original.plannedDate || sync.plannedDate) : undefined,
      revision: (original.revision || 1) + 1,
      updatedAt: now,
    };

    const previousSnapshot = { ...original, workBlocks: original.workBlocks ? [...original.workBlocks] : undefined };

    const updatedTasks = tasks.map((t) => (t.id === taskId ? updatedTask : t));

    return {
      updatedTasks,
      description: `Unscheduled "${original.title}"`,
      sideEffects: { toastMessage: `Unscheduled "${original.title}"` },
      inverse: (currentTasks: Task[]) =>
        currentTasks.map((t) => (t.id === taskId ? { ...previousSnapshot } : t)),
      forward: (currentTasks: Task[]) =>
        currentTasks.map((t) => (t.id === taskId ? { ...updatedTask, updatedAt: Date.now() } : t)),
    };
  },

  /**
   * Unified Command Dispatcher
   */
  executeCommand(
    tasks: Task[],
    command: { type: CommandType; taskId?: string; payload?: Record<string, unknown>; options?: Record<string, unknown> }
  ): CommandResult {
    switch (command.type) {
      case 'schedule_task':
        return this.scheduleTask(
          tasks,
          (command.taskId || command.payload?.taskId) as string,
          ((command.payload?.schedule as any) || command.payload) as any,
          command.options as any
        );
      case 'move_task':
        return this.moveTask(
          tasks,
          (command.taskId || command.payload?.taskId) as string,
          (command.payload?.newDate || command.payload?.date) as string,
          (command.payload?.newStartTime || command.payload?.startTime) as string | undefined,
          command.options as any
        );
      case 'unschedule_task':
        return this.unscheduleTask(
          tasks,
          (command.taskId || command.payload?.taskId) as string,
          command.options as any
        );
      case 'create_task':
        return this.createTask(tasks, (command.payload?.title || command.payload?.input || '') as string, command.payload);
      case 'update_task':
        return this.updateTask(tasks, (command.taskId || command.payload?.taskId) as string, command.payload || {}, command.options as any);
      case 'complete_task':
        return this.toggleTaskStatus(tasks, (command.taskId || command.payload?.taskId) as string);
      case 'delete_task':
        return this.deleteTask(tasks, (command.taskId || command.payload?.taskId) as string);
      case 'archive_task':
        return this.archiveTask(tasks, (command.taskId || command.payload?.taskId) as string);
      case 'restore_task':
        return this.restoreTask(tasks, (command.taskId || command.payload?.taskId) as string);
      case 'merge_tasks':
        return this.mergeTasks(tasks, command.payload?.targetTaskId as string, command.payload?.sourceTaskId as string);
      case 'bulk_update':
        return this.batchUpdate(tasks, command.payload?.taskIds as string[], command.payload?.updates as any);
      default:
        return { updatedTasks: tasks, description: 'Unknown command', inverse: (c) => c };
    }
  },

  /**
   * Bidirectional Command History Stack (BUG-17)
   */
  undoStack: [] as Array<{
    description: string;
    inverse: (tasks: Task[]) => Task[];
    forward: (tasks: Task[]) => Task[];
    sideEffects?: CommandResult['sideEffects'];
  }>,

  redoStack: [] as Array<{
    description: string;
    inverse: (tasks: Task[]) => Task[];
    forward: (tasks: Task[]) => Task[];
    sideEffects?: CommandResult['sideEffects'];
  }>,

  /**
   * Clear both undo and redo stacks
   */
  clearHistory() {
    this.undoStack = [];
    this.redoStack = [];
  },

  /**
   * Check if an undo action is available
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  },

  /**
   * Check if a redo action is available
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  },

  /**
   * Record an executed action into the undo stack and clear redo stack
   */
  recordAction(entry: {
    description: string;
    inverse: (tasks: Task[]) => Task[];
    forward: (tasks: Task[]) => Task[];
    sideEffects?: CommandResult['sideEffects'];
  }) {
    this.redoStack = [];
    this.undoStack.push(entry);
    if (this.undoStack.length > 50) {
      this.undoStack.shift();
    }
  },

  /**
   * Execute a command function, record its inverse in undoStack, clear redoStack, and return result
   */
  executeAction(
    tasks: Task[],
    commandFn: (currentTasks: Task[]) => CommandResult
  ): CommandResult {
    const result = commandFn(tasks);
    const forwardFn =
      result.forward ||
      ((currentTasks: Task[]) => {
        const updatedMap = new Map(result.updatedTasks.map((t) => [t.id, t]));
        return currentTasks.map((t) => updatedMap.get(t.id) || t);
      });
    this.recordAction({
      description: result.description,
      inverse: result.inverse,
      forward: forwardFn,
      sideEffects: result.sideEffects,
    });
    return result;
  },

  /**
   * Pop from undoStack, apply inverse, and push forward action to redoStack
   */
  undoLastAction(currentTasks: Task[] = []): {
    updatedTasks: Task[];
    description: string;
    sideEffects?: CommandResult['sideEffects'];
  } | null {
    const entry = this.undoStack.pop();
    if (!entry) return null;

    const updatedTasks = entry.inverse(currentTasks);
    this.redoStack.push(entry);

    return {
      updatedTasks,
      description: `Undo: ${entry.description}`,
      sideEffects: entry.sideEffects,
    };
  },

  /**
   * Pop from redoStack, execute forward action, and push to undoStack
   */
  redoLastAction(currentTasks: Task[] = []): {
    updatedTasks: Task[];
    description: string;
    sideEffects?: CommandResult['sideEffects'];
  } | null {
    const entry = this.redoStack.pop();
    if (!entry) return null;

    const updatedTasks = entry.forward(currentTasks);
    this.undoStack.push(entry);

    return {
      updatedTasks,
      description: `Redo: ${entry.description}`,
      sideEffects: entry.sideEffects,
    };
  },
};
