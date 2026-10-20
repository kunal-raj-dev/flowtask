import { DEFAULT_WORKFLOW_SETTINGS, type UserWorkflowSettings } from '../types/settings';
import { commandService } from "./commandService";
import { WorkspaceStore } from "./workspaceStore";
import { useFocusStore } from "../store/useFocusStore";
import { formatLocalDate } from "../utils/nlpParser";
import {
  isActiveTask,
  isTodayTask,
  isFocusTask,
  completedOn,
} from "../utils/taskSelectors";
import type {
  Task,
  Priority,
  FocusSessionMode,
  FocusSession,
  FocusLog,
} from "../types/task";
import { writeFocusCheckpoint } from "./focusCheckpoint";
import { focusSessionService } from "./focusSessionService";
import { suggestSubtasks, generateStarterStep, type SuggestedSubtask } from "../utils/aiCopilot";

export interface WebMcpToolDefinition<
  TParams = Record<string, unknown>,
  TResult = unknown,
> {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  inputSchema: Record<string, unknown>;
  execute: (params?: TParams) => Promise<TResult> | TResult;
}

export interface WebMcpRegistrationOptions {
  signal?: AbortSignal;
  store?: WorkspaceStore | null;
  getStore?: () => WorkspaceStore | null;
  onRegistered?: () => void;
  onUnregistered?: () => void;
}

export interface CreateTaskParams {
  title: string;
  priority?: Priority;
  plannedDate?: string;
  dueDate?: string;
  projectId?: string;
  estimatedMinutes?: number;
  description?: string;
  nextAction?: string;
  subtasks?: Array<{ title: string; estimatedMinutes?: number }>;
}

export interface UpdateTaskParams {
  taskId: string;
  title?: string;
  priority?: Priority;
  plannedDate?: string;
  dueDate?: string;
  estimatedMinutes?: number;
  projectId?: string;
  description?: string;
  isPinnedToday?: boolean;
  isSomeday?: boolean;
}

export interface CompleteTaskParams {
  taskId: string;
  completed?: boolean;
}

export interface ListTasksParams {
  status?: "all" | "todo" | "done";
  priority?: Priority;
  projectId?: string;
  plannedDate?: string;
  searchQuery?: string;
  limit?: number;
}

export interface ListTodayTasksParams {
  includeCompleted?: boolean;
  projectId?: string;
}

export interface StartFocusSessionParams {
  taskId?: string;
  taskTitle?: string;
  mode?: FocusSessionMode;
  targetDurationMinutes?: number;
}

export interface StopFocusSessionParams {
  abandon?: boolean;
}

export interface ScheduleTimelineBlockParams {
  taskId: string;
  startTime: string;
  date?: string;
  durationMinutes?: number;
}

export interface GetDailySummaryParams {
  date?: string;
}

export interface DecomposeTaskParams {
  taskId?: string;
  taskTitle?: string;
}

export interface WorkspaceStatusResult {
  activeTasksCount: number;
  todayTasksCount: number;
  overdueCount: number;
  activeFocusSession: FocusSession | null;
  todayFocusedSeconds: number;
}

export interface GlobalWebMcpBridge {
  version: string;
  tools: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    inputSchema: Record<string, unknown>;
  }>;
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  executeTool: (name: string, args: unknown) => Promise<unknown>;
  getTools: () => WebMcpToolDefinition[];
  unregister: () => void;
}

declare global {
  interface Window {
    __FLOWTASK_MCP__?: GlobalWebMcpBridge;
  }
}

// Module-level references
let activeRegistrationStore: WorkspaceStore | null = null;
let activeStoreGetter: (() => WorkspaceStore | null) | null = null;
let activeAbortCleanup: (() => void) | null = null;
let activeRegistration: symbol | null = null;

export function setWebMcpActiveStore(store: WorkspaceStore | null): void {
  activeRegistrationStore = store;
}

function resolveStore(): WorkspaceStore {
  if (activeRegistrationStore) {
    return activeRegistrationStore;
  }
  if (activeStoreGetter) {
    const s = activeStoreGetter();
    if (s) return s;
  }
  throw new Error(
    "Open a workspace and wait for it to finish loading before using assistant tools.",
  );
}

