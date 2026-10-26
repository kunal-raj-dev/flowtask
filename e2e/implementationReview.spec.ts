import { openWorkspaceCustomization } from './helpers/workspaceActions';
import { test, expect, type Page } from '@playwright/test';
import { STARTER_DASHBOARDS } from '../src/services/starterDashboards';
import { DEFAULT_WORKFLOW_SETTINGS } from '../src/types/settings';
import { DEFAULT_APPEARANCE } from '../src/utils/appearance';
import { readPlanner } from './helpers/plannerWorkspace';

const title = 'DSA practice with a deliberately long title to verify wrapping and stable focus controls on narrow phones';
async function seed(page: Page, options = { shortcuts: true, startView: 'dashboard' }) {
  await page.clock.setFixedTime(new Date('2026-10-23T04:30:00Z'));
  await page.addInitScript(({ desks, settings, appearance, title, options }) => {
    if (localStorage.getItem('implementation-review-seeded')) return;
    localStorage.setItem('flowtask_onboarding_completed', 'true');
    localStorage.setItem('flowtask_backup_last_reminder', String(Date.now()));
    localStorage.setItem('flowtask_ws_local', JSON.stringify({ schemaVersion: 8, workspaceId: 'local',
      tasks: [{ id: 'dsa', title, status: 'todo', priority: 'p1', projectId: 'work', milestoneId: 'old-milestone',
        createdAt: 1, plannedDate: '2026-10-23', isPinnedToday: true, topThreeDate: '2026-10-23',
        estimatedMinutes: 30, sessionMetadata: { isSession: true, sessionNumber: 1 }, nextAction: 'Read the constraints and write a small example.',
        subtasks: [50, 50, 35, 35, 25, 25].map((estimatedMinutes, i) => ({ id: `s${i}`, title: `Question ${i + 1}`, completed: false, estimatedMinutes })),
      }], projects: [{ id: 'inbox', name: 'Inbox', color: '#6366f1', createdAt: 1 },
        { id: 'work', name: 'Work', color: '#285941', createdAt: 1, milestones: [{ id: 'old-milestone', title: 'Practice', order: 0 }] },
        { id: 'study', name: 'Study', color: '#285941', createdAt: 1 }], dashboards: desks, customViews: [],
      preferences: { settings: { ...settings, onboardingCompleted: true, keyboardShortcutsEnabled: options.shortcuts, defaultLandingView: options.startView },
        appearance: { ...appearance, reducedMotion: true }, activeDashboardId: desks[0].id }, pending: [], undo: [], updatedAt: Date.now() }));
    localStorage.setItem('implementation-review-seeded', 'true');
  }, { desks: structuredClone(STARTER_DASHBOARDS), settings: DEFAULT_WORKFLOW_SETTINGS, appearance: DEFAULT_APPEARANCE, title, options });
  await page.goto('/app');
  await expect(page.locator('main#main-content')).toBeVisible();
}
async function studio(page: Page) {
  const entry = page.getByRole('button', { name: /^Focus Studio/ }).first();
  if (await entry.isVisible()) await entry.click();
  else await page.getByRole('button', { name: 'Launch Focus Mode', exact: true }).click();
  return page.getByRole('dialog', { name: 'Focus Studio', exact: true });
}

