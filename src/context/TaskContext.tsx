import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import confetti from 'canvas-confetti';
import type { Task, SubTask, Project, ViewId, Priority, CalendarEvent, InterruptionStash, SmartFilterView, SmartFilterPredicate } from '../types/task';
import { parseTaskInput, formatLocalDate } from '../utils/nlpParser';
import { BUILT_IN_SMART_VIEWS } from '../utils/smartViewUtils';
import { audioEngine, type SoundProfile } from '../utils/audioEngine';
import {
  loadTasksFromStorage,
  saveTasksToStorage,
  loadProjectsFromStorage,
  saveProjectsToStorage,
  calculateNextDueDate,
} from '../utils/storage';
import { useAuth } from './AuthContext';
import { taskSyncService } from '../services/taskSyncService';
import { fetchICSFeed } from '../services/calendarService';
import { checkAndTriggerDailyAutoSnapshot } from '../utils/backupService';
import { parseTimeToMinutes, minutesToTimeStr } from '../utils/timelineUtils';
import { convertSessionToTask, type ParsedSession } from '../utils/sessionParser';

interface UndoAction {
  description: string;
  previousTasks: Task[];
}

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'local';

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

  // Live Task Stopwatch
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

  // Task Duplication
  duplicateTask: (taskId: string) => Task | null;

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

  // Actions
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

  addTask: (input: string, explicitOverrides?: Partial<Task>) => Task;
  addMultipleTasks: (lines: string[]) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  toggleTaskStatus: (id: string) => void;
  toggleTaskPinToday: (id: string) => boolean; // returns false if already 3 pinned
  toggleSubTask: (taskId: string, subtaskId: string) => void;
  addSubTask: (taskId: string, title: string, estimatedMinutes?: number, extra?: Partial<SubTask>) => void;
  updateSubTask: (taskId: string, subtaskId: string, updates: Partial<SubTask>) => void;
  deleteSubTask: (taskId: string, subtaskId: string) => void;
  addStudySessions: (sessions: ParsedSession[], dateStr?: string, projectId?: string) => Task[];
  bulkRescheduleOverdue: (action: 'today' | 'someday' | 'dismiss') => void;
  undoLastAction: () => void;
  addProject: (name: string, color: string, icon?: string) => void;
  importTasks: (tasks: Task[], projects?: Project[]) => void;
  showToast: (message: string, actionLabel?: string, onAction?: () => void) => void;
  clearToast: () => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const TaskProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, isConfigured } = useAuth();

  const [tasks, setTasks] = useState<Task[]>(() => loadTasksFromStorage());
  const [projects, setProjects] = useState<Project[]>(() => loadProjectsFromStorage());
  const [activeView, setActiveView] = useState<ViewId>('today');
  const [viewLayout, setViewLayout] = useState<'list' | 'kanban' | 'matrix'>('list');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [quickWinsOnly, setQuickWinsOnly] = useState(false);
  const [isTriageDismissed, setIsTriageDismissed] = useState(false);
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [toast, setToast] = useState<{ message: string; actionLabel?: string; onAction?: () => void } | null>(null);

  // Cloud Sync state
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(isConfigured ? 'syncing' : 'local');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Active Task Stopwatch state
  const [activeTimerTaskId, setActiveTimerTaskId] = useState<string | null>(() => {
    return localStorage.getItem('flowtask_active_timer_task_id') || null;
  });
  const [activeTimerSeconds, setActiveTimerSeconds] = useState<number>(0);

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

  // Stopwatch interval ticker
  useEffect(() => {
    if (!activeTimerTaskId) {
      setActiveTimerSeconds(0);
      return;
    }
    const startedAt = Date.now() - activeTimerSeconds * 1000;
    const interval = setInterval(() => {
      setActiveTimerSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTimerTaskId]);

  // Theme state
  const [theme, setThemeState] = useState<AppTheme>(() => {
    const saved = localStorage.getItem('flowtask_theme') as AppTheme;
    if (saved && ['light', 'dark', 'tokyo', 'nord', 'matcha'].includes(saved)) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // Sound profile state
  const [soundProfile, setSoundProfileState] = useState<SoundProfile>(() => audioEngine.getSoundProfile());
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => audioEngine.getSoundEnabled());

  // Save to localStorage whenever tasks change locally
  useEffect(() => {
    saveTasksToStorage(tasks);
  }, [tasks]);

  useEffect(() => {
    saveProjectsToStorage(projects);
  }, [projects]);

  // Rolling local snapshot safety net
  useEffect(() => {
    if (tasks.length > 0) {
      checkAndTriggerDailyAutoSnapshot(tasks, projects);
    }
  }, [tasks, projects]);

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

  const pushUndo = useCallback((description: string, prevTasks: Task[]) => {
    setUndoStack((prev) => [{ description, previousTasks: prevTasks }, ...prev.slice(0, 9)]);
  }, []);

  const undoLastAction = useCallback(() => {
    if (undoStack.length === 0) return;
    const [actionToUndo, ...rest] = undoStack;
    setUndoStack(rest);
    setTasks(actionToUndo.previousTasks);
    if (user) {
      taskSyncService.batchMigrate(user.uid, actionToUndo.previousTasks, projects).catch((err) => {
        console.warn('Failed to sync undo to cloud:', err);
      });
    }
    showToast(`Undone: ${actionToUndo.description}`);
  }, [undoStack, user, projects, showToast]);

  // Firebase Real-time Synchronization effect
  useEffect(() => {
    if (!isConfigured || !user) {
      setSyncStatus('local');
      return;
    }

    let isMounted = true;
    setSyncStatus('syncing');

    // Check if cloud has existing tasks; if empty, migrate initial/local data
    taskSyncService
      .checkHasRemoteData(user.uid)
      .then(async (hasRemote) => {
        if (!isMounted) return;
        if (!hasRemote) {
          const currentLocalTasks = loadTasksFromStorage();
          const currentLocalProjects = loadProjectsFromStorage();
          if (currentLocalTasks.length > 0 || currentLocalProjects.length > 0) {
            await taskSyncService.batchMigrate(user.uid, currentLocalTasks, currentLocalProjects);
          }
        }
      })
      .catch((err) => {
        console.warn('Initial remote check warning:', err);
      });

    // Real-time listener for tasks
    const unsubTasks = taskSyncService.subscribeToTasks(
      user.uid,
      (remoteTasks, hasPendingWrites) => {
        if (!isMounted) return;
        if (remoteTasks.length > 0) {
          setTasks(remoteTasks);
        }
        setSyncStatus(hasPendingWrites ? 'syncing' : 'synced');
        setLastSyncedAt(new Date());
      },
      (err) => {
        console.warn('Task sync listener reported offline:', err);
        if (isMounted) setSyncStatus('offline');
      }
    );

    // Real-time listener for projects
    const unsubProjects = taskSyncService.subscribeToProjects(
      user.uid,
      (remoteProjects) => {
        if (!isMounted) return;
        if (remoteProjects.length > 0) {
          setProjects(remoteProjects);
        }
      },
      (err) => {
        console.warn('Project sync listener reported offline:', err);
      }
    );

    return () => {
      isMounted = false;
      unsubTasks();
      unsubProjects();
    };
  }, [user, isConfigured]);

  // Force sync helper
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

  // Compute overdue tasks (tasks not done with dueDate before today)
  const todayStr = formatLocalDate(new Date());
  const overdueTasks = tasks.filter(
    (t) => t.status !== 'done' && t.dueDate && t.dueDate < todayStr && t.dueDate !== ''
  );

  // Add Task
  const addTask = useCallback(
    (input: string, explicitOverrides?: Partial<Task>): Task => {
      const parsed = parseTaskInput(input);
      let targetProjectId = explicitOverrides?.projectId;

      if (!targetProjectId && parsed.projectTag) {
        const found = projects.find((p) => p.name.toLowerCase() === parsed.projectTag?.toLowerCase());
        if (found) targetProjectId = found.id;
      }
      if (!targetProjectId) {
        if (activeView.startsWith('project:')) {
          targetProjectId = activeView.split(':')[1];
        } else {
          targetProjectId = 'inbox';
        }
      }

      // Default due date logic: if currently on Today view, default to today if not parsed
      let defaultDueDate = parsed.dueDate || explicitOverrides?.dueDate;
      if (!defaultDueDate && activeView === 'today') {
        defaultDueDate = todayStr;
      }

      // Automatically allocate timeline schedule slots if dueTime and duration exist
      let scheduledStart = explicitOverrides?.scheduledStart;
      let scheduledEnd = explicitOverrides?.scheduledEnd;
      const effectiveDueTime = parsed.dueTime || explicitOverrides?.dueTime;
      const effectiveDuration = parsed.estimatedMinutes || explicitOverrides?.estimatedMinutes;

      if (!scheduledStart && effectiveDueTime) {
        scheduledStart = effectiveDueTime;
        if (!scheduledEnd && effectiveDuration) {
          const startMin = parseTimeToMinutes(effectiveDueTime);
          if (startMin !== null) {
            const endMin = Math.min(1439, startMin + effectiveDuration);
            scheduledEnd = minutesToTimeStr(endMin);
          }
        }
      }

      const newTask: Task = {
        id: 'task-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        title: parsed.cleanTitle || 'Untitled task',
        description: explicitOverrides?.description || '',
        status: 'todo',
        priority: parsed.priority || explicitOverrides?.priority || 'p4',
        projectId: targetProjectId,
        dueDate: defaultDueDate,
        dueTime: effectiveDueTime,
        estimatedMinutes: effectiveDuration,
        subtasks: explicitOverrides?.subtasks || [],
        recurrence: parsed.recurrence || explicitOverrides?.recurrence || 'none',
        customRecurrence: explicitOverrides?.customRecurrence || parsed.customRecurrence,
        isPinnedToday: explicitOverrides?.isPinnedToday || false,
        scheduledStart,
        scheduledEnd,
        tags: explicitOverrides?.tags || parsed.tags,
        contextTags: explicitOverrides?.contextTags || parsed.contextTags,
        createdAt: Date.now(),
      };

      setTasks((prev) => [newTask, ...prev]);
      audioEngine.playClickSound();

      if (user) {
        taskSyncService.saveTask(user.uid, newTask).catch((err) => {
          console.warn('Cloud task sync queued offline:', err);
        });
      }

      return newTask;
    },
    [activeView, projects, todayStr, user]
  );

  // Add multiple tasks from multi-line brain dump
  const addMultipleTasks = useCallback(
    (lines: string[]) => {
      const cleanLines = lines.map((l) => l.trim()).filter((l) => l.length > 0);
      if (cleanLines.length === 0) return;

      const created: Task[] = [];
      setTasks((prev) => {
        const newTasks = [...prev];
        for (const line of cleanLines) {
          const parsed = parseTaskInput(line);
          const t: Task = {
            id: 'task-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
            title: parsed.cleanTitle || line,
            status: 'todo',
            priority: parsed.priority || 'p4',
            projectId: activeView.startsWith('project:') ? activeView.split(':')[1] : 'inbox',
            dueDate: parsed.dueDate || (activeView === 'today' ? todayStr : undefined),
            dueTime: parsed.dueTime,
            estimatedMinutes: parsed.estimatedMinutes,
            contextTags: parsed.contextTags,
            subtasks: [],
            recurrence: 'none',
            createdAt: Date.now(),
          };
          created.push(t);
          newTasks.unshift(t);
        }
        return newTasks;
      });

      if (user && created.length > 0) {
        taskSyncService.batchMigrate(user.uid, created, []).catch((err) => {
          console.warn('Batch task sync queued offline:', err);
        });
      }

      showToast(`Added ${cleanLines.length} tasks from Brain Dump`);
    },
    [activeView, todayStr, showToast, user]
  );

  // Update Task
  const updateTask = useCallback(
    (id: string, updates: Partial<Task>) => {
      let updatedTask: Task | undefined;
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id === id) {
            updatedTask = { ...t, ...updates };
            return updatedTask;
          }
          return t;
        })
      );

      if (user && updatedTask) {
        taskSyncService.saveTask(user.uid, updatedTask).catch((err) => {
          console.warn('Task update queued offline:', err);
        });
      }
    },
    [user]
  );

  // Delete Task with Undo
  const deleteTask = useCallback(
    (id: string) => {
      const taskToDelete = tasks.find((t) => t.id === id);
      if (!taskToDelete) return;

      const prevTasks = [...tasks];
      pushUndo(`Deleted "${taskToDelete.title}"`, prevTasks);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      if (selectedTaskId === id) setSelectedTaskId(null);

      if (user) {
        taskSyncService.deleteTask(user.uid, id).catch((err) => {
          console.warn('Cloud delete queued offline:', err);
        });
      }

      showToast(`Deleted "${taskToDelete.title}"`, 'Undo', () => {
        undoLastAction();
      });
    },
    [tasks, selectedTaskId, pushUndo, showToast, undoLastAction, user]
  );

  // Toggle Task Status (with sound, confetti, recurrence calculation, and undo)
  const toggleTaskStatus = useCallback(
    (id: string) => {
      const target = tasks.find((t) => t.id === id);
      if (!target) return;

      const isCompleting = target.status !== 'done';
      const prevTasks = [...tasks];

      if (isCompleting) {
        const pinnedTasks = tasks.filter((t) => t.isPinnedToday);
        const willFinishRuleOf3 =
          target.isPinnedToday &&
          pinnedTasks.length >= 1 &&
          pinnedTasks.every((t) => (t.id === id ? true : t.status === 'done'));

        if (willFinishRuleOf3) {
          audioEngine.playRuleOf3Fanfare();
          confetti({
            particleCount: 80,
            spread: 90,
            origin: { y: 0.5 },
            colors: ['#F59E0B', '#10B981', '#6366F1', '#EC4899'],
          });
        } else {
          audioEngine.playCompletionChime();
          if (activeView === 'today' || target.priority === 'p1') {
            confetti({
              particleCount: 40,
              spread: 60,
              origin: { y: 0.8 },
              colors: ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'],
              disableForReducedMotion: true,
            });
          }
        }
      } else {
        audioEngine.playTaskUncheckSound();
      }

      pushUndo(isCompleting ? `Completed "${target.title}"` : `Reopened "${target.title}"`, prevTasks);

      let modifiedTask: Task | undefined;
      let nextRecurringTask: Task | undefined;

      setTasks((prev) => {
        let updated = prev.map((t) => {
          if (t.id === id) {
            modifiedTask = {
              ...t,
              status: isCompleting ? ('done' as const) : ('todo' as const),
              completedAt: isCompleting ? Date.now() : undefined,
              isPinnedToday: isCompleting ? false : t.isPinnedToday,
            };
            return modifiedTask;
          }
          return t;
        });

        if (isCompleting && target.recurrence && target.recurrence !== 'none') {
          const nextDueDate = calculateNextDueDate(
            target.dueDate,
            target.recurrence,
            target.customRecurrence,
            Date.now()
          );
          nextRecurringTask = {
            ...target,
            id: 'task-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
            status: 'todo',
            dueDate: nextDueDate,
            completedAt: undefined,
            isPinnedToday: false,
            createdAt: Date.now(),
            subtasks: target.subtasks.map((s) => ({ ...s, completed: false })),
          };
          updated = [nextRecurringTask, ...updated];
        }

        return updated;
      });

      if (user) {
        if (modifiedTask) {
          taskSyncService.saveTask(user.uid, modifiedTask).catch((err) => {
            console.warn('Status sync queued offline:', err);
          });
        }
        if (nextRecurringTask) {
          taskSyncService.saveTask(user.uid, nextRecurringTask).catch((err) => {
            console.warn('Recurring task sync queued offline:', err);
          });
        }
      }

      showToast(
        isCompleting ? `Marked "${target.title}" done` : `Reopened "${target.title}"`,
        'Undo',
        () => undoLastAction()
      );
    },
    [tasks, activeView, pushUndo, showToast, undoLastAction, user]
  );

  // Toggle Task Pin for Rule of 3 in Today view
  const toggleTaskPinToday = useCallback(
    (id: string): boolean => {
      const target = tasks.find((t) => t.id === id);
      if (!target) return false;

      const currentlyPinned = tasks.filter((t) => t.isPinnedToday && t.id !== id);

      if (!target.isPinnedToday) {
        if (currentlyPinned.length >= 3) {
          showToast('Rule of 3: Focus on at most 3 top priorities today for maximum clarity!');
          return false;
        }
        updateTask(id, { isPinnedToday: true, dueDate: todayStr });
        audioEngine.playToggleSound(true);
        return true;
      } else {
        updateTask(id, { isPinnedToday: false });
        audioEngine.playToggleSound(false);
        return true;
      }
    },
    [tasks, todayStr, showToast, updateTask]
  );

  // Subtask management
  const toggleSubTask = useCallback(
    (taskId: string, subtaskId: string) => {
      let updatedTask: Task | undefined;
      let isNowCompleted = false;
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id === taskId) {
            const nextSubs = t.subtasks.map((s) => {
              if (s.id === subtaskId) {
                isNowCompleted = !s.completed;
                return { ...s, completed: isNowCompleted };
              }
              return s;
            });
            updatedTask = { ...t, subtasks: nextSubs };
            return updatedTask;
          }
          return t;
        })
      );
      audioEngine.playSubtaskToggle(isNowCompleted);

      if (user && updatedTask) {
        taskSyncService.saveTask(user.uid, updatedTask).catch((err) => {
          console.warn('Subtask sync queued offline:', err);
        });
      }
    },
    [user]
  );

  const addSubTask = useCallback(
    (taskId: string, title: string, estimatedMinutes?: number, extra?: Partial<SubTask>) => {
      if (!title.trim()) return;
      const newSub: SubTask = {
        id: 'sub-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        title: title.trim(),
        completed: false,
        estimatedMinutes: estimatedMinutes && estimatedMinutes > 0 ? estimatedMinutes : undefined,
        ...extra,
      };

      let updatedTask: Task | undefined;
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id === taskId) {
            updatedTask = { ...t, subtasks: [...t.subtasks, newSub] };
            return updatedTask;
          }
          return t;
        })
      );
      audioEngine.playClickSound();

      if (user && updatedTask) {
        taskSyncService.saveTask(user.uid, updatedTask).catch((err) => {
          console.warn('Subtask add queued offline:', err);
        });
      }
    },
    [user]
  );

  const updateSubTask = useCallback(
    (taskId: string, subtaskId: string, updates: Partial<SubTask>) => {
      let updatedTask: Task | undefined;
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id === taskId) {
            updatedTask = {
              ...t,
              subtasks: t.subtasks.map((s) => (s.id === subtaskId ? { ...s, ...updates } : s)),
            };
            return updatedTask;
          }
          return t;
        })
      );

      if (user && updatedTask) {
        taskSyncService.saveTask(user.uid, updatedTask).catch((err) => {
          console.warn('Subtask update queued offline:', err);
        });
      }
    },
    [user]
  );

  const deleteSubTask = useCallback(
    (taskId: string, subtaskId: string) => {
      let updatedTask: Task | undefined;
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id === taskId) {
            updatedTask = { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) };
            return updatedTask;
          }
          return t;
        })
      );

      if (user && updatedTask) {
        taskSyncService.saveTask(user.uid, updatedTask).catch((err) => {
          console.warn('Subtask delete queued offline:', err);
        });
      }
    },
    [user]
  );

  // Subtask-to-Task Promotion
  const promoteSubTaskToTask = useCallback(
    (taskId: string, subtaskId: string) => {
      const parent = tasks.find((t) => t.id === taskId);
      if (!parent) return;
      const sub = parent.subtasks?.find((s) => s.id === subtaskId);
      if (!sub) return;

      deleteSubTask(taskId, subtaskId);

      addTask(sub.title, {
        projectId: parent.projectId,
        priority: parent.priority,
        dueDate: parent.dueDate,
      });

      showToast(`Promoted "${sub.title}" to an independent task.`);
    },
    [tasks, deleteSubTask, addTask, showToast]
  );

  // Move / Reorder Subtask
  const moveSubTask = useCallback(
    (taskId: string, subtaskId: string, direction: 'up' | 'down') => {
      let updatedTask: Task | undefined;
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId || !t.subtasks) return t;
          const subs = [...t.subtasks];
          const index = subs.findIndex((s) => s.id === subtaskId);
          if (index === -1) return t;
          const targetIndex = direction === 'up' ? index - 1 : index + 1;
          if (targetIndex < 0 || targetIndex >= subs.length) return t;
          const [moved] = subs.splice(index, 1);
          subs.splice(targetIndex, 0, moved);
          updatedTask = { ...t, subtasks: subs };
          return updatedTask;
        })
      );

      if (user && updatedTask) {
        taskSyncService.saveTask(user.uid, updatedTask).catch((err) => {
          console.warn('Subtask move queued offline:', err);
        });
      }
    },
    [user]
  );

  // Duplicate / Clone Task
  const duplicateTask = useCallback(
    (taskId: string): Task | null => {
      const target = tasks.find((t) => t.id === taskId);
      if (!target) return null;
      const clone: Task = {
        ...target,
        id: 'task-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        title: `${target.title} (Copy)`,
        status: 'todo',
        completedAt: undefined,
        subtasks: (target.subtasks || []).map((s) => ({
          ...s,
          id: 'sub-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
          completed: false,
        })),
        createdAt: Date.now(),
      };
      setTasks((prev) => [clone, ...prev]);
      audioEngine.playClickSound();
      showToast(`Duplicated "${target.title}"`);
      if (user) {
        taskSyncService.saveTask(user.uid, clone).catch(console.warn);
      }
      return clone;
    },
    [tasks, user, showToast]
  );

  // Active Task Stopwatch actions
  const stopTaskTimer = useCallback(() => {
    if (!activeTimerTaskId) return;
    const elapsedSeconds = activeTimerSeconds;
    const minutesToAdd = Math.max(1, Math.round(elapsedSeconds / 60));

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === activeTimerTaskId) {
          return {
            ...t,
            timeSpentMinutes: (t.timeSpentMinutes || 0) + minutesToAdd,
          };
        }
        return t;
      })
    );

    localStorage.removeItem('flowtask_active_timer_task_id');
    setActiveTimerTaskId(null);
    setActiveTimerSeconds(0);
    audioEngine.playToggleSound(false);
    showToast(`Logged ${minutesToAdd}m of focus time.`);
  }, [activeTimerTaskId, activeTimerSeconds, showToast]);

  const startTaskTimer = useCallback(
    (taskId: string) => {
      if (activeTimerTaskId && activeTimerTaskId !== taskId) {
        stopTaskTimer();
      }
      setActiveTimerTaskId(taskId);
      setActiveTimerSeconds(0);
      localStorage.setItem('flowtask_active_timer_task_id', taskId);
      audioEngine.playToggleSound(true);
    },
    [activeTimerTaskId, stopTaskTimer]
  );

  const toggleTaskTimer = useCallback(
    (taskId: string) => {
      if (activeTimerTaskId === taskId) {
        stopTaskTimer();
      } else {
        startTaskTimer(taskId);
      }
    },
    [activeTimerTaskId, stopTaskTimer, startTaskTimer]
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
      if (taskIds.length === 0) return;
      pushUndo(`Bulk updated ${taskIds.length} tasks`, tasks);

      let updatedList: Task[] = [];
      setTasks((prev) => {
        updatedList = prev.map((t) => {
          if (taskIds.includes(t.id)) {
            return { ...t, ...updates };
          }
          return t;
        });
        return updatedList;
      });

      audioEngine.playClickSound();
      showToast(`Updated ${taskIds.length} tasks.`, 'Undo', undoLastAction);
      clearTaskSelection();

      if (user) {
        taskSyncService.batchMigrate(user.uid, updatedList, projects).catch((err) => {
          console.warn('Batch task update queued offline:', err);
        });
      }
    },
    [tasks, projects, user, pushUndo, showToast, clearTaskSelection, undoLastAction]
  );

  const batchDeleteTasks = useCallback(
    (taskIds: string[]) => {
      if (taskIds.length === 0) return;
      pushUndo(`Bulk deleted ${taskIds.length} tasks`, tasks);

      let remaining: Task[] = [];
      setTasks((prev) => {
        remaining = prev.filter((t) => !taskIds.includes(t.id));
        return remaining;
      });

      audioEngine.playClickSound();
      showToast(`Deleted ${taskIds.length} tasks.`, 'Undo', undoLastAction);
      clearTaskSelection();

      if (user) {
        taskSyncService.batchMigrate(user.uid, remaining, projects).catch((err) => {
          console.warn('Batch delete sync queued offline:', err);
        });
      }
    },
    [tasks, projects, user, pushUndo, showToast, clearTaskSelection, undoLastAction]
  );

  const batchToggleStatus = useCallback(
    (taskIds: string[]) => {
      if (taskIds.length === 0) return;
      pushUndo(`Toggled ${taskIds.length} tasks`, tasks);

      let updatedList: Task[] = [];
      setTasks((prev) => {
        const allDone = taskIds.every((id) => {
          const found = prev.find((t) => t.id === id);
          return found?.status === 'done';
        });
        const newStatus = allDone ? 'todo' : 'done';

        updatedList = prev.map((t) => {
          if (taskIds.includes(t.id)) {
            return {
              ...t,
              status: newStatus,
              completedAt: newStatus === 'done' ? Date.now() : undefined,
            };
          }
          return t;
        });
        return updatedList;
      });

      audioEngine.playCompletionChime();
      showToast(`Updated status for ${taskIds.length} tasks.`, 'Undo', undoLastAction);
      clearTaskSelection();

      if (user) {
        taskSyncService.batchMigrate(user.uid, updatedList, projects).catch((err) => {
          console.warn('Batch toggle status queued offline:', err);
        });
      }
    },
    [tasks, projects, user, pushUndo, showToast, clearTaskSelection, undoLastAction]
  );

  // Interruption Stash & Restore
  const stashActiveFocus = useCallback(
    (
      overrideTask?: { id: string; title: string; projectId?: string },
      overrideElapsed?: number
    ) => {
      const targetTaskId = overrideTask?.id || activeTimerTaskId;
      if (!targetTaskId) {
        setIsInterruptionModalOpen(true);
        return;
      }

      const currentTask = overrideTask || tasks.find((t) => t.id === targetTaskId);
      const elapsed =
        overrideElapsed !== undefined ? overrideElapsed : activeTimerSeconds;

      const stash: InterruptionStash = {
        taskId: targetTaskId,
        taskTitle: currentTask?.title || 'Focused Task',
        elapsedSeconds: elapsed,
        stashedAt: Date.now(),
        projectId: currentTask?.projectId,
      };

      setInterruptionStash(stash);
      localStorage.setItem('flowtask_interruption_stash', JSON.stringify(stash));

      localStorage.removeItem('flowtask_active_timer_task_id');
      setActiveTimerTaskId(null);
      setActiveTimerSeconds(0);

      setIsInterruptionModalOpen(true);
      audioEngine.playClickSound();
      showToast(`Stashed focus on "${stash.taskTitle}".`);
    },
    [activeTimerTaskId, activeTimerSeconds, tasks, showToast]
  );

  const restoreStashedFocus = useCallback(() => {
    if (!interruptionStash) return;

    startTaskTimer(interruptionStash.taskId);
    setActiveTimerSeconds(interruptionStash.elapsedSeconds);

    const title = interruptionStash.taskTitle;
    setInterruptionStash(null);
    localStorage.removeItem('flowtask_interruption_stash');
    setIsInterruptionModalOpen(false);

    audioEngine.playCompletionChime();
    showToast(`Restored focus on "${title}"!`);
  }, [interruptionStash, startTaskTimer, showToast]);

  const clearInterruptionStash = useCallback(() => {
    setInterruptionStash(null);
    localStorage.removeItem('flowtask_interruption_stash');
  }, []);

  // Keyboard shortcut listener for Alt+S, Alt+R, and Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        stashActiveFocus();
      } else if (e.altKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        restoreStashedFocus();
      } else if (e.key === 'Escape' && selectedTaskIds.length > 0 && !isInput) {
        clearTaskSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stashActiveFocus, restoreStashedFocus, selectedTaskIds, clearTaskSelection]);

  // Calendar ICS feed management
  const setCalendarIcsUrl = useCallback((url: string) => {
    setCalendarIcsUrlState(url);
    localStorage.setItem('flowtask_calendar_ics_url', url);
  }, []);

  const refreshCalendarEvents = useCallback(async () => {
    if (!calendarIcsUrl.trim()) {
      setCalendarEvents([]);
      return;
    }
    try {
      const today = formatLocalDate(new Date());
      const events = await fetchICSFeed(calendarIcsUrl, today);
      setCalendarEvents(events);
    } catch (err) {
      console.warn('Failed to refresh ICS calendar feed:', err);
    }
  }, [calendarIcsUrl]);

  useEffect(() => {
    if (calendarIcsUrl) {
      refreshCalendarEvents();
      const interval = setInterval(refreshCalendarEvents, 15 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [calendarIcsUrl, refreshCalendarEvents]);

  const dismissShutdown = useCallback(() => {
    setIsShutdownDismissed(true);
  }, []);

  // Smart Views Management
  const smartViews: SmartFilterView[] = [...BUILT_IN_SMART_VIEWS, ...customSmartViews];

  const addSmartView = useCallback(
    (name: string, icon: string, color: string, predicate: SmartFilterPredicate): SmartFilterView => {
      const newView: SmartFilterView = {
        id: 'sv-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        name: name.trim(),
        icon,
        color,
        predicate,
      };

      setCustomSmartViews((prev) => {
        const next = [...prev, newView];
        localStorage.setItem('flowtask_custom_smart_views', JSON.stringify(next));
        return next;
      });

      audioEngine.playCompletionChime();
      showToast(`Created smart view "${newView.name}".`);
      return newView;
    },
    [showToast]
  );

  const deleteSmartView = useCallback(
    (id: string) => {
      setCustomSmartViews((prev) => {
        const next = prev.filter((v) => v.id !== id);
        localStorage.setItem('flowtask_custom_smart_views', JSON.stringify(next));
        return next;
      });

      if (activeView === `smart:${id}`) {
        setActiveView('today');
      }
      showToast('Smart view removed.');
    },
    [activeView, showToast]
  );

  // Gentle Overdue Triage (Clean Slate)
  const bulkRescheduleOverdue = useCallback(
    (action: 'today' | 'someday' | 'dismiss') => {
      if (action === 'dismiss') {
        setIsTriageDismissed(true);
        return;
      }

      let updatedList: Task[] = [];
      setTasks((prev) => {
        updatedList = prev.map((t) => {
          if (t.status !== 'done' && t.dueDate && t.dueDate < todayStr && t.dueDate !== '') {
            if (action === 'today') {
              return { ...t, dueDate: todayStr };
            }
            if (action === 'someday') {
              return { ...t, dueDate: undefined };
            }
          }
          return t;
        });
        return updatedList;
      });

      if (user && updatedList.length > 0) {
        taskSyncService.batchMigrate(user.uid, updatedList, projects).catch((err) => {
          console.warn('Bulk reschedule queued offline:', err);
        });
      }

      setIsTriageDismissed(true);
      showToast(
        action === 'today'
          ? 'Rescheduled overdue tasks to Today'
          : 'Moved overdue tasks to Someday'
      );
    },
    [todayStr, showToast, user, projects]
  );

  // Add custom project
  const addProject = useCallback(
    (name: string, color: string, icon?: string) => {
      const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const newProj: Project = { id, name, color, icon: icon || 'Folder' };
      setProjects((prev) => [...prev, newProj]);

      if (user) {
        taskSyncService.saveProject(user.uid, newProj).catch((err) => {
          console.warn('Project save queued offline:', err);
        });
      }

      showToast(`Created project "${name}"`);
    },
    [showToast, user]
  );

  // JSON Import
  const importTasks = useCallback(
    (importedTasks: Task[], importedProjects?: Project[]) => {
      setTasks(importedTasks);
      const nextProjects = importedProjects && importedProjects.length > 0 ? importedProjects : projects;
      if (importedProjects && importedProjects.length > 0) {
        setProjects(importedProjects);
      }

      if (user) {
        taskSyncService.batchMigrate(user.uid, importedTasks, nextProjects).catch((err) => {
          console.warn('Import sync queued offline:', err);
        });
      }

      showToast(`Successfully imported ${importedTasks.length} tasks!`);
    },
    [showToast, user, projects]
  );

  // Study Sessions Importer
  const addStudySessions = useCallback(
    (sessions: ParsedSession[], dateStr?: string, projectId = 'work'): Task[] => {
      if (sessions.length === 0) return [];
      const effectiveDate = dateStr || todayStr;
      const newTasks: Task[] = sessions.map((s) => convertSessionToTask(s, effectiveDate, projectId));

      pushUndo(`Imported ${sessions.length} study sessions`, tasks);
      setTasks((prev) => [...newTasks, ...prev]);

      audioEngine.playRuleOf3Fanfare();
      confetti({
        particleCount: 50,
        spread: 70,
        origin: { y: 0.7 },
      });

      const totalTargets = sessions.reduce((acc, s) => acc + s.targets.length, 0);
      showToast(
        `Scheduled ${sessions.length} Study Sessions with ${totalTargets} targets!`,
        'Undo',
        undoLastAction
      );

      if (user) {
        taskSyncService.batchMigrate(user.uid, [...newTasks, ...tasks], projects).catch((err) => {
          console.warn('Study sessions sync queued offline:', err);
        });
      }

      return newTasks;
    },
    [todayStr, pushUndo, tasks, showToast, undoLastAction, user, projects]
  );

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
        setTheme,
        soundEnabled,
        soundProfile,
        setSoundProfile,
        overdueTasks,
        isTriageDismissed,
        toast,
        syncStatus,
        lastSyncedAt,
        isAuthModalOpen,
        setIsAuthModalOpen,
        forceSyncToCloud,
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
        toggleTheme,
        toggleSound,
        addTask,
        addMultipleTasks,
        updateTask,
        deleteTask,
        toggleTaskStatus,
        toggleTaskPinToday,
        toggleSubTask,
        addSubTask,
        updateSubTask,
        deleteSubTask,
        moveSubTask,
        duplicateTask,
        isTemplatePickerOpen,
        setIsTemplatePickerOpen,
        isWeeklyReviewOpen,
        setIsWeeklyReviewOpen,
        bulkRescheduleOverdue,
        undoLastAction,
        addProject,
        importTasks,
        addStudySessions,
        showToast,
        clearToast,
      }}
    >
      {children}
    </TaskContext.Provider>
  );
};

export const useTaskContext = () => {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTaskContext must be used within a TaskProvider');
  }
  return context;
};