// JSON Schemas
export const createTaskSchema = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description:
        "Title or task phrase. Can include natural language tokens like #work, p1, tomorrow.",
    },
    priority: {
      type: "string",
      enum: ["p1", "p2", "p3", "p4"],
      description:
        "Priority tier: p1 (urgent), p2 (high), p3 (medium), p4 (low)",
    },
    plannedDate: {
      type: "string",
      description: "Planned scheduled date in YYYY-MM-DD format",
    },
    dueDate: {
      type: "string",
      description: "Deadline date in YYYY-MM-DD format",
    },
    projectId: {
      type: "string",
      description: "Target project ID (e.g. inbox, work, personal)",
    },
    estimatedMinutes: {
      type: "number",
      description: "Estimated duration in minutes",
    },
    description: {
      type: "string",
      description: "Detailed notes or checklist description",
    },
    nextAction: { type: "string", description: "A small starter action for the task" },
    subtasks: { type: "array", maxItems: 30, items: { type: "object", properties: { title: { type: "string" }, estimatedMinutes: { type: "number", exclusiveMinimum: 0 } }, required: ["title"] } },
  },
  required: ["title"],
} as const;

export const updateTaskSchema = {
  type: "object",
  properties: {
    taskId: {
      type: "string",
      description: "ID of the task to update",
    },
    title: {
      type: "string",
      description: "Updated title",
    },
    priority: {
      type: "string",
      enum: ["p1", "p2", "p3", "p4"],
      description: "Updated priority",
    },
    plannedDate: {
      type: "string",
      description: "Scheduled date in YYYY-MM-DD",
    },
    dueDate: {
      type: "string",
      description: "Due date in YYYY-MM-DD",
    },
    estimatedMinutes: {
      type: "number",
      description: "Estimated duration in minutes",
    },
    projectId: {
      type: "string",
      description: "Target project ID",
    },
    description: {
      type: "string",
      description: "Updated description notes",
    },
    isPinnedToday: {
      type: "boolean",
      description: "Pin to Top 3 today",
    },
    isSomeday: {
      type: "boolean",
      description: "Move to someday backlog",
    },
  },
  required: ["taskId"],
} as const;

export const completeTaskSchema = {
  type: "object",
  properties: {
    taskId: {
      type: "string",
      description: "ID of the task to complete or toggle",
    },
    completed: {
      type: "boolean",
      description: "Explicit completion state (default: true)",
    },
  },
  required: ["taskId"],
} as const;

export const listTasksSchema = {
  type: "object",
  properties: {
    status: {
      type: "string",
      enum: ["all", "todo", "done"],
      description: "Filter by status (default: all)",
    },
    priority: {
      type: "string",
      enum: ["p1", "p2", "p3", "p4"],
      description: "Filter by priority",
    },
    projectId: {
      type: "string",
      description: "Filter by project ID",
    },
    plannedDate: {
      type: "string",
      description: "Filter by planned date YYYY-MM-DD",
    },
    searchQuery: {
      type: "string",
      description: "Search filter for title or description",
    },
    limit: {
      type: "number",
      description: "Maximum number of tasks to return",
    },
  },
} as const;

export const listTodayTasksSchema = {
  type: "object",
  properties: {
    includeCompleted: {
      type: "boolean",
      description:
        "Whether to include completed tasks for today (default: false)",
    },
    projectId: {
      type: "string",
      description: "Optional filter by project ID",
    },
  },
} as const;

export const startFocusSessionSchema = {
  type: "object",
  properties: {
    taskId: {
      type: "string",
      description: "Optional ID of the task to focus on",
    },
    taskTitle: {
      type: "string",
      description: "Title or topic for the focus session",
    },
    mode: {
      type: "string",
      enum: ["pomodoro", "sprint"],
      description: "Focus mode (default: pomodoro)",
    },
    targetDurationMinutes: {
      type: "number",
      description:
        "Duration in minutes (default: 25 for pomodoro, 50 for sprint)",
    },
  },
} as const;

export const stopFocusSessionSchema = {
  type: "object",
  properties: {
    abandon: {
      type: "boolean",
      description: "Whether to abandon without saving focus log (default: false)",
    },
  },
} as const;

export const scheduleTimelineBlockSchema = {
  type: "object",
  properties: {
    taskId: {
      type: "string",
      description: "ID of the task to schedule",
    },
    startTime: {
      type: "string",
      description: "Start time in HH:mm format (e.g. 09:30, 14:15)",
    },
    date: {
      type: "string",
      description: "Target date in YYYY-MM-DD format (defaults to today)",
    },
    durationMinutes: {
      type: "number",
      description: "Duration in minutes (snapped to 15m intervals)",
    },
  },
  required: ["taskId", "startTime"],
} as const;

export const getDailySummarySchema = {
  type: "object",
  properties: {
    date: {
      type: "string",
      description: "Target date in YYYY-MM-DD format (defaults to today)",
    },
  },
} as const;

export const decomposeTaskSchema = {
  type: "object",
  properties: {
    taskId: {
      type: "string",
      description: "ID of an existing task to decompose into subtasks",
    },
    taskTitle: {
      type: "string",
      description: "Title of a task or goal to break down",
    },
  },
} as const;

