import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import confetti from 'canvas-confetti';
import type { Task, Project, ViewId, Priority } from '../types/task';
import { parseTaskInput, formatLocalDate } from '../utils/nlpParser';
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
  addSubTask: (taskId: string, title: string) => void;
  deleteSubTask: (taskId: string, subtaskId: string) => void;
  bulkRescheduleOverdue: (action: 'today' | 'someday' | 'dismiss') => void;
  undoLastAction: () => void;
  addProject: (name: string, color: string, icon?: string) => void;
  importTasks: (tasks: Task[], projects?: Project[]) => void;
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
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const setSoundProfile = useCallback((p: SoundProfile) => {
    setSoundProfileState(p);
    audioEngine.setSoundProfile(p);
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabledState((prev) => {
      const next = !prev;
      audioEngine.setSoundEnabled(next);
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

      const newTask: Task = {
        id: 'task-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        title: parsed.cleanTitle || 'Untitled task',
        description: explicitOverrides?.description || '',
        status: 'todo',
        priority: parsed.priority || explicitOverrides?.priority || 'p4',
        projectId: targetProjectId,
        dueDate: defaultDueDate,
        dueTime: parsed.dueTime || explicitOverrides?.dueTime,
        estimatedMinutes: parsed.estimatedMinutes || explicitOverrides?.estimatedMinutes,
        subtasks: explicitOverrides?.subtasks || [],
        recurrence: explicitOverrides?.recurrence || 'none',
        isPinnedToday: explicitOverrides?.isPinnedToday || false,
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
      } else {
        audioEngine.playClickSound();
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
          const nextDueDate = calculateNextDueDate(target.dueDate, target.recurrence);
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
        audioEngine.playClickSound();
        return true;
      } else {
        updateTask(id, { isPinnedToday: false });
        audioEngine.playClickSound();
        return true;
      }
    },
    [tasks, todayStr, showToast, updateTask]
  );

  // Subtask management
  const toggleSubTask = useCallback(
    (taskId: string, subtaskId: string) => {
      let updatedTask: Task | undefined;
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id === taskId) {
            const nextSubs = t.subtasks.map((s) =>
              s.id === subtaskId ? { ...s, completed: !s.completed } : s
            );
            updatedTask = { ...t, subtasks: nextSubs };
            return updatedTask;
          }
          return t;
        })
      );
      audioEngine.playClickSound();

      if (user && updatedTask) {
        taskSyncService.saveTask(user.uid, updatedTask).catch((err) => {
          console.warn('Subtask sync queued offline:', err);
        });
      }
    },
    [user]
  );

  const addSubTask = useCallback(
    (taskId: string, title: string) => {
      if (!title.trim()) return;
      const newSub = {
        id: 'sub-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        title: title.trim(),
        completed: false,
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
        deleteSubTask,
        bulkRescheduleOverdue,
        undoLastAction,
        addProject,
        importTasks,
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
