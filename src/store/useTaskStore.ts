import { recoveryService } from '../services/recoveryService';
import { create } from 'zustand';
import type {
  Task,
  SubTask,
  Project,
  CalendarEvent,
  SmartFilterView,
  SmartFilterPredicate,
} from '../types/task';
import type { WorkspaceDashboard } from '../types/dashboard';
import type { UserWorkflowSettings } from '../types/settings';
import { WorkspaceStore, type StoreSnapshot } from '../services/workspaceStore';
import { commandService, type CommandResult } from '../services/commandService';
import { DEFAULT_WORKFLOW_SETTINGS } from '../types/settings';
import { BUILT_IN_SMART_VIEWS } from '../utils/smartViewUtils';
import { getTodayStr } from '../hooks/useCurrentDate';
import { audioEngine } from '../utils/audioEngine';
import { isActiveTask, isFocusTask } from '../utils/taskSelectors';
import { useUIStore } from './useUIStore';
import { useModalStore } from './useModalStore';
import { downloadJson } from '../utils/fileExporter';
import { createWorkspaceBackup, validateBackupExtras, mergeBackupExtras, type BackupExtras } from '../utils/workspaceBackup';
import { validateWorkspaceData } from '../utils/workspaceValidation';
import { dbService, emptyWorkspace } from '../services/dbService';
import { writeFocusCheckpoint } from '../services/focusCheckpoint';
import { convertSessionToTask, type ParsedSession } from '../utils/sessionParser';

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'local' | 'conflict' | 'error';

export interface TaskState {
  workspaceId: string;
  tasks: Task[];
  projects: Project[];
  customViews: SmartFilterView[];
  dashboards: WorkspaceDashboard[];
  preferences: Record<string, unknown>;
  settings: UserWorkflowSettings;
  syncStatus: SyncStatus;
  lastSyncedAt: Date | null;
  isReady: boolean;
  calendarEvents: CalendarEvent[];
  calendarIcsUrl: string;

  // Store binding & subscription
  store: WorkspaceStore | null;
  setWorkspaceStore: (store: WorkspaceStore) => void;
  syncFromSnapshot: (snapshot: StoreSnapshot) => void;

  // Task Actions (Deterministic)
  addTask: (input: string, explicitOverrides?: Partial<Task>) => Task;
  addMultipleTasks: (lines: string[], overrides?: Partial<Task>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  permanentDeleteTask: (id: string) => void;
  archiveTask: (id: string) => void;
  restoreTask: (id: string) => void;
  toggleTaskStatus: (id: string) => void;
  toggleTaskPinToday: (id: string) => boolean;

  // Subtask Actions
  addSubTask: (taskId: string, title: string, estimatedMinutes?: number, extra?: Partial<SubTask>) => void;
  addSubTasks: (taskId: string, newSubs: Array<{ title: string; estimatedMinutes?: number; extra?: Partial<SubTask> }>) => void;
  updateSubTask: (taskId: string, subtaskId: string, updates: Partial<SubTask>) => void;
  deleteSubTask: (taskId: string, subtaskId: string) => void;
  moveSubTask: (taskId: string, subtaskId: string, direction: 'up' | 'down') => void;
  promoteSubTaskToTask: (taskId: string, subtaskId: string) => void;
  toggleSubTask: (taskId: string, subtaskId: string) => void;

  // Batch & Advanced
  duplicateTask: (taskId: string) => Task | null;
  mergeTasks: (targetId: string, sourceId: string) => void;
  batchUpdateTasks: (ids: string[], updates: Partial<Task>) => void;
  batchDeleteTasks: (ids: string[]) => void;
  batchToggleStatus: (ids: string[]) => void;
  applyTaskChanges: (changes: Array<{ id: string; updates: Partial<Task> }>, description?: string) => void;
  bulkRescheduleOverdue: (action: 'today' | 'someday' | 'dismiss') => void;

  // Projects & Dashboards
  addProject: (name: string, color: string, icon?: string) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string, reassignTo?: string) => void;
  archiveProject: (id: string) => void;
  updateDashboards: (dashboards: WorkspaceDashboard[], newActiveId?: string) => void;

