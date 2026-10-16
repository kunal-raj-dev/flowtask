import { useState, useEffect, useCallback } from 'react';
import type { Task, Priority } from '../types/task';
import { formatLocalDate } from '../utils/nlpParser';
import { useUIStore } from '../store/useUIStore';

interface UseKeyboardNavigationProps {
  tasks: Task[];
  onSelectTask: (taskId: string) => void;
  onToggleStatus: (taskId: string) => void;
  onTogglePinToday?: (taskId: string) => void;
  onUpdateTask?: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask?: (taskId: string) => void;
  onStartFocus?: (taskId: string) => void;
  enabled?: boolean;
}

export function useKeyboardNavigation({
  tasks,
  onSelectTask,
  onToggleStatus,
  onTogglePinToday,
  onUpdateTask,
  onDeleteTask,
  onStartFocus,
  enabled = true,
}: UseKeyboardNavigationProps) {
  const [focusedIndex, setFocusedIndex] = useState<number>(() => {
    const currentSelected = useUIStore.getState().selectedTaskId || useUIStore.getState().focusedTaskId;
    if (currentSelected) {
      const idx = tasks.findIndex((t) => t.id === currentSelected);
      if (idx !== -1) return idx;
    }
    return -1;
  });

  // Sync keyboard focused index with externally selected or focused task
  useEffect(() => {
    const unsub = useUIStore.subscribe((state) => {
      const targetId = state.selectedTaskId || state.focusedTaskId;
      if (targetId) {
        const idx = tasks.findIndex((t) => t.id === targetId);
        if (idx !== -1) {
          setFocusedIndex(idx);
        }
      }
    });
    return unsub;
  }, [tasks]);

  const safeFocusedIndex = tasks.length === 0 ? -1 : Math.min(focusedIndex, tasks.length - 1);
  const focusedTaskId = safeFocusedIndex >= 0 && safeFocusedIndex < tasks.length ? tasks[safeFocusedIndex].id : null;

  useEffect(() => {
    useUIStore.getState().setFocusedTaskId(focusedTaskId);
  }, [focusedTaskId]);

  useEffect(() => {
    return () => {
      if (useUIStore.getState().focusedTaskId === focusedTaskId) {
        useUIStore.getState().setFocusedTaskId(null);
      }
    };
  }, [focusedTaskId]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Allow keyboard navigation if right slide-over TaskDrawer is open, but block on full modal dialogs
      if (document.querySelector('[aria-modal="true"]:not([data-task-drawer="true"]), [data-overlay-open="true"]')) return;
      if (!enabled || tasks.length === 0) return;

      // Ignore when user is actively typing in form inputs, textareas, or contenteditables
      const activeEl = document.activeElement;
      const tag = (activeEl?.tagName || '').toLowerCase();
      const isEditable = activeEl?.getAttribute('contenteditable') === 'true';
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || isEditable) {
        return;
      }

      // If user is focused on an interactive button or anchor, let Space/Enter activate natively
      if ((tag === 'button' || tag === 'a') && (e.key === ' ' || e.key === 'Enter')) {
        return;
      }

      // Modifier keys (Ctrl, Alt, Meta) should pass through
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      switch (e.key) {
        // Move down
        case 'j':
        case 'ArrowDown': {
          e.preventDefault();
          setFocusedIndex((prev) => {
            const next = prev < tasks.length - 1 ? prev + 1 : 0;
            const currentSelected = useUIStore.getState().selectedTaskId;
            if (currentSelected && tasks[next]) {
              onSelectTask(tasks[next].id);
            }
            return next;
          });
          break;
        }

        // Move up
        case 'k':
        case 'ArrowUp': {
          e.preventDefault();
          setFocusedIndex((prev) => {
            const next = prev > 0 ? prev - 1 : tasks.length - 1;
            const currentSelected = useUIStore.getState().selectedTaskId;
            if (currentSelected && tasks[next]) {
              onSelectTask(tasks[next].id);
            }
            return next;
          });
          break;
        }

        // Toggle Complete
        case ' ':
        case 'x': {
          if (focusedTaskId) {
            e.preventDefault();
            onToggleStatus(focusedTaskId);
          }
          break;
        }

        // Open details
        case 'Enter': {
          if (focusedTaskId) {
            e.preventDefault();
            onSelectTask(focusedTaskId);
          }
          break;
        }

        // Toggle Top 3 Focus (Rule of 3)
        case 'f':
        case '*': {
          if (focusedTaskId && onTogglePinToday) {
            e.preventDefault();
            onTogglePinToday(focusedTaskId);
          }
          break;
        }

        // Priority shortcuts (1 = P1 Urgent, 2 = P2 High, 3 = P3 Medium, 4 = P4 Low)
        case '1':
        case '2':
        case '3':
        case '4': {
          if (focusedTaskId && onUpdateTask) {
            e.preventDefault();
            const priorityMap: Record<string, Priority> = {
              '1': 'p1',
              '2': 'p2',
              '3': 'p3',
              '4': 'p4',
            };
            onUpdateTask(focusedTaskId, { priority: priorityMap[e.key] });
          }
          break;
        }

        // Reschedule to Today ('t')
        case 't': {
          if (focusedTaskId && onUpdateTask) {
            e.preventDefault();
            const todayStr = formatLocalDate(new Date());
            onUpdateTask(focusedTaskId, { plannedDate: todayStr });
          }
          break;
        }

        // Reschedule to Tomorrow ('m')
        case 'm': {
          if (focusedTaskId && onUpdateTask) {
            e.preventDefault();
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            onUpdateTask(focusedTaskId, { plannedDate: formatLocalDate(tomorrow) });
          }
          break;
        }

        // Move to Someday ('s')
        case 's': {
          if (focusedTaskId && onUpdateTask) {
            e.preventDefault();
            onUpdateTask(focusedTaskId, { isSomeday: true, plannedDate: undefined, isPinnedToday: false });
          }
          break;
        }

        // Start Focus Mode / Pomodoro ('p')
        case 'p':
        case 'P': {
          if (focusedTaskId && onStartFocus) {
            e.preventDefault();
            onStartFocus(focusedTaskId);
          }
          break;
        }

        // Delete task
        case 'Delete':
        case 'Backspace': {
          if (focusedTaskId && onDeleteTask) {
            e.preventDefault();
            onDeleteTask(focusedTaskId);
          }
          break;
        }

        // Escape: blur highlight
        case 'Escape': {
          setFocusedIndex(-1);
          break;
        }

        default:
          break;
      }
    },
    [
      enabled,
      tasks,
      focusedTaskId,
      onSelectTask,
      onToggleStatus,
      onTogglePinToday,
      onUpdateTask,
      onDeleteTask,
      onStartFocus,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Scroll focused element into view
  useEffect(() => {
    if (focusedTaskId) {
      const el = document.getElementById(`task-${focusedTaskId}`);
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [focusedTaskId]);

  return {
    focusedTaskId,
    focusedIndex: safeFocusedIndex,
    setFocusedIndex,
  };
}
