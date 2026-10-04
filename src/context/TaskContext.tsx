import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react';
import type { Task, SubTask, Project, ViewId, Priority, CalendarEvent, InterruptionStash, SmartFilterView, SmartFilterPredicate, FocusSession, FocusSessionMode } from '../types/task';
import { getTodayStr } from '../hooks/useCurrentDate';
import { BUILT_IN_SMART_VIEWS } from '../utils/smartViewUtils';
import { audioEngine, type SoundProfile } from '../utils/audioEngine';
import { useAuth } from './AuthContext';
import { fetchICSFeed } from '../services/calendarService';
import { convertSessionToTask, type ParsedSession } from '../utils/sessionParser';
import { commandService, type CommandResult } from '../services/commandService';
import { WorkspaceStore } from '../services/workspaceStore';
import { focusSessionService } from '../services/focusSessionService';
import { DEFAULT_WORKFLOW_SETTINGS, type UserWorkflowSettings } from '../types/settings';
import { validateWorkspaceData } from '../utils/workspaceValidation';
import { isActiveTask, isFocusTask } from '../utils/taskSelectors';
import { dbService } from '../services/dbService';

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'local' | 'conflict' | 'error';
export type AppTheme = 'light' | 'dark' | 'tokyo' | 'nord' | 'matcha';

interface TaskContextType {
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

  // Focus Session Engine (Mini-player & Timers)
  focusSession: FocusSession | null;
  focusElapsedSeconds: number;
  startFocusSession: (mode: FocusSessionMode, taskId?: string | null, title?: string | null, targetSec?: number) => void;
  pauseFocusSession: () => void;
  resumeFocusSession: () => void;
  stopFocusSession: () => void;

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

