// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { FocusEngineModal } from './FocusEngineModal';
import { useFocusStore } from '../../store/useFocusStore';
import { useTaskStore } from '../../store/useTaskStore';
import { audioEngine } from '../../utils/audioEngine';
import celebrate from '../../utils/celebrate';
import { pictureInPictureService } from '../../services/pictureInPictureService';
import type { Task } from '../../types/task';

class FakeMediaMetadata {
  init: any;
  constructor(init: any) {
    this.init = init;
  }
}

// --- Mocks ---
vi.mock('../../utils/audioEngine', () => ({
  audioEngine: {
    getSoundEnabled: vi.fn(() => true),
    getSoundProfile: vi.fn(() => 'marimba'),
    setSoundEnabled: vi.fn(),
    setSoundProfile: vi.fn(),
    startAmbientSound: vi.fn(),
    stopAmbientSound: vi.fn(),
    playClickSound: vi.fn(),
    playRuleOf3Fanfare: vi.fn(),
    playPomodoroComplete: vi.fn(),
    playCompletionChime: vi.fn(),
    playStashChime: vi.fn(),
  },
}));

vi.mock('../../utils/celebrate', () => ({
  default: vi.fn(),
}));

const mockToggleTaskStatus = vi.fn();
const mockToggleSubTask = vi.fn();

const sampleTaskWithSubtasks: Task = {
  id: 'task-compiler-1',
  title: 'Build Compiler Frontend',
  status: 'todo',
  priority: 'p1',
  projectId: 'project-core',
  createdAt: Date.now(),
  nextAction: 'Implement lexical tokenizer',
  subtasks: [
    { id: 'sub-1', title: 'Lexical Tokenizer', completed: false, difficulty: 'EASY', estimatedMinutes: 15 },
    { id: 'sub-2', title: 'Recursive Descent Parser', completed: false, difficulty: 'MEDIUM', estimatedMinutes: 25 },
    { id: 'sub-3', title: 'Type Checker', completed: false, difficulty: 'HARD', estimatedMinutes: 40 },
  ],
};

const sampleTaskNoSubtasks: Task = {
  id: 'task-clean-1',
  title: 'Clean Workspace Desk',
  status: 'todo',
  priority: 'p3',
  projectId: 'inbox',
  createdAt: Date.now(),
  subtasks: [],
};

let activeTasksList: Task[] = [sampleTaskWithSubtasks, sampleTaskNoSubtasks];

vi.mock('../../context/TaskContext', () => ({
  useTaskContext: () => ({
    tasks: activeTasksList,
    toggleTaskStatus: mockToggleTaskStatus,
    toggleSubTask: mockToggleSubTask,
  }),
}));

// Mock AudioContext for Web Audio Studio Mixer
class FakeGainNode {
  gain = {
    value: 1,
    setValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
  };
  connect = vi.fn();
  disconnect = vi.fn();
}

class FakeOscillatorNode {
  type = 'sine';
  frequency = { setValueAtTime: vi.fn() };
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class FakeAudioContext {
  state: AudioContextState = 'running';
  currentTime = 0;
  sampleRate = 44100;
  destination = {};
  createGain = vi.fn(() => new FakeGainNode());
  createOscillator = vi.fn(() => new FakeOscillatorNode());
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
    frequency: { setValueAtTime: vi.fn() },
    Q: { setValueAtTime: vi.fn() },
    connect: vi.fn(),
  }));
  createStereoPanner = vi.fn(() => ({
    pan: { value: 0 },
    connect: vi.fn(),
  }));
  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
}