for (const width of [355, 768, 1440]) test(`focus, pause and break share stable timer/control geometry at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 });
  await seed(page);
  const s = await studio(page);
  await s.getByRole('button', { name: 'Start focus', exact: true }).click();
  const geometry = async () => s.evaluate(root => {
    const rect = (selector: string) => { const b = root.querySelector(selector)!.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
    const controls = [...root.querySelectorAll<HTMLButtonElement>('.studio-playback button')].map(button => {
      const b = button.getBoundingClientRect();
      return { label: button.getAttribute('aria-label') || button.textContent, x: b.x, right: b.right, y: b.y, bottom: b.bottom,
        clickable: button.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)) };
    });
    return { timer: rect('.studio-clock'), primary: rect('.studio-start'), controls };
  });
  const focus = await geometry();
  await page.clock.setFixedTime(new Date('2026-10-23T04:30:02Z'));
  await s.getByRole('button', { name: 'Pause', exact: true }).click();
  const paused = await geometry();
  await s.getByRole('button', { name: 'Finish session', exact: true }).click();
  await s.getByRole('button', { name: 'Take a break', exact: true }).click();
  await expect(s.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  const rest = await geometry();
  for (const state of [paused, rest]) for (const element of ['timer', 'primary'] as const) for (const axis of ['x', 'y'] as const) {
    expect(Math.abs(state[element][axis] - focus[element][axis]), `${element}.${axis}`).toBeLessThanOrEqual(1);
  }
  for (const state of [focus, paused, rest]) for (const control of state.controls) {
    expect(control.x).toBeGreaterThanOrEqual(0); expect(control.right).toBeLessThanOrEqual(width);
    expect(control.y).toBeGreaterThanOrEqual(0); expect(control.bottom).toBeLessThanOrEqual(900);
    expect(control.clickable, control.label || '').toBe(true);
  }
  await info.attach('geometry', { body: JSON.stringify({ focus, paused, rest }, null, 2), contentType: 'application/json' });
  await page.screenshot({ path: `screenshots/review-focus-break-${width}.png` });
});

test('legacy 30m estimate reads as 220m, updates everywhere and session cancellation preserves work', async ({ page }) => {
  await seed(page);
  await page.goto('/app?view=project:work');
  await expect(page.getByText('3h 40m remaining estimate')).toBeVisible();
  await page.getByRole('button', { name: title, exact: true }).click();
  const drawer = page.locator('[data-task-drawer="true"]');
  await drawer.getByRole('button', { name: 'Edit subtask', exact: true }).first().click();
  await drawer.getByLabel('Edit subtask duration in minutes').fill('60');
  await drawer.getByRole('button', { name: 'Save subtask', exact: true }).click();
  await expect.poll(async () => (await readPlanner(page)).tasks[0].estimatedMinutes).toBe(230);
  await expect(page.getByText('3h 50m remaining estimate')).toBeVisible();
  await drawer.getByRole('button', { name: /Edit Session|Add Session/ }).click();
  await drawer.getByLabel('Session start time').fill('14:00');
  await drawer.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect((await readPlanner(page)).tasks[0].scheduledStart).toBeUndefined();
  await drawer.getByRole('button', { name: /Edit Session|Add Session/ }).click();
  await drawer.getByRole('button', { name: 'Apply Session', exact: true }).click();
  await expect.poll(async () => (await readPlanner(page)).tasks[0].scheduledStart).toBe('08:00');
  expect((await readPlanner(page)).tasks[0].estimatedMinutes).toBe(230);
  await drawer.getByRole('button', { name: /Remove Session/ }).click();
  await expect.poll(async () => (await readPlanner(page)).tasks[0].scheduledStart).toBeUndefined();
  expect((await readPlanner(page)).tasks[0].estimatedMinutes).toBe(230);
  expect((await readPlanner(page)).tasks[0].subtasks).toHaveLength(6);
});

test('project move preserves an active timer and Undo restores the previous project', async ({ page }) => {
  await seed(page);
  const s = await studio(page);
  await s.getByRole('button', { name: 'Start focus', exact: true }).click();
  await expect.poll(async () => (await readPlanner(page)).preferences.focusSession?.state).toBe('running');
  const sessionId = (await readPlanner(page)).preferences.focusSession.id;
  await s.getByRole('button', { name: 'Back to planner', exact: true }).click();
  await page.getByRole('button', { name: `More actions for ${title}`, exact: true }).first().click();
  await page.getByRole('button', { name: /Move to Project/ }).click();
  await page.getByRole('textbox', { name: 'Search projects' }).fill('Study');
  await page.getByRole('textbox', { name: 'Search projects' }).press('Enter');
  await expect.poll(async () => (await readPlanner(page)).tasks[0].projectId).toBe('study');
  const moved = await readPlanner(page);
  expect(moved.tasks[0].milestoneId).toBeUndefined(); expect(moved.tasks[0].subtasks).toHaveLength(6);
  expect(moved.preferences.focusSession).toMatchObject({ id: sessionId, taskId: 'dsa', state: 'running' });
  await page.getByRole('button', { name: 'Undo', exact: true }).last().click();
  await expect.poll(async () => (await readPlanner(page)).tasks[0].projectId).toBe('work');
});

test('wheel over empty widgets reaches the page and starter preview Cancel preserves saved layout', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await seed(page);
  await expect(page.locator('[data-dashboard-grid]')).toBeVisible();
  const empty = page.locator('[data-widget-type="dayAgenda"] .widget-body');
  await empty.scrollIntoViewIfNeeded();
  const before = await page.locator('.today-dashboard-scroll').evaluate(el => el.scrollTop);
  await empty.hover(); await page.mouse.wheel(0, 600);
  await expect.poll(() => page.locator('.today-dashboard-scroll').evaluate(el => el.scrollTop)).toBeGreaterThan(before);
  const original = (await readPlanner(page)).dashboards[0];
  await openWorkspaceCustomization(page);
  await page.locator('.desk-template-grid').getByRole('button', { name: /^Study Desk/ }).click();
  await expect(page.getByRole('button', { name: 'Save Layout', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect((await readPlanner(page)).dashboards[0]).toEqual(original);
});

test('shortcut master Off persists, blocks global/list/Studio accelerators and retains native dismissal', async ({ page }) => {
  await seed(page);
  await page.keyboard.press('Control+,');
  await page.getByRole('button', { name: 'Shortcuts', exact: true }).click();
  await page.getByRole('switch', { name: 'Show Shortcut Hints', exact: true }).click();
  await page.getByRole('switch', { name: 'Enable Keyboard Shortcuts', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: /Command/ })).toHaveCount(0);
  await page.keyboard.press('j'); await page.keyboard.press('Space');
  expect((await readPlanner(page)).tasks[0].status).toBe('todo');
  const s = await studio(page);
  await page.keyboard.press('Space');
  await expect(s.getByRole('button', { name: 'Start focus', exact: true })).toBeVisible();
  await s.getByRole('button', { name: 'Start focus', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(s.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(s).toHaveCount(0);
  await page.reload();
  const settings = (await readPlanner(page)).preferences.settings;
  expect(settings.keyboardShortcutsEnabled).toBe(false); expect(settings.showShortcutHints).toBe(false);
});

test('Dashboard startup is explicit and a URL view takes priority', async ({ page }) => {
  await seed(page);
  await expect(page.locator('[data-dashboard-grid]')).toBeVisible();
  await page.goto('/app?view=inbox');
  await expect(page.getByRole('heading', { name: 'Inbox', exact: true })).toBeVisible();
  await expect(page.locator('[data-dashboard-grid]')).toHaveCount(0);
});

test('bulk and drawer moves support search, nested Escape, Undo and View project', async ({ page }) => {
  await seed(page);
  await page.getByRole('button', { name: `More actions for ${title}`, exact: true }).first().click();
  await page.getByRole('button', { name: /Select for Batch/ }).click();
  await page.getByRole('button', { name: 'Move', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search projects' }).fill('Study');
  await page.getByRole('textbox', { name: 'Search projects' }).press('Enter');
  await expect.poll(async () => (await readPlanner(page)).tasks[0].projectId).toBe('study');
  await page.getByRole('button', { name: 'Undo', exact: true }).last().click();
  await expect.poll(async () => (await readPlanner(page)).tasks[0].projectId).toBe('work');
  await page.locator('.desk-task-title').first().click();
  const drawer = page.getByRole('dialog', { name: 'Task Details', exact: true });
  await drawer.getByRole('button', { name: 'More task actions', exact: true }).click();
  await drawer.getByRole('button', { name: /Move to Project/ }).click();
  await drawer.getByRole('textbox', { name: 'Search projects' }).press('Escape');
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('button', { name: /Move to Project/ })).toBeVisible();
  await drawer.getByRole('button', { name: /Move to Project/ }).click();
  await drawer.getByRole('textbox', { name: 'Search projects' }).fill('Study');
  await drawer.getByRole('textbox', { name: 'Search projects' }).press('Enter');
  await expect(drawer).toHaveCount(0);
  await page.getByRole('button', { name: 'View project', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Study', exact: true })).toBeVisible();
});
