import { useState, useEffect, useCallback } from 'react';
import type { Task, Priority } from '../types/task';
import { formatLocalDate } from '../utils/nlpParser';
import { useUIStore } from '../store/useUIStore';
import { useModalStore } from '../store/useModalStore';
import { useTaskStore } from '../store/useTaskStore';
import { shouldIgnoreShortcut } from '../services/shortcutRegistry';

interface UseKeyboardNavigationProps {
  tasks: Task[];
  onSelectTask: (taskId: string) => void;
  onToggleStatus: (taskId: string) => void;
  onTogglePinToday?: (taskId: string) => void;
  onUpdateTask?: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask?: (taskId: string) => void;
  onStartFocus?: (taskId: string) => void;
  onBatchUpdate?: (taskIds: string[], updates: Partial<Task>) => void;
  onBatchDelete?: (taskIds: string[]) => void;
  onBatchArchive?: (taskIds: string[]) => void;
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
  onBatchUpdate,
  onBatchDelete,
  onBatchArchive,
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
      // Allow keyboard navigation if right slide-over TaskDrawer is open, but block on full modal dialogs or active popovers
      if (useUIStore.getState().activePopover) return;
      const modalStore = useModalStore.getState();
      if (
        modalStore.hasAnyModalOpen ||
        modalStore.activeModals.length > 0 ||
        modalStore.isAuthModalOpen ||
        modalStore.isQuickAddOpen ||
        modalStore.isTemplatePickerOpen ||
        modalStore.isWeeklyReviewOpen ||
        modalStore.isSmartFilterModalOpen ||
        modalStore.isInterruptionModalOpen ||
        modalStore.isEveningShutdownOpen ||
        modalStore.isMorningKickoffOpen
      ) {
        return;
      }
      if (document.querySelector('[aria-modal="true"]:not([data-task-drawer="true"]), [data-overlay-open="true"], [data-layout-editing="true"]')) return;
      // Dismissal is native UI navigation and stays available with accelerators off.
      if (e.key === 'Escape') {
        setFocusedIndex(-1);
        useUIStore.getState().clearTaskSelection();
        return;
      }
      const shortcutsEnabled = useTaskStore.getState().settings?.keyboardShortcutsEnabled !== false;
      if (!shortcutsEnabled || !enabled) return;

      // Ignore when user is actively typing in form inputs, textareas, contenteditables, or ARIA textboxes
      if (shouldIgnoreShortcut(e)) return;

      const activeEl = document.activeElement;
      const tag = (activeEl?.tagName || '').toLowerCase();

      // If user is focused on an interactive button or anchor, let Space/Enter activate natively
      if ((tag === 'button' || tag === 'a') && (e.key === ' ' || e.key === 'Enter')) {
        return;
      }

      // Modifier keys (Ctrl, Alt, Meta) should pass through
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      // Quick capture anywhere in list views (c / C / n / N)
      if (e.key === 'c' || e.key === 'C' || e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        useModalStore.getState().openModal('quickAdd');
        useUIStore.getState().setIsQuickAddOpen(true);
        return;
      }

      if (tasks.length === 0) return;

