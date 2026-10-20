// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { HorizonTodayView } from './HorizonTodayView';
import type { Task } from '../../../types/task';

const mockUpdateTask = vi.fn();
const mockAddTask = vi.fn();

const sampleTasks: Task[] = [
  {
    id: 'top-1',
    title: 'Top Priority 1',
    status: 'todo',
    priority: 'p1',
    projectId: 'inbox',
    createdAt: 1,
    plannedDate: '2026-10-07',
    topThreeDate: '2026-10-07',
    isPinnedToday: true,
    estimatedMinutes: 60,
    subtasks: [],
  },
  {
    id: 'top-2',
    title: 'Top Priority 2',
    status: 'todo',
    priority: 'p2',
    projectId: 'inbox',
    createdAt: 2,
    plannedDate: '2026-10-07',
    topThreeDate: '2026-10-07',
    isPinnedToday: true,
    estimatedMinutes: 45,
    subtasks: [],
  },
  {
    id: 'morning-1',
    title: 'Morning Focus Task',
    status: 'todo',
    priority: 'p3',
    projectId: 'inbox',
    createdAt: 3,
    plannedDate: '2026-10-07',
    scheduledStart: '09:00',
    scheduledEnd: '10:00',
    estimatedMinutes: 60,
    subtasks: [],
  },
  {
    id: 'evening-1',
    title: 'Evening Task',
    status: 'todo',
    priority: 'p4',
    projectId: 'inbox',
    createdAt: 4,
    plannedDate: '2026-10-07',
    isEvening: true,
    estimatedMinutes: 30,
    subtasks: [],
  },
  {
    id: 'daytime-1',
    title: 'Regular Daytime Flow Task',
    status: 'todo',
    priority: 'p3',
    projectId: 'inbox',
    createdAt: 5,
    plannedDate: '2026-10-07',
    estimatedMinutes: 30,
    subtasks: [],
  },
  {
    id: 'someday-1',
    title: 'Backlog Someday Task',
    status: 'todo',
    priority: 'p3',
    projectId: 'inbox',
    createdAt: 6,
    isSomeday: true,
    subtasks: [],
  },
];

vi.mock('../../../context/TaskContext', () => ({
  useTaskContext: () => ({
    tasks: sampleTasks,
    projects: [{ id: 'inbox', name: 'Inbox', color: '#64748B' }],
    calendarEvents: [
      { id: 'cal-1', title: 'Team Standup', startTime: '10:00', endTime: '10:30', date: '2026-10-07' },
    ],
    settings: { targetWorkCapacityHours: 6, enableSmartSyntaxParsing: true },
    updateTask: mockUpdateTask,
    addTask: mockAddTask,
    showToast: vi.fn(),
    toggleTaskStatus: vi.fn(),
    toggleTaskPinToday: vi.fn(),
    deleteTask: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useCurrentDate', () => ({
  useTodayStr: () => '2026-10-07',
  getTodayStr: () => '2026-10-07',
  getTomorrowStr: () => '2026-10-08',
}));

vi.mock('../../../hooks/useTotalFocusedTodaySeconds', () => ({
  useTotalFocusedTodaySeconds: () => 3600,
}));

describe('HorizonTodayView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Top 3 Priorities deck with rank badges', () => {
    render(<HorizonTodayView onSelectTask={vi.fn()} onStartFocus={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Today.' })).toBeDefined();
    expect(screen.getByText('Your Top 3')).toBeDefined();
    expect(screen.getByText('Top Priority 1')).toBeDefined();
    expect(screen.getByText('Top Priority 2')).toBeDefined();
    expect(screen.getByLabelText('Priority 1')).toBeDefined();
    expect(screen.getByLabelText('Priority 2')).toBeDefined();
  });

  it('renders structured daytime batches (Morning Focus, Daytime Flow, This Evening)', () => {
    render(<HorizonTodayView onSelectTask={vi.fn()} onStartFocus={vi.fn()} />);

    expect(screen.getByRole('region', { name: 'Morning Focus' })).toBeDefined();
    expect(screen.getAllByText('Morning Focus Task').length).toBeGreaterThanOrEqual(1);

    expect(screen.getByRole('region', { name: 'Daytime Flow' })).toBeDefined();
    expect(screen.getByText('Regular Daytime Flow Task')).toBeDefined();

    expect(screen.getByRole('region', { name: 'This Evening' })).toBeDefined();
    expect(screen.getByText('Evening Task')).toBeDefined();
  });

  it('allows inline task capture and dispatches addTask', () => {
    render(<HorizonTodayView onSelectTask={vi.fn()} onStartFocus={vi.fn()} />);

    const input = screen.getByRole('textbox', { name: 'Add a task to this list' });
    fireEvent.change(input, { target: { value: 'New Horizon Action Item !p1 ~45m' } });

    const submitBtn = screen.getByRole('button', { name: 'Add task' });
    fireEvent.click(submitBtn);

    expect(mockAddTask).toHaveBeenCalledWith('New Horizon Action Item !p1 ~45m', expect.objectContaining({
      plannedDate: '2026-10-07',
      priority: 'p1',
      estimatedMinutes: 45,
    }));
  });

  it('provides dashboard switch trigger when callback is provided', () => {
    const onSwitch = vi.fn();
    render(<HorizonTodayView onSwitchToDashboard={onSwitch} />);

    const switcher = screen.getByRole('button', { name: 'Switch dashboard' });
    fireEvent.click(switcher);
    expect(onSwitch).toHaveBeenCalled();
  });
});
