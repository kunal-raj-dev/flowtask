import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TaskContext } from '../../context/TaskContext';
import { StudySessionModal } from './StudyPlanEditor';
import { STARTER_STUDY_TEMPLATES } from '../../utils/studyTemplates';

const create = vi.fn(), close = vi.fn();
function editor(props = {}, workspaceId = 'study-editor-test') {
  return <TaskContext.Provider value={{ workspaceId, projects: [{ id: 'inbox', name: 'Inbox' }], addStudySessions: create } as any}><StudySessionModal isOpen onClose={close} {...props} /></TaskContext.Provider>;
}
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); create.mockReturnValue([{ id: 'created' }]); });

describe('editable study planner', () => {
  it('reviews parsed targets, applies edits and creates only on confirmation', () => {
    render(editor({ initialMode: 'paste' }));
    fireEvent.change(screen.getByLabelText('Study plan text'), { target: { value: 'Biology revision:\nRead chapter 2 20m\nPractice questions 30m' } });
    expect(screen.getByText(/2 targets found/)).toBeDefined();
    expect(create).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Review & edit targets' }));
    fireEvent.change(screen.getByLabelText('Session 1 target 1 title'), { target: { value: 'Read chapter 3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Move target 2 up in session 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create session' }));
    expect(create.mock.calls[0][0][0].targets.map((target: any) => target.title)).toEqual(['Practice questions', 'Read chapter 3']);
    expect(close).toHaveBeenCalledOnce();
  });
  it('keeps quick-cancelled drafts, isolates accounts and clears an explicitly discarded draft', () => {
    const view = render(editor());
    fireEvent.change(screen.getByLabelText('Session 1 name'), { target: { value: 'My private draft' } });
    view.rerender(editor({ isOpen: false }));
    view.rerender(editor());
    expect((screen.getByLabelText('Session 1 name') as HTMLInputElement).value).toBe('My private draft');
    view.rerender(editor({}, 'different-workspace'));
    expect((screen.getByLabelText('Session 1 name') as HTMLInputElement).value).toBe('');
    view.rerender(editor());
    fireEvent.click(screen.getByRole('button', { name: 'Discard draft' }));
    expect(localStorage.getItem('flowtask-study-draft:study-editor-test:session:new')).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });
  it('saves reusable edits without scheduling and keeps a failed creation editable', () => {
    const save = vi.fn();
    const view = render(editor({ purpose: 'template', template: STARTER_STUDY_TEMPLATES[0], initialSessions: STARTER_STUDY_TEMPLATES[0].sessions, onSaveTemplate: save }));
    fireEvent.change(screen.getByLabelText('Template name'), { target: { value: 'My practice plan' } });
    fireEvent.change(screen.getByLabelText('Session 1 target 1 minutes'), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save template' }));
    expect(save.mock.calls[0][0].title).toBe('My practice plan');
    expect(save.mock.calls[0][0].sessions[0].targets[0].estimatedMinutes).toBe(40);
    expect(create).not.toHaveBeenCalled();
    view.unmount();
    create.mockImplementation(() => { throw new Error('Storage busy'); });
    render(editor({ initialSessions: STARTER_STUDY_TEMPLATES[0].sessions }));
    fireEvent.click(screen.getByRole('button', { name: 'Create session' }));
    expect(screen.getByRole('alert').textContent).toBe('Storage busy');
    expect((screen.getByLabelText('Session 1 name') as HTMLInputElement).value).toBe('DSA Practice Sprint');
    expect((screen.getByRole('button', { name: 'Create session' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
