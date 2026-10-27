import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { assertViewport, plannerErrors, readPlanner, seedPlanner } from './helpers/plannerWorkspace';

test.use({ timezoneId: 'Asia/Kolkata' });

test('Today shares full capture while preserving dates and rejecting metadata-only tasks', async ({ page }) => {
  await seedPlanner(page, { empty: true, theme: 'dark' });
  const capture = page.getByRole('region', { name: 'Add a task to Today', exact: true });
  const input = capture.getByRole('textbox', { name: 'Add a task to this list' });
  await input.fill('p1 ~25m #work');
  await input.press('Enter');
  await expect(page.getByText('Add a task name before saving.', { exact: true })).toBeVisible();
  expect((await readPlanner(page)).tasks).toHaveLength(0);
  await input.fill('Read the design brief p2 ~45m');
  await input.press('Enter');
  await expect.poll(async () => (await readPlanner(page)).tasks.length).toBe(1);
  const created = (await readPlanner(page)).tasks[0];
  expect(created).toMatchObject({ title: 'Read the design brief', priority: 'p2', estimatedMinutes: 45, plannedDate: '2026-10-20' });
  await input.fill('Prepare the agenda due:2026-10-21');
  await input.press('Enter');
  await expect.poll(async () => (await readPlanner(page)).tasks.length).toBe(2);
  const future = (await readPlanner(page)).tasks.find((task: { title: string }) => task.title === 'Prepare the agenda');
  expect(future.dueDate).toBe('2026-10-21');
  expect(future.plannedDate).not.toBe('2026-10-20');
  await capture.getByTitle('Switch to Multi-line Brain Dump', { exact: true }).click();
  const multiple = capture.getByRole('textbox', { name: 'Tasks to capture' });
  await multiple.fill('Draft a response\np1 ~15m\nSend the response');
  await multiple.press('Control+Enter');
  await expect.poll(async () => (await readPlanner(page)).tasks.length).toBe(4);
  for (const title of ['Draft a response', 'Send the response']) {
    expect((await readPlanner(page)).tasks.find((task: { title: string }) => task.title === title).plannedDate).toBe('2026-10-20');
  }
  await capture.getByRole('tab', { name: 'Note', exact: true }).click();
  await expect(capture.getByRole('textbox', { name: 'Note body' })).toBeVisible();
  await expect(capture.getByRole('button', { name: 'Daily Note', exact: true })).toBeVisible();
  expect(plannerErrors(page)).toEqual([]);
});

test('refined surfaces, capture and controls stay usable across themes and viewport sizes', async ({ page }) => {
  test.setTimeout(120000);
  await seedPlanner(page, { theme: 'dark' });
  for (const theme of ['dark', 'light', 'tokyo', 'rosewater', 'forest']) {
    // Drive the same persisted preference action used by the appearance picker.
    await page.evaluate(async (theme) => {
      const { useTaskStore } = await import('/src/store/useTaskStore.ts');
      const state = useTaskStore.getState();
      state.setWorkspacePreference('appearance', { ...(state.preferences.appearance as Record<string, unknown>), theme });
    }, theme);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const input = page.getByRole('textbox', { name: 'Add a task to this list' });
    await input.fill('Review the workspace');
    const colors = await page.locator('.today-task-composer .task-composer-submit').evaluate((el) => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--color-brand)';
      el.append(probe);
      const expected = getComputedStyle(probe).color;
      probe.remove();
      return { actual: getComputedStyle(el).backgroundColor, expected };
    });
    expect(colors.actual).toBe(colors.expected);
    const scan = await new AxeBuilder({ page }).include('main#main-content').analyze();
    expect(scan.violations.filter(v => ['serious', 'critical'].includes(v.impact || '')), JSON.stringify(scan.violations)).toEqual([]);
    await input.fill('');
  }
  await page.evaluate(async () => {
    const { useTaskStore } = await import('/src/store/useTaskStore.ts');
    const state = useTaskStore.getState();
    state.setWorkspacePreference('appearance', { ...(state.preferences.appearance as Record<string, unknown>), theme: 'dark' });
  });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('heading', { name: 'Today.', exact: true }).click();
  for (const width of [320, 390, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.getByRole('textbox', { name: 'Add a task to this list' })).toBeVisible();
    await assertViewport(page);
    if ([390, 1440].includes(width)) await page.screenshot({ path: `screenshots/refinement-after-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(async () => {
    const { useTaskStore } = await import('/src/store/useTaskStore.ts');
    const state = useTaskStore.getState();
    state.setWorkspacePreference('appearance', { ...(state.preferences.appearance as Record<string, unknown>), theme: 'dark', highContrast: true, accent: '#ff00ff' });
  });
  await expect(page.locator('html')).toHaveAttribute('data-high-contrast', 'true');
  await page.getByRole('textbox', { name: 'Add a task to this list' }).fill('Keep controls readable p2 ~30m');
  await page.getByRole('button', { name: /More details/ }).click();
  await assertViewport(page);
  const scan = await new AxeBuilder({ page }).include('main#main-content').analyze();
  expect(scan.violations.filter(v => ['serious', 'critical'].includes(v.impact || '')), JSON.stringify(scan.violations)).toEqual([]);
  expect(plannerErrors(page)).toEqual([]);
});
