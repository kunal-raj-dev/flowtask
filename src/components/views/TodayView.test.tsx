// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TodayView } from './TodayView';

let mockTotalFocusedTodaySeconds = 0;
let mockFocusSession: any = null;

const mockTasks = [
  {
    id: 't-1',
    title: 'Solve Priority Problem',
    status: 'todo',
    priority: 'p1',
    projectId: 'inbox',
    createdAt: Date.now(),
    plannedDate: '2026-10-07',
    isPinnedToday: true,
  },
];

vi.mock('../../context/TaskContext', () => ({
  useTaskContext: () => ({
    activeView: 'today',
    selectedTaskIds: [],
    projects: [{ id: 'inbox', name: 'Inbox', color: '#64748B' }],
    tags: [],
    tasks: mockTasks,
    quickWinsOnly: false,
    priorityFilter: 'all',
    toggleTaskStatus: vi.fn(),
    toggleTaskPinToday: vi.fn(),
    updateTask: vi.fn(),
    batchUpdateTasks: vi.fn(),
    deleteTask: vi.fn(),
    settings: { targetWorkCapacityHours: 6.0 },
    showToast: vi.fn(),
    focusSession: mockFocusSession,
    totalFocusedTodaySeconds: mockTotalFocusedTodaySeconds,
  }),
}));

vi.mock('../../hooks/useCurrentDate', () => ({
  useTodayStr: () => '2026-10-07',
  getTodayStr: () => '2026-10-07',
  getTomorrowStr: () => '2026-10-08',
}));

describe('TodayView Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTotalFocusedTodaySeconds = 0;
    mockFocusSession = null;
  });

  it('renders Today header and default zero focus pill', () => {
    render(<TodayView onSelectTask={vi.fn()} onStartFocus={vi.fn()} />);

    expect(screen.getByText('Today')).toBeDefined();
    expect(screen.getByText('0m')).toBeDefined();
    expect(screen.getByText(/6h cap/i)).toBeDefined();
  });

  it('renders updated real-time focused time pill when user has focus time', () => {
    mockTotalFocusedTodaySeconds = 4500; // 1h 15m
    render(<TodayView onSelectTask={vi.fn()} onStartFocus={vi.fn()} />);

    expect(screen.getByText('1h 15m')).toBeDefined();
  });

  it('renders active focus session synchronization banner and invokes callback on resume', () => {
    mockFocusSession = {
      id: 'session-sprint-1',
      taskId: 't-1',
      taskTitle: 'Solve Priority Problem',
      mode: 'sprint',
      state: 'running',
      subtaskId: 'sub-1',
      subtaskTitle: 'Question 1',
    };
    mockTotalFocusedTodaySeconds = 1200;

    const mockStartSprint = vi.fn();
    render(
      <TodayView
        onSelectTask={vi.fn()}
        onStartFocus={vi.fn()}
        onStartSprint={mockStartSprint}
      />
    );

    expect(screen.getByText(/Study Sprint in Progress/i)).toBeDefined();
    expect(screen.getByText(/Question 1/i)).toBeDefined();

    const resumeBtn = screen.getByRole('button', { name: /resume/i });
    fireEvent.click(resumeBtn);

    expect(mockStartSprint).toHaveBeenCalledWith('t-1');
  });
});