export const getWorkspaceStatusSchema = {
  type: "object",
  properties: {},
} as const;

// Tool implementations
export const createTaskTool: WebMcpToolDefinition<
  CreateTaskParams,
  { success: boolean; task: Task }
> = {
  name: "createTask",
  description:
    "Create a new task in FlowTask with optional priority, due date, estimated minutes, project, and notes. Natural language tokens in the title are parsed automatically.",
  parameters: createTaskSchema,
  inputSchema: createTaskSchema,
  execute: async (params: CreateTaskParams = {} as CreateTaskParams) => {
    if (!params || typeof params.title !== "string" || !params.title.trim()) {
      throw new Error(
        'createTask requires a non-empty "title" string parameter.',
      );
    }

    if (
      params.priority &&
      !["p1", "p2", "p3", "p4"].includes(params.priority)
    ) {
      throw new Error(
        `Invalid priority "${params.priority}". Must be one of: p1, p2, p3, p4.`,
      );
    }

    if (
      params.estimatedMinutes !== undefined &&
      (typeof params.estimatedMinutes !== "number" ||
        !Number.isFinite(params.estimatedMinutes) ||
        params.estimatedMinutes < 0)
    ) {
      throw new Error("estimatedMinutes must be a non-negative number.");
    }

    const store = resolveStore();
    if (!store.getSnapshot().ready) {
      await store.load();
    }

    const currentRecord = store.getSnapshot().record;
    const currentTasks = currentRecord.tasks || [];

    const overrides: Partial<Task> = {};
    if (params.priority) overrides.priority = params.priority;
    if (params.plannedDate) overrides.plannedDate = params.plannedDate;
    if (params.dueDate) overrides.dueDate = params.dueDate;
    if (params.projectId) overrides.projectId = params.projectId;
    if (typeof params.estimatedMinutes === "number")
      overrides.estimatedMinutes = params.estimatedMinutes;
    if (params.description) overrides.description = params.description;
    if (params.nextAction !== undefined) {
      if (typeof params.nextAction !== 'string' || params.nextAction.length > 500) throw new Error('nextAction must be a string up to 500 characters.');
      overrides.nextAction = params.nextAction.trim();
    }
    if (params.subtasks !== undefined) {
      if (!Array.isArray(params.subtasks) || params.subtasks.length > 30 || params.subtasks.some(s => !s || typeof s.title !== 'string' || !s.title.trim() || s.title.length > 500 || (s.estimatedMinutes !== undefined && (!Number.isFinite(s.estimatedMinutes) || s.estimatedMinutes <= 0 || s.estimatedMinutes > 1440)))) throw new Error('Provide up to 30 subtasks with non-empty titles and positive durations up to 1440 minutes.');
      overrides.subtasks = params.subtasks.map(s => ({ id: crypto.randomUUID(), title: s.title.trim(), completed: false, estimatedMinutes: s.estimatedMinutes }));
    }

    const result = commandService.createTask(
      currentTasks,
      params.title.trim(),
      overrides,
      { defaultPriority: (currentRecord.preferences.settings as UserWorkflowSettings | undefined)?.defaultTaskPriority || DEFAULT_WORKFLOW_SETTINGS.defaultTaskPriority, enableParsing: (currentRecord.preferences.settings as UserWorkflowSettings | undefined)?.enableSmartSyntaxParsing },
    );

    if (currentRecord.projects && currentRecord.projects.length > 0) {
      if (
        !currentRecord.projects.some(
          (p) => p.id === result.createdTask.projectId,
        )
      ) {
        result.createdTask.projectId = "inbox";
      }
    }

    store.run(result.description, (record) => ({
      ...record,
      tasks: result.updatedTasks,
    }));

    return {
      success: true,
      task: result.createdTask,
    };
  },
};

export const updateTaskTool: WebMcpToolDefinition<
  UpdateTaskParams,
  { success: boolean; task: Task }
