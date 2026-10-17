// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StudyView } from './StudyView';
import type { Task } from '../../types/task';

const mockAddStudySessions = vi.fn();
const mockToggleSubTask = vi.fn();
const mockShowToast = vi.fn();

const mockTasks: Task[] = [
  {
    id: 'study-task-1',
    title: 'DSA Practice Session',
    status: 'todo',
    priority: 'p1',
    projectId: 'study',
    createdAt: Date.now(),
    plannedDate: '2026-10-17',
    tags: ['study', 'sprint'],
    sessionMetadata: {
      isSession: true,
      sessionNumber: 1,
      sessionTopic: 'Leetcode Trees',
    },
    subtasks: [
      { id: 'sub-1', title: 'Binary Tree Inorder', completed: true },
      { id: 'sub-2', title: 'Validate BST', completed: false },
    ],
  },
  {
    id: 'completed-study-task',
    title: 'Operating Systems Review',
    status: 'done',
    priority: 'p2',
    projectId: 'study',
    createdAt: Date.now(),
    plannedDate: '2026-10-16',
    tags: ['study'],
    subtasks: [{ id: 'sub-3', title: 'Paging mechanisms', completed: true }],
  },
];

const mockFocusLogs = [
  {
    id: 'log-1',
    taskId: 'study-task-1',
    mode: 'sprint',
    phase: 'focus',
    seconds: 1800,
    startedAt: Date.now() - 3600000,
    endedAt: Date.now() - 1800000,
    outcome: 'Solved questions',
  },
];

vi.mock('../../context/TaskContext', () => ({
  useTaskContext: () => ({
    tasks: mockTasks,
    addStudySessions: mockAddStudySessions,
    toggleSubTask: mockToggleSubTask,
    focusLogs: mockFocusLogs,
    showToast: mockShowToast,
  }),
}));

vi.mock('../../hooks/useCurrentDate', () => ({
  useTodayStr: () => '2026-10-17',
  getTodayStr: () => '2026-10-17',
  getTomorrowStr: () => '2026-10-18',
}));

describe('StudyView Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Study Hub title, subtitle, and primary navigation tabs', () => {
    render(<StudyView onStartSprint={vi.fn()} onSelectTask={vi.fn()} />);

    expect(screen.getByText('Study Hub')).toBeDefined();
    expect(
      screen.getByText(/Targeted study sprints, paced question solving/i)
    ).toBeDefined();

    expect(screen.getByRole('tab', { name: /Continue/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Planned/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Templates/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /History/i })).toBeDefined();
  });

  it('displays unfinished targets in the Continue tab and calls onStartSprint when requested', () => {
    const handleStartSprint = vi.fn();
    render(<StudyView onStartSprint={handleStartSprint} onSelectTask={vi.fn()} />);

    expect(screen.getByText('DSA Practice Session')).toBeDefined();
    expect(screen.getByText('Validate BST')).toBeDefined();

    // Start Sprint button
    const sprintButtons = screen.getAllByRole('button', { name: /Start Sprint/i });
    expect(sprintButtons.length).toBeGreaterThan(0);
    fireEvent.click(sprintButtons[0]);

    expect(handleStartSprint).toHaveBeenCalledWith('study-task-1');
  });

  it('switches to Planned tab and displays upcoming study sessions', () => {
    render(<StudyView onStartSprint={vi.fn()} onSelectTask={vi.fn()} />);

    const plannedTab = screen.getByRole('tab', { name: /Planned/i });
    fireEvent.click(plannedTab);

    expect(screen.getByText('DSA Practice Session')).toBeDefined();
    expect(screen.getByText(/2026-10-17/i)).toBeDefined();
  });

  it('switches to Templates tab, displays starter templates, and applies a template', () => {
    render(<StudyView onStartSprint={vi.fn()} onSelectTask={vi.fn()} />);

    const templatesTab = screen.getByRole('tab', { name: /Templates/i });
    fireEvent.click(templatesTab);

    expect(screen.getByText('DSA Practice Sprint')).toBeDefined();
    expect(screen.getByText('Exam Revision & Active Recall')).toBeDefined();
    expect(screen.getByText('Deep Reading & Research')).toBeDefined();
    expect(screen.getByText('Development Sprint')).toBeDefined();

    const useTemplateBtns = screen.getAllByRole('button', { name: /Use Template/i });
    expect(useTemplateBtns.length).toBe(4);
    fireEvent.click(useTemplateBtns[0]);

    expect(mockAddStudySessions).toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith(expect.stringMatching(/Created \d+ study session/i));
  });

  it('switches to History tab and displays completed study tasks and sprint logs', () => {
    render(<StudyView onStartSprint={vi.fn()} onSelectTask={vi.fn()} />);

    const historyTab = screen.getByRole('tab', { name: /History/i });
    fireEvent.click(historyTab);

    expect(screen.getByText('Completed Study Tasks')).toBeDefined();
    expect(screen.getByText('Operating Systems Review')).toBeDefined();
    expect(screen.getByText('Study Sprints')).toBeDefined();
    expect(screen.getByText('Time Studied')).toBeDefined();
    expect(screen.getAllByText('30m').length).toBeGreaterThan(0);
  });
});
