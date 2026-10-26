import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('./evidence/', import.meta.url));
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Kolkata', reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => {
  if (localStorage.getItem('ecosystem-research-seeded')) return;
  const date = '2026-10-25';
  const tasks = [
    { id: 'eco-a', title: 'Write project proposal', nextAction: 'Outline the three project outcomes', priority: 'p1', estimatedMinutes: 45, topThreeDate: date, dueDate: '2026-10-28' },
    { id: 'eco-b', title: 'Review prototype with Alex', priority: 'p2', estimatedMinutes: 60, scheduledStart: '15:00', scheduledEnd: '16:00' },
    { id: 'eco-c', title: 'Read a chapter and take notes', priority: 'p3', estimatedMinutes: 30 },
    { id: 'eco-d', title: 'Book dentist appointment', priority: 'p3', estimatedMinutes: 10, isEvening: true },
  ].map(t => ({ ...t, status: 'todo', projectId: 'inbox', plannedDate: date, subtasks: [], createdAt: Date.now() }));
  localStorage.setItem('flowtask_onboarding_completed', 'true');
  localStorage.setItem('flowtask_tasks_v1', JSON.stringify(tasks));
  localStorage.setItem('flowtask_backup_last_reminder', String(Date.now()));
  localStorage.setItem('ecosystem-research-seeded', 'true');
});
const base = process.env.FLOWTASK_RESEARCH_URL || 'http://127.0.0.1:5187';
const observations = [];
for (const [view, width] of [['today',1440],['timeline',1440],['notes',1440],['projects',1440],['routines',1440],['review',1440],['today',390],['timeline',390],['notes',390]]) {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(`${base}/app?view=${view}`);
  await page.locator(`[data-workspace-view="${view}"]`).waitFor();
  await page.waitForTimeout(500);
  const name = `${view}-${width}`;
  await page.screenshot({ path: `${out}${name}.png`, fullPage: true });
  observations.push({ name, headings: await page.getByRole('heading').allTextContents(), text: (await page.locator('main').innerText()).slice(0,16000), overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
}
await page.setViewportSize({ width:1440, height:1000 });
await page.goto(`${base}/app?view=today`);
await page.getByRole('button', { name:'Write project proposal', exact:true }).first().click();
await page.getByRole('dialog').first().waitFor();
await page.waitForTimeout(500);
await page.screenshot({ path:`${out}task-detail-1440.png`, fullPage:true });
observations.push({ name:'task-detail-1440', text:await page.getByRole('dialog').first().innerText() });
await writeFile(`${out}observations.json`, JSON.stringify({capturedAt:new Date().toISOString(),base,syntheticData:true,errors,observations},null,2));
await browser.close();
console.log(JSON.stringify({out,captures:observations.map(x=>x.name),errors}));