> = {
  name: "updateTask",
  description:
    "Update an existing task in FlowTask by ID, modifying fields such as title, priority, dates, notes, or project.",
  parameters: updateTaskSchema,
  inputSchema: updateTaskSchema,
  execute: async (params: UpdateTaskParams = {} as UpdateTaskParams) => {
    if (!params || typeof params.taskId !== "string" || !params.taskId.trim()) {
      throw new Error('updateTask requires a valid "taskId" parameter.');
    }

    const store = resolveStore();
    if (!store.getSnapshot().ready) {
      await store.load();
    }

    const currentTasks = store.getSnapshot().record.tasks || [];
    const task = currentTasks.find((t) => t.id === params.taskId);
    if (!task) {
      throw new Error(`Task with ID "${params.taskId}" not found in workspace.`);
    }

    if (
      params.priority &&
      !["p1", "p2", "p3", "p4"].includes(params.priority)
    ) {
      throw new Error(
        `Invalid priority "${params.priority}". Must be one of: p1, p2, p3, p4.`,
      );
    }

    const updates: Partial<Task> = {};
    if (typeof params.title === "string" && params.title.trim()) updates.title = params.title.trim();
    if (params.priority) updates.priority = params.priority;
    if (params.plannedDate !== undefined) updates.plannedDate = params.plannedDate;
    if (params.dueDate !== undefined) updates.dueDate = params.dueDate;
    if (typeof params.estimatedMinutes === "number") updates.estimatedMinutes = params.estimatedMinutes;
    if (params.projectId) updates.projectId = params.projectId;
    if (params.description !== undefined) updates.description = params.description;
    if (typeof params.isPinnedToday === "boolean") {
      updates.isPinnedToday = params.isPinnedToday;
      if (params.isPinnedToday) updates.topThreeDate = formatLocalDate(new Date());
    }
    if (typeof params.isSomeday === "boolean") {
      updates.isSomeday = params.isSomeday;
      if (params.isSomeday) {
        updates.plannedDate = undefined;
        updates.isPinnedToday = false;
      }
    }

    const updatedTask: Task = { ...task, ...updates, updatedAt: Date.now() };

    store.run(`Update task "${updatedTask.title}"`, (record) => ({
      ...record,
      tasks: record.tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
    }));

    return {
      success: true,
      task: updatedTask,
    };
  },
};

export const completeTaskTool: WebMcpToolDefinition<
  CompleteTaskParams,
  { success: boolean; task: Task }
> = {
  name: "completeTask",
  description:
    "Mark a task as completed or incomplete in FlowTask.",
  parameters: completeTaskSchema,
  inputSchema: completeTaskSchema,
  execute: async (params: CompleteTaskParams = {} as CompleteTaskParams) => {
    if (!params || typeof params.taskId !== "string" || !params.taskId.trim()) {
      throw new Error('completeTask requires a valid "taskId" parameter.');
    }

    const store = resolveStore();
    if (!store.getSnapshot().ready) {
      await store.load();
    }

    const currentTasks = store.getSnapshot().record.tasks || [];
    const task = currentTasks.find((t) => t.id === params.taskId);
    if (!task) {
      throw new Error(`Task with ID "${params.taskId}" not found in workspace.`);
    }

    const targetDone = params.completed !== undefined ? params.completed : task.status !== "done";
    const updatedTask: Task = {
      ...task,
      status: targetDone ? "done" : "todo",
      completedAt: targetDone ? Date.now() : undefined,
      updatedAt: Date.now(),
    };

    store.run(
      targetDone ? `Complete task "${task.title}"` : `Reopen task "${task.title}"`,
      (record) => ({
        ...record,
        tasks: record.tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
      }),
    );

    return {
      success: true,
      task: updatedTask,
    };
  },
};

export const listTasksTool: WebMcpToolDefinition<
  ListTasksParams,
  { totalCount: number; tasks: Task[] }
> = {
  name: "listTasks",
  description:
    "Query tasks in FlowTask with flexible filters by status (todo/done/all), priority, project, plannedDate, or search keywords.",
  parameters: listTasksSchema,
  inputSchema: listTasksSchema,
  execute: async (params: ListTasksParams = {}) => {
    const store = resolveStore();
    if (!store.getSnapshot().ready) {
      await store.load();
    }

    let tasks = store.getSnapshot().record.tasks || [];

    // Filter by status
    if (params.status === "todo") {
      tasks = tasks.filter((t) => isActiveTask(t));
    } else if (params.status === "done") {
      tasks = tasks.filter((t) => t.status === "done" && !t.deletedAt && !t.archivedAt);
    } else {
      tasks = tasks.filter((t) => !t.deletedAt && !t.archivedAt);
    }

    // Filter by priority
    if (params.priority) {
      tasks = tasks.filter((t) => t.priority === params.priority);
    }

    // Filter by project
    if (params.projectId) {
      tasks = tasks.filter((t) => t.projectId === params.projectId);
    }

    // Filter by plannedDate
    if (params.plannedDate) {
      tasks = tasks.filter((t) => t.plannedDate === params.plannedDate);
    }

    // Search query filter
    if (params.searchQuery && params.searchQuery.trim()) {
      const q = params.searchQuery.toLowerCase().trim();
      tasks = tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q)),
      );
    }

    const totalCount = tasks.length;
    if (typeof params.limit === "number" && params.limit > 0) {
      tasks = tasks.slice(0, params.limit);
    }

    return {
      totalCount,
      tasks,
    };
  },
};

