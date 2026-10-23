// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TaskSessionEditor } from './TaskSessionEditor';
import type { Task } from '../../types/task';

describe('session editor draft boundaries', () => {
  it('does not apply a missing or zero length interval', () => {
    const onApply = vi.fn();
    render(<TaskSessionEditor onApply={onApply} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Session end time'), { target: { value: '08:00' } });
    expect((screen.getByRole('button', { name: 'Apply Session' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Apply Session' }));
    fireEvent.change(screen.getByLabelText('Session end time'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply Session' }));
    expect(onApply).not.toHaveBeenCalled();
  });

  it('numbers by the selected planned day, excluding archived tasks and due-date collisions', () => {
    const make = (id: string, plannedDate: string, sessionNumber: number, extra = {}): Task => ({
      id, title: id, projectId: 'work', status: 'todo', priority: 'p3', createdAt: 1, subtasks: [],
      plannedDate, sessionMetadata: { isSession: true, sessionNumber }, ...extra,
    });
    const tasks = [make('today', '2026-10-23', 3), make('tomorrow', '2026-10-24', 7),
      make('archived', '2026-10-24', 20, { archivedAt: 1 }),
      make('different-planned-day', '2026-10-25', 30, { dueDate: '2026-10-24' })];
    const onApply = vi.fn();
    render(<TaskSessionEditor initialSessionNumber={4} initialPlannedDate="2026-10-23" tasks={tasks} onApply={onApply} onCancel={vi.fn()} />);
    expect((screen.getByLabelText('Session number') as HTMLInputElement).value).toBe('4');
    fireEvent.change(screen.getByLabelText('Session planned date'), { target: { value: '2026-10-24' } });
    expect((screen.getByLabelText('Session number') as HTMLInputElement).value).toBe('8');
    fireEvent.change(screen.getByLabelText('Session start time'), { target: { value: '23:00' } });
    fireEvent.change(screen.getByLabelText('Session end time'), { target: { value: '01:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply Session' }));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ plannedDate: '2026-10-24', sessionNumber: 8, durationMinutes: 120 }));
  });
});
