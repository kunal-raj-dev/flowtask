// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CopilotOmnibar } from './CopilotOmnibar';
import * as webMcpService from '../../services/webMcpService';

vi.mock('../../utils/audioEngine', () => ({
  audioEngine: {
    playClickSound: vi.fn(),
    playPopSound: vi.fn(),
  },
}));

describe('CopilotOmnibar Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders omnibar dialog with input and suggestion chips when open', () => {
    render(<CopilotOmnibar isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'FlowTask Copilot' })).toBeDefined();
    expect(screen.getByPlaceholderText(/Ask Copilot/i)).toBeDefined();
    expect(screen.getByText('Decompose feature')).toBeDefined();
    expect(screen.getByText('Daily summary')).toBeDefined();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(<CopilotOmnibar isOpen={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('closes on Escape key press', () => {
    const onClose = vi.fn();
    render(<CopilotOmnibar isOpen={true} onClose={onClose} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('decomposes a task title into actionable subtasks and 2-min starter step', async () => {
    render(<CopilotOmnibar isOpen={true} onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText(/Ask Copilot/i);
    fireEvent.change(input, { target: { value: 'Fix bug in auth workflow' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getAllByText(/Fix bug in auth workflow/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/2-Min Starter/i)).toBeDefined();
      expect(screen.getByText(/Add Task with Subtasks/i)).toBeDefined();
    });
  });

  it('executes daily summary and renders stats cards', async () => {
    const mockSummary = {
      totalTasks: 8,
      completedTasks: 6,
      completionRate: 75,
      topThreeCount: 3,
      topThreeCompleted: 3,
      totalPlannedMinutes: 240,
      focusedSeconds: 5400,
    };

    vi.spyOn(webMcpService, 'executeWebMcpTool').mockResolvedValueOnce(mockSummary);

    render(<CopilotOmnibar isOpen={true} onClose={vi.fn()} />);

    const summaryBtn = screen.getByText('Daily summary');
    fireEvent.click(summaryBtn);

    await waitFor(() => {
      expect(screen.getByText('75%')).toBeDefined();
      expect(screen.getByText('Daily Productivity Summary')).toBeDefined();
      expect(screen.getByText('3 / 3')).toBeDefined();
    });
  });

  it('applies decomposed task to workspace via createTask WebMCP tool', async () => {
    const executeSpy = vi.spyOn(webMcpService, 'executeWebMcpTool').mockResolvedValue({
      success: true,
      task: { id: 'task-123' },
    });

    render(<CopilotOmnibar isOpen={true} onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText(/Ask Copilot/i);
    fireEvent.change(input, { target: { value: 'Draft business proposal' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText(/Add Task with Subtasks/i)).toBeDefined();
    });

    const addBtn = screen.getByText(/Add Task with Subtasks/i);
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(executeSpy).toHaveBeenCalledWith('createTask', expect.objectContaining({
        title: 'Draft business proposal',
      }));
      expect(screen.getByText(/Added to Workspace/i)).toBeDefined();
    });
  });
});
