import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_WORKFLOW_SETTINGS } from '../src/types/settings';
import { DEFAULT_APPEARANCE } from '../src/utils/appearance';
import { STARTER_DASHBOARDS } from '../src/services/starterDashboards';
import { assertViewport, readPlanner } from './helpers/plannerWorkspace';

test.use({ timezoneId: 'Asia/Kolkata', reducedMotion: 'reduce' });
const errors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  errors.set(page, []);
  page.on('pageerror', error => errors.get(page)!.push(error.message));
});
test.afterEach(({ page }) => expect(errors.get(page)).toEqual([]));
async function seed(page: Page) {
  await page.clock.setFixedTime(new Date('2026-10-25T03:30:00Z'));
  await page.addInitScript(({ settings, appearance, dashboards }) => {
    if (localStorage.getItem('foundation-seeded')) return;
    const date = '2026-10-25';
    const tasks = [
      { id: 'top', title: 'Write the project proposal', priority: 'p1', estimatedMinutes: 45, topThreeDate: date },
      { id: 'blocker', title: 'Collect the requirements', priority: 'p2', estimatedMinutes: 30 },
      { id: 'dependent', title: 'Publish the proposal', priority: 'p2', estimatedMinutes: 45, blockedBy: ['blocker'] },
      { id: 'later', title: 'Call after the appointment', priority: 'p3', estimatedMinutes: 10, deferUntil: '2026-10-25T03:31:00Z' },
      { id: 'afternoon', title: 'Deep work in the afternoon', priority: 'p2', estimatedMinutes: 60, cognitiveLoad: 'deep_work', scheduledStart: '15:00', scheduledEnd: '16:00' },
      { id: 'deadline', title: 'Submit today’s assignment', priority: 'p1', estimatedMinutes: 240, dueDate: date },
      { id: 'locked', title: 'Protected work session', priority: 'p2', estimatedMinutes: 90, scheduledStart: '10:00', scheduledEnd: '11:30', scheduleLocked: true },
      { id: 'flexible', title: 'Sort the reference library', priority: 'p4', estimatedMinutes: 180 },
    ].map((t, i) => ({ ...t, status: 'todo', projectId: 'work', plannedDate: date, createdAt: 1000 + i, subtasks: [] }));
    localStorage.setItem('flowtask_onboarding_completed', 'true');
    localStorage.setItem('flowtask_backup_last_reminder', String(Date.now()));
    localStorage.setItem('flowtask_ws_local', JSON.stringify({ schemaVersion: 7, workspaceId: 'local', tasks,
      projects: [{ id: 'inbox', name: 'Inbox', color: '#6366f1' }, { id: 'work', name: 'Work', color: '#285941' }],
      dashboards, customViews: [], preferences: { settings: { ...settings, targetWorkCapacityHours: 4, onboardingCompleted: true }, appearance: { ...appearance, reducedMotion: true }, activeDashboardId: dashboards[0].id },
      pending: [], undo: [], updatedAt: Date.now() }));
    localStorage.setItem('foundation-seeded', 'true');
  }, { settings: DEFAULT_WORKFLOW_SETTINGS, appearance: DEFAULT_APPEARANCE, dashboards: structuredClone(STARTER_DASHBOARDS) });
  await page.goto('/app?view=today');
  await expect(page.getByRole('heading', { name: 'Today.', exact: true })).toBeVisible();
}

