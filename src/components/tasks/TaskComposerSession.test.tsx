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
  useTomorrowStr: () => '2026-10-05',
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

describe('TaskComposer Session Duration Generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders + Session chip and toggles the Session Duration Generator card', async () => {
    render(<TaskComposer />);

    // Expand properties
    const setPropsBtn = screen.getByRole('button', { name: /more details/i });
    fireEvent.click(setPropsBtn);

    // Find + Session chip
    const sessionChip = screen.getByRole('button', { name: /\+ Session/i });
    expect(sessionChip).toBeDefined();

    // Click + Session
    fireEvent.click(sessionChip);

    // Generator card should now be rendered with default 08:00 to 11:00 and 3h duration
    expect(await screen.findByText('Session Duration Generator')).toBeDefined();
    expect(screen.getByText(/3h \(180m\)/i)).toBeDefined();
    expect(screen.getByLabelText('Session number')).toBeDefined();
    expect(screen.getByLabelText('Session start time')).toBeDefined();
    expect(screen.getByLabelText('Session end time')).toBeDefined();
  });

  it('submits task with scheduled start, end, duration and session metadata', async () => {
    render(<TaskComposer />);

    // Input task title
    const input = screen.getByPlaceholderText(/What needs to be done/i);
    fireEvent.change(input, { target: { value: 'Complete Graph Algorithms' } });

    // Expand properties & enable session
    const setPropsBtn = screen.getByRole('button', { name: /more details/i });
    fireEvent.click(setPropsBtn);
    const sessionChip = screen.getByRole('button', { name: /\+ Session/i });
    fireEvent.click(sessionChip);

    fireEvent.click(await screen.findByRole('button', { name: /Apply Session/i }));

    // Submit task
    const addBtn = screen.getByRole('button', { name: /^add$/i });
    fireEvent.click(addBtn);

    expect(mockAddTask).toHaveBeenCalledWith(
      'Complete Graph Algorithms',
      expect.objectContaining({
        scheduledStart: '08:00',
        scheduledEnd: '11:00',
        estimatedMinutes: undefined,
        dueTime: '11:00',
        plannedDate: '2026-10-04',
        sessionMetadata: expect.objectContaining({
          isSession: true,
          sessionNumber: 1,
          sessionTopic: 'Complete Graph Algorithms',
        }),
      })
    );
  });

  it('applies quick session time presets (e.g. Afternoon 14:30–17:30)', async () => {
    render(<TaskComposer />);

    // Expand properties & enable session
    fireEvent.click(screen.getByRole('button', { name: /more details/i }));
    fireEvent.click(screen.getByRole('button', { name: /\+ Session/i }));

    // Click Afternoon preset
    const afternoonBtn = await screen.findByRole('button', { name: /Afternoon/i });
    fireEvent.click(afternoonBtn);
    fireEvent.click(screen.getByRole('button', { name: /Apply Session/i }));

    // Input task title and submit
    const input = screen.getByPlaceholderText(/What needs to be done/i);
    fireEvent.change(input, { target: { value: 'Frontend Redesign Sprint' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    expect(mockAddTask).toHaveBeenCalledWith(
      'Frontend Redesign Sprint',
      expect.objectContaining({
        scheduledStart: '14:30',
        scheduledEnd: '17:30',
        estimatedMinutes: undefined,
      })
    );
  });
  it('defaults plannedDate to todayStr when no date is specified in today view', () => {
    render(<TaskComposer />);
    const input = screen.getByPlaceholderText(/What needs to be done/i);
    fireEvent.change(input, { target: { value: 'Buy groceries' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    expect(mockAddTask).toHaveBeenCalledWith(
      'Buy groceries',
      expect.objectContaining({
        plannedDate: '2026-10-04',
      })
    );
  });

  it('does not force plannedDate to todayStr when a future due date is parsed', () => {
    render(<TaskComposer />);
    const input = screen.getByPlaceholderText(/What needs to be done/i);
    fireEvent.change(input, { target: { value: 'Prepare Q3 report tomorrow at 3pm' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    expect(mockAddTask).toHaveBeenCalledWith(
      'Prepare Q3 report',
      expect.objectContaining({
        plannedDate: undefined,
        dueTime: '15:00',
      })
    );
  });
  it('requires Apply, preserves a manual work estimate, and discards edited session drafts on Cancel', async () => {
    render(<TaskComposer />);
    fireEvent.change(screen.getByPlaceholderText(/What needs to be done/i), { target: { value: 'Study arrays ~40m' } });
    fireEvent.click(screen.getByRole('button', { name: /more details/i }));
    fireEvent.click(screen.getByRole('button', { name: /\+ Session/i }));
    fireEvent.change(await screen.findByLabelText('Session start time'), { target: { value: '14:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
    expect(mockAddTask).toHaveBeenCalledWith('Study arrays', expect.objectContaining({
      scheduledStart: undefined, scheduledEnd: undefined, sessionMetadata: undefined, estimatedMinutes: 40,
    }));
  });

  it('does not turn an unapplied open editor into a saved session', () => {
    render(<TaskComposer />);
    fireEvent.change(screen.getByPlaceholderText(/What needs to be done/i), { target: { value: 'Review notes ~20m' } });
    fireEvent.click(screen.getByRole('button', { name: /more details/i }));
    fireEvent.click(screen.getByRole('button', { name: /\+ Session/i }));
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
    expect(mockAddTask).toHaveBeenCalledWith('Review notes', expect.objectContaining({
      scheduledStart: undefined, sessionMetadata: undefined, estimatedMinutes: 20,
    }));
  });
});

