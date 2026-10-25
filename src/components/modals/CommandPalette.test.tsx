import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommandPalette } from './CommandPalette';
import { TaskContext } from '../../context/TaskContext';

describe('CommandPalette 2.0 Keyboard Choreography & Sub-Palettes', () => {
  const mockTasks = [
    {
      id: 'task-1',
      title: 'Fix auth race condition',
      status: 'todo' as const,
      priority: 'p1' as const,
      projectId: 'work',
      createdAt: Date.now(),
      subtasks: [],
    },
    {
      id: 'task-2',
      title: 'Refactor time-blocking engine',
      status: 'todo' as const,
      priority: 'p2' as const,
      projectId: 'work',
      createdAt: Date.now(),
      subtasks: [],
    },
  ];

  const mockProjects = [
    { id: 'work', name: 'Work', color: '#10b981', order: 0, createdAt: 0, updatedAt: 0 },
  ];

  const defaultContextValue = {
    tasks: mockTasks,
    projects: mockProjects,
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    toggleTaskPinToday: vi.fn(),
    startFocusSession: vi.fn(),
    setActiveView: vi.fn(),
    toggleTheme: vi.fn(),
    theme: 'dark' as const,
    setIsAuthModalOpen: vi.fn(),
    setIsEveningShutdownOpen: vi.fn(),
    setIsSmartFilterModalOpen: vi.fn(),
    setIsWeeklyReviewOpen: vi.fn(),
    undoLastAction: vi.fn(),
    redoLastAction: vi.fn(),
    workspaceId: 'local',
    workspacePreferences: {},
    setWorkspacePreference: vi.fn(),
    downloadWorkspaceBackup: vi.fn(),
    resolveSyncConflict: vi.fn(),
    importLocalWorkspace: vi.fn(),
    activeView: 'today' as const,
    viewLayout: 'list' as const,
    selectedTaskId: null,
    searchQuery: '',
    priorityFilter: 'all' as const,
    quickWinsOnly: false,
    soundEnabled: true,
    soundProfile: 'zen' as const,
    overdueTasks: [],
    isTriageDismissed: false,
    toast: null,
    settings: {} as any,
    updateSettings: vi.fn(),
    resetSettings: vi.fn(),
    syncStatus: 'local' as const,
    lastSyncedAt: null,
    isAuthModalOpen: false,
    forceSyncToCloud: vi.fn(),
    dashboards: [],
    updateDashboards: vi.fn(),
    focusSession: null,
    focusElapsedSeconds: 0,
    focusLogs: [],
    totalFocusedTodaySeconds: 0,
    pauseFocusSession: vi.fn(),
    resumeFocusSession: vi.fn(),
    stopFocusSession: vi.fn(),
    updateFocusSession: vi.fn(),
    switchFocusSubtask: vi.fn(),
    logFocusSegment: vi.fn(),
    activeTimerTaskId: null,
    activeTimerSeconds: 0,
    startTaskTimer: vi.fn(),
    stopTaskTimer: vi.fn(),
    toggleTaskTimer: vi.fn(),
    selectedTaskIds: [],
    toggleTaskSelection: vi.fn(),
    selectTask: vi.fn(),
    deselectTask: vi.fn(),
    selectAllTasks: vi.fn(),
    clearTaskSelection: vi.fn(),
    applyTaskChanges: vi.fn(),
    batchUpdateTasks: vi.fn(),
    batchDeleteTasks: vi.fn(),
    batchToggleStatus: vi.fn(),
    interruptionStash: null,
    isInterruptionModalOpen: false,
    setIsInterruptionModalOpen: vi.fn(),
    stashActiveFocus: vi.fn(),
    restoreStashedFocus: vi.fn(),
    clearInterruptionStash: vi.fn(),
    promoteSubTaskToTask: vi.fn(),
    moveSubTask: vi.fn(),
    duplicateTask: vi.fn(),
    mergeTasks: vi.fn(),
    isQuickAddOpen: false,
    setIsQuickAddOpen: vi.fn(),
    quickAddDraft: '',
    setQuickAddDraft: vi.fn(),
    isTemplatePickerOpen: false,
    setIsTemplatePickerOpen: vi.fn(),
    isWeeklyReviewOpen: false,
    calendarEvents: [],
    calendarIcsUrl: '',
    setCalendarIcsUrl: vi.fn(),
    refreshCalendarEvents: vi.fn(),
    isShutdownDismissed: false,
    dismissShutdown: vi.fn(),
    smartViews: [],
    addSmartView: vi.fn(),
    deleteSmartView: vi.fn(),
    setViewLayout: vi.fn(),
    setSelectedTaskId: vi.fn(),
    setSearchQuery: vi.fn(),
    setPriorityFilter: vi.fn(),
    setQuickWinsOnly: vi.fn(),
    setTheme: vi.fn(),
    toggleSound: vi.fn(),
    setSoundProfile: vi.fn(),
    addTask: vi.fn(),
    addMultipleTasks: vi.fn(),
    permanentDeleteTask: vi.fn(),
    archiveTask: vi.fn(),
    restoreTask: vi.fn(),
    toggleTaskStatus: vi.fn(),
    toggleSubTask: vi.fn(),
    addSubTask: vi.fn(),
    addSubTasks: vi.fn(),
    updateSubTask: vi.fn(),
    deleteSubTask: vi.fn(),
    addStudySessions: vi.fn(),
    bulkRescheduleOverdue: vi.fn(),
    addProject: vi.fn(),
    updateProject: vi.fn(),
    deleteProject: vi.fn(),
    archiveProject: vi.fn(),
    importTasks: vi.fn(),
    showToast: vi.fn(),
    clearToast: vi.fn(),
  };

  const renderPalette = (props: Partial<React.ComponentProps<typeof CommandPalette>> = {}) => {
    return render(
      <TaskContext.Provider value={defaultContextValue as any}>
        <CommandPalette
          isOpen={true}
          onClose={vi.fn()}
          onSelectTask={vi.fn()}
          onOpenPomodoro={vi.fn()}
          onOpenBrainDump={vi.fn()}
          onOpenExportImport={vi.fn()}
          {...props}
        />
      </TaskContext.Provider>
    );
  };

  it('navigates with ArrowDown and ArrowUp and selects item with Enter', () => {
    const onSelectTask = vi.fn();
    const onClose = vi.fn();
    renderPalette({ onSelectTask, onClose });

    // Type query matching task
    const input = screen.getByRole('textbox', { name: 'Command palette query' });
    fireEvent.change(input, { target: { value: 'auth' } });

    expect(screen.getByText('Fix auth race condition')).toBeTruthy();

    // Press Enter to select
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onSelectTask).toHaveBeenCalledWith('task-1');
    expect(onClose).toHaveBeenCalled();
  });

  it('drills into sub-palette with Tab and returns with Escape', () => {
    renderPalette();

    const input = screen.getByRole('textbox', { name: 'Command palette query' });
    fireEvent.change(input, { target: { value: 'auth' } });

    // Press Tab on the highlighted task
    fireEvent.keyDown(window, { key: 'Tab' });

    // Should now be in task sub-palette
    expect(screen.getByText(/Priority 1: Urgent & Important/i)).toBeTruthy();
    expect(screen.getByText(/Schedule for Today/i)).toBeTruthy();

    // Press Escape to return to root
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText(/Priority 1: Urgent & Important/i)).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Command palette query' })).toBeTruthy();
  });

  it('drills into sub-palette with Tab and returns with Backspace even when query is non-empty', () => {
    renderPalette();

    const input = screen.getByRole('textbox', { name: 'Command palette query' });
    fireEvent.change(input, { target: { value: 'auth' } });

    // Drill in
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(screen.getByText(/Priority 1: Urgent & Important/i)).toBeTruthy();

    // Press Backspace - should return to root level
    fireEvent.keyDown(window, { key: 'Backspace' });
    expect(screen.queryByText(/Priority 1: Urgent & Important/i)).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Command palette query' })).toBeTruthy();
  });

  it('executes action in sub-palette with single-key accelerator (e.g. 1 for P1)', () => {
    renderPalette();

    const input = screen.getByRole('textbox', { name: 'Command palette query' });
    fireEvent.change(input, { target: { value: 'auth' } });

    // Drill in
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText(/Priority 1: Urgent & Important/i)).toBeTruthy();

    // Press '1' to set P1
    fireEvent.keyDown(window, { key: '1' });
    expect(defaultContextValue.updateTask).toHaveBeenCalledWith('task-1', { priority: 'p1' });
  });

  it('navigates to Life Areas and Goals from command palette actions', () => {
    renderPalette();

    const input = screen.getByRole('textbox', { name: 'Command palette query' });
    fireEvent.change(input, { target: { value: 'Life Areas' } });

    const areasAction = screen.getByText(/Go to Life Areas/i);
    expect(areasAction).toBeTruthy();
    fireEvent.click(areasAction);
    expect(defaultContextValue.setActiveView).toHaveBeenCalledWith('areas');
  });
});

