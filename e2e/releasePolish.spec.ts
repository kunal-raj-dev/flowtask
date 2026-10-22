import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ timezoneId: 'Asia/Kolkata' });
async function saved(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('flowtask_storage_v2'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    return new Promise<any>((resolve, reject) => { const r = db.transaction('workspaces').objectStore('workspaces').get('local'); r.onsuccess = () => { db.close(); resolve(r.result); }; r.onerror = () => { db.close(); reject(r.error); }; });
  });
}
async function fresh(page: Page) { await page.goto('/app'); await page.getByRole('heading', { name: 'Today.', exact: true }).waitFor(); }
async function settings(page: Page, tab: string) {
  await page.getByRole('button', { name: 'Preferences and Settings', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Application Settings' });
  await dialog.getByRole('button', { name: tab, exact: true }).click();
  return dialog;
}
for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1440, height: 1000 }]) test(`first task and explicit focus stay reachable at ${viewport.width}`, async ({ page }) => {
  await page.setViewportSize(viewport); await fresh(page);
  expect(await page.getByRole('dialog').count()).toBe(0);
  await page.screenshot({ path: `screenshots/release-first-visit-${viewport.width}.png`, fullPage: true });
  const intro = page.getByRole('region', { name: 'Start with one task' });
  await intro.getByRole('textbox', { name: 'Your first task' }).fill('Read one useful chapter');
  await intro.getByRole('button', { name: 'Add task', exact: true }).click();
  expect((await saved(page)).preferences.focusSession).toBeFalsy();
  const start = intro.getByRole('button', { name: 'Start 25-minute focus' });
  const box = await start.boundingBox(); expect(box!.y).toBeGreaterThanOrEqual(0); expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
  await start.click(); const studio = page.getByRole('dialog', { name: 'Focus Studio', exact: true });
  await expect(studio.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await studio.getByRole('button', { name: 'Pause', exact: true }).click(); await studio.getByRole('button', { name: 'Back to planner' }).click();
  const resumeControl = page.getByRole('button', { name: 'Resume Focus Session', exact: true }).or(page.getByRole('button', { name: 'Open paused focus session', exact: true })).first();
  await expect(resumeControl).toBeVisible();
  const before = (await saved(page)).preferences.focusSession.id;
  await resumeControl.click();
  if (viewport.width < 1024) await studio.getByRole('button', { name: 'Resume', exact: true }).click();
  else await page.getByRole('button',{name:/^Focus Studio/}).first().click();
  await expect(studio.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  expect((await saved(page)).preferences.focusSession.id).toBe(before);
  await studio.getByRole('button', { name: 'Back to planner' }).click();
  const scan = await new AxeBuilder({ page }).analyze(); expect(scan.violations.filter(v => ['critical', 'serious'].includes(v.impact || ''))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `screenshots/release-today-${viewport.width}.png`, fullPage: true });
});
test('saved priority and parsing preference apply to inline and quick capture', async ({ page }) => {
  await fresh(page); await page.getByRole('button', { name: 'Explore on my own' }).click();
  const dialog = await settings(page, 'Workflow');
  await dialog.getByRole('button', { name: 'P2', exact: true }).click();
  await dialog.getByRole('switch', { name: 'Smart Natural Language Parsing' }).click(); await dialog.getByRole('button', { name: 'Close settings' }).click();
  const input = page.getByRole('textbox', { name: 'Add a task to this list' });
  await input.fill('Read tomorrow p1 ~45m'); await input.press('Enter');
  await expect.poll(async () => (await saved(page)).tasks[0]?.title).toBe('Read tomorrow p1 ~45m');
  expect((await saved(page)).tasks[0]).toMatchObject({ priority: 'p2' });
  await page.getByRole('heading', { name: 'Today.', exact: true }).click(); await page.keyboard.press('n'); const capture = page.getByRole('dialog', { name: 'Quick Capture' });
  await capture.getByRole('textbox').fill('Plan next Friday p1'); await capture.getByRole('button', { name: /^Add/ }).click();
  await expect.poll(async () => (await saved(page)).tasks.length).toBe(2);
  expect((await saved(page)).tasks[0]).toMatchObject({ title: 'Plan next Friday p1', priority: 'p2' });
});
test('Settings keeps keyboard focus inside and restores its trigger', async ({ page }) => {
  await fresh(page); const trigger = page.getByRole('button', { name: 'Preferences and Settings', exact: true }).first();
  // Safari intentionally does not focus buttons on pointer click. Exercise the
  // keyboard opening path whose focus must be restored after Escape.
  await trigger.focus(); await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Application Settings' }); await expect(dialog).toBeVisible();
  for (let i = 0; i < 35; i++) { await page.keyboard.press(i % 2 ? 'Tab' : 'Shift+Tab'); expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true); }
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
});
test('calendar imports persist, reject invalid replacements, and stay out of backups', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-19T10:52:00Z') }); await fresh(page);
  const dialog = await settings(page, 'Calendar');
  const calendar = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:lecture\r\nDTSTART:20261019T170000\r\nDTEND:20261019T180000\r\nSUMMARY:Imported lecture\r\nEND:VEVENT\r\nEND:VCALENDAR';
  await dialog.getByLabel('Import calendar file').setInputFiles({ name: 'lectures.ics', mimeType: 'text/calendar', buffer: Buffer.from(calendar) });
  await expect(dialog.getByText(/Imported lectures.ics/)).toBeVisible();
  await dialog.getByLabel('Import calendar file').setInputFiles({ name: 'invalid.ics', mimeType: 'text/calendar', buffer: Buffer.from('invalid') });
  await expect(dialog.getByText('Choose a valid .ics calendar file.')).toBeVisible(); expect((await saved(page)).preferences._calendarFile.name).toBe('lectures.ics');
  await dialog.getByRole('button', { name: 'Close settings' }).click(); await page.reload();
  await page.goto('/app?view=timeline'); await expect(page.getByText('Imported lecture', { exact: true })).toBeVisible();
  const data = await settings(page, 'Data'); const downloadEvent = page.waitForEvent('download'); await data.getByRole('button', { name: /Download.*backup/i }).first().click();
  const download = await downloadEvent; const { readFile } = await import('node:fs/promises'); expect(await readFile((await download.path())!, 'utf8')).not.toContain('Imported lecture');
});
test('automatic scheduling starts after now and does not apply the preview', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-19T10:52:00Z') }); await fresh(page); await page.getByRole('button', { name: 'Explore on my own' }).click();
  const input = page.getByRole('textbox', { name: 'Add a task to this list' }); await input.fill('Read ~30m'); await input.press('Enter');
  await page.goto('/app?view=timeline'); await page.getByRole('button', { name: 'Auto-Slot Day' }).click();
  const preview = page.getByRole('dialog', { name: 'Plan your schedule' }); await preview.getByRole('button', { name: 'Preview schedule' }).click();
  await expect(preview.getByRole('region', { name: 'Schedule preview' })).toBeVisible();
  expect((await saved(page)).tasks[0].scheduledStart).toBeUndefined(); await preview.getByRole('button', { name: 'Apply schedule' }).click();
  await expect.poll(async () => (await saved(page)).tasks[0].scheduledStart).toBeTruthy();
  await page.getByRole('button', { name: /^Undo/ }).click(); await expect.poll(async () => (await saved(page)).tasks[0].scheduledStart).toBeUndefined();
});