export const listTodayTasksTool: WebMcpToolDefinition<
  ListTodayTasksParams,
  {
    date: string;
    totalCount: number;
    topThree: Task[];
    daytime: Task[];
    completed: Task[];
  }
> = {
  name: "listTodayTasks",
  description:
    "List all tasks scheduled or planned for today in the user's workspace, organized into topThree, daytime, and completed categories.",
  parameters: listTodayTasksSchema,
  inputSchema: listTodayTasksSchema,
  execute: async (params: ListTodayTasksParams = {}) => {
    const store = resolveStore();
    if (!store.getSnapshot().ready) {
      await store.load();
    }

    const currentTasks = store.getSnapshot().record.tasks || [];
    const todayStr = formatLocalDate(new Date());

    let relevantTasks = currentTasks;
    if (params.projectId) {
      relevantTasks = relevantTasks.filter(
        (t) => t.projectId === params.projectId,
      );
    }

    const todayActive = relevantTasks.filter((t) => isTodayTask(t, todayStr));
    const topThree = todayActive.filter((t) => isFocusTask(t, todayStr));
    const daytime = todayActive.filter((t) => !isFocusTask(t, todayStr));

    let completed: Task[] = [];
    if (params.includeCompleted) {
      completed = relevantTasks.filter(
        (t) =>
          completedOn(t, todayStr) ||
          (t.status === "done" &&
            !t.deletedAt &&
            !t.archivedAt &&
            (t.plannedDate === todayStr || t.dueDate === todayStr)),
      );
    }

    return {
      date: todayStr,
      totalCount: topThree.length + daytime.length + completed.length,
      topThree,
      daytime,
      completed,
    };
  },
};

export const startFocusSessionTool: WebMcpToolDefinition<
  StartFocusSessionParams,
  {
    success: boolean;
    session: FocusSession;
  }
> = {
  name: "startFocusSession",
  description:
    "Start a deep work focus session or study sprint in FlowTask linked to an optional task.",
  parameters: startFocusSessionSchema,
  inputSchema: startFocusSessionSchema,
  execute: async (params: StartFocusSessionParams = {}) => {
    const store = resolveStore();
    if (!store.getSnapshot().ready)
      throw new Error("Wait for the workspace to finish loading.");
    if (useFocusStore.getState().focusSession)
      throw new Error(
        "Finish the current focus session before starting another.",
      );
    const mode: FocusSessionMode =
      params.mode === "sprint" ? "sprint" : "pomodoro";
    const taskId = params.taskId || null;
    const task = taskId
      ? store
          .getSnapshot()
          .record.tasks.find((t) => t.id === taskId && isActiveTask(t))
      : null;
    if (taskId && !task)
      throw new Error("Choose an active task in this workspace.");
    const taskTitle = params.taskTitle || task?.title || null;

    let targetSec: number;
    if (
      typeof params.targetDurationMinutes === "number" &&
      Number.isFinite(params.targetDurationMinutes) &&
      params.targetDurationMinutes > 0 &&
      params.targetDurationMinutes <= 1440
    ) {
      targetSec = Math.round(params.targetDurationMinutes * 60);
    } else {
      targetSec = mode === "pomodoro" ? 1500 : 3000;
    }

    const session = {
      ...focusSessionService.startSession(mode, taskId, taskTitle, targetSec),
      workspaceId: store.id,
    };
    const focusCheckpointAt = writeFocusCheckpoint(store.id, session);
    store.run(
      "Start focus session",
      (record) => ({
        ...record,
        preferences: {
          ...record.preferences,
          focusSession: session,
          focusCheckpointAt,
        },
      }),
      false,
    );
    useFocusStore.getState().setFocusSession(session);

    return {
      success: true,
      session,
    };
  },
};

export const stopFocusSessionTool: WebMcpToolDefinition<
  StopFocusSessionParams,
  { success: boolean; loggedSeconds: number }
> = {
  name: "stopFocusSession",
  description:
    "Stop and finish the currently running focus session in FlowTask.",
  parameters: stopFocusSessionSchema,
  inputSchema: stopFocusSessionSchema,
  execute: async (params: StopFocusSessionParams = {}) => {
    const store = resolveStore();
    if (!store.getSnapshot().ready) {
      await store.load();
    }

    const currentSession = useFocusStore.getState().focusSession;
    if (!currentSession) {
      throw new Error("No active focus session to stop.");
    }

    const elapsed = useFocusStore.getState().focusElapsedSeconds || 0;
    const abandon = params.abandon === true;

    if (!abandon && elapsed > 10) {
      const newLog: FocusLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        taskId: currentSession.taskId || null,
        taskTitle: currentSession.taskTitle || undefined,
        seconds: elapsed,
        startedAt: currentSession.startedAt,
        endedAt: Date.now(),
        mode: currentSession.mode,
        phase: "focus",
      };

      store.run("Log completed focus session", (record) => {
        const existingLogs = (record.preferences.focusLogs as FocusLog[] | undefined) || [];
        return {
          ...record,
          preferences: {
            ...record.preferences,
            focusSession: null,
            focusLogs: [...existingLogs, newLog],
          },
        };
      });
    } else {
      store.run("Clear focus session", (record) => ({
        ...record,
        preferences: {
          ...record.preferences,
          focusSession: null,
        },
      }));
    }

    useFocusStore.getState().setFocusSession(null);

    return {
      success: true,
      loggedSeconds: abandon ? 0 : elapsed,
    };
  },
};

