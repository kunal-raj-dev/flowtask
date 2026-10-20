// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import confetti from 'canvas-confetti';
import celebrate from '../src/utils/celebrate';
import { audioEngine, SoundProfile } from '../src/utils/audioEngine';
import { useTaskStore } from '../src/store/useTaskStore';
import { useUIStore } from '../src/store/useUIStore';
import { useModalStore } from '../src/store/useModalStore';
import { useFocusStore } from '../src/store/useFocusStore';
import { useMotionPreference } from '../src/hooks/useMotionPreference';
import { MorphCheckbox } from '../src/components/ui/MorphCheckbox';
import { WorkspaceTaskRow } from '../src/components/tasks/WorkspaceTaskRow';
import { TaskDrawerHeader } from '../src/components/tasks/drawer/TaskDrawerHeader';
import { TodayView } from '../src/components/views/TodayView';
import { TaskContext, type TaskContextType } from '../src/context/TaskContext';
import { getTodayStr } from '../src/hooks/useCurrentDate';
import { isFocusTask } from '../src/utils/taskSelectors';
import type { Task } from '../src/types/task';

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

describe('Empirical Challenger Suite: Milestone 4 Micro-Interactions, Audio Debouncing & Reduced Motion', () => {
  const todayStr = getTodayStr();

  const mockTop3Task: Task = {
    id: 'top3-task-1',
    title: 'Top 3 Priority Task',
    status: 'todo',
    priority: 'p1',
    projectId: 'inbox',
    isPinnedToday: true,
    topThreeDate: todayStr,
    plannedDate: todayStr,
    subtasks: [],
    createdAt: Date.now(),
  };

  const mockRegularTodayTask: Task = {
    id: 'regular-task-2',
    title: 'Regular Today Task',
    status: 'todo',
    priority: 'p3',
    projectId: 'inbox',
    isPinnedToday: false,
    plannedDate: todayStr,
    subtasks: [],
    createdAt: Date.now() + 1,
  };

  const mockCompletedTop3Task: Task = {
    id: 'top3-completed-3',
    title: 'Completed Top 3 Task',
    status: 'done',
    priority: 'p1',
    projectId: 'inbox',
    isPinnedToday: true,
    topThreeDate: todayStr,
    plannedDate: todayStr,
    completedAt: Date.now(),
    subtasks: [],
    createdAt: Date.now() + 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    delete document.documentElement.dataset.reducedMotion;
    vi.unstubAllGlobals();

    useUIStore.setState({
      selectedTaskId: null,
      focusedTaskId: null,
      selectedTaskIds: [],
      activePopover: null,
      isQuickAddOpen: false,
    });

    useModalStore.setState({
      activeModals: [],
      hasAnyModalOpen: false,
      isAuthModalOpen: false,
      isQuickAddOpen: false,
      isTemplatePickerOpen: false,
      isWeeklyReviewOpen: false,
      isSmartFilterModalOpen: false,
      isInterruptionModalOpen: false,
      isEveningShutdownOpen: false,
      isMorningKickoffOpen: false,
    });

    useFocusStore.setState({
      focusSession: null,
      activeTimerTaskId: null,
      activeTimerSeconds: 0,
      focusElapsedSeconds: 0,
    });

    useTaskStore.setState({
      tasks: [mockTop3Task, mockRegularTodayTask, mockCompletedTop3Task],
      projects: [],
    });

    (audioEngine as any).ctx = null;
    (audioEngine as any).isSoundEnabled = true;
    (audioEngine as any).soundProfile = 'zen';
    (audioEngine as any).lastCompletionChimeTime = 0;
  });

  afterEach(() => {
    delete document.documentElement.dataset.reducedMotion;
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    (audioEngine as any).ctx = null;
  });

  // =========================================================================
  // SECTION 1: Top 3 Completion Confetti Firing Gate
  // =========================================================================
  describe('1. Top 3 Completion Confetti Firing Gate', () => {
    it('verifies isFocusTask correctly classifies tasks based on pinned status and date', () => {
      expect(isFocusTask(mockTop3Task, todayStr)).toBe(true);
      expect(isFocusTask(mockRegularTodayTask, todayStr)).toBe(false);
      // Completed tasks have isActiveTask=false, so isFocusTask is intentionally false
      expect(isFocusTask(mockCompletedTop3Task, todayStr)).toBe(false);
    });

    it('fires celebrate when completing a Top 3 task in WorkspaceTaskRow', () => {
      const toggleTaskStatusMock = vi.fn();
      const mockContext = {
        tasks: [mockTop3Task],
        projects: [],
        selectedTaskIds: [],
        toggleTaskStatus: toggleTaskStatusMock,
        toggleTaskPinToday: vi.fn(),
        updateTask: vi.fn(),
        toggleTaskSelection: vi.fn(),
        toggleTaskTimer: vi.fn(),
      } as unknown as TaskContextType;

      render(
        <TaskContext.Provider value={mockContext}>
          <WorkspaceTaskRow task={mockTop3Task} onSelectTask={vi.fn()} />
        </TaskContext.Provider>
      );

      const checkbox = screen.getByRole('checkbox', { name: /mark as complete/i });
      fireEvent.click(checkbox);

      expect(toggleTaskStatusMock).toHaveBeenCalledWith('top3-task-1');
      expect(confetti).toHaveBeenCalledTimes(1);
      expect(confetti).toHaveBeenCalledWith(
        expect.objectContaining({
          particleCount: 45,
          spread: 60,
          origin: { y: 0.7 },
          disableForReducedMotion: true,
        })
      );
    });

    it('NEVER fires celebrate when completing a non-Top 3 task in WorkspaceTaskRow', () => {
      const toggleTaskStatusMock = vi.fn();
      const mockContext = {
        tasks: [mockRegularTodayTask],
        projects: [],
        selectedTaskIds: [],
        toggleTaskStatus: toggleTaskStatusMock,
        toggleTaskPinToday: vi.fn(),
        updateTask: vi.fn(),
        toggleTaskSelection: vi.fn(),
        toggleTaskTimer: vi.fn(),
      } as unknown as TaskContextType;

      render(
        <TaskContext.Provider value={mockContext}>
          <WorkspaceTaskRow task={mockRegularTodayTask} onSelectTask={vi.fn()} />
        </TaskContext.Provider>
      );

      const checkbox = screen.getByRole('checkbox', { name: /mark as complete/i });
      fireEvent.click(checkbox);

      expect(toggleTaskStatusMock).toHaveBeenCalledWith('regular-task-2');
      expect(confetti).not.toHaveBeenCalled();
    });

    it('fires celebrate when completing a Top 3 task in TaskDrawerHeader', () => {
      const toggleTaskStatusMock = vi.fn();
      const mockContext = {
        tasks: [mockTop3Task],
        toggleTaskStatus: toggleTaskStatusMock,
        updateTask: vi.fn(),
        deleteTask: vi.fn(),
        toggleTaskPinToday: vi.fn(),
        focusSession: null,
      } as unknown as TaskContextType;

      render(
        <TaskContext.Provider value={mockContext}>
          <TaskDrawerHeader task={mockTop3Task} />
        </TaskContext.Provider>
      );

      const checkboxBtn = screen.getByRole('button', { name: /mark as complete/i });
      fireEvent.click(checkboxBtn);

      expect(toggleTaskStatusMock).toHaveBeenCalledWith('top3-task-1');
      expect(confetti).toHaveBeenCalledTimes(1);
      expect(confetti).toHaveBeenCalledWith(
        expect.objectContaining({
          particleCount: 45,
          spread: 60,
          origin: { y: 0.7 },
        })
      );
    });

    it('NEVER fires celebrate when completing a non-Top 3 task in TaskDrawerHeader', () => {
      const toggleTaskStatusMock = vi.fn();
      const mockContext = {
        tasks: [mockRegularTodayTask],
        toggleTaskStatus: toggleTaskStatusMock,
        updateTask: vi.fn(),
        deleteTask: vi.fn(),
        toggleTaskPinToday: vi.fn(),
        focusSession: null,
      } as unknown as TaskContextType;

      render(
        <TaskContext.Provider value={mockContext}>
          <TaskDrawerHeader task={mockRegularTodayTask} />
        </TaskContext.Provider>
      );

      const checkboxBtn = screen.getByRole('button', { name: /mark as complete/i });
      fireEvent.click(checkboxBtn);

      expect(toggleTaskStatusMock).toHaveBeenCalledWith('regular-task-2');
      expect(confetti).not.toHaveBeenCalled();
    });

    it('fires celebrate when completing Top 3 task via keyboard in TodayView', () => {
      const toggleTaskStatusMock = vi.fn();
      const mockContext = {
        tasks: [mockTop3Task, mockRegularTodayTask],
        projects: [],
        calendarEvents: [],
        settings: {},
        selectedTaskIds: [],
        workspacePreferences: { _lastBackupAt: 0, _backupReminderDismissedAt: 0 },
        focusLogs: [],
        toggleTaskStatus: toggleTaskStatusMock,
        toggleTaskPinToday: vi.fn(),
        updateTask: vi.fn(),
        deleteTask: vi.fn(),
        batchUpdateTasks: vi.fn(),
        batchDeleteTasks: vi.fn(),
        addTask: vi.fn(),
        showToast: vi.fn(),
      } as unknown as TaskContextType;

      render(
        <TaskContext.Provider value={mockContext}>
          <TodayView onSelectTask={vi.fn()} onStartFocus={vi.fn()} />
        </TaskContext.Provider>
      );

      // Focus Top 3 task (index 0) with 'j'
      fireEvent.keyDown(window, { key: 'j' });
      expect(useUIStore.getState().focusedTaskId).toBe('top3-task-1');

      // Toggle status with Space
      fireEvent.keyDown(window, { key: ' ' });

      expect(toggleTaskStatusMock).toHaveBeenCalledWith('top3-task-1');
      expect(confetti).toHaveBeenCalledTimes(1);
      expect(confetti).toHaveBeenCalledWith(
        expect.objectContaining({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
        })
      );
    });

    it('NEVER fires celebrate when completing non-Top 3 task via keyboard in TodayView', () => {
      const toggleTaskStatusMock = vi.fn();
      const mockContext = {
        tasks: [mockTop3Task, mockRegularTodayTask],
        projects: [],
        calendarEvents: [],
        settings: {},
        selectedTaskIds: [],
        workspacePreferences: { _lastBackupAt: 0, _backupReminderDismissedAt: 0 },
        focusLogs: [],
        toggleTaskStatus: toggleTaskStatusMock,
        toggleTaskPinToday: vi.fn(),
        updateTask: vi.fn(),
        deleteTask: vi.fn(),
        batchUpdateTasks: vi.fn(),
        batchDeleteTasks: vi.fn(),
        addTask: vi.fn(),
        showToast: vi.fn(),
      } as unknown as TaskContextType;

      render(
        <TaskContext.Provider value={mockContext}>
          <TodayView onSelectTask={vi.fn()} onStartFocus={vi.fn()} />
        </TaskContext.Provider>
      );

      // Advance focus to regular task (index 1) with 'j' twice
      fireEvent.keyDown(window, { key: 'j' });
      fireEvent.keyDown(window, { key: 'j' });
      expect(useUIStore.getState().focusedTaskId).toBe('regular-task-2');

      // Toggle status with Space
      fireEvent.keyDown(window, { key: ' ' });

      expect(toggleTaskStatusMock).toHaveBeenCalledWith('regular-task-2');
      expect(confetti).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // SECTION 2: Uncheck Behavior: Audio & Confetti Suppression
  // =========================================================================
  describe('2. Uncheck Behavior: Audio & Confetti Suppression', () => {
    it('NEVER fires confetti when unchecking completed Top 3 task in WorkspaceTaskRow', () => {
      const toggleTaskStatusMock = vi.fn();
      const mockContext = {
        tasks: [mockCompletedTop3Task],
        projects: [],
        selectedTaskIds: [],
        toggleTaskStatus: toggleTaskStatusMock,
        toggleTaskPinToday: vi.fn(),
        updateTask: vi.fn(),
        toggleTaskSelection: vi.fn(),
        toggleTaskTimer: vi.fn(),
      } as unknown as TaskContextType;

      render(
        <TaskContext.Provider value={mockContext}>
          <WorkspaceTaskRow task={mockCompletedTop3Task} onSelectTask={vi.fn()} />
        </TaskContext.Provider>
      );

      const checkbox = screen.getByRole('checkbox', { name: /mark as incomplete/i });
      fireEvent.click(checkbox);

      expect(toggleTaskStatusMock).toHaveBeenCalledWith('top3-completed-3');
      expect(confetti).not.toHaveBeenCalled();
    });

    it('NEVER fires confetti when unchecking completed Top 3 task in TaskDrawerHeader', () => {
      const toggleTaskStatusMock = vi.fn();
      const mockContext = {
        tasks: [mockCompletedTop3Task],
        toggleTaskStatus: toggleTaskStatusMock,
        updateTask: vi.fn(),
        deleteTask: vi.fn(),
        toggleTaskPinToday: vi.fn(),
        focusSession: null,
      } as unknown as TaskContextType;

      render(
        <TaskContext.Provider value={mockContext}>
          <TaskDrawerHeader task={mockCompletedTop3Task} />
        </TaskContext.Provider>
      );

      const checkboxBtn = screen.getByRole('button', { name: /mark as incomplete/i });
      fireEvent.click(checkboxBtn);

      expect(toggleTaskStatusMock).toHaveBeenCalledWith('top3-completed-3');
      expect(confetti).not.toHaveBeenCalled();
    });

    it('plays playTaskUncheckSound and NOT playTaskComplete when unchecking in useTaskStore', () => {
      const playCompleteSpy = vi.spyOn(audioEngine, 'playTaskComplete').mockImplementation(() => {});
      const playUncheckSpy = vi.spyOn(audioEngine, 'playTaskUncheckSound').mockImplementation(() => {});

      useTaskStore.setState({
        tasks: [
          {
            id: 'task-done-state',
            title: 'Already Finished Task',
            status: 'done',
            priority: 'p1',
            projectId: 'inbox',
            subtasks: [],
            createdAt: Date.now(),
          },
        ],
      });

      // Uncheck task
      useTaskStore.getState().toggleTaskStatus('task-done-state');

      expect(playUncheckSpy).toHaveBeenCalledTimes(1);
      expect(playCompleteSpy).not.toHaveBeenCalled();

      playCompleteSpy.mockRestore();
      playUncheckSpy.mockRestore();
    });

    it('MorphCheckbox uncheck click plays playClickSound and NEVER playCompletionChime', () => {
      const chimeSpy = vi.spyOn(audioEngine, 'playCompletionChime').mockImplementation(() => {});
      const clickSpy = vi.spyOn(audioEngine, 'playClickSound').mockImplementation(() => {});
      const onChange = vi.fn();

      render(<MorphCheckbox checked={true} onChange={onChange} />);

      const btn = screen.getByRole('checkbox');
      fireEvent.click(btn);

      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(chimeSpy).not.toHaveBeenCalled();
      expect(onChange).toHaveBeenCalledWith(false);

      chimeSpy.mockRestore();
      clickSpy.mockRestore();
    });

    it('MorphCheckbox uncheck keyboard Enter/Space plays playClickSound and NEVER playCompletionChime', () => {
      const chimeSpy = vi.spyOn(audioEngine, 'playCompletionChime').mockImplementation(() => {});
      const clickSpy = vi.spyOn(audioEngine, 'playClickSound').mockImplementation(() => {});
      const onChange = vi.fn();

      render(<MorphCheckbox checked={true} onChange={onChange} />);

      const btn = screen.getByRole('checkbox');
      fireEvent.keyDown(btn, { key: ' ' });

      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(chimeSpy).not.toHaveBeenCalled();
      expect(onChange).toHaveBeenCalledWith(false);

      fireEvent.keyDown(btn, { key: 'Enter' });
      expect(clickSpy).toHaveBeenCalledTimes(2);
      expect(chimeSpy).not.toHaveBeenCalled();
      expect(onChange).toHaveBeenCalledWith(false);

      chimeSpy.mockRestore();
      clickSpy.mockRestore();
    });
  });

  // =========================================================================
  // SECTION 3: Rapid Status Toggling & Micro-Debounce Stability
  // =========================================================================
  describe('3. Rapid Status Toggling & Micro-Debounce Stability', () => {
    it('survives 100 rapid status toggles without throwing or leaking oscillators', () => {
      let createdOscillators = 0;
      let createdGains = 0;

      const mockOscillator = {
        type: 'sine',
        frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };

      const mockGain = {
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      };

      const mockCtx = {
        currentTime: 100.0,
        destination: {},
        state: 'running',
        createOscillator: vi.fn(() => {
          createdOscillators++;
          return mockOscillator;
        }),
        createGain: vi.fn(() => {
          createdGains++;
          return mockGain;
        }),
        createBiquadFilter: vi.fn(() => ({
          type: 'lowpass',
          frequency: { setValueAtTime: vi.fn() },
          connect: vi.fn(),
        })),
        resume: vi.fn(),
      };

      (audioEngine as any).ctx = mockCtx;
      (audioEngine as any).isSoundEnabled = true;
      (audioEngine as any).soundProfile = 'zen';
      (audioEngine as any).lastCompletionChimeTime = 0;

      useTaskStore.setState({
        tasks: [
          {
            id: 'burst-task',
            title: 'Burst Test Task',
            status: 'todo',
            priority: 'p2',
            projectId: 'inbox',
            subtasks: [],
            createdAt: Date.now(),
          },
        ],
      });

      // 100 consecutive rapid toggles
      expect(() => {
        for (let i = 0; i < 100; i++) {
          useTaskStore.getState().toggleTaskStatus('burst-task');
        }
      }).not.toThrow();

      // Completion chime was triggered 50 times (on every even toggle: todo -> done)
      // Because all 50 happened at the exact same millisecond, the 50ms micro-debounce
      // allowed exactly 1 completion chime synthesis!
      expect(mockCtx.createOscillator).toHaveBeenCalled();
      expect(createdOscillators).toBeLessThan(60);
      expect(createdGains).toBeGreaterThan(0);
    });

    it('gracefully handles missing AudioContext in headless/SSR environments', () => {
      (audioEngine as any).ctx = null;
      vi.stubGlobal('AudioContext', undefined);

      expect(() => {
        for (let i = 0; i < 20; i++) {
          audioEngine.playCompletionChime();
          audioEngine.playTaskUncheckSound();
          audioEngine.playClickSound();
        }
      }).not.toThrow();
    });

    it('executes uncheck and complete sounds across all 8 sound profiles without error', () => {
      const mockOscillator = {
        type: 'sine',
        frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };

      const mockGain = {
        gain: {
          value: 1,
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      };

      const mockCtx = {
        currentTime: 0.1,
        destination: {},
        state: 'running',
        createOscillator: vi.fn(() => mockOscillator),
        createGain: vi.fn(() => mockGain),
        createBiquadFilter: vi.fn(() => ({
          type: 'lowpass',
          frequency: { setValueAtTime: vi.fn() },
          connect: vi.fn(),
        })),
        resume: vi.fn(),
      };

      (audioEngine as any).ctx = mockCtx;
      (audioEngine as any).isSoundEnabled = true;

      const profiles: SoundProfile[] = [
        'zen',
        'mechanical',
        'bubble',
        'marimba',
        'typewriter',
        'synth',
        'velvet',
        'mute',
      ];

      profiles.forEach((profile) => {
        audioEngine.setSoundProfile(profile);
        expect(() => {
          // Force play bypasses debounce to test audio graph synthesis of each profile
          audioEngine.playCompletionChime(profile, true);
          audioEngine.playTaskUncheckSound();
          audioEngine.playClickSound(profile, true);
        }).not.toThrow();
      });

      // Reset to zen
      audioEngine.setSoundProfile('zen');
    });
  });

  // =========================================================================
  // SECTION 4: Reduced Motion Preference Enforcement
  // =========================================================================
  describe('4. Reduced Motion Preference Enforcement', () => {
    it('suppresses celebrate confetti when document dataset reducedMotion is true', () => {
      document.documentElement.dataset.reducedMotion = 'true';

      celebrate({ particleCount: 50 });

      expect(confetti).not.toHaveBeenCalled();
    });

    it('suppresses celebrate confetti when OS prefers-reduced-motion media query matches', () => {
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      celebrate({ particleCount: 50 });

      expect(confetti).not.toHaveBeenCalled();
    });

    it('suppresses celebrate confetti when BOTH dataset and OS matchMedia are active', () => {
      document.documentElement.dataset.reducedMotion = 'true';
      vi.stubGlobal('matchMedia', () => ({ matches: true }));

      celebrate({ particleCount: 50 });

      expect(confetti).not.toHaveBeenCalled();
    });

    it('allows celebrate confetti when neither reduced motion flag is set', () => {
      delete document.documentElement.dataset.reducedMotion;
      vi.stubGlobal('matchMedia', () => ({ matches: false }));

      celebrate({ particleCount: 50, spread: 60 });

      expect(confetti).toHaveBeenCalledWith(
        expect.objectContaining({
          particleCount: 50,
          spread: 60,
          disableForReducedMotion: true,
        })
      );
    });

    it('hook useMotionPreference correctly reflects dataset reducedMotion mutation', async () => {
      const { result, rerender } = renderHook(() => useMotionPreference());
      expect(result.current).toBe(false);

      act(() => {
        document.documentElement.dataset.reducedMotion = 'true';
      });

      // Wait a microtick for MutationObserver
      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      rerender();
      expect(result.current).toBe(true);

      act(() => {
        delete document.documentElement.dataset.reducedMotion;
      });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      rerender();
      expect(result.current).toBe(false);
    });

    it('renders MorphCheckbox cleanly under reduced motion dataset preference', () => {
      document.documentElement.dataset.reducedMotion = 'true';

      let container: HTMLElement | null = null;
      act(() => {
        const res = render(<MorphCheckbox checked={true} />);
        container = res.container;
      });

      const button = container!.querySelector('button');
      expect(button).not.toBeNull();
      expect(button?.getAttribute('aria-checked')).toBe('true');
    });

    it('renders MorphCheckbox cleanly under OS prefers-reduced-motion preference', () => {
      vi.stubGlobal('matchMedia', (query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      let container: HTMLElement | null = null;
      act(() => {
        const res = render(<MorphCheckbox checked={false} />);
        container = res.container;
      });

      const button = container!.querySelector('button');
      expect(button).not.toBeNull();
      expect(button?.getAttribute('aria-checked')).toBe('false');
    });
  });
});
