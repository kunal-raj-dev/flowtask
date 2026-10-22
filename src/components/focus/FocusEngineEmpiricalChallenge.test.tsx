import { act as flushRender } from '@testing-library/react';
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { FocusEngineModal } from './FocusEngineModal';
import { useFocusStore } from '../../store/useFocusStore';
import { useUIStore } from '../../store/useUIStore';
import { useModalStore } from '../../store/useModalStore';
import { ModalRoot } from '../modals/ModalRoot';
import { ModalProvider, useModal } from '../../context/ModalContext';
import {
  pictureInPictureService,
  isDocumentPipSupported,
} from '../../services/pictureInPictureService';
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

const testTask: Task = {
  id: 'task-adversarial-1',
  title: 'Adversarial Stress Test Target',
  status: 'todo',
  priority: 'p1',
  projectId: 'project-core',
  createdAt: Date.now(),
  nextAction: 'Verify all edge cases',
  subtasks: [
    { id: 'sub-adv-1', title: 'Subtask Alpha', completed: false, difficulty: 'EASY', estimatedMinutes: 10 },
    { id: 'sub-adv-2', title: 'Subtask Beta', completed: false, difficulty: 'MEDIUM', estimatedMinutes: 20 },
    { id: 'sub-adv-3', title: 'Subtask Gamma', completed: false, difficulty: 'HARD', estimatedMinutes: 30 },
  ],
};

let activeTasksList: Task[] = [testTask];

vi.mock('../../context/TaskContext', () => ({
  useTaskContext: () => ({
    tasks: activeTasksList,
    toggleTaskStatus: mockToggleTaskStatus,
    toggleSubTask: mockToggleSubTask,
    setSelectedTaskId: vi.fn(),
    isAuthModalOpen: false,
    setIsAuthModalOpen: vi.fn(),
    isSmartFilterModalOpen: false,
    setIsSmartFilterModalOpen: vi.fn(),
    isEveningShutdownOpen: false,
    setIsEveningShutdownOpen: vi.fn(),
    isWeeklyReviewOpen: false,
    setIsWeeklyReviewOpen: vi.fn(),
  }),
}));

// Mock AudioContext for Lo-Fi Studio Mixer
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

const createMockPipWindow = () => {
  const listeners: Record<string, Function[]> = {};
  return {
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
    close: vi.fn(function (this: any) {
      this.closed = true;
      if (listeners['pagehide']) {
        listeners['pagehide'].forEach((cb) => cb());
      }
    }),
    addEventListener: vi.fn((event: string, cb: Function) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(cb);
    }),
    removeEventListener: vi.fn((event: string, cb: Function) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((f) => f !== cb);
      }
    }),
    // Helper to simulate OS closing the window
    _simulateOsClose: function (this: any) {
      this.closed = true;
      if (listeners['pagehide']) {
        listeners['pagehide'].forEach((cb) => cb());
      }
    },
    _listeners: listeners,
  };
};