  // Smart Views
  addSmartView: (name: string, icon: string, color: string, predicate: SmartFilterPredicate) => SmartFilterView;
  deleteSmartView: (id: string) => void;

  // Settings & Preferences
  updateSettings: (updates: Partial<UserWorkflowSettings>) => void;
  resetSettings: () => void;
  setWorkspacePreference: (key: string, value: unknown) => void;

  // Persistence & Backup
  downloadWorkspaceBackup: () => void;
  resolveSyncConflict: (choice: 'local' | 'remote') => Promise<void>;
  importLocalWorkspace: () => Promise<void>;
  importTasks: (tasks: Task[], projects?: Project[], replace?: boolean, extras?: BackupExtras) => Promise<void>;
  forceSyncToCloud: () => Promise<void>;

  // Calendar
  setCalendarIcsUrl: (url: string) => void;
  importCalendarFile: (file: File) => Promise<number>;
  removeImportedCalendar: () => void;
  refreshCalendarEvents: (date?: string) => Promise<void>;

  // Undo / Redo
  undoLastAction: () => void;
  redoLastAction: () => void;

  // Study Sessions
  addStudySessions: (sessions: ParsedSession[], dateStr?: string, projectId?: string) => Task[];
}

function execute(
  store: WorkspaceStore | null,
  tasks: Task[],
  factory: (list: Task[]) => CommandResult,
  set: (partial: Partial<TaskState> | ((state: TaskState) => Partial<TaskState>)) => void
): CommandResult {
  if (store) {
    const currentTasks = store.getSnapshot().record.tasks;
    const result = factory(currentTasks);
    store.run(result.description, (r) => ({ ...r, tasks: result.updatedTasks }), true, { checkpoint: result.checkpoint });
    return result;
  }
  const result = factory(tasks);
  set({ tasks: result.updatedTasks });
  return result;
}

const defaultLocalWorkspace = emptyWorkspace('local');
let calendarRequestSequence = 0;

