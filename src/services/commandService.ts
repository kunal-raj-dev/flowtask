import type { Task, Priority, Project } from '../types/task';
import { calculateNextDueDate } from '../utils/storage';
import { parseTaskInput } from '../utils/nlpParser';
import { mergeTaskData, redirectDependencies } from '../utils/dependencyUtils';
import { getDerivedSubtaskEstimate } from '../utils/taskTimeSummary';

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
      overrides?.plannedDate !== undefined
        ? overrides.plannedDate
        : parsed.plannedDate || currentContext?.defaultPlannedDate;

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
        forward: (currentTasks: Task[]) => {
          let applied = currentTasks.map((t) => (t.id === taskId ? completedTask : t));
          if (nextRecurringTask && !applied.some((t) => t.id === nextRecurringTask!.id)) {
            applied = [nextRecurringTask, ...applied];
          }
          return applied;
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