export const scheduleTimelineBlockTool: WebMcpToolDefinition<
  ScheduleTimelineBlockParams,
  { success: boolean; task: Task; scheduledSlot: { start: string; end: string } }
> = {
  name: "scheduleTimelineBlock",
  description:
    "Schedule a task into a specific time block on the Horizon 24h timeline rail, snapped to 15-minute intervals.",
  parameters: scheduleTimelineBlockSchema,
  inputSchema: scheduleTimelineBlockSchema,
  execute: async (params: ScheduleTimelineBlockParams = {} as ScheduleTimelineBlockParams) => {
    if (!params || typeof params.taskId !== "string" || !params.taskId.trim()) {
      throw new Error('scheduleTimelineBlock requires a valid "taskId".');
    }
    if (!params.startTime || !/^\d{1,2}:\d{2}$/.test(params.startTime.trim())) {
      throw new Error('scheduleTimelineBlock requires a valid "startTime" in HH:mm format.');
    }

    const store = resolveStore();
    if (!store.getSnapshot().ready) {
      await store.load();
    }

    const tasks = store.getSnapshot().record.tasks || [];
    const task = tasks.find((t) => t.id === params.taskId);
    if (!task) {
      throw new Error(`Task with ID "${params.taskId}" not found.`);
    }

    const [hours, minutes] = params.startTime.trim().split(":").map(Number);
    const totalMinutes = hours * 60 + minutes;
    const snappedStartMin = Math.max(0, Math.min(1410, Math.round(totalMinutes / 15) * 15));
    const duration = Math.max(15, Math.round((params.durationMinutes || task.estimatedMinutes || 30) / 15) * 15);
    const snappedEndMin = Math.min(1440, snappedStartMin + duration);

    const formatMin = (m: number) => {
      const h = Math.floor(m / 60);
      const min = m % 60;
      return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    };

    const scheduledStart = formatMin(snappedStartMin);
    const scheduledEnd = formatMin(snappedEndMin);
    const plannedDate = params.date || task.plannedDate || formatLocalDate(new Date());

    const updatedTask: Task = {
      ...task,
      plannedDate,
      scheduledStart,
      scheduledEnd,
      isSomeday: false,
      updatedAt: Date.now(),
    };

    store.run(`Schedule task "${task.title}" at ${scheduledStart}`, (record) => ({
      ...record,
      tasks: record.tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
    }));

    return {
      success: true,
      task: updatedTask,
      scheduledSlot: {
        start: scheduledStart,
        end: scheduledEnd,
      },
    };
  },
};

export const getDailySummaryTool: WebMcpToolDefinition<
  GetDailySummaryParams,
  {
    date: string;
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    topThreeCount: number;
    topThreeCompleted: number;
    totalPlannedMinutes: number;
    focusedSeconds: number;
  }
> = {
  name: "getDailySummary",
  description:
    "Retrieve a comprehensive productivity summary for a given day, including Top 3 execution rate, completed tasks, and deep work focus time.",
  parameters: getDailySummarySchema,
  inputSchema: getDailySummarySchema,
  execute: async (params: GetDailySummaryParams = {}) => {
    const store = resolveStore();
    if (!store.getSnapshot().ready) {
      await store.load();
    }

    const record = store.getSnapshot().record;
    const tasks = record.tasks || [];
    const dateStr = params.date || formatLocalDate(new Date());

    const dayTasks = tasks.filter(
      (t) =>
        !t.deletedAt &&
        !t.archivedAt &&
        (t.plannedDate === dateStr || t.topThreeDate === dateStr || completedOn(t, dateStr)),
    );

    const completed = dayTasks.filter((t) => t.status === "done" && completedOn(t, dateStr));
    const topThree = dayTasks.filter((t) => isFocusTask(t, dateStr));
    const topThreeDone = topThree.filter((t) => t.status === "done");

    const totalPlannedMinutes = dayTasks.reduce(
      (acc, t) => acc + (t.estimatedMinutes || 30),
      0,
    );

    // Focus time
    const focusLogs = (record.preferences.focusLogs as FocusLog[] | undefined) || [];
    const dayFocusedSec = focusLogs
      .filter((log) => log.endedAt && formatLocalDate(new Date(log.endedAt)) === dateStr)
      .reduce((acc, log) => acc + (log.seconds || 0), 0);

    const completionRate =
      dayTasks.length > 0 ? Math.round((completed.length / dayTasks.length) * 100) : 0;

    return {
      date: dateStr,
      totalTasks: dayTasks.length,
      completedTasks: completed.length,
      completionRate,
      topThreeCount: topThree.length,
      topThreeCompleted: topThreeDone.length,
      totalPlannedMinutes,
      focusedSeconds: dayFocusedSec,
    };
  },
};

