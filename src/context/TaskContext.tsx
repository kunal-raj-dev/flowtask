import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import confetti from 'canvas-confetti';
import type {
  Task,
  SubTask,
  Project,
  ViewId,
  Priority,
  CalendarEvent,
  InterruptionStash,
  SmartFilterView,
  SmartFilterPredicate,
  FocusSession,
  FocusSessionMode,
} from '../types/task';
import { formatLocalDate } from '../utils/nlpParser';
import { BUILT_IN_SMART_VIEWS } from '../utils/smartViewUtils';
import { audioEngine, type SoundProfile } from '../utils/audioEngine';
import {
  loadTasksFromStorage,
  loadProjectsFromStorage,
  saveProjectsToStorage,
} from '../utils/storage';
import { useAuth } from './AuthContext';
import { taskSyncService } from '../services/taskSyncService';
import { fetchICSFeed } from '../services/calendarService';
import { checkAndTriggerDailyAutoSnapshot } from '../utils/backupService';
import { convertSessionToTask, type ParsedSession } from '../utils/sessionParser';
import { commandService } from '../services/commandService';
import { dbService } from '../services/dbService';
import { focusSessionService } from '../services/focusSessionService';

interface UndoAction {
  description: string;
  undo: (currentTasks: Task[]) => Task[];
}

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'local' | 'conflict' | 'error';
export type AppTheme = 'light' | 'dark' | 'tokyo' | 'nord' | 'matcha';

interface TaskContextType {
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
  refreshCalendarEvents: () => Promise<void>;

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
  addMultipleTasks: (lines: string[]) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  permanentDeleteTask: (id: string) => void;
  archiveTask: (id: string) => void;
  restoreTask: (id: string) => void;
  toggleTaskStatus: (id: string) => void;
  toggleTaskPinToday: (id: string) => boolean;
  toggleSubTask: (taskId: string, subtaskId: string) => void;
  addSubTask: (taskId: string, title: string, estimatedMinutes?: number, extra?: Partial<SubTask>) => void;
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
  const { user, isConfigured } = useAuth();
  const workspaceId = user ? user.uid : 'local';

  const [tasks, setTasks] = useState<Task[]>(() => loadTasksFromStorage());
  const [projects, setProjects] = useState<Project[]>(() => loadProjectsFromStorage());
  const [activeView, setActiveView] = useState<ViewId>('today');
  const [viewLayout, setViewLayout] = useState<'list' | 'kanban' | 'matrix'>('list');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [quickWinsOnly, setQuickWinsOnly] = useState(false);
  const [isTriageDismissed, setIsTriageDismissed] = useState(false);
  const [, setUndoStack] = useState<UndoAction[]>([]);
  const undoStackRef = useRef<UndoAction[]>([]);
  const [toast, setToast] = useState<{ message: string; actionLabel?: string; onAction?: () => void } | null>(null);

