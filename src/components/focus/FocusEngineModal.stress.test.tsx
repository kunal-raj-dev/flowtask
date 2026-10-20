import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { FocusEngineModal } from './FocusEngineModal';
import { useFocusStore } from '../../store/useFocusStore';
import { useTaskStore } from '../../store/useTaskStore';
import { pictureInPictureService } from '../../services/pictureInPictureService';
import type { Task } from '../../types/task';

// --- Mocks ---
vi.mock('../../utils/audioEngine', () => ({
  audioEngine: {
    getSoundEnabled: vi.fn(() => true),
    getSoundProfile: vi.fn(() => 'zen'),
    setSoundEnabled: vi.fn(),
    setSoundProfile: vi.fn(),
    startAmbientSound: vi.fn(),
    stopAmbientSound: vi.fn(),
    playClickSound: vi.fn(),
    playRuleOf3Fanfare: vi.fn(),
    playPomodoroComplete: vi.fn(),
    playCompletionChime: vi.fn(),
    playStashChime: vi.fn(),
    setAmbientVolume: vi.fn(),
  },
}));

vi.mock('../../utils/celebrate', () => ({
  default: vi.fn(),
}));

const mockToggleTaskStatus = vi.fn();
const mockToggleSubTask = vi.fn();

let activeTasksList: Task[] = [];

vi.mock('../../context/TaskContext', () => ({
  useTaskContext: () => ({
    tasks: activeTasksList,
    toggleTaskStatus: mockToggleTaskStatus,
    toggleSubTask: mockToggleSubTask,
  }),
}));

// Adversarial Strict Web Audio Mock (throws on NaN/infinite values like real browser)
class StrictGainNode {
  gain = {
    value: 1,
    setValueAtTime: vi.fn((val: number) => {
      if (!Number.isFinite(val)) throw new TypeError("Failed to execute 'setValueAtTime' on 'AudioParam': The provided float value is non-finite.");
    }),
    setTargetAtTime: vi.fn((val: number) => {
      if (!Number.isFinite(val)) throw new TypeError("Failed to execute 'setTargetAtTime' on 'AudioParam': The provided float value is non-finite.");
    }),
    linearRampToValueAtTime: vi.fn((val: number) => {
      if (!Number.isFinite(val)) throw new TypeError("Failed to execute 'linearRampToValueAtTime' on 'AudioParam': The provided float value is non-finite.");
    }),
    exponentialRampToValueAtTime: vi.fn((val: number) => {
      if (!Number.isFinite(val)) throw new TypeError("Failed to execute 'exponentialRampToValueAtTime' on 'AudioParam': The provided float value is non-finite.");
    }),
  };
  connect = vi.fn();
  disconnect = vi.fn();
}

