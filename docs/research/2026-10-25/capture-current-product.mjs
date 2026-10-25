import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Isolated synthetic profile; never reads the user's browser or cloud account.
const out = fileURLToPath(new URL('./evidence/', import.meta.url));
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Kolkata', reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
// Use the real clock; synthetic task dates describe the research date below.
await page.addInitScript(() => {
  if (localStorage.getItem('competitive-research-seeded')) return;
  const tasks = [
    { id: 'research-a', title: 'Finish algorithms assignment', nextAction: 'Write the binary search invariant', priority: 'p1', estimatedMinutes: 45, topThreeDate: '2026-10-25', dueDate: '2026-10-28', description: '## Study notes\n\nReview the invariant before implementing.\n\n- Read lecture notes\n- Write test cases' },
    { id: 'research-b', title: 'Build project settings screen', priority: 'p2', estimatedMinutes: 60, scheduledStart: '11:00', scheduledEnd: '12:00' },
    { id: 'research-c', title: 'Read a chapter and take notes', priority: 'p3', estimatedMinutes: 30 },
  ].map(task => ({ ...task, status: 'todo', projectId: 'inbox', plannedDate: '2026-10-25', subtasks: [], createdAt: Date.now() }));
  localStorage.setItem('flowtask_onboarding_completed', 'true');
  localStorage.setItem('flowtask_tasks_v1', JSON.stringify(tasks));
  localStorage.setItem('flowtask_backup_last_reminder', String(Date.now()));
  localStorage.setItem('competitive-research-seeded', 'true');
});
const base = process.env.FLOWTASK_RESEARCH_URL || 'http://127.0.0.1:5185';
const observations = [];
for (const [name, view, width] of [
  ['today-desktop', 'today', 1440],
  ['plan-desktop', 'timeline', 1440],
  ['projects-desktop', 'projects', 1440],
  ['today-mobile', 'today', 390],
]) {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(`${base}/app?view=${view}`);
  await page.locator(`[data-workspace-view="${view}"]`).waitFor();
  await page.screenshot({ path: `${out}${name}.png`, fullPage: true });
  observations.push({ name, headings: await page.getByRole('heading').allTextContents(), text: (await page.locator('main').innerText()).slice(0, 10000), overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
}
await page.setViewportSize({ width: 1440, height: 1000 });
await page.goto(`${base}/app?view=today`);
await page.getByRole('button', { name: 'Finish algorithms assignment', exact: true }).first().click();
await page.getByRole('dialog').first().waitFor();
await page.waitForFunction(() => {
  const drawer = document.querySelector('[data-task-drawer]');
  return drawer && drawer.getBoundingClientRect().left < innerWidth - 300;
});
// Let the overlay opacity animation settle before capturing its appearance.
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}task-detail-desktop.png`, fullPage: true });
observations.push({ name: 'task-detail-desktop', text: (await page.getByRole('dialog').first().innerText()).slice(0, 12000), layout: await page.locator('[data-task-drawer]').evaluate(element => {
  const style = getComputedStyle(element), parent = element.parentElement;
  return { rect: element.getBoundingClientRect().toJSON(), opacity: style.opacity, transform: style.transform, parentOpacity: getComputedStyle(parent).opacity, parentRect: parent.getBoundingClientRect().toJSON() };
}) });
await writeFile(`${out}observations.json`, JSON.stringify({ capturedAt: new Date().toISOString(), base, syntheticData: true, errors, observations }, null, 2));
await browser.close();
console.log(JSON.stringify({ out, captures: observations.map(x => x.name), errors }));