export const decomposeTaskTool: WebMcpToolDefinition<
  DecomposeTaskParams,
  {
    success: boolean;
    taskTitle: string;
    subtasks: SuggestedSubtask[];
    starterStep: string;
    task?: Task;
  }
> = {
  name: "decomposeTask",
  description:
    "Break down an ambitious or intimidating task into 3-4 actionable subtasks and an anti-procrastination 2-minute starter step using the offline heuristic engine.",
  parameters: decomposeTaskSchema,
  inputSchema: decomposeTaskSchema,
  execute: async (params: DecomposeTaskParams = {}) => {
    const store = resolveStore();
    if (!store.getSnapshot().ready) {
      await store.load();
    }

    let title = params.taskTitle || "";
    let matchedTask: Task | undefined;

    if (params.taskId) {
      matchedTask = store.getSnapshot().record.tasks.find((t) => t.id === params.taskId);
      if (matchedTask) {
        title = matchedTask.title;
      }
    }

    if (!title.trim()) {
      throw new Error('decomposeTask requires a "taskTitle" or valid "taskId".');
    }

    const subtasks = suggestSubtasks(title);
    const starterStep = generateStarterStep(title);

    let updatedTask: Task | undefined;
    if (matchedTask) {
      const generatedSubtasks = subtasks.map((s, idx) => ({
        id: `sub-${Date.now()}-${idx}`,
        title: s.title,
        completed: false,
        estimatedMinutes: s.estimatedMinutes,
      }));

      updatedTask = {
        ...matchedTask,
        subtasks: [...(matchedTask.subtasks || []), ...generatedSubtasks],
        nextAction: starterStep,
        updatedAt: Date.now(),
      };

      store.run(`Decompose task "${matchedTask.title}"`, (record) => ({
        ...record,
        tasks: record.tasks.map((t) => (t.id === updatedTask!.id ? updatedTask! : t)),
      }));
    }

    return {
      success: true,
      taskTitle: title,
      subtasks,
      starterStep,
      task: updatedTask,
    };
  },
};

export const getWorkspaceStatusTool: WebMcpToolDefinition<
  Record<string, unknown>,
  WorkspaceStatusResult
> = {
  name: "getWorkspaceStatus",
  description:
    "Retrieve real-time telemetry and summary of the user's FlowTask workspace.",
  parameters: getWorkspaceStatusSchema,
  inputSchema: getWorkspaceStatusSchema,
  execute: async () => {
    const store = resolveStore();
    if (!store.getSnapshot().ready) {
      await store.load();
    }

    const record = store.getSnapshot().record;
    const tasks = record.tasks || [];
    const todayStr = formatLocalDate(new Date());

    const activeTasks = tasks.filter((t) => isActiveTask(t));
    const activeTasksCount = activeTasks.length;
    const todayTasksCount = tasks.filter((t) =>
      isTodayTask(t, todayStr),
    ).length;

    const overdueCount = tasks.filter((t) => {
      if (!isActiveTask(t)) return false;
      const taskDate = t.dueDate || t.plannedDate;
      return Boolean(taskDate && taskDate < todayStr);
    }).length;

    const activeFocusSession = useFocusStore.getState().focusSession;

    // Aggregate today's focused seconds from focusLogs + active live session
    const preferences = record.preferences || {};
    const focusLogs = (preferences.focusLogs as FocusLog[] | undefined) || [];
    const completedTodaySeconds = focusLogs
      .filter(
        (log) =>
          (!log.phase || log.phase === "focus") &&
          log.endedAt &&
          formatLocalDate(new Date(log.endedAt)) === todayStr,
      )
      .reduce((acc, log) => acc + (log.seconds || 0), 0);

    const isLiveToday =
      activeFocusSession &&
      (activeFocusSession.state === "running" ||
        activeFocusSession.state === "paused") &&
      formatLocalDate(new Date(activeFocusSession.startedAt)) === todayStr;

    const liveSeconds =
      isLiveToday &&
      (!activeFocusSession.pomodoroPhase ||
        activeFocusSession.pomodoroPhase === "focus")
        ? useFocusStore.getState().focusElapsedSeconds
        : 0;

    const todayFocusedSeconds = completedTodaySeconds + liveSeconds;

    return {
      activeTasksCount,
      todayTasksCount,
      overdueCount,
      activeFocusSession,
      todayFocusedSeconds,
    };
  },
};