class StrictOscillatorNode {
  type = 'sine';
  frequency = {
    setValueAtTime: vi.fn((val: number) => {
      if (!Number.isFinite(val)) throw new TypeError("Non-finite frequency");
    }),
  };
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class StrictAudioContext {
  state: AudioContextState = 'running';
  currentTime = 0;
  sampleRate = 44100;
  destination = {};
  createGain = vi.fn(() => new StrictGainNode());
  createOscillator = vi.fn(() => new StrictOscillatorNode());
  createBuffer = vi.fn(() => ({
    length: 100,
    getChannelData: vi.fn(() => new Float32Array(100)),
  }));
  createBufferSource = vi.fn(() => ({
    buffer: null,
    loop: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }));
  createBiquadFilter = vi.fn(() => ({
    type: 'lowpass',
    frequency: {
      setValueAtTime: vi.fn((val: number) => {
        if (!Number.isFinite(val)) throw new TypeError("Non-finite filter frequency");
      }),
    },
    Q: {
      setValueAtTime: vi.fn((val: number) => {
        if (!Number.isFinite(val)) throw new TypeError("Non-finite filter Q");
      }),
    },
    connect: vi.fn(),
  }));
  createStereoPanner = vi.fn(() => ({
    pan: { value: 0 },
    connect: vi.fn(),
  }));
  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
}

describe('Milestone 3 Adversarial Stress Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFocusStore.setState({
      focusSession: null,
      focusElapsedSeconds: 0,
      activeTimerTaskId: null,
      activeTimerSeconds: 0,
    });
    vi.stubGlobal('AudioContext', StrictAudioContext);
  });

  afterEach(() => {
    if (pictureInPictureService.isOpen()) {
      act(() => {
        pictureInPictureService.closePipWindow();
      });
    }
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  // =========================================================================
  // CHALLENGE 1: Timer Continuity Under Rapid Mode Switching (50x rapid cycles)
  // =========================================================================
  describe('Challenge 1: Timer Continuity Under Rapid Mode Switching', () => {
    it('preserves running state and elapsed time across 50 rapid Zen -> Studio -> Sprint -> Zen transitions', () => {
      vi.useFakeTimers();
      const startTime = 1_000_000;
      vi.setSystemTime(startTime);

      const task: Task = {
        id: 'task-stress-1',
        title: 'High-Concurrency Engine Audit',
        status: 'todo',
        priority: 'p1',
        projectId: 'audit',
        createdAt: startTime,
        subtasks: [
          { id: 'sub-1', title: 'Phase A', completed: false, estimatedMinutes: 25 },
        ],
      };
      activeTasksList = [task];
      useTaskStore.setState({ tasks: [task] });

      // Start session running in Zen
      act(() => {
        useFocusStore.getState().startFocusSession('pomodoro', task.id, task.title, 1500);
      });

      // Advance time by 45 seconds
      act(() => {
        vi.advanceTimersByTime(45_000);
        useFocusStore.getState().tick();
      });

      expect(useFocusStore.getState().focusElapsedSeconds).toBe(45);
      expect(useFocusStore.getState().focusSession?.state).toBe('running');

      const { unmount } = render(
        <FocusEngineModal isOpen={true} taskId={task.id} initialMode="zen" onClose={vi.fn()} />
      );

      // Verify initial Zen view displays countdown: 1500 - 45 = 1455s = 24:15
      const timerDisplay = screen.getByRole('timer');
      expect(timerDisplay.textContent).toBe('24:15');

      const zenTab = screen.getByRole('tab', { name: /^Zen/i });
      const studioTab = screen.getByRole('tab', { name: /^Studio/i });
      const sprintTab = screen.getByRole('tab', { name: /^Sprint/i });

      // Execute 50 rapid cycles: Zen -> Studio -> Sprint -> Zen (150 switches total)
      for (let i = 0; i < 50; i++) {
        act(() => {
          fireEvent.click(studioTab);
        });
        act(() => {
          fireEvent.click(sprintTab);
        });
        act(() => {
          fireEvent.click(zenTab);
        });
      }

      // Elapsed time and running state must be completely preserved
      const stateAfterSwitches = useFocusStore.getState();
      expect(stateAfterSwitches.focusSession?.state).toBe('running');
      expect(stateAfterSwitches.focusElapsedSeconds).toBe(45);
      expect(screen.getByRole('timer').textContent).toBe('24:15');

      // Now advance time another 30 seconds while still switching
      act(() => {
        vi.advanceTimersByTime(30_000);
        useFocusStore.getState().tick();
      });

      expect(useFocusStore.getState().focusElapsedSeconds).toBe(75);
      expect(screen.getByRole('timer').textContent).toBe('23:45');

      // Another 50 rapid switches during active tick
      for (let i = 0; i < 50; i++) {
        act(() => {
          fireEvent.click(studioTab);
        });
        act(() => {
          fireEvent.click(sprintTab);
        });
        act(() => {
          fireEvent.click(zenTab);
        });
      }

      expect(useFocusStore.getState().focusSession?.state).toBe('running');
      expect(useFocusStore.getState().focusElapsedSeconds).toBe(75);
      expect(screen.getByRole('timer').textContent).toBe('23:45');

      unmount();
    }, 30_000);

    it('preserves paused state and exact accumulated time across 50 rapid mode switches', () => {
      vi.useFakeTimers();
      const startTime = 2_000_000;
      vi.setSystemTime(startTime);

      const task: Task = {
        id: 'task-stress-paused',
        title: 'Dormant Session Test',
        status: 'todo',
        priority: 'p2',
        projectId: 'audit',
        createdAt: startTime,
        subtasks: [],
      };
      activeTasksList = [task];
      useTaskStore.setState({ tasks: [task] });

      // Start and run for 100 seconds, then pause
      act(() => {
        useFocusStore.getState().startFocusSession('pomodoro', task.id, task.title, 1500);
        vi.advanceTimersByTime(100_000);
        useFocusStore.getState().tick();
        useFocusStore.getState().pauseFocusSession();
      });

      expect(useFocusStore.getState().focusSession?.state).toBe('paused');
      expect(useFocusStore.getState().focusElapsedSeconds).toBe(100);

      const { unmount } = render(
        <FocusEngineModal isOpen={true} taskId={task.id} initialMode="zen" onClose={vi.fn()} />
      );

      const studioTab = screen.getByRole('tab', { name: /^Studio/i });
      const sprintTab = screen.getByRole('tab', { name: /^Sprint/i });
      const zenTab = screen.getByRole('tab', { name: /^Zen/i });

      // 50 rapid switches while paused
      for (let i = 0; i < 50; i++) {
        act(() => {
          fireEvent.click(studioTab);
        });
        act(() => {
          fireEvent.click(sprintTab);
        });
        act(() => {
          fireEvent.click(zenTab);
        });
      }

      // Verify no drift while paused
      expect(useFocusStore.getState().focusSession?.state).toBe('paused');
      expect(useFocusStore.getState().focusElapsedSeconds).toBe(100);

      // Now resume and run for 20 more seconds
      act(() => {
        useFocusStore.getState().resumeFocusSession();
        vi.advanceTimersByTime(20_000);
        useFocusStore.getState().tick();
      });

      expect(useFocusStore.getState().focusSession?.state).toBe('running');
      expect(useFocusStore.getState().focusElapsedSeconds).toBe(120);

      unmount();
    }, 30_000);
  });

  // =========================================================================
  // CHALLENGE 2: Subtask Pacing Calculations Under Extreme Conditions
  // =========================================================================
  describe('Challenge 2: Subtask Pacing Under Extreme Conditions', () => {
    it('Condition 2A: Handles 0 subtasks without zero-division, NaN progress, or crashes', () => {
      const taskZeroSubs: Task = {
        id: 'task-no-subs',
        title: 'Task with No Subtasks',
        status: 'todo',
        priority: 'p3',
        projectId: 'inbox',
        createdAt: Date.now(),
        subtasks: [],
      };
      activeTasksList = [taskZeroSubs];
      useTaskStore.setState({ tasks: [taskZeroSubs] });

      const { unmount } = render(
        <FocusEngineModal isOpen={true} taskId={taskZeroSubs.id} initialMode="sprint" onClose={vi.fn()} />
      );

      // Verify empty subtasks fallback banner
      expect(
        screen.getByText(/No subtasks defined on this task\. Add subtasks to enable guided auto-pacing\./i)
      ).toBeDefined();

      // Velocity shows 0 of 0 solved (0%) without NaN
      expect(screen.getByText(/0 of 0 solved/i)).toBeDefined();
      expect(screen.getByText(/\(0%\)/i)).toBeDefined();
      expect(screen.queryByText(/NaN/i)).toBeNull();

      // Banked pace defaults safely
      expect(screen.getByText(/\+0m/i)).toBeDefined();

      // Starting sprint session on empty subtasks defaults safely (e.g. 30m)
      const startBtn = screen.getByRole('button', { name: /Start sprint/i });
      act(() => {
        fireEvent.click(startBtn);
      });

      expect(useFocusStore.getState().focusSession?.state).toBe('running');
      expect(useFocusStore.getState().focusSession?.targetDurationSec).toBe(1800);

      unmount();
    });

    it('Condition 2B: Handles subtasks with 0 estimatedMinutes safely without division by zero', () => {
      const taskZeroMins: Task = {
        id: 'task-zero-mins',
        title: 'Task with 0 min Subtasks',
        status: 'todo',
        priority: 'p2',
        projectId: 'inbox',
        createdAt: Date.now(),
        subtasks: [
          { id: 'sub-zero-1', title: 'Zero Min Subtask A', completed: false, estimatedMinutes: 0 },
          { id: 'sub-zero-2', title: 'Zero Min Subtask B', completed: false, estimatedMinutes: 0 },
        ],
      };
      activeTasksList = [taskZeroMins];
      useTaskStore.setState({ tasks: [taskZeroMins] });

      const { unmount } = render(
        <FocusEngineModal isOpen={true} taskId={taskZeroMins.id} initialMode="sprint" onClose={vi.fn()} />
      );

      // Countdown display must fall back to default budget (30:00) instead of 00:00 or NaN
      const countdown = screen.getByRole('timer');
      expect(countdown.textContent).toBe('30:00');

      // Checklist must render fallback 30m badge without throwing
      const durationBadges = screen.getAllByText('30m');
      expect(durationBadges.length).toBeGreaterThanOrEqual(2);

      // Clicking Mark Solved & Next must compute surplus without NaN
      const markSolvedBtn = screen.getByRole('button', { name: /Mark Solved and Next/i });
      act(() => {
        fireEvent.click(markSolvedBtn);
      });

      // Subtask 1 toggled
      expect(mockToggleSubTask).toHaveBeenCalledWith('task-zero-mins', 'sub-zero-1');
      // Advances to Step 2 of 2
      expect(screen.getByText(/Step 2 of 2/i)).toBeDefined();
      // Banked pace surplus computed from default budget (30m) without NaN
      expect(screen.getByText(/\+30m/i)).toBeDefined();
      expect(screen.queryByText(/NaN/i)).toBeNull();

      unmount();
    });

    it('Condition 2C: Tests empirical behavior when subtask takes 10x estimatedMinutes', () => {
      vi.useFakeTimers();
      const startTime = 3_000_000;
      vi.setSystemTime(startTime);

      const taskOvertime: Task = {
        id: 'task-overtime',
        title: 'Overtime Subtask Test',
        status: 'todo',
        priority: 'p1',
        projectId: 'audit',
        createdAt: startTime,
        subtasks: [
          { id: 'sub-quick', title: 'Quick 5m Task', completed: false, estimatedMinutes: 5 },
          { id: 'sub-next', title: 'Followup Task', completed: false, estimatedMinutes: 10 },
        ],
      };
      activeTasksList = [taskOvertime];
      useTaskStore.setState({ tasks: [taskOvertime] });

      const { unmount } = render(
        <FocusEngineModal isOpen={true} taskId={taskOvertime.id} initialMode="sprint" onClose={vi.fn()} />
      );

      // Start sprint session
      const startBtn = screen.getByRole('button', { name: /Start sprint/i });
      act(() => {
        fireEvent.click(startBtn);
      });

      const session = useFocusStore.getState().focusSession;
      expect(session).not.toBeNull();
      expect(session?.state).toBe('running');

      // Subtask estimate is 5 minutes = 300 seconds.
      // Now let time run for 10x the estimate: 50 minutes = 3,000 seconds!
      act(() => {
        vi.advanceTimersByTime(3_000_000);
        useFocusStore.getState().tick();
      });

      // Check the empirical behavior of getElapsedSeconds and liveElapsedSeconds
      const liveElapsed = useFocusStore.getState().focusElapsedSeconds;
      const rawElapsedMs = Date.now() - (session?.startedAt || 0);

      // In sprint mode, getElapsedSeconds does not cap at targetDurationSec.
      // Therefore, liveElapsed reflects the true 3,000s elapsed time (50 minutes).
      expect(rawElapsedMs).toBe(3_000_000);
      expect(liveElapsed).toBe(3000);

      // Click Mark Solved & Next
      const markSolvedBtn = screen.getByRole('button', { name: /Mark Solved and Next/i });
      act(() => {
        fireEvent.click(markSolvedBtn);
      });

      // Because liveElapsed was 3000s, stepTarget - liveElapsed = 300 - 3000 = -2700s (-45m).
      // Thus, bankedSeconds reflects negative pace (-45m) with text-rose-400!
      const bankedBadge = screen.getByText('-45m');
      expect(bankedBadge).toBeDefined();
      expect(bankedBadge.className).toContain('text-rose-400');

      unmount();
    });

    it('Condition 2D: Completing the last subtask remains bounded and does not throw', () => {
      const taskThreeSubs: Task = {
        id: 'task-three-subs',
        title: 'Three Subtasks Journey',
        status: 'todo',
        priority: 'p1',
        projectId: 'audit',
        createdAt: Date.now(),
        subtasks: [
          { id: 'sub-1', title: 'First Subtask', completed: false, estimatedMinutes: 10 },
          { id: 'sub-2', title: 'Second Subtask', completed: false, estimatedMinutes: 10 },
          { id: 'sub-3', title: 'Third Subtask (Last)', completed: false, estimatedMinutes: 10 },
        ],
      };
      activeTasksList = [taskThreeSubs];
      useTaskStore.setState({ tasks: [taskThreeSubs] });

      const { unmount } = render(
        <FocusEngineModal isOpen={true} taskId={taskThreeSubs.id} initialMode="sprint" onClose={vi.fn()} />
      );

      const markSolvedBtn = screen.getByRole('button', { name: /Mark Solved and Next/i });

      // Solve step 1 -> advances to step 2
      act(() => {
        fireEvent.click(markSolvedBtn);
      });
      expect(screen.getByText(/Step 2 of 3/i)).toBeDefined();

      // Solve step 2 -> advances to step 3
      act(() => {
        fireEvent.click(markSolvedBtn);
      });
      expect(screen.getByText(/Step 3 of 3/i)).toBeDefined();

      // Solve step 3 (last subtask)
      act(() => {
        fireEvent.click(markSolvedBtn);
      });

      // Must remain bounded on step 3 without out-of-bounds error
      expect(screen.getByText(/Step 3 of 3/i)).toBeDefined();
      expect(mockToggleSubTask).toHaveBeenCalledTimes(3);

      // Verify no out-of-bounds index or crash occurs on subsequent clicks
      act(() => {
        fireEvent.click(markSolvedBtn);
      });
      expect(screen.getByText(/Step 3 of 3/i)).toBeDefined();

      unmount();
    });
  });

  // =========================================================================
  // CHALLENGE 3: Web Audio Synthesizer Lifecycle & NaN Robustness
  // =========================================================================
  describe('Challenge 3: Web Audio Synthesizer Lifecycle & NaN Robustness', () => {
    it('handles rapid mute/unmute 50 times without audio graph crashes', () => {
      const task: Task = {
        id: 'task-audio-1',
        title: 'Studio Soundscape Test',
        status: 'todo',
        priority: 'p1',
        projectId: 'audit',
        createdAt: Date.now(),
        subtasks: [],
      };
      activeTasksList = [task];
      useTaskStore.setState({ tasks: [task] });

      // Start running focus session so synthesizer activates
      act(() => {
        useFocusStore.getState().startFocusSession('pomodoro', task.id, task.title, 1500);
      });

      const { unmount } = render(
        <FocusEngineModal isOpen={true} taskId={task.id} initialMode="studio" onClose={vi.fn()} />
      );

      const silenceBtn = screen.getByRole('button', { name: /Mute atmosphere/i });

      // Rapidly toggle mute 50 times
      for (let i = 0; i < 50; i++) {
        act(() => {
          fireEvent.click(silenceBtn);
        });
      }

      // Verify component did not crash
      expect(screen.getByText('Atmospheric Multi-Track Mixer')).toBeDefined();

      unmount();
    });

    it('handles volume sliding to 0.0, 1.0, and extreme boundary values', () => {
      const task: Task = {
        id: 'task-audio-vol',
        title: 'Volume Slider Test',
        status: 'todo',
        priority: 'p1',
        projectId: 'audit',
        createdAt: Date.now(),
        subtasks: [],
      };
      activeTasksList = [task];
      useTaskStore.setState({ tasks: [task] });

      act(() => {
        useFocusStore.getState().startFocusSession('pomodoro', task.id, task.title, 1500);
      });

      const { unmount } = render(
        <FocusEngineModal isOpen={true} taskId={task.id} initialMode="studio" onClose={vi.fn()} />
      );

      const masterSlider = screen.getByLabelText(/Master volume/i);
      const binauralSlider = screen.getByLabelText(/Binaural Beats volume/i);
      const brownSlider = screen.getByLabelText(/Brown Noise volume/i);
      const rainSlider = screen.getByLabelText(/Rain volume/i);
      const campfireSlider = screen.getByLabelText(/Campfire volume/i);

      // Slide all to 0.0
      act(() => {
        fireEvent.change(masterSlider, { target: { value: '0' } });
        fireEvent.change(binauralSlider, { target: { value: '0' } });
        fireEvent.change(brownSlider, { target: { value: '0' } });
        fireEvent.change(rainSlider, { target: { value: '0' } });
        fireEvent.change(campfireSlider, { target: { value: '0' } });
      });

      const zeroPercentLabels = screen.getAllByText('0%');
      expect(zeroPercentLabels.length).toBeGreaterThanOrEqual(1);

      // Slide all to 1.0
      act(() => {
        fireEvent.change(masterSlider, { target: { value: '1' } });
        fireEvent.change(binauralSlider, { target: { value: '1' } });
        fireEvent.change(brownSlider, { target: { value: '1' } });
        fireEvent.change(rainSlider, { target: { value: '1' } });
        fireEvent.change(campfireSlider, { target: { value: '1' } });
      });

      const hundredPercentLabels = screen.getAllByText('100%');
      expect(hundredPercentLabels.length).toBeGreaterThanOrEqual(1);

      unmount();
    });

    it('safely catches and survives non-finite / NaN values in audio automation', () => {
      const task: Task = {
        id: 'task-audio-nan',
        title: 'NaN Safety Test',
        status: 'todo',
        priority: 'p1',
        projectId: 'audit',
        createdAt: Date.now(),
        subtasks: [],
      };
      activeTasksList = [task];
      useTaskStore.setState({ tasks: [task] });

      act(() => {
        useFocusStore.getState().startFocusSession('pomodoro', task.id, task.title, 1500);
      });

      const { unmount } = render(
        <FocusEngineModal isOpen={true} taskId={task.id} initialMode="studio" onClose={vi.fn()} />
      );

      const masterSlider = screen.getByLabelText(/Master volume/i);

      // Attempt to dispatch non-number string that produces NaN via parseFloat
      act(() => {
        fireEvent.change(masterSlider, { target: { value: 'invalid_nan' } });
      });

      // The try-catch block inside StudioMixerSynthesizer.setVolumes prevents uncaught exceptions
      // Component remains intact
      expect(screen.getByText('Atmospheric Multi-Track Mixer')).toBeDefined();

      // Verify recovery when valid number is provided next
      act(() => {
        fireEvent.change(masterSlider, { target: { value: '0.75' } });
      });

      expect(screen.getByText('75%')).toBeDefined();

      unmount();
    });

    it('disposes synthesizer cleanly on unmount without uncaught errors', () => {
      const task: Task = {
        id: 'task-audio-dispose',
        title: 'Dispose Test',
        status: 'todo',
        priority: 'p1',
        projectId: 'audit',
        createdAt: Date.now(),
        subtasks: [],
      };
      activeTasksList = [task];
      useTaskStore.setState({ tasks: [task] });

      act(() => {
        useFocusStore.getState().startFocusSession('pomodoro', task.id, task.title, 1500);
      });

      const { unmount } = render(
        <FocusEngineModal isOpen={true} taskId={task.id} initialMode="studio" onClose={vi.fn()} />
      );

      // Unmounting should invoke dispose() cleanly
      expect(() => {
        unmount();
      }).not.toThrow();
    });
  });
});
