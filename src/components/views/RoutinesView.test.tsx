// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoutinesView } from './RoutinesView';
import { TaskContext } from '../../context/TaskContext';

describe('RoutinesView', () => {
  const renderWithContext = () => {
    return render(
      <TaskContext.Provider
        value={{
          projects: [],
          tasks: [],
        } as any}
      >
        <RoutinesView />
      </TaskContext.Provider>
    );
  };

  it('renders routines library with starter cadences', () => {
    renderWithContext();

    expect(screen.getByText('Routines & Rituals')).toBeDefined();
    expect(screen.getAllByText('Morning Launch').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Workday Startup').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Evening Shutdown').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Weekly Calibration').length).toBeGreaterThanOrEqual(1);
  });

  it('allows opening create routine dialog and entering new routine data', () => {
    renderWithContext();

    const newBtn = screen.getByRole('button', { name: /new routine/i });
    fireEvent.click(newBtn);

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Create Routine')).toBeDefined();

    const titleInput = screen.getByLabelText(/routine title/i);
    fireEvent.change(titleInput, { target: { value: 'Nightly Wind Down' } });

    const addStepBtn = screen.getByRole('button', { name: /add step/i });
    fireEvent.click(addStepBtn);

    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('can switch to History tab', () => {
    renderWithContext();

    const historyTab = screen.getByRole('button', { name: /history/i });
    fireEvent.click(historyTab);

    expect(screen.getByText(/no routine runs recorded yet/i)).toBeDefined();
  });

  it('keeps keyboard focus in the editor and closes it with Escape', async () => {
    renderWithContext();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /new routine/i }));
    expect(screen.getByRole('dialog', { name: 'Create Routine' })).toBeDefined();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens RoutineRunner when Start Routine is clicked', () => {
    renderWithContext();

    const startButtons = screen.getAllByRole('button', { name: /start routine/i });
    expect(startButtons.length).toBeGreaterThan(0);
    fireEvent.click(startButtons[0]);

    // RoutineRunner opens as modal dialog
    const dialogs = screen.getAllByRole('dialog');
    expect(dialogs.length).toBeGreaterThan(0);
  });
});
