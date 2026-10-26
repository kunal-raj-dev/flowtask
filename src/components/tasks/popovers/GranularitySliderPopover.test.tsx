import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GranularitySliderPopover } from './GranularitySliderPopover';
import { audioEngine } from '../../../utils/audioEngine';

vi.mock('../../../utils/audioEngine', () => ({
  audioEngine: {
    playPopSound: vi.fn(),
    playTaskComplete: vi.fn(),
  },
}));

describe('GranularitySliderPopover', () => {
  const onApplySubtasks = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with default Detailed granularity (level 3) and displays preview steps', () => {
    render(
      <GranularitySliderPopover
        taskId="task-1"
        taskTitle="Implement Authentication Flow"
        onApplySubtasks={onApplySubtasks}
        onClose={onClose}
      />
    );

    expect(screen.getByRole('dialog', { name: 'ADHD Task Breakdown Granularity' })).toBeDefined();
    expect(screen.getByText(/Detailed \(Level 3\)/i)).toBeDefined();
    expect(screen.getByText(/6 steps/i)).toBeDefined();
  });

  it('updates granularity when slider or number hotkey (1-5) is pressed', () => {
    render(
      <GranularitySliderPopover
        taskId="task-1"
        taskTitle="Write Documentation"
        onApplySubtasks={onApplySubtasks}
        onClose={onClose}
      />
    );

    // Press '1' for Macro
    fireEvent.keyDown(window, { key: '1' });
    expect(screen.getByText(/Macro \(Level 1\)/i)).toBeDefined();
    expect(screen.getByText(/2 steps/i)).toBeDefined();
    expect(audioEngine.playPopSound).toHaveBeenCalled();

    // Press '5' for Hyper-Atomic
    fireEvent.keyDown(window, { key: '5' });
    expect(screen.getByText(/Hyper-Atomic \(Level 5\)/i)).toBeDefined();
    expect(screen.getByText(/12 steps/i)).toBeDefined();
  });

  it('applies subtasks and triggers sound on button click', () => {
    render(
      <GranularitySliderPopover
        taskId="task-1"
        taskTitle="Deploy Service"
        onApplySubtasks={onApplySubtasks}
        onClose={onClose}
      />
    );

    const applyBtn = screen.getByRole('button', { name: /Apply \d+ Breakdown Steps/i });
    fireEvent.click(applyBtn);

    expect(audioEngine.playTaskComplete).toHaveBeenCalled();
    expect(onApplySubtasks).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          title: expect.any(String),
          completed: false,
        }),
      ])
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('applies subtasks on Enter key and closes on Escape key', () => {
    const { unmount } = render(
      <GranularitySliderPopover
        taskId="task-1"
        taskTitle="Deploy Service"
        onApplySubtasks={onApplySubtasks}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onApplySubtasks).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();

    unmount();

    // Re-render and test Escape
    render(
      <GranularitySliderPopover
        taskId="task-2"
        taskTitle="Another Task"
        onApplySubtasks={onApplySubtasks}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
