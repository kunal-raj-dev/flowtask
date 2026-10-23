import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seedPlanner, readPlanner } from './helpers/plannerWorkspace';

test.use({ timezoneId: 'Asia/Kolkata' });

for (const width of [320, 360, 708, 1440]) {
  test(`session editor fields fit the drawer at ${width}px and apply a time block`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await seedPlanner(page, { theme: width === 360 ? 'porcelain' : 'amoled' });
    await page.locator('[data-task-id="one"] .desk-task-title').click();
    const drawer = page.getByRole('dialog', { name: 'Task Details', exact: true });
    await drawer.getByRole('button', { name: '+ Add Session', exact: true }).click();
    const editor = drawer.getByRole('region', { name: 'Session Duration Generator' });
    await expect(editor).toBeVisible();
    await editor.scrollIntoViewIfNeeded();
    const layout = await editor.evaluate(root => {
      const bounds = root.getBoundingClientRect();
      const elements = [...root.querySelectorAll<HTMLElement>('input, button')];
      return {
        overflow: root.scrollWidth > root.clientWidth + 1,
        outside: elements.filter(el => { const r = el.getBoundingClientRect(); return r.left < bounds.left || r.right > bounds.right; }).map(el => el.getAttribute('aria-label') || el.textContent),
        overlaps: elements.flatMap((a, index) => elements.slice(index + 1).filter(b => {
          const x = a.getBoundingClientRect(), y = b.getBoundingClientRect();
          return Math.min(x.right, y.right) - Math.max(x.left, y.left) > 1 && Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top) > 1;
        }).map(b => [a.getAttribute('aria-label') || a.textContent, b.getAttribute('aria-label') || b.textContent])),
      };
    });
    expect(layout).toEqual({ overflow: false, outside: [], overlaps: [] });
    const scan = await new AxeBuilder({ page }).include('.task-session-editor').analyze();
    expect(scan.violations.filter(v => ['serious', 'critical'].includes(v.impact || ''))).toEqual([]);
    await page.screenshot({ path: `screenshots/session-editor-${width}.png` });
    await editor.getByRole('button', { name: /Midday 11:30/ }).click();
    await expect(editor.getByLabel('Session start time')).toHaveValue('11:30');
    await expect(editor.getByLabel('Session end time')).toHaveValue('14:00');
    await editor.getByRole('button', { name: 'Apply Session' }).click();
    await expect(editor).toHaveCount(0);
    await expect.poll(async () => (await readPlanner(page)).tasks.find((task: { id: string }) => task.id === 'one').scheduledStart).toBe('11:30');
    await page.reload();
    await page.locator('[data-task-id="one"] .desk-task-title').click();
    await expect(page.getByRole('dialog', { name: 'Task Details' }).getByText('11:30 – 14:00', { exact: true })).toBeVisible();
  });
}

test('the session editor and its styles are available on first use offline', async ({ page, context }) => {
  test.skip(process.env.FLOWTASK_PRODUCTION !== 'true', 'Requires a production service worker');
  await seedPlanner(page, { theme: 'graphite' });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await page.locator('[data-task-id="one"] .desk-task-title').click();
  const drawer = page.getByRole('dialog', { name: 'Task Details' });
  await drawer.getByRole('button', { name: '+ Add Session', exact: true }).click();
  const editor = drawer.getByRole('region', { name: 'Session Duration Generator' });
  await expect(editor).toBeVisible();
  expect(await editor.evaluate(el => getComputedStyle(el).containerType)).toBe('inline-size');
  await editor.getByRole('button', { name: 'Apply Session' }).click();
  await expect(drawer.getByText('08:00 – 11:00', { exact: true })).toBeVisible();
  await context.setOffline(false);
});