      const selectedTaskIds = useUIStore.getState().selectedTaskIds;
      if (selectedTaskIds.length > 0) {
        // Multi-select batch hotkeys
        if (e.key === 'e' || e.key === 'E') {
          e.preventDefault();
          if (onBatchArchive) onBatchArchive(selectedTaskIds);
          else if (onBatchUpdate) onBatchUpdate(selectedTaskIds, { archivedAt: Date.now() });
          else if (onUpdateTask) selectedTaskIds.forEach(id => onUpdateTask(id, { archivedAt: Date.now() }));
          useUIStore.getState().clearTaskSelection();
          return;
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          if (onBatchDelete) onBatchDelete(selectedTaskIds);
          else if (onDeleteTask) selectedTaskIds.forEach(id => onDeleteTask(id));
          useUIStore.getState().clearTaskSelection();
          return;
        }
        if (e.key === 't' || e.key === 'T') {
          e.preventDefault();
          const todayStr = formatLocalDate(new Date());
          const updates = { plannedDate: todayStr, isSomeday: false };
          if (onBatchUpdate) onBatchUpdate(selectedTaskIds, updates);
          else if (onUpdateTask) selectedTaskIds.forEach(id => onUpdateTask(id, updates));
          useUIStore.getState().clearTaskSelection();
          return;
        }
        if (e.key === 'm' || e.key === 'M') {
          e.preventDefault();
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const tomorrowStr = formatLocalDate(tomorrow);
          const updates = { plannedDate: tomorrowStr, isSomeday: false };
          if (onBatchUpdate) onBatchUpdate(selectedTaskIds, updates);
          else if (onUpdateTask) selectedTaskIds.forEach(id => onUpdateTask(id, updates));
          useUIStore.getState().clearTaskSelection();
          return;
        }
        if (e.key === 's' || e.key === 'S') {
          e.preventDefault();
          const updates = { isSomeday: true, plannedDate: undefined, isPinnedToday: false };
          if (onBatchUpdate) onBatchUpdate(selectedTaskIds, updates);
          else if (onUpdateTask) selectedTaskIds.forEach(id => onUpdateTask(id, updates));
          useUIStore.getState().clearTaskSelection();
          return;
        }
        // Shift+1..4 Batch Duration shortcuts (15m, 30m, 45m, 60m)
        if (
          e.shiftKey &&
          (['1', '2', '3', '4', '!', '@', '#', '$'].includes(e.key) ||
           ['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code))
        ) {
          e.preventDefault();
          let minutes = 15;
          if (e.key === '!' || e.key === '1' || e.code === 'Digit1') minutes = 15;
          else if (e.key === '@' || e.key === '2' || e.code === 'Digit2') minutes = 30;
          else if (e.key === '#' || e.key === '3' || e.code === 'Digit3') minutes = 45;
          else if (e.key === '$' || e.key === '4' || e.code === 'Digit4') minutes = 60;
          if (onBatchUpdate) onBatchUpdate(selectedTaskIds, { estimatedMinutes: minutes });
          else if (onUpdateTask) selectedTaskIds.forEach(id => onUpdateTask(id, { estimatedMinutes: minutes }));
          useUIStore.getState().clearTaskSelection();
          return;
        }
        if (!e.shiftKey && ['1', '2', '3', '4', 'p', 'P'].includes(e.key)) {
          e.preventDefault();
          const pMap: Record<string, Priority> = { '1': 'p1', '2': 'p2', '3': 'p3', '4': 'p4', 'p': 'p1', 'P': 'p1' };
          const p = pMap[e.key] || 'p1';
          if (onBatchUpdate) onBatchUpdate(selectedTaskIds, { priority: p });
          else if (onUpdateTask) selectedTaskIds.forEach(id => onUpdateTask(id, { priority: p }));
          useUIStore.getState().clearTaskSelection();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          useUIStore.getState().clearTaskSelection();
          return;
        }
      }

      // Shift+1..4 Duration Tagging (15m, 30m, 45m, 60m) on focused task
      if (
        e.shiftKey &&
        (['1', '2', '3', '4', '!', '@', '#', '$'].includes(e.key) ||
         ['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code))
      ) {
        if (focusedTaskId && onUpdateTask) {
          e.preventDefault();
          let minutes = 15;
          if (e.key === '!' || e.key === '1' || e.code === 'Digit1') minutes = 15;
          else if (e.key === '@' || e.key === '2' || e.code === 'Digit2') minutes = 30;
          else if (e.key === '#' || e.key === '3' || e.code === 'Digit3') minutes = 45;
          else if (e.key === '$' || e.key === '4' || e.code === 'Digit4') minutes = 60;
          onUpdateTask(focusedTaskId, { estimatedMinutes: minutes });
        }
        return;
      }

      switch (e.key) {
        // Move down
        case 'j':
        case 'ArrowDown': {
          e.preventDefault();
          setFocusedIndex((prev) => {
            const next = prev < tasks.length - 1 ? prev + 1 : 0;
            if (e.shiftKey) {
              const currentTaskId = tasks[prev]?.id;
              const nextTaskId = tasks[next]?.id;
              if (currentTaskId && !useUIStore.getState().selectedTaskIds.includes(currentTaskId)) {
                useUIStore.getState().selectTask(currentTaskId);
              }
              if (nextTaskId) {
                useUIStore.getState().selectTask(nextTaskId);
              }
            } else {
              const currentSelected = useUIStore.getState().selectedTaskId;
              if (currentSelected && tasks[next]) {
                onSelectTask(tasks[next].id);
              }
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
            if (e.shiftKey) {
              const currentTaskId = tasks[prev]?.id;
              const nextTaskId = tasks[next]?.id;
              if (currentTaskId && !useUIStore.getState().selectedTaskIds.includes(currentTaskId)) {
                useUIStore.getState().selectTask(currentTaskId);
              }
              if (nextTaskId) {
                useUIStore.getState().selectTask(nextTaskId);
              }
            } else {
              const currentSelected = useUIStore.getState().selectedTaskId;
              if (currentSelected && tasks[next]) {
                onSelectTask(tasks[next].id);
              }
            }
            return next;
          });
          break;
        }

        // Toggle Complete
        case ' ': {
          if (focusedTaskId) {
            e.preventDefault();
            onToggleStatus(focusedTaskId);
          }
          break;
        }

        // Toggle Multi-select Selection ('x')
        case 'x':
        case 'X': {
          if (focusedTaskId) {
            e.preventDefault();
            useUIStore.getState().toggleTaskSelection(focusedTaskId);
          }
          break;
        }

        case 'F2': {
          if (focusedTaskId) {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('flowtask:edit-task', { detail: focusedTaskId }));
          }
          break;
        }

        // Open Priority Picker Popover ('p')
        case 'p':
        case 'P': {
          if (focusedTaskId) {
            e.preventDefault();
            useUIStore.getState().setActivePopover({ type: 'priority', taskId: focusedTaskId });
          }
          break;
        }

        // Open Date Picker Popover ('d')
        case 'd':
        case 'D': {
          if (focusedTaskId) {
            e.preventDefault();
            useUIStore.getState().setActivePopover({ type: 'date', taskId: focusedTaskId });
          }
          break;
        }

        // Open details and dispatch inline edit event
        case 'Enter': {
          if (focusedTaskId) {
            e.preventDefault();
            onSelectTask(focusedTaskId);
          }
          break;
        }

        // Reschedule to Today & Pin to Top 3 ('t')
        case 't':
        case 'T': {
          if (focusedTaskId) {
            e.preventDefault();
            if (onTogglePinToday) {
              onTogglePinToday(focusedTaskId);
            }
            if (onUpdateTask) {
              const todayStr = formatLocalDate(new Date());
              onUpdateTask(focusedTaskId, { plannedDate: todayStr, isSomeday: false });
            }
          }
          break;
        }
        case '*': {
          if (focusedTaskId && onTogglePinToday) {
            e.preventDefault();
            onTogglePinToday(focusedTaskId);
          }
          break;
        }

        // Direct Priority shortcuts (1 = P1 Urgent, 2 = P2 High, 3 = P3 Medium, 4 = P4 Low)
        case '1':
        case '2':
        case '3':
        case '4': {
          if (!e.shiftKey && focusedTaskId && onUpdateTask) {
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

        // Reschedule to Tomorrow ('m')
        case 'm':
        case 'M': {
          if (focusedTaskId && onUpdateTask) {
            e.preventDefault();
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            onUpdateTask(focusedTaskId, { plannedDate: formatLocalDate(tomorrow), isSomeday: false, isPinnedToday: false });
          }
          break;
        }

        // Move to Someday ('s')
        case 's':
        case 'S': {
          if (focusedTaskId && onUpdateTask) {
            e.preventDefault();
            onUpdateTask(focusedTaskId, { isSomeday: true, plannedDate: undefined, dueDate: undefined, isPinnedToday: false });
          }
          break;
        }

        // Archive exactly once, preferring the batch command when available.
        case 'e':
        case 'E': {
          if (focusedTaskId) {
            e.preventDefault();
            if (onBatchArchive) onBatchArchive([focusedTaskId]);
            else onUpdateTask?.(focusedTaskId, { archivedAt: Date.now() });
          }
          break;
        }

        // Start Focus Mode / Pomodoro ('f')
        case 'f':
        case 'F': {
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

        // Escape: blur highlight and clear multi-selection
        case 'Escape': {
          setFocusedIndex(-1);
          if (useUIStore.getState().selectedTaskIds.length > 0) {
            useUIStore.getState().clearTaskSelection();
          }
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
      onBatchUpdate,
      onBatchDelete,
      onBatchArchive,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Scroll focused element into view
  useEffect(() => {
    if (focusedTaskId) {
      const el = [...document.querySelectorAll<HTMLElement>('[data-task-id]')].find(item => item.dataset.taskId === focusedTaskId) || document.getElementById(`task-${focusedTaskId}`);
      if (!el) window.dispatchEvent(new CustomEvent('flowtask:reveal-task', { detail: focusedTaskId }));
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      }
    }
  }, [focusedTaskId]);

  return {
    focusedTaskId,
    focusedIndex: safeFocusedIndex,
    setFocusedIndex,
  };
}
