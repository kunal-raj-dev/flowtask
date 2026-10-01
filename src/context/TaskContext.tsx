import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import confetti from 'canvas-confetti';
import type { Task, Project, ViewId, Priority } from '../types/task';
import { parseTaskInput, formatLocalDate } from '../utils/nlpParser';
import { audioEngine } from '../utils/audioEngine';
import {
  loadTasksFromStorage,
  saveTasksToStorage,
  loadProjectsFromStorage,
  saveProjectsToStorage,
  calculateNextDueDate,
} from '../utils/storage';

interface UndoAction {
  description: string;
  previousTasks: Task[];
}

interface TaskContextType {
  tasks: Task[];
  projects: Project[];
  activeView: ViewId;
  viewLayout: 'list' | 'kanban' | 'matrix';
  selectedTaskId: string | null;
  searchQuery: string;
  priorityFilter: Priority | 'all';
  quickWinsOnly: boolean;
  theme: 'light' | 'dark';
  soundEnabled: boolean;
  overdueTasks: Task[];
  isTriageDismissed: boolean;
  toast: { message: string; actionLabel?: string; onAction?: () => void } | null;

  // Actions
  setActiveView: (view: ViewId) => void;
  setViewLayout: (layout: 'list' | 'kanban' | 'matrix') => void;
  setSelectedTaskId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setPriorityFilter: (p: Priority | 'all') => void;
  setQuickWinsOnly: (enabled: boolean) => void;
  toggleTheme: () => void;
  toggleSound: () => void;

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

  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('flowtask_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // Sound state
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => audioEngine.getSoundEnabled());

  useEffect(() => {
    saveTasksToStorage(tasks);
  }, [tasks]);

  useEffect(() => {
    saveProjectsToStorage(projects);
  }, [projects]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('flowtask_theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
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
    showToast(`Undone: ${actionToUndo.description}`);
  }, [undoStack, showToast]);

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
      return newTask;
    },
    [activeView, projects, todayStr]
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

      showToast(`Added ${cleanLines.length} tasks from Brain Dump`);
    },
    [activeView, todayStr, showToast]
  );

  // Update Task
  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  }, []);

  // Delete Task with Undo
  const deleteTask = useCallback(
    (id: string) => {
      const taskToDelete = tasks.find((t) => t.id === id);
      if (!taskToDelete) return;

      const prevTasks = [...tasks];
      pushUndo(`Deleted "${taskToDelete.title}"`, prevTasks);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      if (selectedTaskId === id) setSelectedTaskId(null);

      showToast(`Deleted "${taskToDelete.title}"`, 'Undo', () => {
        undoLastAction();
      });
    },
    [tasks, selectedTaskId, pushUndo, showToast, undoLastAction]
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
        // Fire celebration confetti if in Today view or high priority
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

      setTasks((prev) => {
        let updated = prev.map((t) => {
          if (t.id === id) {
            return {
              ...t,
              status: isCompleting ? ('done' as const) : ('todo' as const),
              completedAt: isCompleting ? Date.now() : undefined,
              isPinnedToday: isCompleting ? false : t.isPinnedToday,
            };
          }
          return t;
        });

        // If completing a recurring task, automatically generate next occurrence!
        if (isCompleting && target.recurrence && target.recurrence !== 'none') {
          const nextDueDate = calculateNextDueDate(target.dueDate, target.recurrence);
          const nextTask: Task = {
            ...target,
            id: 'task-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
            status: 'todo',
            dueDate: nextDueDate,
            completedAt: undefined,
            isPinnedToday: false,
            createdAt: Date.now(),
            subtasks: target.subtasks.map((s) => ({ ...s, completed: false })),
          };
          updated = [nextTask, ...updated];
        }

        return updated;
      });

      showToast(
        isCompleting ? `Marked "${target.title}" done` : `Reopened "${target.title}"`,
        'Undo',
        () => undoLastAction()
      );
    },
    [tasks, activeView, pushUndo, showToast, undoLastAction]
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
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id === taskId) {
            const nextSubs = t.subtasks.map((s) =>
              s.id === subtaskId ? { ...s, completed: !s.completed } : s
            );
            return { ...t, subtasks: nextSubs };
          }
          return t;
        })
      );
      audioEngine.playClickSound();
    },
    []
  );

  const addSubTask = useCallback((taskId: string, title: string) => {
    if (!title.trim()) return;
    const newSub = {
      id: 'sub-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      title: title.trim(),
      completed: false,
    };
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          return { ...t, subtasks: [...t.subtasks, newSub] };
        }
        return t;
      })
    );
    audioEngine.playClickSound();
  }, []);

  const deleteSubTask = useCallback((taskId: string, subtaskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          return { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) };
        }
        return t;
      })
    );
  }, []);

  // Gentle Overdue Triage (Clean Slate)
  const bulkRescheduleOverdue = useCallback(
    (action: 'today' | 'someday' | 'dismiss') => {
      if (action === 'dismiss') {
        setIsTriageDismissed(true);
        return;
      }

      setTasks((prev) =>
        prev.map((t) => {
          if (t.status !== 'done' && t.dueDate && t.dueDate < todayStr && t.dueDate !== '') {
            if (action === 'today') {
              return { ...t, dueDate: todayStr };
            }
            if (action === 'someday') {
              return { ...t, dueDate: undefined };
            }
          }
          return t;
        })
      );

      setIsTriageDismissed(true);
      showToast(
        action === 'today'
          ? 'Rescheduled overdue tasks to Today'
          : 'Moved overdue tasks to Someday'
      );
    },
    [todayStr, showToast]
  );

  // Add custom project
  const addProject = useCallback(
    (name: string, color: string, icon?: string) => {
      const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const newProj: Project = { id, name, color, icon: icon || 'Folder' };
      setProjects((prev) => [...prev, newProj]);
      showToast(`Created project "${name}"`);
    },
    [showToast]
  );

  // JSON Import
  const importTasks = useCallback(
    (importedTasks: Task[], importedProjects?: Project[]) => {
      setTasks(importedTasks);
      if (importedProjects && importedProjects.length > 0) {
        setProjects(importedProjects);
      }
      showToast(`Successfully imported ${importedTasks.length} tasks!`);
    },
    [showToast]
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
        soundEnabled,
        overdueTasks,
        isTriageDismissed,
        toast,
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