  // Project Actions
  addProject: (name: string, color: string, icon?: string) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string, reassignToProjectId?: string) => void;
  archiveProject: (id: string) => void;

  importTasks: (tasks: Task[], projects?: Project[], replace?: boolean) => Promise<void>;
  showToast: (message: string, actionLabel?: string, onAction?: () => void) => void;
  clearToast: () => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const TaskProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div role="status" className="p-10">Opening your workspace…</div>;
  return <WorkspaceProvider key={user?.uid || 'local'} workspaceId={user?.uid || 'local'} connected={!!user}>{children}</WorkspaceProvider>;
};
const WorkspaceProvider = ({ children, workspaceId, connected }: { children: ReactNode; workspaceId: string; connected: boolean }) => {
  const [store] = useState(() => new WorkspaceStore(workspaceId, connected));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const { tasks, projects, preferences, customViews: customSmartViews } = snapshot.record;
  const current = () => store.getSnapshot().record;
  const syncStatus = snapshot.sync;
  const lastSyncedAt = useMemo(
    () => (syncStatus === 'synced' ? new Date(snapshot.record.updatedAt) : null),
    [syncStatus, snapshot.record.updatedAt]
  );
  const parseView = (): ViewId => {
    const view = new URL(window.location.href).searchParams.get('view') || 'today';
    return /^(today|inbox|upcoming|projects|review|all|someday|timeline|matrix|kanban|insights|logbook|trash|archive|project:.+|smart:.+)$/.test(view) ? view as ViewId : 'today';
  };
  const [activeView, setActiveViewState] = useState<ViewId>(parseView);
  const setActiveView = (view: ViewId) => { const url = new URL(window.location.href); url.searchParams.set('view', view); history.pushState({}, '', url); setActiveViewState(view); };
  useEffect(() => { const navigate = () => setActiveViewState(parseView()); window.addEventListener('popstate', navigate); return () => window.removeEventListener('popstate', navigate); }, []);
  const [viewLayout, setViewLayout] = useState<'list' | 'kanban' | 'matrix'>('list');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [quickWinsOnly, setQuickWinsOnly] = useState(false);
  const [isTriageDismissed, setIsTriageDismissed] = useState(false);
  const [toast, setToast] = useState<{ message: string; actionLabel?: string; onAction?: () => void } | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddDraft, setQuickAddDraft] = useState('');
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const [isWeeklyReviewOpen, setIsWeeklyReviewOpen] = useState(false);
  const [isSmartFilterModalOpen, setIsSmartFilterModalOpen] = useState(false);
  const [isInterruptionModalOpen, setIsInterruptionModalOpen] = useState(false);
  const [isEveningShutdownOpen, setIsEveningShutdownOpen] = useState(false);
  const [isShutdownDismissed, setIsShutdownDismissed] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [focusElapsedSeconds, setFocusElapsedSeconds] = useState(0);
  const [theme, setTheme] = useState<AppTheme>(() => {
    const saved = localStorage.getItem('flowtask_theme') as AppTheme;
    return ['light', 'dark', 'tokyo', 'nord', 'matcha'].includes(saved) ? saved : 'light';
  });
  const [soundEnabled, setSoundEnabled] = useState(audioEngine.getSoundEnabled());
  const [soundProfile, setSoundProfileState] = useState<SoundProfile>(audioEngine.getSoundProfile());
  const todayStr = getTodayStr();
  const settings = useMemo<UserWorkflowSettings>(
    () => ({ ...DEFAULT_WORKFLOW_SETTINGS, ...((preferences.settings as Partial<UserWorkflowSettings>) || {}) }),
    [preferences.settings]
  );
  const focusSession = (preferences.focusSession as FocusSession | null) || null;
  const interruptionStash = (preferences.interruptionStash as InterruptionStash | null) || null;
  const calendarIcsUrl = (preferences.calendarUrl as string) || '';
  const overdueTasks = tasks.filter(t => isActiveTask(t) && t.dueDate && t.dueDate < todayStr);
  const showToast = useCallback((message: string, actionLabel?: string, onAction?: () => void) => setToast({ message, actionLabel, onAction }), []);
  const clearToast = useCallback(() => setToast(null), []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(clearToast, 5000); return () => clearTimeout(timer); }, [toast, clearToast]);
  useEffect(() => {
    const abort = new AbortController();
    let release: (() => void) | undefined;
    if (navigator.locks) {
      void navigator.locks.request('flowtask-workspace-' + workspaceId, { signal: abort.signal }, async () => {
        await store.load();
        if (abort.signal.aborted) return;
        await new Promise<void>(resolve => { release = resolve; });
        await store.settled().catch(() => {});
      }).catch(() => {});
    } else void store.load();
    return () => { abort.abort(); release?.(); };
  }, [store, workspaceId]);
  useEffect(() => {
    if (!connected || !snapshot.ready) return;
    let cancelled = false;
    let stop: (() => void) | undefined;
    void import('../services/cloudWorkspace').then(({ createCloudAdapter, watchCloud }) => {
      if (cancelled) return;
      store.connect(createCloudAdapter(workspaceId));
      stop = watchCloud(workspaceId, (kind, data) => store.receive(kind, data), error => showToast(`Cloud connection interrupted: ${error.message}`));
    }).catch(error => showToast(String(error.message || error)));
    const retry = () => { void store.flush(); };
    window.addEventListener('online', retry);
    return () => { cancelled = true; stop?.(); store.disconnect(); window.removeEventListener('online', retry); };
  }, [connected, snapshot.ready, store, workspaceId, showToast]);
  useEffect(() => {
    const tick = () => setFocusElapsedSeconds(focusSession ? focusSessionService.getElapsedSeconds(focusSession) : 0);
    tick(); if (focusSession?.state !== 'running') return;
    const timer = setInterval(tick, 1000); return () => clearInterval(timer);
  }, [focusSession]);
  useEffect(() => {
    document.documentElement.classList.remove('dark', 'theme-tokyo', 'theme-nord', 'theme-matcha');
    if (['dark', 'tokyo', 'nord'].includes(theme)) document.documentElement.classList.add('dark');
    if (!['light', 'dark'].includes(theme)) document.documentElement.classList.add(`theme-${theme}`);
    document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('flowtask_theme', theme);
  }, [theme]);
  const setWorkspacePreference = (key: string, value: unknown) => store.run('Update workspace preference', r => ({ ...r, preferences: { ...r.preferences, [key]: value } }), false);
  const updateSettings = (updates: Partial<UserWorkflowSettings>) => setWorkspacePreference('settings', { ...DEFAULT_WORKFLOW_SETTINGS, ...(current().preferences.settings as object || {}), ...updates });
  const resetSettings = () => setWorkspacePreference('settings', DEFAULT_WORKFLOW_SETTINGS);
  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');
  const toggleSound = () => { audioEngine.setSoundEnabled(!soundEnabled); setSoundEnabled(!soundEnabled); };
  const setSoundProfile = (profile: SoundProfile) => { audioEngine.setSoundProfile(profile); setSoundProfileState(profile); };
  function execute(factory: (list: Task[]) => CommandResult) {
    const result = factory(current().tasks);
    store.run(result.description, r => ({ ...r, tasks: result.updatedTasks }));
    return result;
  }
  const undoLastAction = () => { try { store.undo(); } catch (error) { showToast(String((error as Error).message)); } };
  const addTask = (input: string, overrides?: Partial<Task>): Task => {
    const result = commandService.createTask(current().tasks, input, overrides, { defaultPlannedDate: activeView === 'today' ? todayStr : undefined, defaultProjectId: activeView.startsWith('project:') ? activeView.slice(8) : 'inbox' });
    if (!current().projects.some(p => p.id === result.createdTask.projectId)) result.createdTask.projectId = 'inbox';
    store.run(result.description, r => ({ ...r, tasks: result.updatedTasks }));
    return result.createdTask;
  };
  const addTaskRef = useRef(addTask); addTaskRef.current = addTask;
  const showToastRef = useRef(showToast); showToastRef.current = showToast;

  // Real-time synchronization listener for Chrome Extension Quick Capture
  useEffect(() => {
    const handleExternalCaptureMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'FLOWTASK_EXTERNAL_CAPTURE' && event.data.task) {
        const { title, description, priority, projectId } = event.data.task;
        if (title && typeof title === 'string') {
          addTaskRef.current(title, {
            description: typeof description === 'string' ? description : undefined,
            priority: ['p1', 'p2', 'p3', 'p4'].includes(priority) ? priority : 'p2',
            projectId: projectId || 'inbox',
          });
          showToastRef.current(`Captured: "${title.slice(0, 32)}${title.length > 32 ? '...' : ''}"`);
        }
      }
    };
    window.addEventListener('message', handleExternalCaptureMessage);
    return () => window.removeEventListener('message', handleExternalCaptureMessage);
  }, []);
  const addMultipleTasks = (lines: string[], overrides?: Partial<Task>) => {
    store.run('Add multiple tasks', r => ({ ...r, tasks: lines.map(l => l.trim()).filter(Boolean).reduce((list, line) => commandService.createTask(list, line, { projectId: activeView.startsWith('project:') ? activeView.slice(8) : 'inbox', ...overrides }, { defaultPlannedDate: activeView === 'today' ? todayStr : undefined }).updatedTasks, r.tasks) }));
  };
  const updateTask = (id: string, updates: Partial<Task>) => { execute(list => commandService.updateTask(list, id, updates)); };
  const deleteTask = (id: string) => { execute(list => commandService.deleteTask(list, id)); showToast('Task moved to Trash', 'Undo', undoLastAction); };
  const permanentDeleteTask = (id: string) => { execute(list => commandService.permanentDeleteTask(list, id)); };
  const archiveTask = (id: string) => { execute(list => commandService.archiveTask(list, id)); showToast('Task archived', 'Undo', undoLastAction); };
  const restoreTask = (id: string) => { execute(list => commandService.restoreTask(list, id)); };
  const toggleTaskStatus = (id: string) => { execute(list => commandService.toggleTaskStatus(list, id)); audioEngine.playTaskComplete(); };
  const toggleTaskPinToday = (id: string) => {
    const task = current().tasks.find(t => t.id === id); if (!task || !isActiveTask(task)) return false;
    const pinned = isFocusTask(task, todayStr);
    if (!pinned && current().tasks.filter(t => isFocusTask(t, todayStr)).length >= 3) { showToast('Your Top 3 is full. Unpin a task first.'); return false; }
    updateTask(id, { isPinnedToday: !pinned, topThreeDate: pinned ? undefined : todayStr, plannedDate: pinned ? task.plannedDate : todayStr }); return true;
  };
  const editSubtasks = (taskId: string, transform: (subs: SubTask[]) => SubTask[]) => {
    const task = current().tasks.find(t => t.id === taskId); if (task) updateTask(taskId, { subtasks: transform(task.subtasks) });
  };
  const toggleSubTask = (taskId: string, subId: string) => editSubtasks(taskId, subs => subs.map(s => s.id === subId ? { ...s, completed: !s.completed } : s));
  const addSubTask = (taskId: string, title: string, estimatedMinutes?: number, extra?: Partial<SubTask>) => editSubtasks(taskId, subs => [...subs, { ...extra, id: crypto.randomUUID(), title: title.trim(), estimatedMinutes, completed: false }]);
  const addSubTasks = (taskId: string, newSubs: Array<{ title: string; estimatedMinutes?: number; extra?: Partial<SubTask> }>) => editSubtasks(taskId, subs => [...subs, ...newSubs.map(s => ({ ...s.extra, id: crypto.randomUUID(), title: s.title.trim(), estimatedMinutes: s.estimatedMinutes, completed: false }))]);
  const updateSubTask = (taskId: string, subId: string, updates: Partial<SubTask>) => editSubtasks(taskId, subs => subs.map(s => s.id === subId ? { ...s, ...updates, id: s.id } : s));
  const deleteSubTask = (taskId: string, subId: string) => editSubtasks(taskId, subs => subs.filter(s => s.id !== subId));
  const moveSubTask = (taskId: string, subId: string, direction: 'up' | 'down') => editSubtasks(taskId, subs => {
    const index = subs.findIndex(s => s.id === subId), target = index + (direction === 'up' ? -1 : 1);
    if (index < 0 || target < 0 || target >= subs.length) return subs;
    const next = [...subs]; [next[index], next[target]] = [next[target], next[index]]; return next;
  });
  const promoteSubTaskToTask = (taskId: string, subId: string) => {
    store.run('Promote subtask', r => {
      const parent = r.tasks.find(t => t.id === taskId), sub = parent?.subtasks.find(s => s.id === subId); if (!parent || !sub) return r;
      const list = r.tasks.map(t => t.id === taskId ? { ...t, subtasks: t.subtasks.filter(s => s.id !== subId) } : t);
      return { ...r, tasks: commandService.createTask(list, sub.title, { projectId: parent.projectId, plannedDate: parent.plannedDate, priority: parent.priority, estimatedMinutes: sub.estimatedMinutes }).updatedTasks };
    });
  };
  const duplicateTask = (id: string): Task | null => {
    const task = current().tasks.find(t => t.id === id); if (!task) return null;
    return addTask(`${task.title} (Copy)`, { ...task, title: `${task.title} (Copy)`, isPinnedToday: false, topThreeDate: undefined, subtasks: task.subtasks.map(s => ({ ...s, id: crypto.randomUUID(), completed: false })) });
  };
  const mergeTasks = (target: string, source: string) => { execute(list => commandService.mergeTasks(list, target, source)); };
  const addStudySessions = (sessions: ParsedSession[], date = todayStr, projectId = 'inbox') => {
    const created = sessions.map(s => convertSessionToTask(s, date, projectId)); store.run('Add study sessions', r => ({ ...r, tasks: [...created, ...r.tasks] })); return created;
  };
  const batchUpdateTasks = (ids: string[], updates: Partial<Task>) => { execute(list => commandService.batchUpdate(list, ids, updates)); };
  const batchDeleteTasks = (ids: string[]) => { execute(list => commandService.batchDelete(list, ids)); setSelectedTaskIds([]); showToast('Tasks moved to Trash', 'Undo', undoLastAction); };
  const batchToggleStatus = (ids: string[]) => {
    store.run('Change task completion', r => {
      const allDone = r.tasks.filter(t => ids.includes(t.id)).every(t => t.status === 'done');
      return { ...r, tasks: ids.reduce((list, id) => { const task = list.find(t => t.id === id); return task && (task.status === 'done') === allDone ? commandService.toggleTaskStatus(list, id).updatedTasks : list; }, r.tasks) };
    });
  };
  const bulkRescheduleOverdue = (action: 'today' | 'someday' | 'dismiss') => {
    if (action === 'dismiss') { setIsTriageDismissed(true); return; }
    batchUpdateTasks(current().tasks.filter(t => isActiveTask(t) && t.dueDate && t.dueDate < todayStr).map(t => t.id), action === 'today' ? { plannedDate: todayStr, isSomeday: false } : { plannedDate: undefined, isSomeday: true });
  };
  const toggleTaskSelection = (id: string) => setSelectedTaskIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  const selectTask = (id: string) => setSelectedTaskIds(ids => [...new Set([...ids, id])]);
  const deselectTask = (id: string) => setSelectedTaskIds(ids => ids.filter(x => x !== id));
  const selectAllTasks = (ids: string[]) => setSelectedTaskIds(ids);
  const clearTaskSelection = () => setSelectedTaskIds([]);
  function stopFocusSession() {
    store.run('Log focus session', r => {
      const session = r.preferences.focusSession as FocusSession | null; if (!session) return r;
      const logs = (r.preferences.focusLogs || []) as { id: string; seconds: number; taskId: string | null; endedAt: number }[];
      if (logs.some(log => log.id === session.id)) return { ...r, preferences: { ...r.preferences, focusSession: null } };
      const seconds = focusSessionService.getElapsedSeconds(session);
      return { ...r, tasks: r.tasks.map(t => t.id === session.taskId ? { ...t, timeSpentMinutes: (t.timeSpentMinutes || 0) + seconds / 60 } : t), preferences: { ...r.preferences, focusSession: null, focusLogs: [...logs, { id: session.id, seconds, taskId: session.taskId, endedAt: Date.now() }] } };
    }, false);
  }
  function startFocusSession(mode: FocusSessionMode, taskId: string | null = null, title: string | null = null, targetSec = mode === 'pomodoro' ? 1500 : 0) {
    if (current().preferences.focusSession) stopFocusSession();
    const session: FocusSession = { id: crypto.randomUUID(), mode, taskId, taskTitle: title || 'Focus session', startedAt: Date.now(), accumulatedElapsedMs: 0, targetDurationSec: targetSec, state: 'running', pomodoroCycle: 1, pomodoroPhase: 'focus' };
    setWorkspacePreference('focusSession', session);
  }
  const pauseFocusSession = () => { const session = current().preferences.focusSession as FocusSession | null; if (session?.state === 'running') setWorkspacePreference('focusSession', { ...session, accumulatedElapsedMs: session.accumulatedElapsedMs + Math.max(0, Date.now() - session.startedAt), pausedAt: Date.now(), state: 'paused' }); };
  const resumeFocusSession = () => { const session = current().preferences.focusSession as FocusSession | null; if (session?.state === 'paused') setWorkspacePreference('focusSession', { ...session, startedAt: Date.now(), pausedAt: null, state: 'running' }); };
  const activeTimerTaskId = focusSession?.taskId || null, activeTimerSeconds = focusElapsedSeconds;
  const startTaskTimer = (id: string) => startFocusSession('stopwatch', id, current().tasks.find(t => t.id === id)?.title);
  const stopTaskTimer = stopFocusSession;
  const toggleTaskTimer = (id: string) => { const session = current().preferences.focusSession as FocusSession | null; if (session?.taskId !== id) startTaskTimer(id); else if (session.state === 'running') pauseFocusSession(); else resumeFocusSession(); };
  const stashActiveFocus = (override?: { id: string; title: string; projectId?: string }, elapsed?: number) => {
    const session = current().preferences.focusSession as FocusSession | null, id = override?.id || session?.taskId; if (!id) return;
    setWorkspacePreference('interruptionStash', { taskId: id, taskTitle: override?.title || session?.taskTitle || 'Focus', elapsedSeconds: elapsed ?? focusElapsedSeconds, stashedAt: Date.now(), projectId: override?.projectId }); stopFocusSession();
  };
  const clearInterruptionStash = () => setWorkspacePreference('interruptionStash', null);
  const restoreStashedFocus = () => { const stash = current().preferences.interruptionStash as InterruptionStash | null; if (stash) { startFocusSession('stopwatch', stash.taskId, stash.taskTitle); clearInterruptionStash(); } };
  const setCalendarIcsUrl = (url: string) => setWorkspacePreference('calendarUrl', url);
  const refreshCalendarEvents = useCallback(async (date = todayStr) => {
    if (!calendarIcsUrl.trim()) { setCalendarEvents([]); return; }
    try { setCalendarEvents(await fetchICSFeed(calendarIcsUrl, date)); } catch (error) { showToast(`Calendar could not refresh: ${(error as Error).message}`); }
  }, [calendarIcsUrl, todayStr, showToast]);
  useEffect(() => { void refreshCalendarEvents(); }, [refreshCalendarEvents]);
  const addProject = (name: string, color: string, icon?: string) => { if (!name.trim()) return; store.run('Create project', r => ({ ...r, projects: [...r.projects, { id: crypto.randomUUID(), name: name.trim(), color, icon, createdAt: Date.now() }] })); };
  const updateProject = (id: string, updates: Partial<Project>) => store.run('Update project', r => ({ ...r, projects: r.projects.map(p => p.id === id ? { ...p, ...updates, id } : p) }));
  const deleteProject = (id: string, reassignToProjectId = 'inbox') => {
    if (id === 'inbox' || id === reassignToProjectId || !current().projects.some(p => p.id === reassignToProjectId)) return;
    store.run('Delete project and move its tasks', r => ({ ...r, projects: r.projects.filter(p => p.id !== id), tasks: r.tasks.map(t => t.projectId === id ? { ...t, projectId: reassignToProjectId } : t) }));
  };
  const archiveProject = (id: string) => { if (id !== 'inbox') updateProject(id, { isArchived: true, archivedAt: Date.now() }); };
  const smartViews = useMemo(() => [...BUILT_IN_SMART_VIEWS, ...customSmartViews], [customSmartViews]);
  const addSmartView = (name: string, icon: string, color: string, predicate: SmartFilterPredicate): SmartFilterView => {
    const view = { id: crypto.randomUUID(), name, icon, color, predicate }; store.run('Save view', r => ({ ...r, customViews: [...r.customViews, view] }), false); return view;
  };
  const deleteSmartView = (id: string) => store.run('Remove saved view', r => ({ ...r, customViews: r.customViews.filter(v => v.id !== id) }), false);
  async function importTasks(importedTasks: Task[], importedProjects?: Project[], replace = false) {
    const before = current();
    const nextProjects = replace ? importedProjects || before.projects : [...before.projects, ...(importedProjects || []).filter(p => !before.projects.some(old => old.id === p.id))];
    const nextTasks = replace ? importedTasks : [...before.tasks, ...importedTasks.filter(t => !before.tasks.some(old => old.id === t.id))];
    const validated = validateWorkspaceData(nextTasks, nextProjects);
    localStorage.setItem(`flowtask_pre_import_${workspaceId}`, JSON.stringify(before));
    store.run(replace ? 'Restore backup' : 'Import tasks', r => ({ ...r, ...validated }));
    await store.settled(); showToast(`Saved ${importedTasks.length} imported tasks`);
  }
  const forceSyncToCloud = async () => { if (!connected) { setIsAuthModalOpen(true); return; } await store.retry(); };
  const dismissShutdown = () => setIsShutdownDismissed(true);
  const downloadWorkspaceBackup = () => {
    const blob = new Blob([JSON.stringify({ ...current(), version: 3 }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = `flowtask-${workspaceId}-${todayStr}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const resolveSyncConflict = async (choice: 'local' | 'remote') => { try { await store.resolveConflict(choice); } catch (error) { showToast((error as Error).message); } };
  const importLocalWorkspace = async () => { const local = await dbService.loadWorkspace('local'); if (local) await importTasks(local.tasks, local.projects); };

  const contextValue = useMemo<TaskContextType>(() => ({
    workspaceId, workspacePreferences: preferences, setWorkspacePreference, downloadWorkspaceBackup, resolveSyncConflict, importLocalWorkspace,
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
    toast,
    syncStatus,
    lastSyncedAt,
    isAuthModalOpen,
    setIsAuthModalOpen,
    forceSyncToCloud,
    focusSession,
    focusElapsedSeconds,
    startFocusSession,
    pauseFocusSession,
    resumeFocusSession,
    stopFocusSession,
    activeTimerTaskId,
    activeTimerSeconds,
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
    workspaceId, preferences, tasks, projects, activeView, viewLayout, selectedTaskId,
    searchQuery, priorityFilter, quickWinsOnly, theme, soundEnabled, soundProfile,
    overdueTasks, isTriageDismissed, toast, syncStatus, lastSyncedAt, isAuthModalOpen,
    focusSession, focusElapsedSeconds, activeTimerTaskId, activeTimerSeconds,
    selectedTaskIds, interruptionStash, isInterruptionModalOpen, isQuickAddOpen,
    quickAddDraft, isTemplatePickerOpen, isWeeklyReviewOpen, calendarEvents,
    calendarIcsUrl, isEveningShutdownOpen, isShutdownDismissed, smartViews,
    isSmartFilterModalOpen, settings, refreshCalendarEvents, showToast, clearToast
  ]);

  if (!snapshot.ready) return <div role="status" className="p-10"><p>{snapshot.error || 'Opening your saved workspace… If it is open in another tab, close that tab to continue here.'}</p>{snapshot.error && <button onClick={() => void store.load()}>Retry</button>}</div>;

  return (
    <TaskContext.Provider value={contextValue}>
      {(snapshot.error || snapshot.sync === 'offline') && <div role="alert" className="fixed top-0 left-0 right-0 z-[1000] bg-amber-100 text-amber-950 p-3 flex gap-3 items-center"><span>{snapshot.error || 'Cloud unavailable. Changes are saved on this device and queued for retry.'}</span><button onClick={() => void store.retry().catch(error => showToast(error.message))}>Retry</button><button onClick={downloadWorkspaceBackup}>Download backup</button>{snapshot.sync === 'conflict' && <><button onClick={() => void resolveSyncConflict('local')}>Keep device changes</button><button onClick={() => void resolveSyncConflict('remote')}>Use account changes</button></>}</div>}
      {children}
    </TaskContext.Provider>
  );
};

export const useTaskContext = (): TaskContextType => {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTaskContext must be used within a TaskProvider');
  }
  return context;
};