describe('Empirical Challenge: Milestone 3 Focus Engine V4', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pictureInPictureService.closePipWindow();
    activeTasksList = [testTask];
    useFocusStore.setState({
      focusSession: null,
      focusElapsedSeconds: 0,
      activeTimerTaskId: null,
      activeTimerSeconds: 0,
    });
    useModalStore.setState({
      activeModals: [],
      modalProps: {},
    });
    useUIStore.setState({
      selectedTaskIds: [],
      selectedTaskId: null,
      focusedTaskId: null,
    });
    (window as any).AudioContext = FakeAudioContext;

    // JSDOM does not implement HTMLElement.prototype.isContentEditable (WHATWG HTML standard)
    if (!('isContentEditable' in HTMLElement.prototype)) {
      Object.defineProperty(HTMLElement.prototype, 'isContentEditable', {
        get() {
          const attr = this.getAttribute('contenteditable');
          return attr === 'true' || attr === '' || this.contentEditable === 'true';
        },
        configurable: true,
      });
    }
  });

  afterEach(async () => {
    await act(async () => { pictureInPictureService.closePipWindow(); });
    vi.unstubAllGlobals();
  });

  // =========================================================================
  // Challenge 1: Document PiP (Supported, Unsupported, OS Closed, Rapid Toggle)
  // =========================================================================
  describe('Challenge 1: Document PiP Robustness', () => {
    it('1.1 verifies isDocumentPipSupported detection accuracy across environments', () => {
      // Case A: Missing documentPictureInPicture
      vi.stubGlobal('documentPictureInPicture', undefined);
      expect(isDocumentPipSupported()).toBe(false);
      expect(pictureInPictureService.isSupported()).toBe(false);

      // Case B: documentPictureInPicture exists without requestWindow
      vi.stubGlobal('documentPictureInPicture', {});
      expect(isDocumentPipSupported()).toBe(false);

      // Case C: documentPictureInPicture with non-function requestWindow
      vi.stubGlobal('documentPictureInPicture', { requestWindow: 'not-a-func' });
      expect(isDocumentPipSupported()).toBe(false);

      // Case D: Valid Chromium Document PiP API
      vi.stubGlobal('documentPictureInPicture', {
        requestWindow: vi.fn(async () => createMockPipWindow()),
      });
      expect(isDocumentPipSupported()).toBe(true);
      expect(pictureInPictureService.isSupported()).toBe(true);
    });

    it('1.2 handles unsupported browser: rejects gracefully without crashing or rendering button', async () => {
      vi.stubGlobal('documentPictureInPicture', undefined);

      // A: Direct service invocation throws descriptive error
      await expect(pictureInPictureService.requestPipWindow()).rejects.toThrow(
        /not supported in this browser/i
      );

      // B: FocusEngineModal gracefully hides PiP button
      await flushRender(async () => (render(<FocusEngineModal isOpen={true} taskId="task-adversarial-1" onClose={vi.fn()} />)));
      expect(screen.queryByRole('button', { name: 'Toggle Picture-in-Picture' })).toBeNull();
      expect(screen.queryByTitle(/Picture-in-Picture/i)).toBeNull();

      // C: Pressing 'p' shortcut does not throw unhandled rejection
      await act(async () => {
        fireEvent.keyDown(window, { key: 'p' });
      });
      expect(pictureInPictureService.isOpen()).toBe(false);
    });

    it('1.3 synchronizes styles, dark class, and data-theme to opened PiP window', async () => {
      const mockWin = createMockPipWindow();
      vi.stubGlobal('documentPictureInPicture', {
        requestWindow: vi.fn(async () => mockWin),
      });

      // Prepare host document styles
      const styleEl = document.createElement('style');
      styleEl.textContent = '.custom-timer { font-size: 24px; }';
      document.head.appendChild(styleEl);

      document.documentElement.setAttribute('data-theme', 'solar-warm');
      document.documentElement.classList.add('dark');

      const openedWin = await pictureInPictureService.requestPipWindow({ width: 340, height: 200 });

      expect(openedWin).toBe(mockWin);
      expect(mockWin.document.title).toBe('FlowTask Focus HUD');
      expect(mockWin.document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'solar-warm');
      expect(mockWin.document.documentElement.classList.add).toHaveBeenCalledWith('dark');
      expect(mockWin.document.head.appendChild).toHaveBeenCalled();

      // Clean up style
      document.head.removeChild(styleEl);
    });

    it('1.4 handles window prematurely closed by OS via pagehide event', async () => {
      const mockWin = createMockPipWindow();
      vi.stubGlobal('documentPictureInPicture', {
        requestWindow: vi.fn(async () => mockWin),
      });

      const subscriberStates: boolean[] = [];
      const unsub = pictureInPictureService.subscribe((open) => {
        subscriberStates.push(open);
      });

      await flushRender(async () => (render(<FocusEngineModal isOpen={true} taskId="task-adversarial-1" onClose={vi.fn()} />)));

      // Open PiP
      const pipBtn = screen.getByRole('button', { name: 'Toggle Picture-in-Picture' });
      await act(async () => {
        fireEvent.click(pipBtn);
      });

      expect(pictureInPictureService.isOpen()).toBe(true);
      expect(subscriberStates[subscriberStates.length - 1]).toBe(true);

      // Simulate OS closing the window
      await act(async () => {
        mockWin._simulateOsClose();
      });

      expect(pictureInPictureService.isOpen()).toBe(false);
      expect(pictureInPictureService.getPipWindow()).toBeNull();
      expect(subscriberStates[subscriberStates.length - 1]).toBe(false);

      // Verify a new PiP window can immediately be reopened cleanly
      const newMockWin = createMockPipWindow();
      (window as any).documentPictureInPicture.requestWindow.mockResolvedValueOnce(newMockWin);

      await act(async () => {
        fireEvent.click(pipBtn);
      });

      expect(pictureInPictureService.isOpen()).toBe(true);
      expect(pictureInPictureService.getPipWindow()).toBe(newMockWin);

      unsub();
    });

    it('1.5 handles OS window manager closing window directly (win.closed = true) before event', async () => {
      const mockWin = createMockPipWindow();
      vi.stubGlobal('documentPictureInPicture', {
        requestWindow: vi.fn(async () => mockWin),
      });

      await pictureInPictureService.requestPipWindow();
      expect(pictureInPictureService.isOpen()).toBe(true);

      // Simulate OS abruptly marking window closed without invoking pagehide listener
      mockWin.closed = true;

      // isOpen() and getPipWindow() must detect closed state and self-heal
      expect(pictureInPictureService.isOpen()).toBe(false);
      expect(pictureInPictureService.getPipWindow()).toBeNull();
    });

    it('1.6 handles rapid toggling stress test (multiple concurrent calls and in-flight close)', async () => {
      let resolveWindow: (win: any) => void;
      const delayedRequest = vi.fn(
        () =>
          new Promise((resolve) => {
            resolveWindow = resolve;
          })
      );

      vi.stubGlobal('documentPictureInPicture', {
        requestWindow: delayedRequest,
      });

      // Rapid call 1 & call 2 while pending
      const req1 = pictureInPictureService.requestPipWindow();
      const req2 = pictureInPictureService.requestPipWindow();

      // Must coalesce into the same in-flight request
      expect(delayedRequest).toHaveBeenCalledTimes(1);

      // Now close before the promise resolves
      pictureInPictureService.closePipWindow();

      // Resolve window late
      const mockWin = createMockPipWindow();
      resolveWindow!(mockWin);

      // Both in-flight requests reject with generation mismatch error
      await expect(Promise.all([req1, req2])).rejects.toThrow(/closed before it opened/i);

      // Window was instructed to close
      expect(mockWin.close).toHaveBeenCalled();
      expect(pictureInPictureService.isOpen()).toBe(false);
    });
  });

  // =========================================================================
  // Challenge 2: Media Session OS Actions Under Simulated Background Events
  // =========================================================================
  describe('Challenge 2: Media Session OS Action Handlers & Background Events', () => {
    it('2.1 executes all OS action handlers (play, pause, stop, nexttrack, previoustrack) across session states', async () => {
      const handlers: Record<string, () => void> = {};
      const mockMediaSession = {
        metadata: null as any,
        playbackState: 'none',
        setActionHandler: vi.fn((action: string, handler: () => void) => {
          handlers[action] = handler;
        }),
      };
      vi.stubGlobal('navigator', { mediaSession: mockMediaSession });
      vi.stubGlobal('MediaMetadata', FakeMediaMetadata);

      const onClose = vi.fn();
      await flushRender(async () => (render(
        <FocusEngineModal
          isOpen={true}
          taskId="task-adversarial-1"
          initialMode="sprint"
          onClose={onClose}
        />
      )));

      // A. Idle state: 'play' starts the focus session
      expect(useFocusStore.getState().focusSession).toBeNull();
      await act(async () => {
        handlers.play();
      });
      expect(useFocusStore.getState().focusSession?.state).toBe('running');
      expect(useFocusStore.getState().focusSession?.mode).toBe('sprint');

      // B. Running state: 'pause' pauses the focus session
      await act(async () => {
        handlers.pause();
      });
      expect(useFocusStore.getState().focusSession?.state).toBe('paused');

      // C. Paused state: 'play' resumes the focus session
      await act(async () => {
        handlers.play();
      });
      expect(useFocusStore.getState().focusSession?.state).toBe('running');

      // D. Sprint mode: 'nexttrack' completes subtask 1 and advances to subtask 2
      await act(async () => {
        handlers.nexttrack();
      });
      expect(mockToggleSubTask).toHaveBeenCalledWith('task-adversarial-1', 'sub-adv-1');

      // E. Sprint mode: 'previoustrack' returns to subtask 1
      await act(async () => {
        handlers.previoustrack();
      });
      expect(screen.getByText('Step 1 of 3')).toBeDefined();

      // F. Sprint mode: 'previoustrack' at index 0 remains at index 0 (safe lower bound)
      await act(async () => {
        handlers.previoustrack();
      });
      expect(screen.getByText('Step 1 of 3')).toBeDefined();

      // G. 'stop' cleans up session and triggers onClose
      await act(async () => {
        handlers.stop();
      });
      expect(useFocusStore.getState().focusSession).toBeNull();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('2.2 handles background tab events (document.hidden) with Media Session and WakeLock', async () => {
      const handlers: Record<string, () => void> = {};
      const mockMediaSession = {
        metadata: null as any,
        playbackState: 'none',
        setActionHandler: vi.fn((action: string, handler: () => void) => {
          handlers[action] = handler;
        }),
      };
      vi.stubGlobal('navigator', {
        mediaSession: mockMediaSession,
        wakeLock: {
          request: vi.fn().mockResolvedValue({
            released: false,
            release: vi.fn().mockResolvedValue(undefined),
            addEventListener: vi.fn(),
          }),
        },
      });
      vi.stubGlobal('MediaMetadata', FakeMediaMetadata);

      await flushRender(async () => (render(<FocusEngineModal isOpen={true} taskId="task-adversarial-1" onClose={vi.fn()} />)));

      // Start session
      await act(async () => {
        handlers.play();
      });
      expect(useFocusStore.getState().focusSession?.state).toBe('running');

      // Simulate browser tab switching to background (visibilitychange -> hidden)
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      });
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // OS sends hardware Pause key while in background
      await act(async () => {
        handlers.pause();
      });
      expect(useFocusStore.getState().focusSession?.state).toBe('paused');

      // OS sends hardware Play key while in background
      await act(async () => {
        handlers.play();
      });
      expect(useFocusStore.getState().focusSession?.state).toBe('running');

      // Simulate tab returning to foreground (visibilitychange -> visible)
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      });
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      expect(useFocusStore.getState().focusSession?.state).toBe('running');
    });
  });

  // =========================================================================
  // Challenge 3: Keyboard Shortcut Collisions in Form Controls
  // =========================================================================
  describe('Challenge 3: Keyboard Shortcut Collisions & Form Isolation', () => {
    it('3.1 strictly ignores hotkeys (Space, Enter, p, f, Esc) when focused on input, textarea, and contenteditable', async () => {
      const mockClose = vi.fn();
      const mockRequestFullscreen = vi.fn().mockResolvedValue(undefined);
      window.HTMLDivElement.prototype.requestFullscreen = mockRequestFullscreen;

      const mockPipWindow = createMockPipWindow();
      vi.stubGlobal('documentPictureInPicture', {
        requestWindow: vi.fn(async () => mockPipWindow),
      });

      await flushRender(async () => (render(
        <FocusEngineModal
          isOpen={true}
          taskId="task-adversarial-1"
          initialMode="zen"
          onClose={mockClose}
        />
      )));

      // Create test elements
      const textInput = document.createElement('input');
      textInput.type = 'text';

      const numberInput = document.createElement('input');
      numberInput.type = 'number';

      const textarea = document.createElement('textarea');

      const contentEditableTrue = document.createElement('div');
      contentEditableTrue.setAttribute('contenteditable', 'true');

      const contentEditableEmpty = document.createElement('div');
      contentEditableEmpty.setAttribute('contenteditable', '');

      const formElements = [
        textInput,
        numberInput,
        textarea,
        contentEditableTrue,
        contentEditableEmpty,
      ];

      for (const el of formElements) {
        useFocusStore.setState({ focusSession: null });
        mockToggleTaskStatus.mockClear();
        document.body.appendChild(el);
        el.focus();

        // 1. Space: must NOT toggle play/pause
        fireEvent.keyDown(el, { code: 'Space', key: ' ' });
        expect(useFocusStore.getState().focusSession).toBeNull();

        // 2. Enter: must NOT toggle task completion
        fireEvent.keyDown(el, { key: 'Enter' });
        expect(mockToggleTaskStatus).not.toHaveBeenCalled();

        // 3. 'p' / 'P': must NOT trigger Document PiP
        await act(async () => {
          fireEvent.keyDown(el, { key: 'p' });
          fireEvent.keyDown(el, { key: 'P' });
        });
        expect(pictureInPictureService.isOpen()).toBe(false);

        // 4. 'f' / 'F': must NOT toggle fullscreen
        await act(async () => {
          fireEvent.keyDown(el, { key: 'f' });
          fireEvent.keyDown(el, { key: 'F' });
        });
        expect(mockRequestFullscreen).not.toHaveBeenCalled();

        // 5. 'Escape': must NOT call onClose
        await act(async () => {
          fireEvent.keyDown(el, { key: 'Escape' });
        });
        expect(mockClose).not.toHaveBeenCalled();

        document.body.removeChild(el);
      }
    });

    it('3.2 triggers hotkeys normally when keyboard events originate outside form controls', async () => {
      const mockClose = vi.fn();
      const mockRequestFullscreen = vi.fn().mockResolvedValue(undefined);
      window.HTMLDivElement.prototype.requestFullscreen = mockRequestFullscreen;

      const mockPipWindow = createMockPipWindow();
      vi.stubGlobal('documentPictureInPicture', {
        requestWindow: vi.fn(async () => mockPipWindow),
      });

      await flushRender(async () => (render(
        <FocusEngineModal
          isOpen={true}
          taskId="task-adversarial-1"
          initialMode="zen"
          onClose={mockClose}
        />
      )));

      // Outside input: Space starts session
      await act(async () => {
        fireEvent.keyDown(window, { code: 'Space', key: ' ' });
      });
      expect(useFocusStore.getState().focusSession?.state).toBe('running');

      // Outside input: Enter completes task
      await act(async () => {
        fireEvent.keyDown(window, { key: 'Enter' });
      });
      expect(mockToggleTaskStatus).toHaveBeenCalledWith('task-adversarial-1');

      // Outside input: 'p' opens PiP
      await act(async () => {
        fireEvent.keyDown(window, { key: 'p' });
      });
      expect(pictureInPictureService.isOpen()).toBe(true);

      // Outside input: 'f' triggers fullscreen
      await act(async () => {
        fireEvent.keyDown(window, { key: 'f' });
      });
      expect(mockRequestFullscreen).toHaveBeenCalled();

      // Outside input: Escape calls onClose
      await act(async () => {
        fireEvent.keyDown(window, { key: 'Escape' });
      });
      expect(mockClose).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Challenge 4: Escape Key Hierarchy (Fullscreen vs Modal Dismissal)
  // =========================================================================
  describe('Challenge 4: Escape Key Hierarchy (Fullscreen vs Modal Dismissal)', () => {
    it('4.1 in browser fullscreen, Escape exits fullscreen first without closing modal; second Escape closes modal', async () => {
      const mockClose = vi.fn();
      const mockExitFullscreen = vi.fn().mockImplementation(() => {
        Object.defineProperty(document, 'fullscreenElement', {
          value: null,
          configurable: true,
        });
        return Promise.resolve();
      });
      document.exitFullscreen = mockExitFullscreen;

      await flushRender(async () => (render(
        <FocusEngineModal
          isOpen={true}
          taskId="task-adversarial-1"
          initialMode="zen"
          onClose={mockClose}
        />
      )));

      // Simulate user entering fullscreen
      Object.defineProperty(document, 'fullscreenElement', {
        value: document.createElement('div'),
        configurable: true,
      });

      // First Escape: exits fullscreen, modal MUST stay open
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(mockExitFullscreen).toHaveBeenCalledTimes(1);
      expect(mockClose).not.toHaveBeenCalled();

      // Second Escape: modal closes
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it('4.2 ModalRoot centralized Escape respects fullscreen hierarchy for focusEngine modal', async () => {
      const mockExitFullscreen = vi.fn().mockImplementation(() => {
        Object.defineProperty(document, 'fullscreenElement', {
          value: null,
          configurable: true,
        });
        return Promise.resolve();
      });
      document.exitFullscreen = mockExitFullscreen;

      // Mount ModalRoot with focusEngine opened
      const TestRoot = () => {
        const { openModal } = useModal();
        return (
          <div>
            <button onClick={() => openModal('focusEngine', { taskId: 'task-adversarial-1' })}>
              Open Focus Engine
            </button>
            <ModalRoot />
          </div>
        );
      };

      await flushRender(async () => (render(
        <ModalProvider>
          <TestRoot />
        </ModalProvider>
      )));

      // Open focusEngine modal
      await act(async () => {
        fireEvent.click(screen.getByText('Open Focus Engine'));
      });

      expect(screen.getByRole('dialog', { name: 'Unified Focus Engine' })).toBeDefined();

      // Set fullscreen
      Object.defineProperty(document, 'fullscreenElement', {
        value: document.createElement('div'),
        configurable: true,
      });

      // Escape in fullscreen: ModalRoot must NOT close the modal!
      await act(async () => {
        fireEvent.keyDown(window, { key: 'Escape' });
      });

      expect(mockExitFullscreen).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('dialog', { name: 'Unified Focus Engine' })).toBeDefined();

      // Subsequent Escape when not in fullscreen: closes the modal
      await act(async () => {
        fireEvent.keyDown(window, { key: 'Escape' });
      });

      expect(screen.queryByRole('dialog', { name: 'Unified Focus Engine' })).toBeNull();
    });
  });
});
