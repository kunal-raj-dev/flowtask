import { SyncFeedback } from '../components/workflow/SyncFeedback';
import { WorkspaceReadOnly } from '../components/workflow/WorkspaceReadOnly';
import { ownWorkspace } from '../services/workspaceOwnership';
import { DeviceImportPrompt } from '../components/workflow/DeviceImportPrompt';
import { WorkspaceRecovery } from '../components/workflow/WorkspaceRecovery';
import { startWorkspaceFocus, finishWorkspaceFocus, changeWorkspaceFocusState } from '../services/focusLifecycle';
import { commandService } from '../services/commandService';
import { validateWorkspaceData } from '../utils/workspaceValidation';
import { normalizeAppearance } from '../utils/appearance';
import { THEMES, type AppTheme } from '../utils/themeRegistry';

import { type BackupExtras } from '../utils/workspaceBackup';
import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react';
import type { Task, SubTask, Project, ViewId, Priority, CalendarEvent, InterruptionStash, SmartFilterView, SmartFilterPredicate, FocusSession, FocusSessionMode, FocusLog } from '../types/task';
import type { WorkspaceDashboard } from '../types/dashboard';
import { getTodayStr } from '../hooks/useCurrentDate';
import { formatLocalDate } from '../utils/nlpParser';
import { BUILT_IN_SMART_VIEWS } from '../utils/smartViewUtils';
import { type SoundProfile } from '../utils/audioEngine';
import { useAuth } from './AuthContext';
import { type ParsedSession } from '../utils/sessionParser';
import { WorkspaceStore, WorkspaceStoreContext } from '../services/workspaceStore';
import { registerWebMcpTools } from '../services/webMcpService';
import { DEFAULT_WORKFLOW_SETTINGS, type UserWorkflowSettings } from '../types/settings';
import { isActiveTask } from '../utils/taskSelectors';

import { useUIStore, useFocusStore, useTaskStore, useModalStore } from '../store';

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'local' | 'conflict' | 'error';
export type { AppTheme } from '../utils/themeRegistry';

export {
  useSound,
  useActiveView,
  useSearchFilter,
  useTaskSelection,
  useToast,
  useModals,
  useFocus,
  useIsTaskTimerActive,
} from '../store';

export {
  WorkspaceStoreContext,
  useWorkspaceSelector,
  useWorkspaceTasks,
  useWorkspaceProjects,
  useActiveTask,
} from '../services/workspaceStore';

export interface TaskContextType {
  workspaceId: string;
  workspacePreferences: Record<string, unknown>;
  setWorkspacePreference: (key: string, value: unknown) => void;
  downloadWorkspaceBackup: () => void;
  resolveSyncConflict: (choice: 'local' | 'remote') => Promise<void>;
  importLocalWorkspace: () => Promise<void>;

  tasks: Task[];
  projects: Project[];
  activeView: ViewId;
  viewLayout: 'list' | 'kanban' | 'matrix';
  selectedTaskId: string | null;
  searchQuery: string;
  priorityFilter: Priority | 'all';
  quickWinsOnly: boolean;
  theme: AppTheme;
  soundEnabled: boolean;
  soundProfile: SoundProfile;
  overdueTasks: Task[];
  isTriageDismissed: boolean;
  toast: { message: string; actionLabel?: string; onAction?: () => void } | null;

  // User Workflow Settings & Preferences
  settings: UserWorkflowSettings;
  updateSettings: (updates: Partial<UserWorkflowSettings>) => void;
  resetSettings: () => void;

  // Cloud Sync & Auth Modal
  syncStatus: SyncStatus;
  lastSyncedAt: Date | null;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  forceSyncToCloud: () => Promise<void>;

  // Dashboards & Personal Workspace Canvas
  dashboards: WorkspaceDashboard[];
  updateDashboards: (dashboards: WorkspaceDashboard[], newActiveId?: string) => void;

  // Focus Session Engine (Mini-player, Study Sprints, & Timers)
  focusSession: FocusSession | null;
  focusElapsedSeconds: number;
  focusLogs: FocusLog[];
  totalFocusedTodaySeconds: number;
  startFocusSession: (
    mode: FocusSessionMode,
    taskId?: string | null,
    title?: string | null,
    targetSec?: number,
    subtaskId?: string | null,
    subtaskTitle?: string | null,
    pacingSec?: number
  ) => void;
  pauseFocusSession: () => void;
  resumeFocusSession: () => void;
  stopFocusSession: () => void;
  updateFocusSession: (updates: Partial<FocusSession>) => void;
  switchFocusSubtask: (subtaskId: string, subtaskTitle: string, targetSec: number) => void;
  logFocusSegment: (taskId: string | null, seconds: number, subtaskId?: string, subtaskTitle?: string) => void;

