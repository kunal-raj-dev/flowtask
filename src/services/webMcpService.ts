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
  },
  required: ["title"],
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

    const result = commandService.createTask(
      currentTasks,
      params.title.trim(),
      overrides,
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

export const flowTaskWebMcpTools: WebMcpToolDefinition[] = [
  createTaskTool as unknown as WebMcpToolDefinition,
  listTodayTasksTool as unknown as WebMcpToolDefinition,
  startFocusSessionTool as unknown as WebMcpToolDefinition,
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
