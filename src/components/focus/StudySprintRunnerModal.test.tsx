// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StudySprintRunnerModal } from './StudySprintRunnerModal';
import { audioEngine } from '../../utils/audioEngine';
import type { Task } from '../../types/task';

vi.mock('../../utils/audioEngine', () => ({
  audioEngine: {
    startAmbientSound: vi.fn(),
    stopAmbientSound: vi.fn(),
    playClickSound: vi.fn(),
    playRuleOf3Fanfare: vi.fn(),
  },
}));

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

const mockUpdateTask = vi.fn();
const mockToggleSubTask = vi.fn();

const sampleTask: Task = {
  id: 'task-study-1',
  title: 'LeetCode 75 Sprint',
  status: 'todo',
  priority: 'p1',
  projectId: 'work',
  createdAt: Date.now(),
  subtasks: [
    { id: 'sub-1', title: 'Two Sum', completed: false, difficulty: 'EASY', estimatedMinutes: 15 },
    { id: 'sub-2', title: 'Add Two Numbers', completed: false, difficulty: 'MEDIUM', estimatedMinutes: 25 },
  ],
};

let mockTotalFocusedTodaySeconds = 0;

vi.mock('../../context/TaskContext', () => ({
  useTaskContext: () => ({
    tasks: [sampleTask],
    updateTask: mockUpdateTask,
    toggleSubTask: mockToggleSubTask,
    totalFocusedTodaySeconds: mockTotalFocusedTodaySeconds,
  }),
}));

describe('StudySprintRunnerModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly when open', () => {
    render(
      <StudySprintRunnerModal
        isOpen={true}
        taskId="task-study-1"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('LeetCode 75 Sprint')).toBeDefined();
    expect(screen.getAllByText('Two Sum').length).toBeGreaterThan(0);
  });

  it('cleans up ambient sound when unmounted', () => {
    const { unmount } = render(
      <StudySprintRunnerModal
        isOpen={true}
        taskId="task-study-1"
        onClose={vi.fn()}
      />
    );

    unmount();
    expect(audioEngine.stopAmbientSound).toHaveBeenCalled();
  });

  it('toggles fullscreen mode and updates padding correctly', () => {
    const handleClose = vi.fn();
    render(
      <StudySprintRunnerModal
        isOpen={true}
        taskId="task-study-1"
        onClose={handleClose}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('p-2');

    // Press 'f' to toggle fullscreen
    fireEvent.keyDown(window, { key: 'f' });
    expect(dialog.className).toContain('p-0');
    expect(dialog.className).not.toContain('p-2');

    // Press 'Escape' to exit fullscreen
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(dialog.className).toContain('p-2');
    expect(handleClose).not.toHaveBeenCalled();

    // Next 'Escape' closes modal
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('does not toggle fullscreen when typing in an input element', () => {
    render(
      <StudySprintRunnerModal
        isOpen={true}
        taskId="task-study-1"
        onClose={vi.fn()}
      />
    );

    const dialog = screen.getByRole('dialog');
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    fireEvent.keyDown(input, { key: 'f' });
    // Should still have p-2, fullscreen not toggled
    expect(dialog.className).toContain('p-2');

    document.body.removeChild(input);
  });

  it('renders today total focused time when focus time exists', () => {
    mockTotalFocusedTodaySeconds = 3600; // 1h
    render(
      <StudySprintRunnerModal
        isOpen={true}
        taskId="task-study-1"
        onClose={vi.fn()}
      />
    );

    expect(screen.getAllByText(/1h focused today/i).length).toBeGreaterThan(0);
    mockTotalFocusedTodaySeconds = 0;
  });
});
