// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MoveToProjectPicker } from './MoveToProjectPicker';

describe('project move picker', () => {
  it('searches active projects, supports arrow navigation and keeps Escape inside the picker', () => {
    const onSelect = vi.fn(), onClose = vi.fn(), parentEscape = vi.fn();
    render(<div onKeyDown={parentEscape}><MoveToProjectPicker projects={[
      { id: 'inbox', name: 'Inbox', color: '#fff', createdAt: 1 },
      { id: 'study', name: 'Study', color: '#fff', createdAt: 1 },
      { id: 'old', name: 'Old project', color: '#fff', createdAt: 1, isArchived: true },
    ]} onSelectProject={onSelect} onClose={onClose} /></div>);
    expect(screen.queryByText('Old project')).toBeNull();
    fireEvent.change(screen.getByLabelText('Search projects'), { target: { value: 'stud' } });
    fireEvent.keyDown(screen.getByLabelText('Search projects'), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Study' }));
    fireEvent.click(document.activeElement!);
    expect(onSelect).toHaveBeenCalledWith('study');
    fireEvent.keyDown(screen.getByLabelText('Search projects'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(parentEscape).not.toHaveBeenCalled();
  });
});
