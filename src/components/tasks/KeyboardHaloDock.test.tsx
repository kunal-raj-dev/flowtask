// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KeyboardHaloDock } from './KeyboardHaloDock';
import type { Task } from '../../types/task';

describe('KeyboardHaloDock (BUG-13)', () => {
  const mockTask: Task = {
    id: 'dock-task-1',
    title: 'Deploy Production Worker',
    status: 'todo',
    priority: 'p2',
    projectId: 'work',
    isEvening: false,
    createdAt: Date.now(),
    subtasks: [],
  };

  const defaultProps = {
    task: mockTask,
    onSelect: vi.fn(),
    onToggleStatus: vi.fn(),
    onStartFocus: vi.fn(),
    onRescheduleToday: vi.fn(),
    onRescheduleTomorrow: vi.fn(),
    onRescheduleSomeday: vi.fn(),
    onSetPriority: vi.fn(),
    onToggleEvening: vi.fn(),
    onDismiss: vi.fn(),
    onOpenShortcuts: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders task title and action buttons', () => {
    render(<KeyboardHaloDock {...defaultProps} />);

    expect(screen.getByText('Deploy Production Worker')).toBeDefined();
    expect(screen.getByText('Done')).toBeDefined();
    expect(screen.getByText('Details')).toBeDefined();
    expect(screen.getByText('Focus')).toBeDefined();
    expect(screen.getByText('Today')).toBeDefined();
    expect(screen.getByText('Tomorrow')).toBeDefined();
    expect(screen.getByText('Someday')).toBeDefined();
    expect(screen.getByText('🌙 Eve')).toBeDefined();
    expect(screen.getByRole('button', { name: /keyboard shortcuts cheatsheet/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /dismiss keyboard halo dock/i })).toBeDefined();
  });

  it('triggers task completion when clicking Done action', () => {
    render(<KeyboardHaloDock {...defaultProps} />);

    fireEvent.click(screen.getByText('Done'));
    expect(defaultProps.onToggleStatus).toHaveBeenCalledTimes(1);
  });

  it('triggers focus session when clicking Focus action', () => {
    render(<KeyboardHaloDock {...defaultProps} />);

    fireEvent.click(screen.getByText('Focus'));
    expect(defaultProps.onStartFocus).toHaveBeenCalledTimes(1);
  });

  it('triggers reschedule actions for Today, Tomorrow, and Someday', () => {
    render(<KeyboardHaloDock {...defaultProps} />);

    fireEvent.click(screen.getByText('Today'));
    expect(defaultProps.onRescheduleToday).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Tomorrow'));
    expect(defaultProps.onRescheduleTomorrow).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Someday'));
    expect(defaultProps.onRescheduleSomeday).toHaveBeenCalledTimes(1);
  });

  it('changes priority when priority pills 1-4 are clicked', () => {
    render(<KeyboardHaloDock {...defaultProps} />);

    fireEvent.click(screen.getByTitle('Set Priority 1'));
    expect(defaultProps.onSetPriority).toHaveBeenCalledWith('p1');

    fireEvent.click(screen.getByTitle('Set Priority 3'));
    expect(defaultProps.onSetPriority).toHaveBeenCalledWith('p3');

    fireEvent.click(screen.getByTitle('Set Priority 4'));
    expect(defaultProps.onSetPriority).toHaveBeenCalledWith('p4');
  });

  it('triggers evening toggle when clicking Eve action', () => {
    render(<KeyboardHaloDock {...defaultProps} />);

    fireEvent.click(screen.getByText('🌙 Eve'));
    expect(defaultProps.onToggleEvening).toHaveBeenCalledTimes(1);
  });

  it('opens keyboard shortcuts modal when clicking ? button', () => {
    render(<KeyboardHaloDock {...defaultProps} />);

    const shortcutBtn = screen.getByRole('button', { name: /keyboard shortcuts cheatsheet/i });
    fireEvent.click(shortcutBtn);
    expect(defaultProps.onOpenShortcuts).toHaveBeenCalledTimes(1);
  });

  it('dismisses dock when clicking X button', () => {
    render(<KeyboardHaloDock {...defaultProps} />);

    const dismissBtn = screen.getByRole('button', { name: /dismiss keyboard halo dock/i });
    fireEvent.click(dismissBtn);
    expect(defaultProps.onDismiss).toHaveBeenCalledTimes(1);
  });
});