  // Backwards-compatible stopwatch hooks
  activeTimerTaskId: string | null;
  activeTimerSeconds: number;
  startTaskTimer: (taskId: string) => void;
  stopTaskTimer: () => void;
  toggleTaskTimer: (taskId: string) => void;

  // Multi-Select Batch Actions
  selectedTaskIds: string[];
  toggleTaskSelection: (taskId: string) => void;
  selectTask: (taskId: string) => void;
  deselectTask: (taskId: string) => void;
  selectAllTasks: (taskIds: string[]) => void;
  clearTaskSelection: () => void;
  applyTaskChanges: (changes: Array<{ id: string; updates: Partial<Task> }>, description?: string) => void;
  batchUpdateTasks: (taskIds: string[], updates: Partial<Task>) => void;
  batchDeleteTasks: (taskIds: string[]) => void;
  batchToggleStatus: (taskIds: string[]) => void;

  // Interruption Stash & Restore
  interruptionStash: InterruptionStash | null;
  isInterruptionModalOpen: boolean;
  setIsInterruptionModalOpen: (open: boolean) => void;
  stashActiveFocus: (overrideTask?: { id: string; title: string; projectId?: string }, overrideElapsed?: number) => void;
  restoreStashedFocus: () => void;
  clearInterruptionStash: () => void;

  // Subtask Power Tools
  promoteSubTaskToTask: (taskId: string, subtaskId: string) => void;
  moveSubTask: (taskId: string, subtaskId: string, direction: 'up' | 'down') => void;

  // Task Duplication & Merge
  duplicateTask: (taskId: string) => Task | null;
  mergeTasks: (targetTaskId: string, sourceTaskId: string) => void;

  // Quick Add Universal Composer
  isQuickAddOpen: boolean;
  setIsQuickAddOpen: (open: boolean) => void;
  quickAddDraft: string;
  setQuickAddDraft: (draft: string) => void;

  // Workflow Templates Modal
  isTemplatePickerOpen: boolean;
  setIsTemplatePickerOpen: (open: boolean) => void;

  // Weekly Review Modal
  isWeeklyReviewOpen: boolean;
  setIsWeeklyReviewOpen: (open: boolean) => void;

  // Calendar ICS Overlay
  calendarEvents: CalendarEvent[];
  importCalendarFile: (file: File) => Promise<number>;
  removeImportedCalendar: () => void;
  calendarIcsUrl: string;
  setCalendarIcsUrl: (url: string) => void;
  refreshCalendarEvents: (date?: string) => Promise<void>;

  // Evening Shutdown Ritual
  isEveningShutdownOpen: boolean;
  setIsEveningShutdownOpen: (open: boolean) => void;
  isShutdownDismissed: boolean;
  dismissShutdown: () => void;

  // Smart Views
  smartViews: SmartFilterView[];
  addSmartView: (name: string, icon: string, color: string, predicate: SmartFilterPredicate) => SmartFilterView;
  deleteSmartView: (id: string) => void;
  isSmartFilterModalOpen: boolean;
  setIsSmartFilterModalOpen: (open: boolean) => void;

  // Navigation & Preferences Actions
  setActiveView: (view: ViewId) => void;
  setViewLayout: (layout: 'list' | 'kanban' | 'matrix') => void;
  setSelectedTaskId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setPriorityFilter: (p: Priority | 'all') => void;
  setQuickWinsOnly: (enabled: boolean) => void;
  setTheme: (t: AppTheme) => void;
  toggleTheme: () => void;
  toggleSound: () => void;
  setSoundProfile: (p: SoundProfile) => void;

  // Core Task Actions (deterministic command driven)
  addTask: (input: string, explicitOverrides?: Partial<Task>) => Task;
  addMultipleTasks: (lines: string[], overrides?: Partial<Task>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  permanentDeleteTask: (id: string) => void;
  archiveTask: (id: string) => void;
  restoreTask: (id: string) => void;
  toggleTaskStatus: (id: string) => void;
  toggleTaskPinToday: (id: string) => boolean;
  toggleSubTask: (taskId: string, subtaskId: string) => void;
  addSubTask: (taskId: string, title: string, estimatedMinutes?: number, extra?: Partial<SubTask>) => void;
  addSubTasks: (taskId: string, newSubs: Array<{ title: string; estimatedMinutes?: number; extra?: Partial<SubTask> }>) => void;
  updateSubTask: (taskId: string, subtaskId: string, updates: Partial<SubTask>) => void;
  deleteSubTask: (taskId: string, subtaskId: string) => void;
  addStudySessions: (sessions: ParsedSession[], dateStr?: string, projectId?: string) => Task[];
  bulkRescheduleOverdue: (action: 'today' | 'someday' | 'dismiss') => void;
  undoLastAction: () => void;
  redoLastAction: () => void;

  // Project Actions
  addProject: (name: string, color: string, icon?: string) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string, reassignToProjectId?: string) => void;
  archiveProject: (id: string) => void;

