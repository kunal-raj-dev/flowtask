import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seedPlanner, readPlanner, assertViewport } from './helpers/plannerWorkspace';
import { THEMES, THEME_IDS } from '../src/utils/themeRegistry';

test('all eighteen themes keep the Today background and task controls readable', async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seedPlanner(page, { image: 'ws-morning-library' });
  for (const theme of THEME_IDS) {
    await page.keyboard.press('Control+,');
    const settings = page.getByRole('dialog', { name: /^(Application Settings|Appearance settings)$/ });
    await settings.getByRole('button', { name: 'Appearance', exact: true }).click();
    await settings.getByRole('button', { name: 'All', exact: true }).click();
    await settings.getByRole('button', { name: `Apply ${THEMES[theme].label} theme`, exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.locator('[data-today-background] img')).toBeVisible();
    await assertViewport(page);
    const scan = await new AxeBuilder({ page }).include('.today-surface').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(scan.violations.filter(v => ['serious', 'critical'].includes(v.impact || '')).map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), theme).toEqual([]);
  }
});

test('capture stays durable across reload and all supported viewport widths', async ({ page }, testInfo) => {
  await seedPlanner(page, { theme: 'light', empty: true });
  await page.goto('/app');
  const capture = page.getByRole('textbox', { name: 'Add a task to this list' });
  await capture.fill('Release verification task'); await capture.press('Enter');
  await expect.poll(async () => (await readPlanner(page)).tasks.some((task: { title: string }) => task.title === 'Release verification task')).toBe(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Release verification task', exact: true })).toBeVisible();
  for (const width of [320, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(capture).toBeVisible();
    await assertViewport(page);
    if ([390, 1440].includes(width)) await page.screenshot({ path: testInfo.outputPath(`today-${width}.png`) });
  }
});

test('a second tab follows durable changes and explicitly transfers editing ownership', async ({ page, context }) => {
  await seedPlanner(page, { empty: true }); await page.goto('/app');
  await expect(page.getByRole('textbox', { name: 'Add a task to this list' })).toBeVisible();
  const second = await context.newPage(); await second.goto('/app');
  await expect(second.getByText(/Read-only preview/)).toBeVisible();
  await expect(second.locator('.workspace-provider-content[inert]')).toHaveCount(1);
  await page.getByRole('textbox', { name: 'Add a task to this list' }).fill('Written by first tab');
  await page.getByRole('textbox', { name: 'Add a task to this list' }).press('Enter');
  await expect.poll(async () => (await readPlanner(second)).tasks.some((task: { title: string }) => task.title === 'Written by first tab')).toBe(true);
  await second.getByRole('button', { name: 'Use this tab', exact: true }).click();
  await expect(page.getByText(/Read-only preview/)).toBeVisible();
  await expect(second.locator('.workspace-provider-content[inert]')).toHaveCount(0);
  const capture = second.getByRole('textbox', { name: 'Add a task to this list' });
  await capture.fill('Written after transfer'); await capture.press('Enter');
  await expect.poll(async () => (await readPlanner(second)).tasks.length).toBe(2);
  await second.close();
});

test('a visible backup reminder stays compact and dismisses durably on small screens', async ({ page }, testInfo) => {
  await seedPlanner(page, { theme: 'light', empty: true });
  const capture = page.getByRole('textbox', { name: 'Add a task to this list' });
  await capture.fill('Backup reminder fixture'); await capture.press('Enter');
  await page.locator('[data-task-id]').filter({ hasText: 'Backup reminder fixture' }).first().getByRole('checkbox').click();
  const reminder = page.getByRole('complementary', { name: 'Keep a backup' });
  await expect(reminder).toBeVisible();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await assertViewport(page);
    const bounds = await reminder.evaluate(element => ({ height: element.getBoundingClientRect().height, buttons: [...element.querySelectorAll('button')].map(button => button.getBoundingClientRect().toJSON()) }));
    expect(bounds.height).toBeLessThan(width < 1024 ? 90 : 110);
    for (const button of bounds.buttons) { expect(button.width).toBeGreaterThanOrEqual(44); expect(button.height).toBeGreaterThanOrEqual(44); }
    expect(bounds.buttons[0].right).toBeLessThanOrEqual(bounds.buttons[1].left);
    if ([390, 1440].includes(width)) await page.screenshot({ path: testInfo.outputPath(`backup-reminder-${width}.png`) });
  }
  await reminder.getByRole('button', { name: 'Remind me about backups later', exact: true }).click();
  await expect(reminder).toHaveCount(0);
  await expect.poll(async () => Number((await readPlanner(page)).preferences._backupReminderDismissedAt)).toBeGreaterThan(0);
  await page.reload(); await expect(capture).toBeVisible(); await expect(reminder).toHaveCount(0);
});

test('an invalid saved graph opens recovery without replacing the original', async ({ page }) => {
  await seedPlanner(page, { empty: true }); await page.goto('/app');
  await expect(page.getByRole('textbox', { name: 'Add a task to this list' })).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('flowtask_storage_v2'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('workspaces', 'readwrite'); const store = tx.objectStore('workspaces');
      const request = store.get('local'); request.onsuccess = () => store.put({ ...request.result, tasks: [{ id: 'broken', title: 'Preserve original', status: 'todo', priority: 'p2', projectId: 'inbox', createdAt: 1, subtasks: [], blockedBy: ['missing'] }] });
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error); };
    });
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Let’s reopen your workspace.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export original data' })).toBeVisible();
  expect((await readPlanner(page)).tasks[0].id).toBe('broken');
});

test('mobile Plan is directly available and core surfaces have no serious accessibility violations', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedPlanner(page, { theme: 'light', empty: true }); await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'Today.', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Plan View', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Plan.', exact: true })).toBeVisible();
  await assertViewport(page);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations.filter(violation => ['serious', 'critical'].includes(violation.impact || ''))).toEqual([]);
});

for (const count of [1000, 10000]) test(`large workspace keeps rendering bounded with ${count} tasks`, async ({ page }, testInfo) => {
  await seedPlanner(page, { empty: true });
  await page.evaluate(async count => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('flowtask_storage_v2'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('workspaces', 'readwrite'), store = tx.objectStore('workspaces'), request = store.get('local');
      request.onsuccess = () => store.put({ ...request.result, tasks: Array.from({ length: count }, (_, i) => ({ id: `scale-${i}`, title: `Scale task ${i}`, status: 'todo', priority: 'p3', projectId: 'inbox', plannedDate: '2026-10-20', createdAt: 1000 + i, subtasks: [] })) });
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }, count);
  const started = Date.now(); await page.reload();
  const capture = page.getByRole('textbox', { name: 'Add a task to this list' }); await expect(capture).toBeVisible();
  expect(await page.locator('[data-task-id]').count()).toBeLessThan(80);
  const inputStarted = Date.now(); await capture.fill(`Capture with ${count} tasks`);
  const captureInputMs = Date.now() - inputStarted;
  // Desktop CI lab guard, deliberately separate from mobile field INP.
  expect(captureInputMs).toBeLessThan(1500);
  await capture.press('Enter');
  await expect.poll(async () => (await readPlanner(page)).tasks.length).toBe(count + 1);
  await testInfo.attach('large-workspace-lab.json', { body: JSON.stringify({ tasks: count, reloadAndCaptureMs: Date.now() - started, captureInputMs, renderedRows: await page.locator('[data-task-id]').count(), conditions: 'Local production build, unthrottled desktop browser. These are lab guardrails, not field Web Vitals.' }), contentType: 'application/json' });
});