export const useTaskStore = create<TaskState>((set, get) => ({
  workspaceId: 'local',
  tasks: defaultLocalWorkspace.tasks,
  projects: defaultLocalWorkspace.projects,
  customViews: defaultLocalWorkspace.customViews,
  dashboards: defaultLocalWorkspace.dashboards || [],
  preferences: defaultLocalWorkspace.preferences,
  settings: DEFAULT_WORKFLOW_SETTINGS,
  syncStatus: 'local',
  lastSyncedAt: null,
  isReady: false,
  calendarEvents: [],
  calendarIcsUrl: '',
  store: null,

  setWorkspaceStore: (store: WorkspaceStore) => {
    if (get().store !== store) calendarRequestSequence++;
    set({ store, workspaceId: store.id, calendarEvents: [], lastSyncedAt: null });
    const snap = store.getSnapshot();
    if (snap.ready) {
      get().syncFromSnapshot(snap);
    }
  },

  syncFromSnapshot: (snapshot: StoreSnapshot) => {
    const { record, ready, sync } = snapshot;
    const prefSettings = (record.preferences.settings as Partial<UserWorkflowSettings>) || {};
    const mergedSettings: UserWorkflowSettings = get().preferences.settings === record.preferences.settings ? get().settings : {
      ...DEFAULT_WORKFLOW_SETTINGS,
      ...prefSettings,
    };
    const calendarUrl = (record.preferences.calendarUrl as string) || '';

    set({
      workspaceId: get().store?.id || get().workspaceId,
      tasks: record.tasks,
      projects: record.projects,
      customViews: record.customViews || [],
      dashboards: record.dashboards || [],
      preferences: record.preferences,
      settings: mergedSettings,
      syncStatus: sync,
      lastSyncedAt: sync === 'synced' ? new Date(record.updatedAt) : get().lastSyncedAt,
      isReady: ready,
      calendarIcsUrl: calendarUrl,
    });
  },

  addTask: (input: string, overrides?: Partial<Task>): Task => {
    const { store, tasks, projects, settings } = get();
    const currentTasks = store ? store.getSnapshot().record.tasks : tasks;
    const currentProjects = store ? store.getSnapshot().record.projects : projects;
    const activeView = useUIStore.getState().activeView;
    const todayStr = getTodayStr();

    const result = commandService.createTask(currentTasks, input, overrides, {
      defaultPriority: settings.defaultTaskPriority,
      enableParsing: settings.enableSmartSyntaxParsing,
      projects: currentProjects,
      defaultPlannedDate: activeView === 'today' ? todayStr : undefined,
      defaultProjectId: activeView.startsWith('project:') ? activeView.slice(8) : 'inbox',
    });

    if (!currentProjects.some((p) => p.id === result.createdTask.projectId)) {
      result.createdTask.projectId = 'inbox';
    }

    if (store) {
      store.run(result.description, (r) => ({ ...r, tasks: result.updatedTasks }));
    } else {
      set({ tasks: result.updatedTasks });
    }

    return result.createdTask;
  },

  addMultipleTasks: (lines: string[], overrides?: Partial<Task>) => {
    const { store, settings } = get();
    const activeView = useUIStore.getState().activeView;
    const todayStr = getTodayStr();

    if (store) {
      store.run('Add multiple tasks', (r) => ({
        ...r,
        tasks: lines
          .map((l) => l.trim())
          .filter(Boolean)
          .reduce(
            (list, line) =>
              commandService.createTask(list, line, overrides, {
                defaultProjectId: activeView.startsWith('project:') ? activeView.slice(8) : 'inbox',
                defaultPriority: settings.defaultTaskPriority,
                enableParsing: settings.enableSmartSyntaxParsing,
                projects: r.projects,
                defaultPlannedDate: activeView === 'today' ? todayStr : undefined,
              }).updatedTasks,
            r.tasks
          ),
      }));
    } else {
      set((s) => ({
        tasks: lines
          .map((l) => l.trim())
          .filter(Boolean)
          .reduce(
            (list, line) =>
              commandService.createTask(list, line, overrides, {
                defaultProjectId: activeView.startsWith('project:') ? activeView.slice(8) : 'inbox',
                defaultPriority: settings.defaultTaskPriority,
                enableParsing: settings.enableSmartSyntaxParsing,
                projects: s.projects,
                defaultPlannedDate: activeView === 'today' ? todayStr : undefined,
              }).updatedTasks,
            s.tasks
          ),
      }));
    }
  },

  updateTask: (id: string, updates: Partial<Task>) => {
    const { store, tasks } = get();
    execute(store, tasks, (list) => commandService.updateTask(list, id, updates), set);
  },

  deleteTask: (id: string) => {
    const { store, tasks, undoLastAction } = get();
    execute(store, tasks, (list) => commandService.deleteTask(list, id), set);
    useUIStore.getState().showToast('Task moved to Trash', 'Undo', undoLastAction);
  },

  permanentDeleteTask: (id: string) => {
    const { store, tasks } = get();
    execute(store, tasks, (list) => commandService.permanentDeleteTask(list, id), set);
  },

  archiveTask: (id: string) => {
    const { store, tasks, undoLastAction } = get();
    execute(store, tasks, (list) => commandService.archiveTask(list, id), set);
    useUIStore.getState().showToast('Task archived', 'Undo', undoLastAction);
  },

  restoreTask: (id: string) => {
    const { store, tasks } = get();
    execute(store, tasks, (list) => commandService.restoreTask(list, id), set);
  },

  toggleTaskStatus: (id: string) => {
    const { store, tasks } = get();
    const currentTasks = store ? store.getSnapshot().record.tasks : tasks;
    const task = currentTasks.find((t) => t.id === id);
    const isCompleting = task ? task.status !== 'done' : true;

    execute(store, tasks, (list) => commandService.toggleTaskStatus(list, id), set);

    if (isCompleting) {
      audioEngine.playTaskComplete();
    } else {
      audioEngine.playTaskUncheckSound();
    }
  },

  toggleTaskPinToday: (id: string) => {
    const { store, tasks, updateTask } = get();
    const currentTasks = store ? store.getSnapshot().record.tasks : tasks;
    const task = currentTasks.find((t) => t.id === id);
    if (!task || !isActiveTask(task)) return false;

    const todayStr = getTodayStr();
    const pinned = isFocusTask(task, todayStr);
    if (!pinned && currentTasks.filter((t) => isFocusTask(t, todayStr)).length >= 3) {
      useUIStore.getState().showToast('Your Top 3 is full. Unpin a task first.');
      return false;
    }

    updateTask(id, {
      isPinnedToday: !pinned,
      topThreeDate: pinned ? undefined : todayStr,
      plannedDate: pinned ? task.plannedDate : todayStr,
    });
    return true;
  },

  addSubTask: (taskId: string, title: string, estimatedMinutes?: number, extra?: Partial<SubTask>) => {
    const { store, tasks, updateTask } = get();
    const currentTasks = store ? store.getSnapshot().record.tasks : tasks;
    const task = currentTasks.find((t) => t.id === taskId);
    if (!task) return;
    const newSub: SubTask = {
      ...extra,
      id: crypto.randomUUID(),
      title: title.trim(),
      estimatedMinutes,
      completed: false,
    };
    updateTask(taskId, { subtasks: [...task.subtasks, newSub] });
  },

  addSubTasks: (taskId: string, newSubs: Array<{ title: string; estimatedMinutes?: number; extra?: Partial<SubTask> }>) => {
    const { store, tasks, updateTask } = get();
    const currentTasks = store ? store.getSnapshot().record.tasks : tasks;
    const task = currentTasks.find((t) => t.id === taskId);
    if (!task) return;
    const created = newSubs.map((s) => ({
      ...s.extra,
      id: crypto.randomUUID(),
      title: s.title.trim(),
      estimatedMinutes: s.estimatedMinutes,
      completed: false,
    }));
    updateTask(taskId, { subtasks: [...task.subtasks, ...created] });
  },

  updateSubTask: (taskId: string, subtaskId: string, updates: Partial<SubTask>) => {
    const { store, tasks, updateTask } = get();
    const currentTasks = store ? store.getSnapshot().record.tasks : tasks;
    const task = currentTasks.find((t) => t.id === taskId);
    if (!task) return;
    updateTask(taskId, {
      subtasks: task.subtasks.map((s) => (s.id === subtaskId ? { ...s, ...updates, id: s.id } : s)),
    });
  },

  deleteSubTask: (taskId: string, subtaskId: string) => {
    const { store, tasks, updateTask } = get();
    const currentTasks = store ? store.getSnapshot().record.tasks : tasks;
    const task = currentTasks.find((t) => t.id === taskId);
    if (!task) return;
    updateTask(taskId, {
      subtasks: task.subtasks.filter((s) => s.id !== subtaskId),
    });
  },

  moveSubTask: (taskId: string, subtaskId: string, direction: 'up' | 'down') => {
    const { store, tasks, updateTask } = get();
    const currentTasks = store ? store.getSnapshot().record.tasks : tasks;
    const task = currentTasks.find((t) => t.id === taskId);
    if (!task) return;
    const index = task.subtasks.findIndex((s) => s.id === subtaskId);
    const target = index + (direction === 'up' ? -1 : 1);
    if (index < 0 || target < 0 || target >= task.subtasks.length) return;
    const next = [...task.subtasks];
    [next[index], next[target]] = [next[target], next[index]];
    updateTask(taskId, { subtasks: next });
  },

  promoteSubTaskToTask: (taskId: string, subtaskId: string) => {
    const { store } = get();
    if (store) {
      store.run('Promote subtask', (r) => {
        const parent = r.tasks.find((t) => t.id === taskId);
        const sub = parent?.subtasks.find((s) => s.id === subtaskId);
        if (!parent || !sub) return r;
        const list = r.tasks.map((t) => (t.id === taskId ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) } : t));
        return {
          ...r,
          tasks: commandService.createTask(list, sub.title, {
            projectId: parent.projectId,
            plannedDate: parent.plannedDate,
            priority: parent.priority,
            estimatedMinutes: sub.estimatedMinutes,
          }).updatedTasks,
        };
      });
    }
  },

  toggleSubTask: (taskId: string, subtaskId: string) => {
    const { store, tasks, updateTask } = get();
    const currentTasks = store ? store.getSnapshot().record.tasks : tasks;
    const task = currentTasks.find((t) => t.id === taskId);
    if (!task) return;
    const sub = task.subtasks.find((s) => s.id === subtaskId);
    const willBeCompleted = sub ? !sub.completed : true;

    updateTask(taskId, {
      subtasks: task.subtasks.map((s) => (s.id === subtaskId ? { ...s, completed: !s.completed } : s)),
    });
    audioEngine.playSubtaskToggle(willBeCompleted);
  },

  duplicateTask: (taskId: string): Task | null => {
    const { store, tasks, addTask } = get();
    const currentTasks = store ? store.getSnapshot().record.tasks : tasks;
    const task = currentTasks.find((t) => t.id === taskId);
    if (!task) return null;
    return addTask(`${task.title} (Copy)`, {
      ...task,
      title: `${task.title} (Copy)`,
      isPinnedToday: false,
      topThreeDate: undefined,
      subtasks: task.subtasks.map((s) => ({ ...s, id: crypto.randomUUID(), completed: false })),
    });
  },

  mergeTasks: (targetId: string, sourceId: string) => {
    const { store, tasks } = get();
    execute(store, tasks, (list) => commandService.mergeTasks(list, targetId, sourceId), set);
  },

  batchUpdateTasks: (ids: string[], updates: Partial<Task>) => {
    const { store, tasks } = get();
    execute(store, tasks, (list) => commandService.batchUpdate(list, ids, updates), set);
  },

  batchDeleteTasks: (ids: string[]) => {
    const { store, tasks, undoLastAction } = get();
    execute(store, tasks, (list) => commandService.batchDelete(list, ids), set);
    useUIStore.getState().clearTaskSelection();
    useUIStore.getState().showToast('Tasks moved to Trash', 'Undo', undoLastAction);
  },

  batchToggleStatus: (ids: string[]) => {
    const { store } = get();
    if (store) {
      store.run('Change task completion', (r) => {
        const allDone = r.tasks.filter((t) => ids.includes(t.id)).every((t) => t.status === 'done');
        return {
          ...r,
          tasks: ids.reduce((list, id) => {
            const task = list.find((t) => t.id === id);
            return task && (task.status === 'done') === allDone
              ? commandService.toggleTaskStatus(list, id).updatedTasks
              : list;
          }, r.tasks),
        };
      });
    }
  },

  applyTaskChanges: (changes: Array<{ id: string; updates: Partial<Task> }>, description = 'Update tasks') => {
    const { store } = get();
    if (store) {
      store.run(description, (r) => ({
        ...r,
        tasks: r.tasks.map((task) => {
          const change = changes.find((c) => c.id === task.id);
          return change ? { ...task, ...change.updates } : task;
        }),
      }));
    }
  },

  bulkRescheduleOverdue: (action: 'today' | 'someday' | 'dismiss') => {
    const { store, tasks, batchUpdateTasks } = get();
    const todayStr = getTodayStr();
    if (action === 'dismiss') {
      useModalStore.getState().setIsTriageDismissed(true);
      return;
    }
    const currentTasks = store ? store.getSnapshot().record.tasks : tasks;
    const overdueIds = currentTasks
      .filter((t) => isActiveTask(t) && t.dueDate && t.dueDate < todayStr)
      .map((t) => t.id);
    batchUpdateTasks(
      overdueIds,
      action === 'today' ? { plannedDate: todayStr, isSomeday: false } : { plannedDate: undefined, isSomeday: true }
    );
  },

  addProject: (name: string, color: string, icon?: string) => {
    if (!name.trim()) return;
    const { store } = get();
    const newProject: Project = {
      id: crypto.randomUUID(),
      name: name.trim(),
      color,
      icon,
      createdAt: Date.now(),
    };
    if (store) {
      store.run('Create project', (r) => ({
        ...r,
        projects: [...r.projects, newProject],
      }));
    } else {
      set((s) => ({ projects: [...s.projects, newProject] }));
    }
  },

  updateProject: (id: string, updates: Partial<Project>) => {
    const { store } = get();
    if (store) {
      store.run('Update project', (r) => ({
        ...r,
        projects: r.projects.map((p) => (p.id === id ? { ...p, ...updates, id } : p)),
      }));
    } else {
      set((s) => ({
        projects: s.projects.map((p) => (p.id === id ? { ...p, ...updates, id } : p)),
      }));
    }
  },

  deleteProject: (id: string, reassignToProjectId = 'inbox') => {
    const { store, projects } = get();
    const currentProjects = store ? store.getSnapshot().record.projects : projects;
    if (id === 'inbox' || id === reassignToProjectId || !currentProjects.some((p) => p.id === reassignToProjectId)) {
      return;
    }
    if (store) {
      store.run('Delete project and move its tasks', (r) => ({
        ...r,
        projects: r.projects.filter((p) => p.id !== id),
        tasks: r.tasks.map((t) => (t.projectId === id ? { ...t, projectId: reassignToProjectId, milestoneId: undefined } : t)),
      }), true, { checkpoint: true });
    }
  },

  archiveProject: (id: string) => {
    if (id !== 'inbox') {
      get().updateProject(id, { isArchived: true, archivedAt: Date.now() });
    }
  },

  updateDashboards: (nextDashboards: WorkspaceDashboard[], newActiveId?: string) => {
    const { store } = get();
    if (store) {
      store.run('Update dashboards', (r) => ({
        ...r,
        dashboards: nextDashboards,
        preferences: newActiveId ? { ...r.preferences, activeDashboardId: newActiveId } : r.preferences,
      }));
    } else {
      set({ dashboards: nextDashboards });
    }
  },

  addSmartView: (name: string, icon: string, color: string, predicate: SmartFilterPredicate) => {
    const view: SmartFilterView = { id: crypto.randomUUID(), name, icon, color, predicate };
    const { store } = get();
    if (store) {
      store.run('Save view', (r) => ({ ...r, customViews: [...r.customViews, view] }), false);
    } else {
      set((s) => ({ customViews: [...s.customViews, view] }));
    }
    return view;
  },

  deleteSmartView: (id: string) => {
    const { store } = get();
    if (store) {
      store.run('Remove saved view', (r) => ({ ...r, customViews: r.customViews.filter((v) => v.id !== id) }), false);
    } else {
      set((s) => ({ customViews: s.customViews.filter((v) => v.id !== id) }));
    }
  },

  updateSettings: (updates: Partial<UserWorkflowSettings>) => {
    const nextSettings = { ...get().settings, ...updates };
    get().setWorkspacePreference('settings', nextSettings);
    set({ settings: nextSettings });
  },

  resetSettings: () => {
    get().setWorkspacePreference('settings', DEFAULT_WORKFLOW_SETTINGS);
    set({ settings: DEFAULT_WORKFLOW_SETTINGS });
  },

  setWorkspacePreference: (key: string, value: unknown) => {
    const { store, workspaceId } = get();
    const checkpointAt =
      key === 'focusSession' ? writeFocusCheckpoint(workspaceId, value as import('../types/task').FocusSession | null) : undefined;
    if (store) {
      store.run(
        'Update workspace preference',
        (r) => ({
          ...r,
          preferences: {
            ...r.preferences,
            [key]: value,
            ...(checkpointAt ? { focusCheckpointAt: checkpointAt } : {}),
          },
        }),
        false
      );
    } else {
      set((s) => ({
        preferences: {
          ...s.preferences,
          [key]: value,
        },
      }));
    }
  },

  downloadWorkspaceBackup: () => {
    const { store, workspaceId, tasks, projects, preferences } = get();
    const before = store ? store.getSnapshot().record : { tasks, projects, preferences };
    const exportedAt = Date.now();
    const withExportDate = {
      ...before,
      preferences: { ...before.preferences, _lastBackupAt: exportedAt },
    };
    const todayStr = getTodayStr();
    downloadJson(createWorkspaceBackup(withExportDate as any), `flowtask-${workspaceId}-${todayStr}.json`);
    if (store) {
      store.run('Record backup export', (r) => ({ ...r, preferences: { ...r.preferences, _lastBackupAt: exportedAt } }), false);
    }
  },

  resolveSyncConflict: async (choice: 'local' | 'remote') => {
    const { store } = get();
    if (!store) return;
    try {
      await store.resolveConflict(choice);
    } catch (error) {
      useUIStore.getState().showToast((error as Error).message);
    }
  },

  importLocalWorkspace: async () => {
    const local = await dbService.loadWorkspace('local');
    if (local) {
      await get().importTasks(local.tasks, local.projects);
    }
  },

  importTasks: async (importedTasks: Task[], importedProjects?: Project[], replace = false, extras?: BackupExtras) => {
    const { store, workspaceId, tasks, projects } = get();
    const beforeRecord = store?.getSnapshot().record;
    const beforeTasks = beforeRecord ? beforeRecord.tasks : tasks;
    const beforeProjects = store ? store.getSnapshot().record.projects : projects;

    const nextProjects = replace
      ? importedProjects || beforeProjects
      : [...beforeProjects, ...(importedProjects || []).filter((p) => !beforeProjects.some((old) => old.id === p.id))];
    const nextTasks = replace
      ? importedTasks
      : [...beforeTasks, ...importedTasks.filter((t) => !beforeTasks.some((old) => old.id === t.id))];

    const validated = validateWorkspaceData(nextTasks, nextProjects);
    const validatedExtras = extras ? validateBackupExtras(extras) : undefined;

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`flowtask_pre_import_${workspaceId}`, JSON.stringify(store ? store.getSnapshot().record : { tasks, projects }));
    }

    if (store) {
      if (replace && typeof indexedDB !== 'undefined') await recoveryService.create(workspaceId, beforeRecord!, 'pre_batch', 'Before replacing workspace');
      if (get().store !== store || store.getSnapshot().record !== beforeRecord) throw new Error('The workspace changed while preparing the import. Review it and retry.');
      const restoreCheckpoint = replace && validatedExtras ? writeFocusCheckpoint(workspaceId, null) : 0;
      store.run(replace ? 'Restore backup' : 'Import tasks', (r) => {
        const restored = {
          ...r,
          ...validated,
          ...(validatedExtras ? mergeBackupExtras(r, validatedExtras, replace) : {}),
        };
        return restoreCheckpoint
          ? { ...restored, preferences: { ...restored.preferences, focusSession: null, focusCheckpointAt: restoreCheckpoint } }
          : restored;
      });
      await store.settled();
    } else {
      set({ tasks: validated.tasks, projects: validated.projects });
    }

    useUIStore.getState().showToast(`Saved ${importedTasks.length} imported tasks`);
  },

  forceSyncToCloud: async () => {
    const { store } = get();
    if (!store || !store.connected) {
      useModalStore.getState().setIsAuthModalOpen(true);
      useUIStore.getState().showToast('Sign in with Google to enable Cloud Sync across devices');
      return;
    }
    useUIStore.getState().showToast('Syncing changes with cloud...');
    await store.retry();
  },

  setCalendarIcsUrl: (url: string) => {
    get().setWorkspacePreference('calendarUrl', url);
    set({ calendarIcsUrl: url });
  },

  importCalendarFile: async (file: File) => {
    const { store, workspaceId } = get();
    if (file.size > 2 * 1024 * 1024) throw new Error('Choose a calendar smaller than 2 MB.');
    const content = await file.text();
    if (!content.includes('BEGIN:VCALENDAR') || !content.includes('END:VCALENDAR')) {
      throw new Error('Choose a valid .ics calendar file.');
    }
    const todayStr = getTodayStr();
    const { parseICSFeed } = await import('../services/calendarService');
    if (get().store !== store || get().workspaceId !== workspaceId) throw new Error('Your workspace changed. Choose the calendar file again.');
    const events = parseICSFeed(content, todayStr);
    get().setWorkspacePreference('_calendarFile', { name: file.name, content });
    return events.length;
  },

  removeImportedCalendar: () => {
    get().setWorkspacePreference('_calendarFile', undefined);
  },

  refreshCalendarEvents: async (date = getTodayStr()) => {
    const request = ++calendarRequestSequence;
    const { preferences, calendarIcsUrl, store, workspaceId } = get();
    const calendarFile = preferences._calendarFile as { name: string; content: string } | undefined;
    const isCurrent = () => request === calendarRequestSequence && get().store === store &&
      get().workspaceId === workspaceId && get().calendarIcsUrl === calendarIcsUrl &&
      get().preferences._calendarFile === calendarFile;
    let imported: CalendarEvent[] = [];

    if (!calendarIcsUrl.trim() && !calendarFile) {
      set({ calendarEvents: [] });
      return;
    }

    try {
      const { parseICSFeed, fetchICSFeed } = await import('../services/calendarService');
      if (!isCurrent()) return;
      imported = calendarFile ? parseICSFeed(calendarFile.content, date).map(event => ({ ...event, id: `file:${event.id}` })) : [];
      const feed = calendarIcsUrl.trim() ? await fetchICSFeed(calendarIcsUrl, date) : [];
      if (!isCurrent()) return;
      set({ calendarEvents: [...imported, ...feed.map((event) => ({ ...event, id: `feed:${event.id}` }))] });
    } catch (error) {
      if (!isCurrent()) return;
      set({ calendarEvents: imported });
      useUIStore.getState().showToast(`Calendar could not refresh: ${(error as Error).message}`);
    }
  },

  undoLastAction: () => {
    const { store } = get();
    if (store) {
      try {
        store.undo();
      } catch (error) {
        useUIStore.getState().showToast(String((error as Error).message));
      }
    }
  },

  redoLastAction: () => {
    const { store } = get();
    if (store) {
      try {
        store.redo();
        useUIStore.getState().showToast('Action redone');
      } catch (error) {
        useUIStore.getState().showToast(String((error as Error).message));
      }
    }
  },

  addStudySessions: (sessions: ParsedSession[], date = getTodayStr(), projectId = 'inbox') => {
    const created = sessions.map((s) => convertSessionToTask(s, date, projectId));
    const { store } = get();
    if (store) {
      store.run('Add study sessions', (r) => ({ ...r, tasks: [...created, ...r.tasks] }));
    } else {
      set((s) => ({ tasks: [...created, ...s.tasks] }));
    }
    return created;
  },
}));

// Convenience selectors
export const useTasks = () => useTaskStore((s) => s.tasks);
export const useProjects = () => useTaskStore((s) => s.projects);
export const useSmartViews = () => {
  const custom = useTaskStore((s) => s.customViews);
  return [...BUILT_IN_SMART_VIEWS, ...custom];
};
export const useDashboards = () => useTaskStore((s) => s.dashboards);