test('dependency completion and a resumed tab update Today availability without reloading', async ({ page }) => {
  await seed(page);
  await expect(page.locator('[data-task-id="dependent"]')).toHaveCount(0);
  await expect(page.locator('[data-task-id="later"]')).toHaveCount(0);
  await page.locator('[data-task-id="blocker"]').getByRole('checkbox').click();
  await expect(page.locator('[data-task-id="dependent"]')).toBeVisible();
  await page.clock.setFixedTime(new Date('2026-10-25T03:32:00Z'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('[data-task-id="later"]')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Daytime Flow' }).locator('[data-task-id="afternoon"]')).toBeVisible();
});

test('balance is reviewed, protects commitments, persists and supports one Undo', async ({ page }) => {
  await seed(page);
  await page.getByRole('button', { name: 'Balance Day', exact: true }).click();
  const review = page.getByRole('dialog', { name: 'Review day balance' });
  await expect(review).toBeVisible();
  expect((await readPlanner(page)).tasks.find((t: any) => t.id === 'flexible').plannedDate).toBe('2026-10-25');
  await review.getByRole('button', { name: /Move 2 tasks to tomorrow/ }).click();
  await expect.poll(async () => (await readPlanner(page)).tasks.find((t: any) => t.id === 'flexible').plannedDate).toBe('2026-10-26');
  for (const id of ['locked', 'deadline', 'top', 'afternoon']) {
    expect((await readPlanner(page)).tasks.find((t: any) => t.id === id).plannedDate).toBe('2026-10-25');
  }
  await page.getByRole('button', { name: 'Undo', exact: true }).last().click();
  await expect.poll(async () => (await readPlanner(page)).tasks.find((t: any) => t.id === 'flexible').plannedDate).toBe('2026-10-25');
  await page.reload();
  await expect(page.locator('[data-task-id="flexible"]')).toBeVisible();
});

test('small-start mode creates a five-minute persistent session while preserving the task estimate', async ({ page }) => {
  await seed(page);
  await page.getByRole('button', { name: 'Today options' }).click();
  await page.getByRole('button', { name: 'Single-Task Horizon', exact: true }).click();
  await page.getByRole('button', { name: 'Start 5m Timer' }).click();
  await expect.poll(async () => (await readPlanner(page)).preferences.focusSession?.targetDurationSec).toBe(300);
  expect((await readPlanner(page)).tasks.find((t: any) => t.id === 'top').estimatedMinutes).toBe(45);
  await page.reload();
  await expect.poll(async () => (await readPlanner(page)).preferences.focusSession?.targetDurationSec).toBe(300);
});

test('Today options opens the routine runner and daily note', async ({ page }) => {
  await seed(page);
  await page.getByRole('button', { name: 'Today options' }).click();
  await page.getByRole('button', { name: 'Launch Routine', exact: true }).click();
  const runner = page.getByRole('dialog', { name: 'Paced Routine Runner', exact: true });
  await expect(runner).toBeVisible();
  await runner.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Today options' }).click();
  await page.getByRole('button', { name: 'Daily note', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Note title', exact: true })).toHaveValue(/Daily note/);
});

for (const width of [320, 390, 1440]) {
  test(`Today and the Plan tray remain usable at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await seed(page);
    await assertViewport(page);
    await page.getByRole('button', { name: 'Today options' }).click();
    const tools = page.getByRole('dialog', { name: 'Today options' });
    await expect(tools.getByRole('button', { name: 'Single-Task Horizon' })).toBeVisible();
    await assertViewport(page);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Today options' })).toBeFocused();
    await page.screenshot({ path: `docs/evidence/2026-10-25-implementation/today-${width}-${testInfo.project.name}.png` });
    await page.goto('/app?view=timeline');
    await expect(page.getByRole('heading', { name: 'Plan.', exact: true })).toBeVisible();
    if (width < 1024) {
      const toggle = page.getByRole('button', { name: /Show unscheduled tasks/ });
      await expect(toggle).toBeVisible();
      await expect(page.locator('#timeline-staged-tasks')).toBeHidden();
      await toggle.click();
      await expect(page.locator('#timeline-staged-tasks')).toBeVisible();
      await page.getByRole('button', { name: /Hide unscheduled tasks/ }).click();
    }
    await assertViewport(page);
    await page.screenshot({ path: `docs/evidence/2026-10-25-implementation/plan-${width}-${testInfo.project.name}.png` });
  });
}
