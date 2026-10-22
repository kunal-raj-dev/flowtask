import { act as flushRender } from '@testing-library/react';
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { DashboardEditor } from './DashboardEditor';
import { STARTER_DASHBOARDS } from '../../services/starterDashboards';
import type { WorkspaceDashboard } from '../../types/dashboard';

const mockTasks = [
  {
    id: 't-1',
    title: 'Focus Task 1',
    status: 'todo',
    priority: 'p1',
    projectId: 'inbox',
    createdAt: Date.now(),
    plannedDate: '2026-10-17',
    isPinnedToday: true,
    estimatedMinutes: 25,
    subtasks: [],
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
    focusSession: null,
    totalFocusedTodaySeconds: 0,
    focusLogs: [],
    dayPlanSummary: null,
  }),
}));

vi.mock('../../hooks/useCurrentDate', () => ({
  useTodayStr: () => '2026-10-17',
  getTodayStr: () => '2026-10-17',
  getTomorrowStr: () => '2026-10-18',
}));

let store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    store = {};
  },
};
(globalThis as any).localStorage = localStorageMock;

function enterEdit() { fireEvent.click(screen.getByRole('button', { name: 'Customize' })); fireEvent.click(screen.getByRole('button', { name: 'Edit workspace' })); }
describe('DashboardEditor Component', () => {
  let sampleDashboards: WorkspaceDashboard[];
  let onUpdateDashboards: any;
  let onPlanMyDay: any;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    sampleDashboards = JSON.parse(JSON.stringify(STARTER_DASHBOARDS));
    onUpdateDashboards = vi.fn();
    onPlanMyDay = vi.fn();
  });

  it('renders Today heading, active dashboard name, and action buttons', async () => {
    await flushRender(async () => (render(
      <DashboardEditor
        dashboards={sampleDashboards}
        activeDashboardId={sampleDashboards[0].id}
        onUpdateDashboards={onUpdateDashboards}
        onPlanMyDay={onPlanMyDay}
      />
    )));

    expect(screen.getByText('Today')).toBeDefined();
    expect(screen.getByText('Daily Desk')).toBeDefined();
    expect(screen.getByRole('button', { name: /Plan my day/i })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Customize' })).toBeDefined();
  });

  it('invokes onPlanMyDay callback when clicking Plan my day', async () => {
    await flushRender(async () => (render(
      <DashboardEditor
        dashboards={sampleDashboards}
        activeDashboardId={sampleDashboards[0].id}
        onUpdateDashboards={onUpdateDashboards}
        onPlanMyDay={onPlanMyDay}
      />
    )));

    const planBtn = screen.getByRole('button', { name: /Plan my day/i });
    fireEvent.click(planBtn);
    expect(onPlanMyDay).toHaveBeenCalledTimes(1);
  });

  it('enters editing mode on clicking Edit workspace and reveals toolbar controls', async () => {
    await flushRender(async () => (render(
      <DashboardEditor
        dashboards={sampleDashboards}
        activeDashboardId={sampleDashboards[0].id}
        onUpdateDashboards={onUpdateDashboards}
        onPlanMyDay={onPlanMyDay}
      />
    )));

    enterEdit();

    expect(screen.getByRole('button', { name: /Save/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Add Widget/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Undo/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Redo/i })).toBeDefined();
  });

  it('saves changes and commits one dashboard update when Save is clicked', async () => {
    await flushRender(async () => (render(
      <DashboardEditor
        dashboards={sampleDashboards}
        activeDashboardId={sampleDashboards[0].id}
        onUpdateDashboards={onUpdateDashboards}
        onPlanMyDay={onPlanMyDay}
      />
    )));

    // Enter edit mode
    enterEdit();

    // Click Save
    const saveBtn = screen.getByRole('button', { name: /Save/i });
    fireEvent.click(saveBtn);

    expect(onUpdateDashboards).toHaveBeenCalledTimes(1);
    const updated = onUpdateDashboards.mock.calls[0][0];
    expect(updated.length).toBe(sampleDashboards.length);
  });

  it('cancels edit mode on clicking Cancel without saving', async () => {
    await flushRender(async () => (render(
      <DashboardEditor
        dashboards={sampleDashboards}
        activeDashboardId={sampleDashboards[0].id}
        onUpdateDashboards={onUpdateDashboards}
        onPlanMyDay={onPlanMyDay}
      />
    )));

    enterEdit();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

    expect(onUpdateDashboards).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Customize' })).toBeDefined();
  });

  it('opens widget catalog and allows adding a new widget to dashboard', async () => {
    await flushRender(async () => (render(
      <DashboardEditor
        dashboards={sampleDashboards}
        activeDashboardId={sampleDashboards[0].id}
        onUpdateDashboards={onUpdateDashboards}
        onPlanMyDay={onPlanMyDay}
      />
    )));

    enterEdit();
    fireEvent.click(screen.getByRole('button', { name: /Add Widget/i }));

    expect(screen.getByText('Add Widget to Workspace')).toBeDefined();
    expect(screen.getByPlaceholderText(/Search widgets/i)).toBeDefined();

    // Select and add a widget from catalog
    const addButtons = screen.getAllByRole('button', { name: /^Add$/i });
    expect(addButtons.length).toBeGreaterThan(0);
    fireEvent.click(addButtons[0]);

    // Modal closes upon selection
    await waitFor(() => expect(screen.queryByText('Add Widget to Workspace')).toBeNull());
  });

  it('persists draft to localStorage during edit mode and shows recovery banner on return', async () => {
    const dashId = sampleDashboards[0].id;
    const draftKey = `flowtask-dashboard-draft:local:${dashId}`;

    const { unmount } = await flushRender(async () => (render(
      <DashboardEditor
        dashboards={sampleDashboards}
        activeDashboardId={dashId}
        onUpdateDashboards={onUpdateDashboards}
        onPlanMyDay={onPlanMyDay}
      />
    )));

    // Enter edit mode
    enterEdit();

    // Verify localStorage draft was saved
    expect(localStorage.getItem(draftKey)).not.toBeNull();
    unmount();

    // Re-render component: should show recovery banner
    await flushRender(async () => (render(
      <DashboardEditor
        dashboards={sampleDashboards}
        activeDashboardId={dashId}
        onUpdateDashboards={onUpdateDashboards}
        onPlanMyDay={onPlanMyDay}
      />
    )));

    expect(
      screen.getByText(/Your unfinished layout/i)
    ).toBeDefined();
    expect(screen.getByRole('button', { name: /Resume Editing/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Discard/i })).toBeDefined();

    // Discard draft
    fireEvent.click(screen.getByRole('button', { name: /Discard/i }));
    expect(localStorage.getItem(draftKey)).toBeNull();
  });

  it('supports dashboard switching and creation via the switcher dropdown', async () => {
    await flushRender(async () => (render(
      <DashboardEditor
        dashboards={sampleDashboards}
        activeDashboardId={sampleDashboards[0].id}
        onUpdateDashboards={onUpdateDashboards}
        onPlanMyDay={onPlanMyDay}
      />
    )));

    // Click switcher dropdown
    const switcherTrigger = screen.getByRole('button', { name: /Switch dashboard/i });
    fireEvent.click(switcherTrigger);

    const menu = screen.getByRole('dialog', { name: 'Your desks' });
    for (const name of ['Daily Desk','Study Desk','Developer Desk','Minimal Desk']) expect(within(menu).getAllByText(name).length).toBeGreaterThan(0);

    // Click Create New Dashboard
    const createBtn = screen.getByRole('button', { name: /Create New Dashboard/i });
    fireEvent.click(createBtn);

    expect(onUpdateDashboards).toHaveBeenCalled();
    const updated = onUpdateDashboards.mock.calls[0][0];
    expect(updated.length).toBe(sampleDashboards.length + 1);
  });
});