  // Cloud Sync state
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(isConfigured ? 'syncing' : 'local');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Quick Add Composer State (preserves draft across views)
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddDraft, setQuickAddDraft] = useState('');

  // Focus Session Engine (Mini-player & Timers)
  const [focusSession, setFocusSession] = useState<FocusSession | null>(() =>
    focusSessionService.getStoredSession()
  );
  const [focusElapsedSeconds, setFocusElapsedSeconds] = useState<number>(0);

  // External Calendar ICS state
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarIcsUrl, setCalendarIcsUrlState] = useState<string>(() => {
    return localStorage.getItem('flowtask_calendar_ics_url') || '';
  });

  // Evening Shutdown Ritual state
  const [isEveningShutdownOpen, setIsEveningShutdownOpen] = useState(false);
  const [isShutdownDismissed, setIsShutdownDismissed] = useState(false);

  // Multi-Select state
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  // Interruption Stash state
  const [interruptionStash, setInterruptionStash] = useState<InterruptionStash | null>(() => {
    try {
      const saved = localStorage.getItem('flowtask_interruption_stash');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isInterruptionModalOpen, setIsInterruptionModalOpen] = useState(false);

  // Smart Views state
  const [customSmartViews, setCustomSmartViews] = useState<SmartFilterView[]>(() => {
    try {
      const saved = localStorage.getItem('flowtask_custom_smart_views');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isSmartFilterModalOpen, setIsSmartFilterModalOpen] = useState(false);
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const [isWeeklyReviewOpen, setIsWeeklyReviewOpen] = useState(false);

  // Theme state
  const [theme, setThemeState] = useState<AppTheme>(() => {
    const saved = localStorage.getItem('flowtask_theme') as AppTheme;
    if (saved && ['light', 'dark', 'tokyo', 'nord', 'matcha'].includes(saved)) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // Sound profile state
  const [soundProfile, setSoundProfileState] = useState<SoundProfile>(() => audioEngine.getSoundProfile());
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => audioEngine.getSoundEnabled());

  // Initialize workspace from IndexedDB / legacy migration on mount and when account switches
  useEffect(() => {
    let isMounted = true;

    dbService.ensureLegacyMigrated(workspaceId).then((record) => {
      if (!isMounted) return;
      if (record && record.tasks) {
        setTasks(record.tasks);
        setProjects(record.projects);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [workspaceId]);

  // Persist to scoped database whenever tasks or projects change
  useEffect(() => {
    dbService.saveWorkspace(workspaceId, { tasks, projects, customViews: customSmartViews });
  }, [workspaceId, tasks, projects, customSmartViews]);

  // Rolling local snapshot safety net
  useEffect(() => {
    if (tasks.length > 0) {
      checkAndTriggerDailyAutoSnapshot(tasks, projects);
    }
  }, [tasks, projects]);

  // Focus Session Ticker
  useEffect(() => {
    if (!focusSession || focusSession.state !== 'running') {
      setFocusElapsedSeconds(focusSession ? focusSessionService.getElapsedSeconds(focusSession) : 0);
      return;
    }

    const interval = setInterval(() => {
      setFocusElapsedSeconds(focusSessionService.getElapsedSeconds(focusSession));
    }, 1000);

    return () => clearInterval(interval);
  }, [focusSession]);

  // Cross-tab focus synchronization
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('flowtask_focus_channel');
    channel.onmessage = (event) => {
      if (event.data?.type === 'FOCUS_SESSION_UPDATE') {
        setFocusSession(event.data.session);
      }
    };
    return () => channel.close();
  }, []);

  // Theme attribute application
  useEffect(() => {
    document.documentElement.classList.remove('dark', 'theme-tokyo', 'theme-nord', 'theme-matcha');
    if (theme === 'dark' || theme === 'tokyo' || theme === 'nord') {
      document.documentElement.classList.add('dark');
    }
    if (theme === 'tokyo') document.documentElement.classList.add('theme-tokyo');
    if (theme === 'nord') document.documentElement.classList.add('theme-nord');
    if (theme === 'matcha') document.documentElement.classList.add('theme-matcha');

    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('flowtask_theme', theme);
  }, [theme]);

  const setTheme = useCallback((t: AppTheme) => {
    setThemeState(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      audioEngine.playToggleSound(next === 'light');
      return next;
    });
  }, []);

  const setSoundProfile = useCallback((p: SoundProfile) => {
    setSoundProfileState(p);
    audioEngine.setSoundProfile(p);
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabledState((prev) => {
      const next = !prev;
      audioEngine.setSoundEnabled(next);
      if (next) {
        audioEngine.playToggleSound(true);
      }
      return next;
    });
  }, []);

  const showToast = useCallback((message: string, actionLabel?: string, onAction?: () => void) => {
    setToast({ message, actionLabel, onAction });
    const timer = setTimeout(() => {
      setToast(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const clearToast = useCallback(() => setToast(null), []);

  const pushUndo = useCallback((description: string, undoFn: (currentTasks: Task[]) => Task[]) => {
    const action: UndoAction = { description, undo: undoFn };
    undoStackRef.current = [action, ...undoStackRef.current.slice(0, 9)];
    setUndoStack(undoStackRef.current);
  }, []);

  const undoLastAction = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const [actionToUndo, ...rest] = undoStackRef.current;
    undoStackRef.current = rest;
    setUndoStack(rest);

    setTasks((currentTasks) => {
      const reverted = actionToUndo.undo(currentTasks);
      if (user) {
        taskSyncService.batchMigrate(user.uid, reverted, projects).catch((err) => {
          console.warn('Undo cloud sync error:', err);
        });
      }
      return reverted;
    });

    showToast(`Undone: ${actionToUndo.description}`);
  }, [user, projects, showToast]);

  // Firebase Real-time Synchronization
  useEffect(() => {
    if (!isConfigured || !user) {
      setSyncStatus('local');
      return;
    }

    let isMounted = true;
    setSyncStatus('syncing');

    // Subscribe to tasks
    const unsubTasks = taskSyncService.subscribeToTasks(
      user.uid,
      (remoteTasks, hasPendingWrites) => {
        if (!isMounted) return;
        setTasks(remoteTasks);
        setSyncStatus(hasPendingWrites ? 'syncing' : 'synced');
        setLastSyncedAt(new Date());
      },
      (err) => {
        console.warn('Task sync listener reported error/offline:', err);
        if (isMounted) setSyncStatus('offline');
      }
    );

    // Subscribe to projects
    const unsubProjects = taskSyncService.subscribeToProjects(
      user.uid,
      (remoteProjects) => {
        if (!isMounted) return;
        if (remoteProjects.length > 0) {
          setProjects(remoteProjects);
        }
      },
      (err) => {
        console.warn('Project sync listener error:', err);
      }
    );

    return () => {
      isMounted = false;
      unsubTasks();
      unsubProjects();
    };
  }, [user, isConfigured]);

  const forceSyncToCloud = useCallback(async () => {
    if (!user) {
      showToast('Offline mode: Sign in to sync across devices');
      return;
    }
    setSyncStatus('syncing');
    try {
      await taskSyncService.batchMigrate(user.uid, tasks, projects);
      setSyncStatus('synced');
      setLastSyncedAt(new Date());
      showToast('All tasks & projects synced to Cloud!');
    } catch (err) {
      console.error('Manual sync failed:', err);
      setSyncStatus('offline');
      showToast('Sync queued in offline cache');
    }
  }, [user, tasks, projects, showToast]);

  // Compute overdue tasks
  const todayStr = formatLocalDate(new Date());
  const overdueTasks = tasks.filter(
    (t) =>
      !t.deletedAt &&
      !t.archivedAt &&
      t.status !== 'done' &&
      t.dueDate &&
      t.dueDate < todayStr &&
      t.dueDate !== ''
  );

  // Core Task Actions via Command Service
  const addTask = useCallback(
    (input: string, explicitOverrides?: Partial<Task>): Task => {
      const defaultPlanned = activeView === 'today' ? todayStr : undefined;
      const defaultProj = activeView.startsWith('project:') ? activeView.split(':')[1] : undefined;

      const result = commandService.createTask(tasks, input, explicitOverrides, {
        defaultPlannedDate: defaultPlanned,
        defaultProjectId: defaultProj,
      });

      setTasks(result.updatedTasks);
      pushUndo(result.description, result.inverse);
      audioEngine.playClickSound();

      if (user) {
        taskSyncService.saveTask(user.uid, result.createdTask).catch((err) => {
          console.warn('Cloud task sync queued offline:', err);
        });
      }

      return result.createdTask;
    },
    [tasks, activeView, todayStr, pushUndo, user]
  );

  const addMultipleTasks = useCallback(
    (lines: string[]) => {
      const cleanLines = lines.map((l) => l.trim()).filter((l) => l.length > 0);
      if (cleanLines.length === 0) return;

      let currentList = tasks;
      const created: Task[] = [];

      for (const line of cleanLines) {
        const res = commandService.createTask(currentList, line, undefined, {
          defaultPlannedDate: activeView === 'today' ? todayStr : undefined,
          defaultProjectId: activeView.startsWith('project:') ? activeView.split(':')[1] : 'inbox',
        });
        currentList = res.updatedTasks;
        created.push(res.createdTask);
      }

      setTasks(currentList);
      pushUndo(`Added ${created.length} tasks`, (curr) =>
        curr.filter((t) => !created.some((c) => c.id === t.id))
      );

      if (user && created.length > 0) {
        taskSyncService.batchMigrate(user.uid, created, []).catch((err) => {
          console.warn('Batch task sync queued offline:', err);
        });
      }

      showToast(`Added ${created.length} tasks`);
    },
    [tasks, activeView, todayStr, pushUndo, user, showToast]
  );

  const updateTask = useCallback(
    (id: string, updates: Partial<Task>) => {
      const result = commandService.updateTask(tasks, id, updates);
      setTasks(result.updatedTasks);
      pushUndo(result.description, result.inverse);

      const updated = result.updatedTasks.find((t) => t.id === id);
      if (user && updated) {
        taskSyncService.saveTask(user.uid, updated).catch((err) => {
          console.warn('Task update queued offline:', err);
        });
      }
    },
    [tasks, pushUndo, user]
  );

  const deleteTask = useCallback(
    (id: string) => {
      const result = commandService.deleteTask(tasks, id);
      setTasks(result.updatedTasks);
      pushUndo(result.description, result.inverse);
      audioEngine.playTaskComplete();

      const deleted = result.updatedTasks.find((t) => t.id === id);
      if (user && deleted) {
        taskSyncService.saveTask(user.uid, deleted).catch((err) => {
          console.warn('Delete sync queued offline:', err);
        });
      }

      showToast('Task moved to Trash', 'Undo', () => undoLastAction());
    },
    [tasks, pushUndo, user, showToast, undoLastAction]
  );

  const permanentDeleteTask = useCallback(
    (id: string) => {
      const result = commandService.permanentDeleteTask(tasks, id);
      setTasks(result.updatedTasks);
      pushUndo(result.description, result.inverse);

      if (user) {
        taskSyncService.deleteTask(user.uid, id).catch((err) => {
          console.warn('Permanent delete sync queued offline:', err);
        });
      }

      showToast('Task permanently deleted');
    },
    [tasks, pushUndo, user, showToast]
  );

  const archiveTask = useCallback(
    (id: string) => {
      const result = commandService.archiveTask(tasks, id);
      setTasks(result.updatedTasks);
      pushUndo(result.description, result.inverse);

      const archived = result.updatedTasks.find((t) => t.id === id);
      if (user && archived) {
        taskSyncService.saveTask(user.uid, archived).catch((err) => {
          console.warn('Archive sync queued offline:', err);
        });
      }

      showToast('Task archived', 'Undo', () => undoLastAction());
    },
    [tasks, pushUndo, user, showToast, undoLastAction]
  );

  const restoreTask = useCallback(
    (id: string) => {
      const result = commandService.restoreTask(tasks, id);
      setTasks(result.updatedTasks);
      pushUndo(result.description, result.inverse);

      const restored = result.updatedTasks.find((t) => t.id === id);
      if (user && restored) {
        taskSyncService.saveTask(user.uid, restored).catch((err) => {
          console.warn('Restore sync queued offline:', err);
        });
      }

      showToast('Task restored');
    },
    [tasks, pushUndo, user, showToast]
  );

  const toggleTaskStatus = useCallback(
    (id: string) => {
      const target = tasks.find((t) => t.id === id);
      if (!target) return;

      const result = commandService.toggleTaskStatus(tasks, id);
      setTasks(result.updatedTasks);
      pushUndo(result.description, result.inverse);

      if (target.status !== 'done') {
        audioEngine.playTaskComplete();
        confetti({
          particleCount: 25,
          spread: 45,
          origin: { y: 0.8 },
          colors: ['#6366f1', '#10b981', '#f59e0b'],
        });
      }

      if (user) {
        const completed = result.updatedTasks.find((t) => t.id === id);
        if (completed) {
          taskSyncService.saveTask(user.uid, completed).catch((err) => {
            console.warn('Task completion sync queued offline:', err);
          });
        }
        if (result.sideEffects?.nextRecurringTaskId) {
          const nextOccur = result.updatedTasks.find(
            (t) => t.id === result.sideEffects!.nextRecurringTaskId
          );
          if (nextOccur) {
            taskSyncService.saveTask(user.uid, nextOccur).catch((err) => {
              console.warn('Recurring task sync queued offline:', err);
            });
          }
        }
      }
    },
    [tasks, pushUndo, user]
  );

  const toggleTaskPinToday = useCallback(
    (id: string): boolean => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return false;

      const isPinnedForToday = task.isPinnedToday && task.topThreeDate === todayStr;

      if (!isPinnedForToday) {
        // Enforce Top 3 limit for today
        const currentPinnedTodayCount = tasks.filter(
          (t) =>
            !t.deletedAt &&
            !t.archivedAt &&
            t.status !== 'done' &&
            t.isPinnedToday &&
            (t.topThreeDate === todayStr || (!t.topThreeDate && t.plannedDate === todayStr))
        ).length;

        if (currentPinnedTodayCount >= 3) {
          showToast('Rule of 3: Focus on at most 3 core tasks per day for maximum depth.');
          return false;
        }

        updateTask(id, {
          isPinnedToday: true,
          topThreeDate: todayStr,
          plannedDate: task.plannedDate || todayStr,
        });
        audioEngine.playClickSound();
      } else {
        updateTask(id, { isPinnedToday: false, topThreeDate: undefined });
      }

      return true;
    },
    [tasks, todayStr, showToast, updateTask]
  );

  const toggleSubTask = useCallback(
    (taskId: string, subtaskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      const subtasks = task.subtasks.map((s) =>
        s.id === subtaskId ? { ...s, completed: !s.completed } : s
      );

      updateTask(taskId, { subtasks });
      audioEngine.playClickSound();
    },
    [tasks, updateTask]
  );

  const addSubTask = useCallback(
    (taskId: string, title: string, estimatedMinutes?: number, extra?: Partial<SubTask>) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      const newSub: SubTask = {
        id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title: title.trim(),
        completed: false,
        estimatedMinutes,
        ...extra,
      };

      updateTask(taskId, { subtasks: [...task.subtasks, newSub] });
      audioEngine.playClickSound();
    },
    [tasks, updateTask]
  );

  const updateSubTask = useCallback(
    (taskId: string, subtaskId: string, updates: Partial<SubTask>) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      const subtasks = task.subtasks.map((s) =>
        s.id === subtaskId ? { ...s, ...updates } : s
      );

      updateTask(taskId, { subtasks });
    },
    [tasks, updateTask]
  );

  const deleteSubTask = useCallback(
    (taskId: string, subtaskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      const subtasks = task.subtasks.filter((s) => s.id !== subtaskId);
      updateTask(taskId, { subtasks });
    },
    [tasks, updateTask]
  );

  const promoteSubTaskToTask = useCallback(
    (taskId: string, subtaskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      const subtask = task.subtasks.find((s) => s.id === subtaskId);
      if (!subtask) return;

      // Remove from parent
      deleteSubTask(taskId, subtaskId);

      // Create new standalone task inheriting project and context
      addTask(subtask.title, {
        projectId: task.projectId,
        plannedDate: task.plannedDate,
        dueDate: task.dueDate,
        priority: task.priority,
        estimatedMinutes: subtask.estimatedMinutes || 15,
        contextTags: task.contextTags,
      });

      showToast(`Promoted "${subtask.title}" to standalone task`);
    },
    [tasks, deleteSubTask, addTask, showToast]
  );

  const moveSubTask = useCallback(
    (taskId: string, subtaskId: string, direction: 'up' | 'down') => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      const index = task.subtasks.findIndex((s) => s.id === subtaskId);
      if (index === -1) return;

      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= task.subtasks.length) return;

      const updated = [...task.subtasks];
      const [moved] = updated.splice(index, 1);
      updated.splice(targetIndex, 0, moved);

      updateTask(taskId, { subtasks: updated });
    },
    [tasks, updateTask]
  );

  const duplicateTask = useCallback(
    (taskId: string): Task | null => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return null;

      const duplicated = addTask(`${task.title} (Copy)`, {
        description: task.description,
        priority: task.priority,
        projectId: task.projectId,
        plannedDate: task.plannedDate,
        dueDate: task.dueDate,
        dueTime: task.dueTime,
        estimatedMinutes: task.estimatedMinutes,
        recurrence: task.recurrence,
        customRecurrence: task.customRecurrence,
        tags: task.tags ? [...task.tags] : undefined,
        contextTags: task.contextTags ? [...task.contextTags] : undefined,
        subtasks: task.subtasks.map((s) => ({
          ...s,
          id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          completed: false,
        })),
      });

      showToast('Task duplicated');
      return duplicated;
    },
    [tasks, addTask, showToast]
  );

  const mergeTasks = useCallback(
    (targetTaskId: string, sourceTaskId: string) => {
      const result = commandService.mergeTasks(tasks, targetTaskId, sourceTaskId);
      setTasks(result.updatedTasks);
      pushUndo(result.description, result.inverse);

      if (user) {
        taskSyncService.batchMigrate(user.uid, result.updatedTasks, projects).catch((err) => {
          console.warn('Merge sync queued offline:', err);
        });
      }

      showToast('Tasks merged successfully');
    },
    [tasks, pushUndo, user, projects, showToast]
  );

  const addStudySessions = useCallback(
    (sessions: ParsedSession[], dateStr: string = todayStr, projectId: string = 'work'): Task[] => {
      const created: Task[] = sessions.map((s) => convertSessionToTask(s, dateStr, projectId));
      const updatedList = [...created, ...tasks];

      setTasks(updatedList);
      if (user && created.length > 0) {
        taskSyncService.batchMigrate(user.uid, created, []).catch((err) => {
          console.warn('Study sessions sync queued offline:', err);
        });
      }

      showToast(`Added ${created.length} Study Sprint Sessions`);
      return created;
    },
    [tasks, todayStr, user, showToast]
  );

  const bulkRescheduleOverdue = useCallback(
    (action: 'today' | 'someday' | 'dismiss') => {
      const overdueIds = overdueTasks.map((t) => t.id);
      if (overdueIds.length === 0) return;

      if (action === 'today') {
        const result = commandService.batchUpdate(tasks, overdueIds, { plannedDate: todayStr });
        setTasks(result.updatedTasks);
        pushUndo(result.description, result.inverse);
        showToast(`Moved ${overdueIds.length} overdue tasks to Today`);
      } else if (action === 'someday') {
        const result = commandService.batchUpdate(tasks, overdueIds, { isSomeday: true, plannedDate: undefined });
        setTasks(result.updatedTasks);
        pushUndo(result.description, result.inverse);
        showToast(`Deferred ${overdueIds.length} overdue tasks to Someday`);
      } else {
        setIsTriageDismissed(true);
      }
    },
    [overdueTasks, tasks, todayStr, pushUndo, showToast]
  );

  // Focus Session Controls (Mini-player, Stopwatch, Pomodoro)
  const startFocusSession = useCallback(
    (mode: FocusSessionMode, taskId?: string | null, title?: string | null, targetSec?: number) => {
      const session = focusSessionService.startSession(mode, taskId, title, targetSec);
      setFocusSession(session);
      audioEngine.playClickSound();
    },
    []
  );

  const pauseFocusSession = useCallback(() => {
    if (!focusSession) return;
    const updated = focusSessionService.pauseSession(focusSession);
    setFocusSession(updated);
    audioEngine.playClickSound();
  }, [focusSession]);

  const resumeFocusSession = useCallback(() => {
    if (!focusSession) return;
    const updated = focusSessionService.resumeSession(focusSession);
    setFocusSession(updated);
    audioEngine.playClickSound();
  }, [focusSession]);

  const stopFocusSession = useCallback(() => {
    if (!focusSession) return;
    const { finalElapsedSeconds } = focusSessionService.stopSession(focusSession);
    setFocusSession(null);

    // If session was tied to a task, update its timeSpentMinutes idempotently
    if (focusSession.taskId && finalElapsedSeconds > 10) {
      const elapsedMinutes = Math.round(finalElapsedSeconds / 60);
      const task = tasks.find((t) => t.id === focusSession.taskId);
      if (task) {
        updateTask(task.id, {
          timeSpentMinutes: (task.timeSpentMinutes || 0) + (elapsedMinutes > 0 ? elapsedMinutes : 1),
        });
      }
    }
  }, [focusSession, tasks, updateTask]);

  // Backwards-compatible stopwatch shortcuts
  const activeTimerTaskId = focusSession?.taskId || null;
  const activeTimerSeconds = focusElapsedSeconds;

  const startTaskTimer = useCallback(
    (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      startFocusSession('stopwatch', taskId, task?.title);
    },
    [tasks, startFocusSession]
  );

  const stopTaskTimer = useCallback(() => {
    stopFocusSession();
  }, [stopFocusSession]);

  const toggleTaskTimer = useCallback(
    (taskId: string) => {
      if (focusSession && focusSession.taskId === taskId) {
        if (focusSession.state === 'running') {
          pauseFocusSession();
        } else {
          resumeFocusSession();
        }
      } else {
        const task = tasks.find((t) => t.id === taskId);
        startFocusSession('stopwatch', taskId, task?.title);
      }
    },
    [focusSession, tasks, pauseFocusSession, resumeFocusSession, startFocusSession]
  );

  // Multi-Select Batch Actions
  const toggleTaskSelection = useCallback((taskId: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  }, []);

  const selectTask = useCallback((taskId: string) => {
    setSelectedTaskIds((prev) => (prev.includes(taskId) ? prev : [...prev, taskId]));
  }, []);

  const deselectTask = useCallback((taskId: string) => {
    setSelectedTaskIds((prev) => prev.filter((id) => id !== taskId));
  }, []);

  const selectAllTasks = useCallback((taskIds: string[]) => {
    setSelectedTaskIds(taskIds);
  }, []);

  const clearTaskSelection = useCallback(() => {
    setSelectedTaskIds([]);
  }, []);

  const batchUpdateTasks = useCallback(
    (taskIds: string[], updates: Partial<Task>) => {
      const result = commandService.batchUpdate(tasks, taskIds, updates);
      setTasks(result.updatedTasks);
      pushUndo(result.description, result.inverse);

      if (user) {
        const affected = result.updatedTasks.filter((t) => taskIds.includes(t.id));
        taskSyncService.batchMigrate(user.uid, affected, []).catch((err) => {
          console.warn('Batch update sync queued offline:', err);
        });
      }

      showToast(`Updated ${taskIds.length} tasks`);
    },
    [tasks, pushUndo, user, showToast]
  );

  const batchDeleteTasks = useCallback(
    (taskIds: string[]) => {
      const result = commandService.batchDelete(tasks, taskIds);
      setTasks(result.updatedTasks);
      pushUndo(result.description, result.inverse);
      clearTaskSelection();

      if (user) {
        const affected = result.updatedTasks.filter((t) => taskIds.includes(t.id));
        taskSyncService.batchMigrate(user.uid, affected, []).catch((err) => {
          console.warn('Batch delete sync queued offline:', err);
        });
      }

      showToast(`Moved ${taskIds.length} tasks to Trash`, 'Undo', () => undoLastAction());
    },
    [tasks, pushUndo, clearTaskSelection, user, showToast, undoLastAction]
  );

  const batchToggleStatus = useCallback(
    (taskIds: string[]) => {
      const areAllDone = tasks
        .filter((t) => taskIds.includes(t.id))
        .every((t) => t.status === 'done');
      const nextStatus = areAllDone ? 'todo' : 'done';

      batchUpdateTasks(taskIds, {
        status: nextStatus,
        completedAt: nextStatus === 'done' ? Date.now() : undefined,
      });

      if (nextStatus === 'done') {
        audioEngine.playTaskComplete();
      }
    },
    [tasks, batchUpdateTasks]
  );

  // Interruption Stash & Restore
  const stashActiveFocus = useCallback(
    (overrideTask?: { id: string; title: string; projectId?: string }, overrideElapsed?: number) => {
      const taskId = overrideTask?.id || focusSession?.taskId;
      const title = overrideTask?.title || focusSession?.taskTitle || 'Current Focus';
      const elapsed = overrideElapsed !== undefined ? overrideElapsed : focusElapsedSeconds;

      if (!taskId) return;

      const stash: InterruptionStash = {
        taskId,
        taskTitle: title,
        elapsedSeconds: elapsed,
        stashedAt: Date.now(),
        projectId: overrideTask?.projectId || focusSession?.projectId || undefined,
      };

      setInterruptionStash(stash);
      localStorage.setItem('flowtask_interruption_stash', JSON.stringify(stash));
      stopFocusSession();
      audioEngine.playClickSound();
      showToast(`Stashed: "${title}" (${Math.floor(elapsed / 60)}m)`, 'View', () =>
        setIsInterruptionModalOpen(true)
      );
    },
    [focusSession, focusElapsedSeconds, stopFocusSession, showToast]
  );

  const restoreStashedFocus = useCallback(() => {
    if (!interruptionStash) return;
    startFocusSession('stopwatch', interruptionStash.taskId, interruptionStash.taskTitle);
    setInterruptionStash(null);
    localStorage.removeItem('flowtask_interruption_stash');
    showToast(`Resumed focus: "${interruptionStash.taskTitle}"`);
  }, [interruptionStash, startFocusSession, showToast]);

  const clearInterruptionStash = useCallback(() => {
    setInterruptionStash(null);
    localStorage.removeItem('flowtask_interruption_stash');
  }, []);

  // Calendar External ICS
  const setCalendarIcsUrl = useCallback((url: string) => {
    setCalendarIcsUrlState(url);
    localStorage.setItem('flowtask_calendar_ics_url', url);
  }, []);

  const refreshCalendarEvents = useCallback(async () => {
    if (!calendarIcsUrl.trim()) {
      setCalendarEvents([]);
      return;
    }
    const events = await fetchICSFeed(calendarIcsUrl, todayStr);
    setCalendarEvents(events);
  }, [calendarIcsUrl, todayStr]);

  useEffect(() => {
    if (calendarIcsUrl) {
      refreshCalendarEvents();
    }
  }, [calendarIcsUrl, refreshCalendarEvents]);

  // Project Management Actions
  const addProject = useCallback(
    (name: string, color: string, icon?: string) => {
      const newProj: Project = {
        id: `proj-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: name.trim(),
        color,
        icon,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const updated = [...projects, newProj];
      setProjects(updated);
      saveProjectsToStorage(updated);

      if (user) {
        taskSyncService.saveProject(user.uid, newProj).catch((err) => {
          console.warn('Project sync error:', err);
        });
      }

      showToast(`Project "${newProj.name}" created`);
    },
    [projects, user, showToast]
  );

  const updateProject = useCallback(
    (id: string, updates: Partial<Project>) => {
      const updated = projects.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
      );
      setProjects(updated);
      saveProjectsToStorage(updated);

      const modified = updated.find((p) => p.id === id);
      if (user && modified) {
        taskSyncService.saveProject(user.uid, modified).catch((err) => {
          console.warn('Project update sync error:', err);
        });
      }
    },
    [projects, user]
  );

  const deleteProject = useCallback(
    (id: string, reassignToProjectId: string = 'inbox') => {
      if (['inbox', 'work', 'personal'].includes(id)) {
        showToast('Default projects cannot be deleted');
        return;
      }

      // Reassign any tasks belonging to this project
      const tasksToReassign = tasks.filter((t) => t.projectId === id);
      if (tasksToReassign.length > 0) {
        batchUpdateTasks(
          tasksToReassign.map((t) => t.id),
          { projectId: reassignToProjectId }
        );
      }

      const updatedProjects = projects.filter((p) => p.id !== id);
      setProjects(updatedProjects);
      saveProjectsToStorage(updatedProjects);

      if (user) {
        taskSyncService.deleteProject(user.uid, id).catch((err) => {
          console.warn('Project deletion sync error:', err);
        });
      }

      showToast(`Project deleted (tasks moved to ${reassignToProjectId})`);
    },
    [projects, tasks, batchUpdateTasks, user, showToast]
  );

  const archiveProject = useCallback(
    (id: string) => {
      updateProject(id, { isArchived: true, archivedAt: Date.now() });
      showToast('Project archived');
    },
    [updateProject, showToast]
  );

  // Smart Views
  const smartViews: SmartFilterView[] = [...BUILT_IN_SMART_VIEWS, ...customSmartViews];

  const addSmartView = useCallback(
    (name: string, icon: string, color: string, predicate: SmartFilterPredicate): SmartFilterView => {
      const newView: SmartFilterView = {
        id: `smart_${Date.now()}`,
        name,
        icon,
        color,
        predicate,
      };

      const updated = [...customSmartViews, newView];
      setCustomSmartViews(updated);
      localStorage.setItem('flowtask_custom_smart_views', JSON.stringify(updated));
      showToast(`Smart View "${name}" saved`);
      return newView;
    },
    [customSmartViews, showToast]
  );

  const deleteSmartView = useCallback(
    (id: string) => {
      const updated = customSmartViews.filter((v) => v.id !== id);
      setCustomSmartViews(updated);
      localStorage.setItem('flowtask_custom_smart_views', JSON.stringify(updated));
      showToast('Smart View removed');
    },
    [customSmartViews, showToast]
  );

  // Import Tasks
  const importTasks = useCallback(
    async (importedTasks: Task[], importedProjects?: Project[], replace: boolean = false) => {
      if (replace) {
        // Snapshot current state before destructive replace
        const newProjects = importedProjects && importedProjects.length > 0 ? importedProjects : projects;
        setTasks(importedTasks);
        setProjects(newProjects);

        if (user) {
          await taskSyncService.batchReplace(user.uid, importedTasks, newProjects);
        }
        showToast(`Replaced workspace with ${importedTasks.length} tasks`);
      } else {
        // Merge without duplicates
        const existingIds = new Set(tasks.map((t) => t.id));
        const nonDuplicateTasks = importedTasks.filter((t) => !existingIds.has(t.id));
        const mergedTasks = [...nonDuplicateTasks, ...tasks];

        setTasks(mergedTasks);
        if (importedProjects && importedProjects.length > 0) {
          const existingProjIds = new Set(projects.map((p) => p.id));
          const newProjs = importedProjects.filter((p) => !existingProjIds.has(p.id));
          if (newProjs.length > 0) {
            const mergedProjs = [...projects, ...newProjs];
            setProjects(mergedProjs);
          }
        }

        if (user && nonDuplicateTasks.length > 0) {
          await taskSyncService.batchMigrate(user.uid, nonDuplicateTasks, importedProjects || []);
        }
        showToast(`Imported ${nonDuplicateTasks.length} tasks`);
      }
    },
    [tasks, projects, user, showToast]
  );

  const dismissShutdown = useCallback(() => setIsShutdownDismissed(true), []);

  return (
    <TaskContext.Provider
      value={{
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
      }}
    >
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