  importTasks: (tasks: Task[], projects?: Project[], replace?: boolean, extras?: BackupExtras) => Promise<void>;
  showToast: (message: string, actionLabel?: string, onAction?: () => void) => void;
  clearToast: () => void;
}

export const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const TaskProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div role="status" className="p-10">Opening your workspace…</div>;
  return <WorkspaceProvider key={user?.uid || 'local'} workspaceId={user?.uid || 'local'} connected={!!user}>{children}</WorkspaceProvider>;
};

const WorkspaceProvider = ({ children, workspaceId, connected }: { children: ReactNode; workspaceId: string; connected: boolean }) => {
  const [store] = useState(() => new WorkspaceStore(workspaceId, connected));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const ownership = useRef<ReturnType<typeof ownWorkspace> | null>(null);

  // Bind store to useTaskStore
  useEffect(() => {
    useTaskStore.getState().setWorkspaceStore(store);
  }, [store]);

  useEffect(() => {
    if (snapshot.ready) {
      useTaskStore.getState().syncFromSnapshot(snapshot);
    }
  }, [snapshot]);

  useEffect(() => {
    if (!snapshot.ready) return;
    return registerWebMcpTools({ store });
  }, [store, snapshot.ready]);

  const { tasks, projects, preferences, customViews: customSmartViews, dashboards = [] } = snapshot.record;
  const current = () => store.getSnapshot().record;
  const syncStatus = snapshot.sync;
  const lastSyncedAt = useMemo(
    () => (snapshot.lastSyncedAt ? new Date(snapshot.lastSyncedAt) : null),
    [snapshot.lastSyncedAt]
  );

  // Granular UI store hooks
  const activeView = useUIStore((s) => s.activeView);
  const viewLayout = useUIStore((s) => s.viewLayout);
  const selectedTaskId = useUIStore((s) => s.selectedTaskId);
  const searchQuery = useUIStore((s) => s.searchQuery);
  const priorityFilter = useUIStore((s) => s.priorityFilter);
  const quickWinsOnly = useUIStore((s) => s.quickWinsOnly);
  const theme = useUIStore((s) => s.theme);
  const soundEnabled = useUIStore((s) => s.soundEnabled);
  const soundProfile = useUIStore((s) => s.soundProfile);
  const toast = useUIStore((s) => s.toast);
  const selectedTaskIds = useUIStore((s) => s.selectedTaskIds);

  const setActiveView = useUIStore((s) => s.setActiveView);
  const setViewLayout = useUIStore((s) => s.setViewLayout);
  const setSelectedTaskId = useUIStore((s) => s.setSelectedTaskId);
  const setSearchQuery = useUIStore((s) => s.setSearchQuery);
  const setPriorityFilter = useUIStore((s) => s.setPriorityFilter);
  const setQuickWinsOnly = useUIStore((s) => s.setQuickWinsOnly);
  const toggleSound = useUIStore((s) => s.toggleSound);
  const setSoundProfile = useUIStore((s) => s.setSoundProfile);
  const showToast = useUIStore((s) => s.showToast);
  const clearToast = useUIStore((s) => s.clearToast);
  const toggleTaskSelection = useUIStore((s) => s.toggleTaskSelection);
  const selectTask = useUIStore((s) => s.selectTask);
  const deselectTask = useUIStore((s) => s.deselectTask);
  const selectAllTasks = useUIStore((s) => s.selectAllTasks);
  const clearTaskSelection = useUIStore((s) => s.clearTaskSelection);

  // Granular Modal store hooks
  const isAuthModalOpen = useModalStore((s) => s.isAuthModalOpen);
  const isQuickAddOpen = useModalStore((s) => s.isQuickAddOpen);
  const quickAddDraft = useModalStore((s) => s.quickAddDraft);
  const isTemplatePickerOpen = useModalStore((s) => s.isTemplatePickerOpen);
  const isWeeklyReviewOpen = useModalStore((s) => s.isWeeklyReviewOpen);
  const isSmartFilterModalOpen = useModalStore((s) => s.isSmartFilterModalOpen);
  const isInterruptionModalOpen = useModalStore((s) => s.isInterruptionModalOpen);
  const isEveningShutdownOpen = useModalStore((s) => s.isEveningShutdownOpen);
  const isShutdownDismissed = useModalStore((s) => s.isShutdownDismissed);
  const isTriageDismissed = useModalStore((s) => s.isTriageDismissed);

  const setIsAuthModalOpen = useModalStore((s) => s.setIsAuthModalOpen);
  const setIsQuickAddOpen = useModalStore((s) => s.setIsQuickAddOpen);
  const setQuickAddDraft = useModalStore((s) => s.setQuickAddDraft);
  const setIsTemplatePickerOpen = useModalStore((s) => s.setIsTemplatePickerOpen);
  const setIsWeeklyReviewOpen = useModalStore((s) => s.setIsWeeklyReviewOpen);
  const setIsSmartFilterModalOpen = useModalStore((s) => s.setIsSmartFilterModalOpen);
  const setIsInterruptionModalOpen = useModalStore((s) => s.setIsInterruptionModalOpen);
  const setIsEveningShutdownOpen = useModalStore((s) => s.setIsEveningShutdownOpen);
  const dismissShutdown = useModalStore((s) => s.dismissShutdown);
  const setIsTriageDismissed = useModalStore((s) => s.setIsTriageDismissed);

  const storeFocusSession = useFocusStore((s) => s.focusSession);
  const focusSession = (preferences.focusSession as FocusSession | null) || (storeFocusSession?.workspaceId === workspaceId ? storeFocusSession : null);
  const calendarEvents = useTaskStore((s) => s.calendarEvents);
  const todayStr = getTodayStr();

  const settings = useMemo<UserWorkflowSettings>(
    () => ({ ...DEFAULT_WORKFLOW_SETTINGS, ...((preferences.settings as Partial<UserWorkflowSettings>) || {}) }),
    [preferences.settings]
  );
  const focusLogs = useMemo<FocusLog[]>(
    () => (Array.isArray(preferences.focusLogs) ? (preferences.focusLogs as FocusLog[]) : []),
    [preferences.focusLogs]
  );

  const interruptionStash = (preferences.interruptionStash as InterruptionStash | null) || null;
  const calendarIcsUrl = (preferences.calendarUrl as string) || '';
  const overdueTasks = tasks.filter(t => isActiveTask(t) && t.dueDate && t.dueDate < todayStr);

  useEffect(() => {
    if (preferences.focusSession) useFocusStore.getState().setFocusSession({ ...(preferences.focusSession as FocusSession), workspaceId });
    else if (snapshot.ready) useFocusStore.getState().setFocusSession(null);
  }, [preferences.focusSession, snapshot.ready, workspaceId]);

  useEffect(() => {
    const owner = ownWorkspace(store);
    ownership.current = owner;
    return () => { owner.close(); ownership.current = null; };
  }, [store]);

  useEffect(() => {
    if (!connected || !snapshot.ready || snapshot.readOnly) return;
    let cancelled = false;
    let stop: (() => void) | undefined;
    let connecting = false;
    const retry = async () => {
      if (connecting || cancelled) return;
      connecting = true;
      try {
        const { createCloudAdapter, watchCloud } = await import('../services/cloudWorkspace');
        if (cancelled) return;
        const adapter = createCloudAdapter(workspaceId);
        store.prepareConnection();
        const data = await adapter.read();
        if (cancelled) return;
        validateWorkspaceData(data.tasks, data.projects);
        for (const kind of ['projects', 'tasks', 'dashboards', 'focusLogs', 'recipes', 'preferences'] as const) if (data[kind]) store.receive(kind, data[kind]!);
        if (cancelled) return;
        stop?.();
        stop = watchCloud(workspaceId, (kind, values) => { if (!cancelled) store.receive(kind, values); }, error => { if (!cancelled) store.connectionFailed(error); });
        store.connect(adapter);
        await store.retry();
      } catch (error) { if (!cancelled) store.connectionFailed(error); }
      finally { connecting = false; }
    };
    void retry();
    window.addEventListener('online', retry);
    window.addEventListener('flowtask:retry-cloud', retry);
    return () => { cancelled = true; stop?.(); store.disconnect(); window.removeEventListener('online', retry); window.removeEventListener('flowtask:retry-cloud', retry); };
  }, [connected, snapshot.ready, snapshot.readOnly, store, workspaceId, showToast]);


  useEffect(() => {
    const toggle = (event: Event) => {
      const id = (event as CustomEvent).detail;
      if (typeof id !== 'string' || store.getSnapshot().readOnly) return;
      const session = store.getSnapshot().record.preferences.focusSession as FocusSession | null;
      if (session?.taskId === id) {
        if (session.state === 'running') pauseFocusSession(); else resumeFocusSession();
      } else if (!session) startFocusSession('stopwatch', id);
      else showToast('Return to the current focus session before starting another task.');
    };
    window.addEventListener('flowtask:toggle-task-timer', toggle);
    return () => window.removeEventListener('flowtask:toggle-task-timer', toggle);
  });

  const setWorkspacePreference = (key: string, value: unknown) => {
    useTaskStore.getState().setWorkspacePreference(key, value);
  };

  const setTheme = (value: AppTheme) => {
    setWorkspacePreference('appearance', { ...normalizeAppearance(current().preferences.appearance), theme: value, mode: 'manual', accent: '' });
  };
  const toggleTheme = () => setTheme(THEMES[useUIStore.getState().theme].scheme === 'dark' ? 'light' : 'dark');
  const updateSettings = (updates: Partial<UserWorkflowSettings>) => useTaskStore.getState().updateSettings(updates);
  const resetSettings = () => useTaskStore.getState().resetSettings();

  const undoLastAction = () => useTaskStore.getState().undoLastAction();
  const redoLastAction = () => useTaskStore.getState().redoLastAction();

  const addTask = (input: string, overrides?: Partial<Task>): Task => useTaskStore.getState().addTask(input, overrides);
  const showToastRef = useRef(showToast); showToastRef.current = showToast;

  // Real-time synchronization listener for Chrome Extension Quick Capture
  useEffect(() => {
    const handleExternalCaptureMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin || store.getSnapshot().readOnly) return;
      if (event.data && event.data.type === 'FLOWTASK_EXTERNAL_CAPTURE' && event.data.task) {
        const { title, description, priority, projectId } = event.data.task;
        if (title && typeof title === 'string' && title.trim() && title.length <= 10000 && (!description || typeof description === 'string' && description.length <= 20000)) {
          const captureId = typeof event.data.task.id === 'string' ? event.data.task.id : '';
          const captures = (store.getSnapshot().record.preferences._captureIds || []) as string[];
          if (!captureId || captureId.length > 200) return;
          if (captures.includes(captureId)) { window.postMessage({ type: 'FLOWTASK_CAPTURE_ACK', id: captureId }, window.location.origin); return; }
          const receipt = store.run('Capture from extension', record => {
            const result = commandService.createTask(record.tasks, title, {
              description: typeof description === 'string' ? description : undefined,
              priority: ['p1', 'p2', 'p3', 'p4'].includes(priority) ? priority : settings.defaultTaskPriority,
              projectId: typeof projectId === 'string' && record.projects.some(p => p.id === projectId) ? projectId : 'inbox',
            }, { enableParsing: false });
            return { ...record, tasks: result.updatedTasks.map(t => t.id === result.createdTask.id ? { ...t, id: captureId } : t), preferences: { ...record.preferences, _captureIds: [...captures.slice(-999), captureId] } };
          });
          void receipt?.persisted.then(() => window.postMessage({ type: 'FLOWTASK_CAPTURE_ACK', id: captureId }, window.location.origin)).catch(() => {});
          showToastRef.current(`Captured: "${title.slice(0, 32)}${title.length > 32 ? '...' : ''}"`);
        }
      }
    };
    window.addEventListener('message', handleExternalCaptureMessage);
    return () => window.removeEventListener('message', handleExternalCaptureMessage);
  }, [store, settings.defaultTaskPriority]);

  const addMultipleTasks = (lines: string[], overrides?: Partial<Task>) => useTaskStore.getState().addMultipleTasks(lines, overrides);
  const updateTask = (id: string, updates: Partial<Task>) => useTaskStore.getState().updateTask(id, updates);
  const deleteTask = (id: string) => useTaskStore.getState().deleteTask(id);
  const permanentDeleteTask = (id: string) => useTaskStore.getState().permanentDeleteTask(id);
  const archiveTask = (id: string) => useTaskStore.getState().archiveTask(id);
  const restoreTask = (id: string) => useTaskStore.getState().restoreTask(id);
  const toggleTaskStatus = (id: string) => useTaskStore.getState().toggleTaskStatus(id);
  const toggleTaskPinToday = (id: string) => useTaskStore.getState().toggleTaskPinToday(id);

  const toggleSubTask = (taskId: string, subId: string) => useTaskStore.getState().toggleSubTask(taskId, subId);
  const addSubTask = (taskId: string, title: string, estimatedMinutes?: number, extra?: Partial<SubTask>) => useTaskStore.getState().addSubTask(taskId, title, estimatedMinutes, extra);
  const addSubTasks = (taskId: string, newSubs: Array<{ title: string; estimatedMinutes?: number; extra?: Partial<SubTask> }>) => useTaskStore.getState().addSubTasks(taskId, newSubs);
  const updateSubTask = (taskId: string, subId: string, updates: Partial<SubTask>) => useTaskStore.getState().updateSubTask(taskId, subId, updates);
  const deleteSubTask = (taskId: string, subId: string) => useTaskStore.getState().deleteSubTask(taskId, subId);
  const moveSubTask = (taskId: string, subId: string, direction: 'up' | 'down') => useTaskStore.getState().moveSubTask(taskId, subId, direction);
  const promoteSubTaskToTask = (taskId: string, subId: string) => useTaskStore.getState().promoteSubTaskToTask(taskId, subId);

  const duplicateTask = (id: string): Task | null => useTaskStore.getState().duplicateTask(id);
  const mergeTasks = (target: string, source: string) => useTaskStore.getState().mergeTasks(target, source);
  const addStudySessions = (sessions: ParsedSession[], date = todayStr, projectId = 'inbox') => useTaskStore.getState().addStudySessions(sessions, date, projectId);
  const applyTaskChanges = (changes: Array<{ id: string; updates: Partial<Task> }>, description = 'Update tasks') => useTaskStore.getState().applyTaskChanges(changes, description);
  const batchUpdateTasks = (ids: string[], updates: Partial<Task>) => useTaskStore.getState().batchUpdateTasks(ids, updates);
  const batchDeleteTasks = (ids: string[]) => useTaskStore.getState().batchDeleteTasks(ids);
  const batchToggleStatus = (ids: string[]) => useTaskStore.getState().batchToggleStatus(ids);
  const bulkRescheduleOverdue = (action: 'today' | 'someday' | 'dismiss') => useTaskStore.getState().bulkRescheduleOverdue(action);

  function stopFocusSession() {
    finishWorkspaceFocus(store);
    useFocusStore.getState().setFocusSession(null);
  }
  function startFocusSession(
    mode: FocusSessionMode,
    taskId: string | null = null,
    title: string | null = null,
    targetSec = mode === 'stopwatch' ? 0 : 1500,
    subtaskId: string | null = null,
    subtaskTitle: string | null = null,
    pacingSec: number = 0
  ) {
    if (current().preferences.focusSession) { showToast('Return to your current focus session, or finish it before starting another.'); return; }
    const taskObj = taskId ? current().tasks.find(t => t.id === taskId) : null;
    const session = startWorkspaceFocus(store, { mode, taskId, taskTitle: title || taskObj?.title, targetDurationSec: targetSec, subtaskId, subtaskTitle, pacingSecondsPerUnit: pacingSec });
    useFocusStore.getState().setFocusSession(session);
  }

  const pauseFocusSession = () => {
    useFocusStore.getState().setFocusSession(changeWorkspaceFocusState(store, 'paused'));
  };
  const resumeFocusSession = () => {
    useFocusStore.getState().setFocusSession(changeWorkspaceFocusState(store, 'running'));
  };
  const updateFocusSession = (updates: Partial<FocusSession>) => {
    const session = (current().preferences.focusSession as FocusSession | null) || useFocusStore.getState().focusSession;
    if (!session) return;
    const updated: FocusSession = { ...session, ...updates };
    setWorkspacePreference('focusSession', updated);
    useFocusStore.getState().setFocusSession(updated);
  };

  const switchFocusSubtask = (subtaskId: string, subtaskTitle: string, targetSec: number) => {
    const session = current().preferences.focusSession as FocusSession | null;
    if (!session) return;
    finishWorkspaceFocus(store);
    const updated = startWorkspaceFocus(store, { mode: session.mode, taskId: session.taskId, taskTitle: session.taskTitle, subtaskId, subtaskTitle, targetDurationSec: targetSec, pacingSecondsPerUnit: targetSec, timerConfiguration: session.timerConfiguration });
    useFocusStore.getState().setFocusSession(session.state === 'paused' ? changeWorkspaceFocusState(store, 'paused') : updated);
  };

  const logFocusSegment = (taskId: string | null, seconds: number, subtaskId?: string, subtaskTitle?: string) => {
    if (seconds <= 0) return;
    store.run('Log focus segment', r => {
      const logs = (r.preferences.focusLogs || []) as FocusLog[];
      const newLog: FocusLog = {
        id: crypto.randomUUID(),
        phase: 'focus',
        seconds,
        taskId,
        taskTitle: taskId ? r.tasks.find(t => t.id === taskId)?.title : undefined,
        subtaskId,
        subtaskTitle,
        mode: 'sprint',
        startedAt: Date.now() - seconds * 1000,
        endedAt: Date.now(),
      };
      const minutesSpent = Math.max(1, Math.round(seconds / 60));
      const updatedTasks = taskId
        ? r.tasks.map(t => t.id === taskId
            ? {
                ...t,
                timeSpentMinutes: (t.timeSpentMinutes || 0) + minutesSpent,
                subtasks: subtaskId
                  ? t.subtasks.map(s => s.id === subtaskId ? { ...s, timeSpentMinutes: (s.timeSpentMinutes || 0) + minutesSpent } : s)
                  : t.subtasks
              }
            : t)
        : r.tasks;
      return {
        ...r,
        tasks: updatedTasks,
        preferences: { ...r.preferences, focusLogs: [...logs, newLog] }
      };
    }, false);
  };

  const activeTimerTaskId = focusSession?.taskId || null;
  const startTaskTimer = (id: string) => startFocusSession('stopwatch', id, current().tasks.find(t => t.id === id)?.title);
  const stopTaskTimer = stopFocusSession;
  const toggleTaskTimer = (id: string) => {
    const session = current().preferences.focusSession as FocusSession | null;
    if (session?.taskId !== id) startTaskTimer(id);
    else if (session.state === 'running') pauseFocusSession();
    else resumeFocusSession();
  };

  const stashActiveFocus = (override?: { id: string; title: string; projectId?: string }, elapsed?: number) => {
    const session = current().preferences.focusSession as FocusSession | null, id = override?.id || session?.taskId;
    if (!id) return;
    setWorkspacePreference('interruptionStash', {
      taskId: id,
      taskTitle: override?.title || session?.taskTitle || 'Focus',
      elapsedSeconds: elapsed ?? useFocusStore.getState().focusElapsedSeconds,
      stashedAt: Date.now(),
      projectId: override?.projectId,
    });
    stopFocusSession();
  };

  const clearInterruptionStash = () => setWorkspacePreference('interruptionStash', null);

  const restoreStashedFocus = () => {
    const stash = current().preferences.interruptionStash as InterruptionStash | null;
    if (!stash) return;
    if (current().preferences.focusSession) {
      showToast('Finish the current session before restoring your saved focus. Your saved context is still here.');
      return;
    }
    startFocusSession('stopwatch', stash.taskId, stash.taskTitle);
    clearInterruptionStash();
  };

  const setCalendarIcsUrl = (url: string) => useTaskStore.getState().setCalendarIcsUrl(url);
  const importCalendarFile = (file: File) => useTaskStore.getState().importCalendarFile(file);
  const removeImportedCalendar = () => useTaskStore.getState().removeImportedCalendar();
  const refreshCalendarEvents = useCallback((date = todayStr) => useTaskStore.getState().refreshCalendarEvents(date), [todayStr]);

  const addProject = (name: string, color: string, icon?: string) => useTaskStore.getState().addProject(name, color, icon);
  const updateProject = (id: string, updates: Partial<Project>) => useTaskStore.getState().updateProject(id, updates);
  const deleteProject = (id: string, reassignToProjectId = 'inbox') => useTaskStore.getState().deleteProject(id, reassignToProjectId);
  const archiveProject = (id: string) => useTaskStore.getState().archiveProject(id);

  const smartViews = useMemo(() => [...BUILT_IN_SMART_VIEWS, ...customSmartViews], [customSmartViews]);
  const addSmartView = (name: string, icon: string, color: string, predicate: SmartFilterPredicate): SmartFilterView => useTaskStore.getState().addSmartView(name, icon, color, predicate);
  const deleteSmartView = (id: string) => useTaskStore.getState().deleteSmartView(id);

  const importTasks = (importedTasks: Task[], importedProjects?: Project[], replace = false, extras?: BackupExtras) => useTaskStore.getState().importTasks(importedTasks, importedProjects, replace, extras);
  const forceSyncToCloud = () => useTaskStore.getState().forceSyncToCloud();
  const downloadWorkspaceBackup = () => useTaskStore.getState().downloadWorkspaceBackup();
  const resolveSyncConflict = (choice: 'local' | 'remote') => useTaskStore.getState().resolveSyncConflict(choice);
  const importLocalWorkspace = () => useTaskStore.getState().importLocalWorkspace();
  const updateDashboards = (nextDashboards: WorkspaceDashboard[], newActiveId?: string) => useTaskStore.getState().updateDashboards(nextDashboards, newActiveId);

  const contextValue = useMemo<TaskContextType>(() => ({
    workspaceId,
    workspacePreferences: preferences,
    setWorkspacePreference,
    downloadWorkspaceBackup,
    resolveSyncConflict,
    importLocalWorkspace,
    importCalendarFile,
    removeImportedCalendar,
    dashboards,
    updateDashboards,
    tasks,
    projects,
    activeView,
    viewLayout,
    selectedTaskId,
    searchQuery,
    priorityFilter,
    quickWinsOnly,
    theme,
    soundEnabled,
    soundProfile,
    overdueTasks,
    isTriageDismissed,
    setIsTriageDismissed,
    toast,
    syncStatus,
    lastSyncedAt,
    isAuthModalOpen,
    setIsAuthModalOpen,
    forceSyncToCloud,
    focusSession,
    get focusElapsedSeconds() {
      return useFocusStore.getState().focusElapsedSeconds;
    },
    focusLogs,
    get totalFocusedTodaySeconds() {
      const logs = (Array.isArray(preferences.focusLogs) ? preferences.focusLogs : []) as FocusLog[];
      const tStr = getTodayStr();
      const completedToday = logs
        .filter((log) => (!log.phase || log.phase === 'focus') && log.endedAt && formatLocalDate(new Date(log.endedAt)) === tStr)
        .reduce((acc, log) => acc + (log.seconds || 0), 0);
      const session = (preferences.focusSession as FocusSession | null) || useFocusStore.getState().focusSession;
      const isLiveToday =
        session &&
        (session.state === 'running' || session.state === 'paused') &&
        formatLocalDate(new Date(session.startedAt)) === tStr;
      const liveSec = isLiveToday && (!session.pomodoroPhase || session.pomodoroPhase === 'focus') ? useFocusStore.getState().focusElapsedSeconds : 0;
      return completedToday + liveSec;
    },
    startFocusSession,
    pauseFocusSession,
    resumeFocusSession,
    stopFocusSession,
    updateFocusSession,
    switchFocusSubtask,
    logFocusSegment,
    activeTimerTaskId,
    get activeTimerSeconds() {
      return useFocusStore.getState().activeTimerSeconds;
    },
    startTaskTimer,
    stopTaskTimer,
    toggleTaskTimer,
    selectedTaskIds,
    toggleTaskSelection,
    selectTask,
    deselectTask,
    selectAllTasks,
    clearTaskSelection,
    batchUpdateTasks,
    applyTaskChanges,
    batchDeleteTasks,
    batchToggleStatus,
    interruptionStash,
    isInterruptionModalOpen,
    setIsInterruptionModalOpen,
    stashActiveFocus,
    restoreStashedFocus,
    clearInterruptionStash,
    promoteSubTaskToTask,
    moveSubTask,
    duplicateTask,
    mergeTasks,
    isQuickAddOpen,
    setIsQuickAddOpen,
    quickAddDraft,
    setQuickAddDraft,
    isTemplatePickerOpen,
    setIsTemplatePickerOpen,
    isWeeklyReviewOpen,
    setIsWeeklyReviewOpen,
    calendarEvents,
    calendarIcsUrl,
    setCalendarIcsUrl,
    refreshCalendarEvents,
    isEveningShutdownOpen,
    setIsEveningShutdownOpen,
    isShutdownDismissed,
    dismissShutdown,
    smartViews,
    addSmartView,
    deleteSmartView,
    isSmartFilterModalOpen,
    setIsSmartFilterModalOpen,
    setActiveView,
    setViewLayout,
    setSelectedTaskId,
    setSearchQuery,
    setPriorityFilter,
    setQuickWinsOnly,
    setTheme,
    toggleTheme,
    toggleSound,
    setSoundProfile,
    addTask,
    addMultipleTasks,
    updateTask,
    deleteTask,
    permanentDeleteTask,
    archiveTask,
    restoreTask,
    toggleTaskStatus,
    toggleTaskPinToday,
    toggleSubTask,
    addSubTask,
    addSubTasks,
    updateSubTask,
    deleteSubTask,
    addStudySessions,
    bulkRescheduleOverdue,
    undoLastAction,
    redoLastAction,
    addProject,
    updateProject,
    deleteProject,
    archiveProject,
    importTasks,
    showToast,
    clearToast,
    settings,
    updateSettings,
    resetSettings,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    workspaceId, preferences, dashboards, tasks, projects, activeView, viewLayout, selectedTaskId,
    searchQuery, priorityFilter, quickWinsOnly, theme, soundEnabled, soundProfile,
    overdueTasks, isTriageDismissed, toast, syncStatus, lastSyncedAt, isAuthModalOpen,
    focusSession, focusLogs, activeTimerTaskId,
    selectedTaskIds, interruptionStash, isInterruptionModalOpen, isQuickAddOpen,
    quickAddDraft, isTemplatePickerOpen, isWeeklyReviewOpen, calendarEvents,
    calendarIcsUrl, isEveningShutdownOpen, isShutdownDismissed, smartViews,
    isSmartFilterModalOpen, settings, refreshCalendarEvents, showToast, clearToast
  ]);

  if (!snapshot.ready) return <WorkspaceRecovery store={store} error={snapshot.error} />;

  return (
    <WorkspaceStoreContext.Provider value={store}>
      <TaskContext.Provider value={contextValue}>
        <SyncFeedback store={store} snapshot={snapshot} download={downloadWorkspaceBackup} />
        {snapshot.readOnly && <div className="workspace-readonly-banner" role="status"><span>Read-only preview · This workspace is being edited in another tab.</span><button className="desk-button" onClick={() => void ownership.current?.takeOver()}>Use this tab</button></div>}
        {snapshot.recoveryError && <div className="workspace-recovery-notice" role="status">{snapshot.recoveryError}<button className="desk-button" onClick={downloadWorkspaceBackup}>Download backup</button></div>}
        <div className="workspace-provider-content" inert={snapshot.readOnly || undefined}>{snapshot.readOnly ? <WorkspaceReadOnly record={snapshot.record} /> : children}</div>
        {!snapshot.readOnly && connected && <DeviceImportPrompt />}
      </TaskContext.Provider>
    </WorkspaceStoreContext.Provider>
  );
};

export const useTaskContext = (): TaskContextType => {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTaskContext must be used within a TaskProvider');
  }
  return context;
};

/** Public theme controls persist to the current workspace; UI store setters are runtime state. */
export const useTheme = () => {
  const { theme, setTheme, toggleTheme } = useTaskContext();
  return { theme, setTheme, toggleTheme };
};