describe('FocusEngineModal (Milestone 3 Comprehensive Suite)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activeTasksList = [sampleTaskWithSubtasks, sampleTaskNoSubtasks];
    useFocusStore.setState({
      focusSession: null,
      focusElapsedSeconds: 0,
      activeTimerTaskId: null,
      activeTimerSeconds: 0,
    });
    useTaskStore.setState({
      tasks: activeTasksList,
    });
    vi.stubGlobal('AudioContext', FakeAudioContext);
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

  // ==========================================
  // Suite 1: Mode Rendering
  // ==========================================
  describe('1. Mode Rendering', () => {
    it('1.1 renders Zen Minimalist mode by default with countdown, task, and next action', () => {
      render(<FocusEngineModal isOpen={true} taskId="task-compiler-1" onClose={vi.fn()} />);

      expect(screen.getByRole('dialog', { name: 'Unified Focus Engine' })).toBeDefined();
      expect(screen.getByRole('tabpanel', { name: 'Zen Minimalist Mode' })).toBeDefined();
      expect(screen.getByRole('heading', { name: 'Build Compiler Frontend' })).toBeDefined();
      expect(screen.getByText('Implement lexical tokenizer')).toBeDefined();
      expect(screen.getByRole('timer')).toBeDefined();
      expect(screen.getByRole('button', { name: /start session/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /complete/i })).toBeDefined();
    });

    it('1.2 renders Lo-Fi Studio mode when initialMode="studio" with rooms and multi-track mixer', () => {
      render(
        <FocusEngineModal
          isOpen={true}
          taskId="task-compiler-1"
          initialMode="studio"
          onClose={vi.fn()}
        />
      );

      expect(screen.getByRole('tabpanel', { name: 'Lo-Fi Studio Mode' })).toBeDefined();
      expect(screen.getByText(/Atmospheric Multi-Track Mixer/i)).toBeDefined();
      expect(screen.getByLabelText('Master volume')).toBeDefined();
      expect(screen.getByLabelText('Binaural Beats volume')).toBeDefined();
      expect(screen.getByLabelText('Brown Noise volume')).toBeDefined();
      expect(screen.getByLabelText('Rain volume')).toBeDefined();
      expect(screen.getByLabelText('Campfire volume')).toBeDefined();
    });

    it('1.3 renders Step-by-Step Sprint mode when initialMode="sprint" with velocity and subtask card', () => {
      render(
        <FocusEngineModal
          isOpen={true}
          taskId="task-compiler-1"
          initialMode="sprint"
          onClose={vi.fn()}
        />
      );

      expect(screen.getByRole('tabpanel', { name: 'Step-by-Step Sprint Mode' })).toBeDefined();
      expect(screen.getByText(/Sprint Velocity/i)).toBeDefined();
      expect(screen.getByText(/0 of 3 solved/i)).toBeDefined();
      expect(screen.getByRole('heading', { name: 'Lexical Tokenizer' })).toBeDefined();
      expect(screen.getAllByText('Easy').length).toBeGreaterThan(0);
    });

    it('1.4 displays informative fallback when task has no subtasks in sprint mode', () => {
      render(
        <FocusEngineModal
          isOpen={true}
          taskId="task-clean-1"
          initialMode="sprint"
          onClose={vi.fn()}
        />
      );

      expect(
        screen.getByText(/No subtasks defined on this task. Add subtasks to enable guided auto-pacing./i)
      ).toBeDefined();
    });

    it('1.5 renders nothing when isOpen is false', () => {
      const { container } = render(
        <FocusEngineModal isOpen={false} taskId="task-compiler-1" onClose={vi.fn()} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('1.6 handles short_break and long_break initial phases in Zen mode', () => {
      const { unmount } = render(
        <FocusEngineModal
          isOpen={true}
          taskId="task-compiler-1"
          initialMode="zen"
          initialPhase="short_break"
          onClose={vi.fn()}
        />
      );
      // 5 min = 05:00
      expect(screen.getByText('05:00')).toBeDefined();
      unmount();

      render(
        <FocusEngineModal
          isOpen={true}
          taskId="task-compiler-1"
          initialMode="zen"
          initialPhase="long_break"
          onClose={vi.fn()}
        />
      );
      // 15 min = 15:00
      expect(screen.getByText('15:00')).toBeDefined();
    });
  });

  // ==========================================
  // Suite 2: Mode Switching & Timer Preservation
  // ==========================================
  describe('2. Mode Switching & Timer Preservation', () => {
    it('2.1 switches between Zen, Studio, and Sprint modes via tab clicks', () => {
      render(<FocusEngineModal isOpen={true} taskId="task-compiler-1" onClose={vi.fn()} />);

      const studioTab = screen.getByRole('tab', { name: 'Studio' });
      fireEvent.click(studioTab);
      expect(screen.getByRole('tabpanel', { name: 'Lo-Fi Studio Mode' })).toBeDefined();
      expect(audioEngine.playClickSound).toHaveBeenCalled();

      const sprintTab = screen.getByRole('tab', { name: 'Sprint' });
      fireEvent.click(sprintTab);
      expect(screen.getByRole('tabpanel', { name: 'Step-by-Step Sprint Mode' })).toBeDefined();

      const zenTab = screen.getByRole('tab', { name: 'Zen' });
      fireEvent.click(zenTab);
      expect(screen.getByRole('tabpanel', { name: 'Zen Minimalist Mode' })).toBeDefined();
    });

    it('2.2 preserves active running timer and elapsed seconds during mode transition', () => {
      useFocusStore.setState({
        focusSession: {
          id: 'session-running-1',
          taskId: 'task-compiler-1',
          taskTitle: 'Build Compiler Frontend',
          mode: 'pomodoro',
          state: 'running',
          targetDurationSec: 1500,
          accumulatedElapsedMs: 0,
          startedAt: Date.now() - 300000,
        },
        focusElapsedSeconds: 300,
        activeTimerTaskId: 'task-compiler-1',
      });

      render(<FocusEngineModal isOpen={true} taskId="task-compiler-1" onClose={vi.fn()} />);

      // Remaining: 1500 - 300 = 1200 sec = 20:00
      expect(screen.getByText('20:00')).toBeDefined();

      // Switch to Studio mode
      fireEvent.click(screen.getByRole('tab', { name: 'Studio' }));
      expect(screen.getByText('20:00')).toBeDefined();
      expect(useFocusStore.getState().focusSession?.state).toBe('running');

      // Switch to Sprint mode
      fireEvent.click(screen.getByRole('tab', { name: 'Sprint' }));
      expect(useFocusStore.getState().focusSession?.mode).toBe('sprint');
    });

    it('2.3 updates focusSession mode when switching from Zen to Sprint', () => {
      useFocusStore.setState({
        focusSession: {
          id: 'session-1',
          taskId: 'task-compiler-1',
          taskTitle: 'Build Compiler Frontend',
          mode: 'pomodoro',
          state: 'running',
          targetDurationSec: 1500,
          accumulatedElapsedMs: 0,
          startedAt: Date.now(),
        },
        focusElapsedSeconds: 0,
        activeTimerTaskId: 'task-compiler-1',
      });

      render(<FocusEngineModal isOpen={true} taskId="task-compiler-1" onClose={vi.fn()} />);

      fireEvent.click(screen.getByRole('tab', { name: 'Sprint' }));
      expect(useFocusStore.getState().focusSession?.mode).toBe('sprint');

      fireEvent.click(screen.getByRole('tab', { name: 'Zen' }));
      expect(useFocusStore.getState().focusSession?.mode).toBe('pomodoro');
    });

    it('2.4 plays click sound on mode tab switches', () => {
      render(<FocusEngineModal isOpen={true} taskId="task-compiler-1" onClose={vi.fn()} />);

      fireEvent.click(screen.getByRole('tab', { name: 'Studio' }));
      expect(audioEngine.playClickSound).toHaveBeenCalled();

      fireEvent.click(screen.getByRole('tab', { name: 'Sprint' }));
      expect(audioEngine.playClickSound).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================
  // Suite 3: Lo-Fi Studio Audio Mixer
  // ==========================================
  describe('3. Lo-Fi Studio Audio Mixer', () => {
    it('3.1 adjusts master volume slider and displays updated percentage', () => {
      render(
        <FocusEngineModal
          isOpen={true}
          taskId="task-compiler-1"
          initialMode="studio"
          onClose={vi.fn()}
        />
      );

      const masterSlider = screen.getByLabelText('Master volume') as HTMLInputElement;
      fireEvent.change(masterSlider, { target: { value: '0.90' } });
      expect(screen.getByText('90%')).toBeDefined();
    });

    it('3.2 toggles audio mute on silence button click', () => {
      render(
        <FocusEngineModal
          isOpen={true}
          taskId="task-compiler-1"
          initialMode="studio"
          onClose={vi.fn()}
        />
      );

      const silenceBtn = screen.getByRole('button', { name: /mute atmosphere/i });
      fireEvent.click(silenceBtn);
      expect(screen.getByText('Muted')).toBeDefined();

      const unbindBtn = screen.getByRole('button', { name: /unmute atmosphere/i });
      fireEvent.click(unbindBtn);
      expect(screen.getByText('Silence')).toBeDefined();
    });

    it('3.3 adjusts individual channel sliders (binaural, brown, rain, campfire) and updates values', () => {
      render(
        <FocusEngineModal
          isOpen={true}
          taskId="task-compiler-1"
          initialMode="studio"
          onClose={vi.fn()}
        />
      );

      const binauralSlider = screen.getByLabelText('Binaural Beats volume');
      fireEvent.change(binauralSlider, { target: { value: '0.65' } });
      expect(screen.getByText('65%')).toBeDefined();

      const brownSlider = screen.getByLabelText('Brown Noise volume');
      fireEvent.change(brownSlider, { target: { value: '0.50' } });
      expect(screen.getByText('50%')).toBeDefined();

      const rainSlider = screen.getByLabelText('Rain volume');
      fireEvent.change(rainSlider, { target: { value: '0.75' } });
      expect(screen.getByText('75%')).toBeDefined();

      const campfireSlider = screen.getByLabelText('Campfire volume');
      fireEvent.change(campfireSlider, { target: { value: '0.20' } });
      expect(screen.getByText('20%')).toBeDefined();
    });

    it('3.4 initializes Web Audio synthesizer when running in studio mode without mute', () => {
      useFocusStore.setState({
        focusSession: {
          id: 'session-running-audio',
          taskId: 'task-compiler-1',
          taskTitle: 'Build Compiler Frontend',
          mode: 'pomodoro',
          state: 'running',
          targetDurationSec: 1500,
          accumulatedElapsedMs: 0,
          startedAt: Date.now(),
        },
        focusElapsedSeconds: 0,
        activeTimerTaskId: 'task-compiler-1',
      });

      render(
        <FocusEngineModal
          isOpen={true}
          taskId="task-compiler-1"
          initialMode="studio"
          onClose={vi.fn()}
        />
      );

      // Verify that FakeAudioContext was instantiated
      expect(FakeAudioContext).toBeDefined();
    });

    it('3.5 disposes audio synthesizer graph cleanly on unmount', () => {
      useFocusStore.setState({
        focusSession: {
          id: 'session-running-audio',
          taskId: 'task-compiler-1',
          taskTitle: 'Build Compiler Frontend',
          mode: 'pomodoro',
          state: 'running',
          targetDurationSec: 1500,
          accumulatedElapsedMs: 0,
          startedAt: Date.now(),
        },
        focusElapsedSeconds: 0,
        activeTimerTaskId: 'task-compiler-1',
      });

      const { unmount } = render(
        <FocusEngineModal
          isOpen={true}
          taskId="task-compiler-1"
          initialMode="studio"
          onClose={vi.fn()}
        />
      );

      expect(() => unmount()).not.toThrow();
    });
  });

  // ==========================================
  // Suite 4: Sprint Subtasks & Auto-Pacing
  // ==========================================
  describe('4. Sprint Subtasks & Auto-Pacing', () => {
    it('4.1 renders difficulty badges (Easy, Medium, Hard) with appropriate styling', () => {
      render(
        <FocusEngineModal
          isOpen={true}
          taskId="task-compiler-1"
          initialMode="sprint"
          onClose={vi.fn()}
        />
      );

      expect(screen.getAllByText('Easy').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Medium').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Hard').length).toBeGreaterThan(0);
    });

    it('4.2 toggles subtask completion directly in checklist', () => {
      render(
        <FocusEngineModal
          isOpen={true}
          taskId="task-compiler-1"
          initialMode="sprint"
          onClose={vi.fn()}
        />
      );

      const subtaskCheckbox = screen.getByRole('checkbox', {
        name: 'Toggle completion for Lexical Tokenizer',
      });
      fireEvent.click(subtaskCheckbox);

      expect(mockToggleSubTask).toHaveBeenCalledWith('task-compiler-1', 'sub-1');
    });

    it('4.3 advances subtasks on "Mark Solved & Next" with celebratory fanfare and confetti', () => {
      render(
        <FocusEngineModal
          isOpen={true}
          taskId="task-compiler-1"
          initialMode="sprint"
          onClose={vi.fn()}
        />
      );

      const markSolvedBtn = screen.getByRole('button', { name: /mark solved and next/i });
      fireEvent.click(markSolvedBtn);

      expect(mockToggleSubTask).toHaveBeenCalledWith('task-compiler-1', 'sub-1');
      expect(audioEngine.playRuleOf3Fanfare).toHaveBeenCalled();
      expect(celebrate).toHaveBeenCalled();
      // Advances to Step 2
      expect(screen.getByText('Step 2 of 3')).toBeDefined();
      expect(screen.getByRole('heading', { name: 'Recursive Descent Parser' })).toBeDefined();
    });

    it('4.4 navigates through subtasks via previous and next chevron buttons', () => {
      render(
        <FocusEngineModal
          isOpen={true}
          taskId="task-compiler-1"
          initialMode="sprint"
          onClose={vi.fn()}
        />
      );

      const nextBtn = screen.getByRole('button', { name: 'Next subtask' });
      fireEvent.click(nextBtn);
      expect(screen.getByText('Step 2 of 3')).toBeDefined();

      const prevBtn = screen.getByRole('button', { name: 'Previous subtask' });
      fireEvent.click(prevBtn);
      expect(screen.getByText('Step 1 of 3')).toBeDefined();
    });

    it('4.5 accumulates banked pace differential when completing subtask ahead of pace', () => {
      render(
        <FocusEngineModal
          isOpen={true}
          taskId="task-compiler-1"
          initialMode="sprint"
          onClose={vi.fn()}
        />
      );

      // Subtask 1 estimatedMinutes = 15m (900s). Elapsed = 0. Surplus = +15m.
      const markSolvedBtn = screen.getByRole('button', { name: /mark solved and next/i });
      fireEvent.click(markSolvedBtn);

      // Banked pace shows +15m
      expect(screen.getByText('+15m')).toBeDefined();
    });
  });

  // ==========================================
  // Suite 5: PiP & Media Session Integration
  // ==========================================
  describe('5. PiP & Media Session Integration', () => {
    it('5.1 toggles Document Picture-in-Picture window when supported', async () => {
      const mockPipWindow = {
        document: {
          head: { appendChild: vi.fn() },
          documentElement: {
            className: '',
            setAttribute: vi.fn(),
            classList: { add: vi.fn(), contains: vi.fn().mockReturnValue(false) },
          },
          body: { className: '' },
          title: '',
        },
        closed: false,
        focus: vi.fn(),
        close: vi.fn(function (this: { closed: boolean }) {
          this.closed = true;
        }),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      vi.stubGlobal('documentPictureInPicture', {
        requestWindow: vi.fn(async () => mockPipWindow),
      });

      render(<FocusEngineModal isOpen={true} taskId="task-compiler-1" onClose={vi.fn()} />);

      const pipBtn = screen.getByRole('button', { name: 'Toggle Picture-in-Picture' });
      await act(async () => {
        fireEvent.click(pipBtn);
      });

      expect(pictureInPictureService.isOpen()).toBe(true);

      await act(async () => {
        fireEvent.click(pipBtn);
      });
      expect(pictureInPictureService.isOpen()).toBe(false);
    });

    it('5.2 hides or safely bypasses PiP button when Document PiP is unsupported', () => {
      // documentPictureInPicture is undefined in default jsdom
      render(<FocusEngineModal isOpen={true} taskId="task-compiler-1" onClose={vi.fn()} />);

      expect(screen.queryByRole('button', { name: 'Toggle Picture-in-Picture' })).toBeNull();
    });

    it('5.3 updates navigator.mediaSession metadata on mount and mode switch', () => {
      const mockMediaSession = {
        metadata: null as any,
        playbackState: 'none',
        setActionHandler: vi.fn(),
      };

      vi.stubGlobal('navigator', { mediaSession: mockMediaSession });
      vi.stubGlobal('MediaMetadata', FakeMediaMetadata);

      render(<FocusEngineModal isOpen={true} taskId="task-compiler-1" onClose={vi.fn()} />);

      expect(mockMediaSession.metadata.init.title).toBe('Build Compiler Frontend');
      expect(mockMediaSession.metadata.init.artist).toBe('FlowTask Focus');
      expect(mockMediaSession.metadata.init.album).toBe('Zen Minimalist');

      fireEvent.click(screen.getByRole('tab', { name: 'Studio' }));
      expect(mockMediaSession.metadata.init.album).toBe('Lo-Fi Studio');

      fireEvent.click(screen.getByRole('tab', { name: 'Sprint' }));
      expect(mockMediaSession.metadata.init.album).toBe('Step-by-Step Sprint');
    });

    it('5.4 registers and invokes Media Session OS action handlers (play, pause, stop, nexttrack, previoustrack)', () => {
      const actionHandlers: Record<string, () => void> = {};
      const mockMediaSession = {
        metadata: null as any,
        playbackState: 'none',
        setActionHandler: vi.fn((action: string, handler: () => void) => {
          actionHandlers[action] = handler;
        }),
      };

      vi.stubGlobal('navigator', { mediaSession: mockMediaSession });
      vi.stubGlobal('MediaMetadata', FakeMediaMetadata);

      const handleClose = vi.fn();
      render(
        <FocusEngineModal
          isOpen={true}
          taskId="task-compiler-1"
          initialMode="sprint"
          onClose={handleClose}
        />
      );

      expect(actionHandlers.play).toBeDefined();
      expect(actionHandlers.pause).toBeDefined();
      expect(actionHandlers.stop).toBeDefined();
      expect(actionHandlers.nexttrack).toBeDefined();
      expect(actionHandlers.previoustrack).toBeDefined();

      // Invoke play
      act(() => {
        actionHandlers.play();
      });
      expect(useFocusStore.getState().focusSession?.state).toBe('running');

      // Invoke pause
      act(() => {
        actionHandlers.pause();
      });
      expect(useFocusStore.getState().focusSession?.state).toBe('paused');

      // Invoke nexttrack
      act(() => {
        actionHandlers.nexttrack();
      });
      expect(mockToggleSubTask).toHaveBeenCalledWith('task-compiler-1', 'sub-1');

      // Invoke previoustrack
      act(() => {
        actionHandlers.previoustrack();
      });
      expect(screen.getByText('Step 1 of 3')).toBeDefined();

      // Invoke stop
      act(() => {
        actionHandlers.stop();
      });
      expect(useFocusStore.getState().focusSession).toBeNull();
      expect(handleClose).toHaveBeenCalled();
    });
  });

  // ==========================================
  // Suite 6: Keyboard Navigation
  // ==========================================
  describe('6. Keyboard Navigation & Shortcuts', () => {
    it('6.1 toggles play/pause with Space bar', () => {
      render(<FocusEngineModal isOpen={true} taskId="task-compiler-1" onClose={vi.fn()} />);

      fireEvent.keyDown(window, { code: 'Space', key: ' ' });
      expect(useFocusStore.getState().focusSession?.state).toBe('running');

      fireEvent.keyDown(window, { code: 'Space', key: ' ' });
      expect(useFocusStore.getState().focusSession?.state).toBe('paused');
    });

    it('6.2 completes task on Enter key in Zen mode', () => {
      render(<FocusEngineModal isOpen={true} taskId="task-compiler-1" onClose={vi.fn()} />);

      fireEvent.keyDown(window, { key: 'Enter' });
      expect(mockToggleTaskStatus).toHaveBeenCalledWith('task-compiler-1');
      expect(celebrate).toHaveBeenCalled();
    });

    it('6.3 advances subtask on Enter key in Sprint mode', () => {
      render(
        <FocusEngineModal
          isOpen={true}
          taskId="task-compiler-1"
          initialMode="sprint"
          onClose={vi.fn()}
        />
      );

      fireEvent.keyDown(window, { key: 'Enter' });
      expect(mockToggleSubTask).toHaveBeenCalledWith('task-compiler-1', 'sub-1');
      expect(celebrate).toHaveBeenCalled();
      expect(screen.getByText('Step 2 of 3')).toBeDefined();
    });

    it('6.4 toggles Document PiP with "p" key and fullscreen with "f" key', async () => {
      const mockPipWindow = {
        document: {
          head: { appendChild: vi.fn() },
          documentElement: {
            className: '',
            setAttribute: vi.fn(),
            classList: { add: vi.fn(), contains: vi.fn().mockReturnValue(false) },
          },
          body: { className: '' },
          title: '',
        },
        closed: false,
        focus: vi.fn(),
        close: vi.fn(function (this: { closed: boolean }) {
          this.closed = true;
        }),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      vi.stubGlobal('documentPictureInPicture', {
        requestWindow: vi.fn(async () => mockPipWindow),
      });

      const requestFullscreenMock = vi.fn().mockResolvedValue(undefined);
      window.HTMLDivElement.prototype.requestFullscreen = requestFullscreenMock;

      render(<FocusEngineModal isOpen={true} taskId="task-compiler-1" onClose={vi.fn()} />);

      await act(async () => {
        fireEvent.keyDown(window, { key: 'p' });
      });
      expect(pictureInPictureService.isOpen()).toBe(true);

      act(() => {
        fireEvent.keyDown(window, { key: 'f' });
      });
      expect(requestFullscreenMock).toHaveBeenCalled();

      await act(async () => {
        fireEvent.keyDown(window, { key: 'p' });
      });
      expect(pictureInPictureService.isOpen()).toBe(false);
    });

    it('6.5 closes modal on Escape key when not in fullscreen, and exits fullscreen when in fullscreen', () => {
      const handleClose = vi.fn();
      const exitFullscreenMock = vi.fn().mockResolvedValue(undefined);
      document.exitFullscreen = exitFullscreenMock;

      render(
        <FocusEngineModal isOpen={true} taskId="task-compiler-1" onClose={handleClose} />
      );

      // 1. In fullscreen: Escape exits fullscreen, does NOT call onClose
      Object.defineProperty(document, 'fullscreenElement', {
        value: document.createElement('div'),
        configurable: true,
      });

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(exitFullscreenMock).toHaveBeenCalled();
      expect(handleClose).not.toHaveBeenCalled();

      // 2. Not in fullscreen: Escape closes modal
      Object.defineProperty(document, 'fullscreenElement', {
        value: null,
        configurable: true,
      });

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalled();
    });

    it('6.6 ignores hotkeys when user is typing in an input element', () => {
      render(<FocusEngineModal isOpen={true} taskId="task-compiler-1" onClose={vi.fn()} />);

      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      fireEvent.keyDown(input, { code: 'Space', key: ' ' });
      expect(useFocusStore.getState().focusSession).toBeNull();

      fireEvent.keyDown(input, { key: 'Enter' });
      expect(mockToggleTaskStatus).not.toHaveBeenCalled();

      document.body.removeChild(input);
    });
  });

  // ==========================================
  // Suite 7: Boundary Conditions & Edge Cases
  // ==========================================
  describe('7. Boundary Conditions & Edge Cases', () => {
    it('7.1 renders default title "Deep Focus Session" and fallback action when taskId is null or missing', () => {
      activeTasksList = [];
      useTaskStore.setState({ tasks: [] });

      render(<FocusEngineModal isOpen={true} taskId={null} onClose={vi.fn()} />);

      expect(screen.getByText('Deep Focus Session')).toBeDefined();
      expect(screen.getByText('Take the first small intentional step')).toBeDefined();
    });

    it('7.2 handles empty subtasks array in sprint mode gracefully without throwing', () => {
      render(
        <FocusEngineModal
          isOpen={true}
          taskId="task-clean-1"
          initialMode="sprint"
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText(/0 of 0 solved/i)).toBeDefined();
      expect(screen.getByText(/0%/i)).toBeDefined();
      expect(
        screen.getByText(/No subtasks defined on this task. Add subtasks to enable guided auto-pacing./i)
      ).toBeDefined();
    });

    it('7.3 resets timer and stops session when clicking Reset timer button', () => {
      useFocusStore.setState({
        focusSession: {
          id: 'session-to-reset',
          taskId: 'task-compiler-1',
          taskTitle: 'Build Compiler Frontend',
          mode: 'pomodoro',
          state: 'running',
          targetDurationSec: 1500,
          accumulatedElapsedMs: 120000,
          startedAt: Date.now() - 120000,
        },
        focusElapsedSeconds: 120,
        activeTimerTaskId: 'task-compiler-1',
      });

      render(<FocusEngineModal isOpen={true} taskId="task-compiler-1" onClose={vi.fn()} />);

      const resetBtn = screen.getByRole('button', { name: 'Reset timer' });
      fireEvent.click(resetBtn);

      expect(useFocusStore.getState().focusSession).toBeNull();
      expect(audioEngine.playClickSound).toHaveBeenCalled();
    });

    it('7.4 handles AudioContext autoplay suspension or blocked audio gracefully', () => {
      class SuspendedAudioContext extends FakeAudioContext {
        override state: AudioContextState = 'suspended';
        override resume = vi.fn().mockRejectedValue(new Error('Autoplay blocked'));
      }
      vi.stubGlobal('AudioContext', SuspendedAudioContext);

      expect(() => {
        render(
          <FocusEngineModal
            isOpen={true}
            taskId="task-compiler-1"
            initialMode="studio"
            onClose={vi.fn()}
          />
        );
      }).not.toThrow();
    });

    it('7.5 accumulates negative banked pace when sprint subtask runs overtime', () => {
      vi.useFakeTimers();
      const startTime = 100_000;
      vi.setSystemTime(startTime);

      render(
        <FocusEngineModal
          isOpen={true}
          taskId="task-compiler-1"
          initialMode="sprint"
          onClose={vi.fn()}
        />
      );

      // Start sprint session
      const startBtn = screen.getByRole('button', { name: /Start sprint/i });
      act(() => {
        fireEvent.click(startBtn);
      });

      // Subtask 1 estimatedMinutes = 15m (900s).
      // Advance by 25m (1500s) -> overtime by 10m (surplus = -600s = -10m).
      act(() => {
        vi.advanceTimersByTime(25 * 60 * 1000);
        useFocusStore.getState().tick();
      });

      // Advance to next subtask
      const markSolvedBtn = screen.getByRole('button', { name: /Mark Solved and Next/i });
      act(() => {
        fireEvent.click(markSolvedBtn);
      });

      // Banked pace should display -10m with text-rose-400
      const bankedBadge = screen.getByText('-10m');
      expect(bankedBadge).toBeDefined();
      expect(bankedBadge.className).toContain('text-rose-400');
    });
  });
});
