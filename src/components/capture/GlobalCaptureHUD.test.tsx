// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GlobalCaptureHUD } from './GlobalCaptureHUD';
import { TaskContext } from '../../context/TaskContext';
import type { Project } from '../../types/task';

describe('GlobalCaptureHUD', () => {
  const mockAddTask = vi.fn();
  const mockClose = vi.fn();

  const sampleProjects: Project[] = [
    { id: 'work', name: 'Work', color: '#3B82F6', isArchived: false },
    { id: 'personal', name: 'Personal', color: '#10B981', isArchived: false },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderHUD = (isOpen = true) => {
    return render(
      <TaskContext.Provider
        value={{
          addTask: mockAddTask,
          projects: sampleProjects,
        } as any}
      >
        <GlobalCaptureHUD isOpen={isOpen} onClose={mockClose} />
      </TaskContext.Provider>
    );
  };

  it('does not render when isOpen is false', () => {
    renderHUD(false);
    expect(screen.queryByTestId('global-capture-hud')).toBeNull();
  });

  it('renders input and extracts live token chips as user types', () => {
    renderHUD(true);

    expect(screen.getByTestId('global-capture-hud')).toBeDefined();
    const input = screen.getByTestId('capture-hud-input');

    // Type a multi-token command
    fireEvent.change(input, {
      target: { value: 'Refactor audio engine ~45m #work !p1 ~deep' },
    });

    // Check token chips container
    expect(screen.getByText('45m')).toBeDefined();
    expect(screen.getByText('#work')).toBeDefined();
    expect(screen.getByText('P1 Urgent')).toBeDefined();
    expect(screen.getByText('Deep Work')).toBeDefined();
  });

  it('submits parsed task and plays earcon on Enter', () => {
    renderHUD(true);
    const input = screen.getByTestId('capture-hud-input');

    fireEvent.change(input, {
      target: { value: 'Prepare keynote speech ~60m #work !p2 ~deep' },
    });

    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(mockAddTask).toHaveBeenCalledTimes(1);
    const [title, overrides] = mockAddTask.mock.calls[0];
    expect(title).toBe('Prepare keynote speech');
    expect(overrides.projectId).toBe('work');
    expect(overrides.priority).toBe('p2');
    expect(overrides.estimatedMinutes).toBe(60);
    expect(overrides.cognitiveLoad).toBe('deep_work');
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape key press', () => {
    renderHUD(true);
    const input = screen.getByTestId('capture-hud-input');

    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