// 8 primary atomic tools + aliases for complete compatibility
export const flowTaskWebMcpTools: WebMcpToolDefinition[] = [
  createTaskTool as unknown as WebMcpToolDefinition,
  updateTaskTool as unknown as WebMcpToolDefinition,
  completeTaskTool as unknown as WebMcpToolDefinition,
  listTasksTool as unknown as WebMcpToolDefinition,
  startFocusSessionTool as unknown as WebMcpToolDefinition,
  stopFocusSessionTool as unknown as WebMcpToolDefinition,
  scheduleTimelineBlockTool as unknown as WebMcpToolDefinition,
  getDailySummaryTool as unknown as WebMcpToolDefinition,
  decomposeTaskTool as unknown as WebMcpToolDefinition,
  listTodayTasksTool as unknown as WebMcpToolDefinition,
  getWorkspaceStatusTool as unknown as WebMcpToolDefinition,
];

export function getWebMcpTools(): WebMcpToolDefinition[] {
  return [...flowTaskWebMcpTools];
}

export async function executeWebMcpTool(
  name: string,
  args: unknown = {},
): Promise<unknown> {
  const tool = flowTaskWebMcpTools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(
      `WebMCP tool not found: "${name}". Available tools: ${flowTaskWebMcpTools.map((t) => t.name).join(", ")}`,
    );
  }
  return tool.execute((args || {}) as Record<string, unknown>);
}

export function unregisterWebMcpTools(): void {
  activeRegistration = null;
  if (typeof window !== "undefined") {
    delete window.__FLOWTASK_MCP__;
  }
  activeRegistrationStore = null;
  activeStoreGetter = null;
  if (activeAbortCleanup) {
    activeAbortCleanup();
    activeAbortCleanup = null;
  }
}

export function registerWebMcpTools(
  options?: WebMcpRegistrationOptions,
): () => void {
  activeAbortCleanup?.();
  activeAbortCleanup = null;
  const registration = Symbol("workspace-tools");
  activeRegistration = registration;
  // If signal already aborted, perform clean unregistration and return no-op
  if (options?.signal?.aborted) {
    unregisterWebMcpTools();
    options.onUnregistered?.();
    return () => {};
  }

  // Set active store references if provided
  if (options?.store) {
    activeRegistrationStore = options.store;
  }
  if (options?.getStore) {
    activeRegistrationStore = null;
    activeStoreGetter = options.getStore;
  }

  const call = async (name: string, args: unknown) => {
    if (activeRegistration !== registration || options?.signal?.aborted)
      throw new Error(
        "These assistant tools are no longer connected to this workspace.",
      );
    return executeWebMcpTool(name, args);
  };

  const bridge: GlobalWebMcpBridge = {
    version: "1.0.0",
    tools: flowTaskWebMcpTools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
      inputSchema: t.inputSchema,
    })),
    callTool: call,
    executeTool: call,
    getTools: () => getWebMcpTools(),
    unregister: () => {
      if (activeRegistration === registration) unregisterWebMcpTools();
    },
  };

  if (typeof window !== "undefined") {
    window.__FLOWTASK_MCP__ = bridge;
  }

  options?.onRegistered?.();

  const cleanup = () => {
    if (activeRegistration !== registration) return;
    unregisterWebMcpTools();
    options?.onUnregistered?.();
  };

  if (options?.signal) {
    const handleAbort = () => {
      cleanup();
    };
    options.signal.addEventListener("abort", handleAbort, { once: true });
    activeAbortCleanup = () => {
      options.signal?.removeEventListener("abort", handleAbort);
    };
  }

  return cleanup;
}

export interface WebMcpService {
  registerTools: (signal?: AbortSignal) => void;
  unregisterTools: () => void;
  getTools: () => WebMcpToolDefinition[];
  executeTool: (name: string, params: unknown) => Promise<unknown>;
}

export const webMcpService: WebMcpService = {
  registerTools: (signal?: AbortSignal) => {
    registerWebMcpTools({ signal });
  },
  unregisterTools: () => {
    unregisterWebMcpTools();
  },
  getTools: () => getWebMcpTools(),
  executeTool: (name: string, params: unknown) =>
    executeWebMcpTool(name, params),
};
