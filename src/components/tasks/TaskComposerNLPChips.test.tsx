// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskComposer } from './TaskComposer';

const mockAddTask = vi.fn();
const mockAddMultipleTasks = vi.fn();

vi.mock('../../context/TaskContext', () => ({
  useTaskContext: () => ({
    tasks: [],
    projects: [
      { id: 'work', name: 'Web Development', color: '#3B82F6' },
      { id: 'inbox', name: 'Inbox', color: '#64748B' },
    ],
    activeView: 'today',
    addTask: mockAddTask,
    addMultipleTasks: mockAddMultipleTasks,
    showToast: vi.fn(),
    setIsTemplatePickerOpen: vi.fn(),
  }),
}));

vi.mock('../../hooks/useCurrentDate', () => ({
  useTodayStr: () => '2026-10-04',
}));

vi.mock('../../utils/audioEngine', () => ({
  audioEngine: {
    playClickSound: vi.fn(),
  },
}));

vi.mock('../../utils/voiceDictationService', () => ({
  isVoiceDictationSupported: () => false,
  createVoiceDictationSession: vi.fn(),
}));

describe('TaskComposer Auto-Revealing NLP Chips (BUG-18)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps capture tools out of the idle row and preserves the draft when opening and closing them', () => {
    render(<TaskComposer />);
    expect(screen.queryByRole('tab', { name: 'Note' })).toBeNull();
    const input = screen.getByRole('textbox', { name: 'Task title' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Write the response' } });
    fireEvent.click(screen.getByRole('button', { name: 'Capture tools' }));
    expect(screen.getByRole('tab', { name: 'Note' })).toBeDefined();
    expect(screen.getByRole('button', { name: /More details/ })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Capture tools' }));
    expect(screen.queryByRole('tab', { name: 'Note' })).toBeNull();
    expect(input.value).toBe('Write the response');
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(mockAddTask).toHaveBeenCalledWith('Write the response', expect.objectContaining({ plannedDate: '2026-10-04' }));
  });

  it('keeps chips hidden when typing plain text without natural language tokens', () => {
    render(<TaskComposer />);

    const input = screen.getByPlaceholderText(/What needs to be done/i);
    fireEvent.change(input, { target: { value: 'Buy organic groceries' } });

    // Chips bar should not be visible
    expect(screen.queryByLabelText('Deadline')).toBeNull();
    expect(screen.queryByTitle(/Click to cycle priority/i)).toBeNull();
  });

  it('auto-reveals deadline chip when typing date tokens (e.g. "due 2026-10-25")', () => {
    render(<TaskComposer />);

    const input = screen.getByPlaceholderText(/What needs to be done/i);
    fireEvent.change(input, { target: { value: 'Submit quarterly tax report due 2026-10-25' } });

    // Deadline input chip should auto-reveal without manually clicking set properties
    const deadlineInput = screen.getByLabelText('Deadline') as HTMLInputElement;
    expect(deadlineInput).toBeDefined();
    expect(deadlineInput.value).toBe('2026-10-25');

    // Indicator badge should show Parsed
    expect(screen.getByText('Parsed')).toBeDefined();
  });

  it('auto-reveals priority chip when typing priority tokens (e.g. "p1")', () => {
    render(<TaskComposer />);

    const input = screen.getByPlaceholderText(/What needs to be done/i);
    fireEvent.change(input, { target: { value: 'Emergency server outage fix p1' } });

    // Priority chip should auto-reveal showing P1
    const priorityBtn = screen.getByTitle(/Click to cycle priority/i);
    expect(priorityBtn).toBeDefined();
    expect(priorityBtn.textContent).toContain('P1');
  });

  it('auto-reveals duration chip when typing duration tokens (e.g. "~45m")', () => {
    render(<TaskComposer />);

    const input = screen.getByPlaceholderText(/What needs to be done/i);
    fireEvent.change(input, { target: { value: 'System architecture review ~45m' } });

    // Duration chip should auto-reveal showing ~45m
    const durationBtn = screen.getByTitle(/Click to cycle estimated duration/i);
    expect(durationBtn).toBeDefined();
    expect(durationBtn.textContent).toContain('~45m');
  });

  it('auto-reveals project chip when typing project tags (e.g. "#work")', () => {
    render(<TaskComposer />);

    const input = screen.getByPlaceholderText(/What needs to be done/i);
    fireEvent.change(input, { target: { value: 'Write API endpoints #work' } });

    // Project select chip should auto-reveal with work project selected
    const projectSelect = screen.getByLabelText('Project') as HTMLSelectElement;
    expect(projectSelect).toBeDefined();
    expect(projectSelect.value).toBe('work');
  });

  it('allows user to tap chips to fine-tune (e.g. cycle priority and duration)', () => {
    render(<TaskComposer />);

    const input = screen.getByPlaceholderText(/What needs to be done/i);
    fireEvent.change(input, { target: { value: 'Refactor auth pipeline p2 ~30m' } });

    // Priority chip starts at P2
    const priorityBtn = screen.getByTitle(/Click to cycle priority/i);
    expect(priorityBtn.textContent).toContain('P2');

    // Click priority chip to cycle: p2 -> p1
    fireEvent.click(priorityBtn);
    expect(priorityBtn.textContent).toContain('P1');

    // Duration starts at ~30m
    const durationBtn = screen.getByTitle(/Click to cycle estimated duration/i);
    expect(durationBtn.textContent).toContain('~30m');

    // Click duration chip to cycle: 30 -> 45
    fireEvent.click(durationBtn);
    expect(durationBtn.textContent).toContain('~45m');
  });

  it('allows user to clear parsed parameters using the clear X button and hides the chip', () => {
    render(<TaskComposer />);

    const input = screen.getByPlaceholderText(/What needs to be done/i);
    fireEvent.change(input, { target: { value: 'Deploy release candidate due 2026-10-25' } });

    // Clear deadline
    const clearBtn = screen.getByTitle('Clear deadline');
    fireEvent.click(clearBtn);

    // The deadline chip should now be hidden
    expect(screen.queryByLabelText('Deadline')).toBeNull();

    // Submitting must pass undefined dueDate, not empty string
    const addBtn = screen.getByRole('button', { name: /Add/i });
    fireEvent.click(addBtn);

    expect(mockAddTask).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        dueDate: undefined,
      })
    );
  });
});
