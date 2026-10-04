// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PomodoroModal } from './PomodoroModal';

// Mock audio engine to avoid Web Audio errors in jsdom
vi.mock('../../utils/audioEngine', () => ({
  audioEngine: {
    startAmbientSound: vi.fn(),
    stopAmbientSound: vi.fn(),
    playPomodoroComplete: vi.fn(),
    playCompletionChime: vi.fn(),
    playStashChime: vi.fn(),
  },
}));

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

// Mock TaskContext
const mockStopFocusSession = vi.fn();
const mockStartFocusSession = vi.fn();
const mockPauseFocusSession = vi.fn();
const mockResumeFocusSession = vi.fn();
const mockStashActiveFocus = vi.fn();
const mockToggleTaskStatus = vi.fn();

vi.mock('../../context/TaskContext', () => ({
  useTaskContext: () => ({
    tasks: [
      {
        id: 'task-1',
        title: 'Deep Work Session',
        status: 'todo',
        priority: 'p1',
        projectId: 'inbox',
        createdAt: Date.now(),
        subtasks: [],
      },
    ],
    stashActiveFocus: mockStashActiveFocus,
    toggleTaskStatus: mockToggleTaskStatus,
    focusSession: null,
    focusElapsedSeconds: 0,
    startFocusSession: mockStartFocusSession,
    pauseFocusSession: mockPauseFocusSession,
    resumeFocusSession: mockResumeFocusSession,
    stopFocusSession: mockStopFocusSession,
  }),
}));

describe('PomodoroModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders standard popup modal initially', () => {
    const handleClose = vi.fn();
    render(<PomodoroModal taskId="task-1" onClose={handleClose} />);

    expect(screen.getByRole('dialog', { name: /focus timer/i })).toBeDefined();
    expect(screen.getByTitle(/zen fullscreen mode/i)).toBeDefined();
    expect(screen.getByText('Deep Work Session')).toBeDefined();
  });

  it('switches to Zen fullscreen mode with solid theme background when fullscreen button is clicked', () => {
    const handleClose = vi.fn();
    render(<PomodoroModal taskId="task-1" onClose={handleClose} />);

    const fullscreenBtn = screen.getByTitle(/zen fullscreen mode/i);
    fireEvent.click(fullscreenBtn);

    // Should now be in Zen mode
    const zenDialog = screen.getByRole('dialog', { name: /zen focus mode/i });
    expect(zenDialog).toBeDefined();

    // Verify it uses the solid theme background and isolation classes
    expect(zenDialog.className).toContain('bg-[var(--bg-main)]');
    expect(zenDialog.className).toContain('isolate');
    expect(zenDialog.className).toContain('z-[60]');
    expect(zenDialog.className).not.toContain('bg-[var(--bg-canvas)]');

    // Verify Zen specific elements exist
    expect(screen.getByTitle(/exit zen fullscreen/i)).toBeDefined();
    expect(screen.getByText('Deep Work Chamber • Zero Distractions')).toBeDefined();
  });

  it('exits Zen fullscreen mode back to standard modal when Exit Zen button is clicked', () => {
    const handleClose = vi.fn();
    render(<PomodoroModal taskId="task-1" onClose={handleClose} />);

    // Enter Zen
    fireEvent.click(screen.getByTitle(/zen fullscreen mode/i));
    expect(screen.getByRole('dialog', { name: /zen focus mode/i })).toBeDefined();

    // Exit Zen
    fireEvent.click(screen.getByTitle(/exit zen fullscreen/i));
    expect(screen.getByRole('dialog', { name: /focus timer/i })).toBeDefined();
    expect(handleClose).not.toHaveBeenCalled();
  });

  it('toggles Zen fullscreen mode using the "F" keyboard shortcut', () => {
    const handleClose = vi.fn();
    render(<PomodoroModal taskId="task-1" onClose={handleClose} />);

    // Press 'f' to enter
    fireEvent.keyDown(window, { key: 'f' });
    expect(screen.getByRole('dialog', { name: /zen focus mode/i })).toBeDefined();

    // Press 'F' to exit
    fireEvent.keyDown(window, { key: 'F' });
    expect(screen.getByRole('dialog', { name: /focus timer/i })).toBeDefined();
  });

  it('handles Escape key: exits Zen mode first, then closes modal on next Escape', () => {
    const handleClose = vi.fn();
    render(<PomodoroModal taskId="task-1" onClose={handleClose} />);

    // Enter Zen
    fireEvent.click(screen.getByTitle(/zen fullscreen mode/i));
    expect(screen.getByRole('dialog', { name: /zen focus mode/i })).toBeDefined();

    // Escape exits Zen mode
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: /focus timer/i })).toBeDefined();
    expect(handleClose).not.toHaveBeenCalled();

    // Second Escape closes modal
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
