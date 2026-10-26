import { expect, type Page } from '@playwright/test';
import { STARTER_DASHBOARDS } from '../../src/services/starterDashboards';
import { DEFAULT_WORKFLOW_SETTINGS } from '../../src/types/settings';
import { DEFAULT_APPEARANCE } from '../../src/utils/appearance';
const errors = new WeakMap<Page, string[]>();
export const plannerErrors = (page: Page) => errors.get(page) || [];

export async function seedPlanner(page: Page, options: { theme?: string; image?: string; empty?: boolean } = {}) {
  errors.set(page, []);
  page.on('pageerror', error => errors.get(page)?.push(error.message));
  await page.clock.setFixedTime(new Date('2026-10-20T03:30:00Z'));
  await page.addInitScript(({ dashboards, settings, appearance, options }) => {
    if (localStorage.getItem('responsive-planner-seeded')) return;
    const date = '2026-10-20';
    const tasks = options.empty ? [] : [
      { id: 'one', title: 'Prepare the product presentation with a very long task title that wraps clearly on a small phone', priority: 'p1', plannedDate: date, isPinnedToday: true, topThreeDate: date, estimatedMinutes: 45 },
      { id: 'two', title: 'Fix background focus timer', priority: 'p2', plannedDate: date, estimatedMinutes: 30 },
      { id: 'scheduled', title: 'Existing scheduled work', priority: 'p2', plannedDate: date, scheduledStart: '10:00', scheduledEnd: '11:00', scheduleLocked: true, estimatedMinutes: 60 },
      { id: 'backlog', title: 'A task deliberately left in the backlog', priority: 'p3', estimatedMinutes: 20 },
      { id: 'blocked', title: 'Waiting for the presentation', priority: 'p3', plannedDate: date, blockedBy: ['one'], estimatedMinutes: 30 },
    ].map((t, index) => ({ ...t, status: 'todo', projectId: 'work', createdAt: 1000 + index, subtasks: [] }));
    if (options.image) { dashboards[0].coverImage = options.image; dashboards[0].coverFocalPoint = { x: 52, y: 52 }; }
    localStorage.setItem('flowtask_onboarding_completed', 'true');
    localStorage.setItem('flowtask_backup_last_reminder', String(Date.now()));
    localStorage.setItem('flowtask_ws_local', JSON.stringify({
      schemaVersion: 7, workspaceId: 'local', tasks,
      projects: [{ id: 'inbox', name: 'Inbox', color: '#6366f1', order: 0, createdAt: 1, updatedAt: 1 }, { id: 'work', name: 'Work', color: '#285941', order: 1, createdAt: 1, updatedAt: 1 }],
      dashboards, customViews: [], preferences: { settings: { ...settings, onboardingCompleted: true }, appearance: { ...appearance, theme: options.theme || 'light', reducedMotion: true }, activeDashboardId: dashboards[0].id }, pending: [], undo: [], updatedAt: Date.now(),
    }));
    localStorage.setItem('responsive-planner-seeded', 'true');
  }, { dashboards: structuredClone(STARTER_DASHBOARDS), settings: DEFAULT_WORKFLOW_SETTINGS, appearance: DEFAULT_APPEARANCE, options });
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'Today.', exact: true })).toBeVisible();
}

export async function readPlanner(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('flowtask_storage_v2'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    return new Promise<any>((resolve, reject) => { const request = db.transaction('workspaces').objectStore('workspaces').get('local'); request.onsuccess = () => { db.close(); resolve(request.result || JSON.parse(localStorage.getItem('flowtask_ws_local') || 'null')); }; request.onerror = () => { db.close(); reject(request.error); }; });
  });
}

export async function assertViewport(page: Page) {
  // Check settled geometry, including animated sidebar/dialog exits.
  await expect(async () => {
  const overflow = await page.evaluate(() => {
    const width = window.innerWidth;
    const candidates = [...document.querySelectorAll<HTMLElement>('main h1, main h2, main header, main input, main button, [role="dialog"] input, [role="dialog"] button')];
    return { document: document.documentElement.scrollWidth > width + 1, offenders: candidates.filter(el => {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height || getComputedStyle(el).visibility === 'hidden') return false;
      // Wide content is allowed inside a deliberate horizontal scrolling container.
      for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        if (parent.classList.contains('overflow-x-auto') && parent.scrollWidth > parent.clientWidth + 1) return false;
      }
      return rect.right > width + 2 || rect.left < -2;
    }).slice(0, 6).map(el => ({ text: el.textContent?.slice(0, 55), className: el.className, rect: el.getBoundingClientRect().toJSON() })) };
  });
  expect(overflow, JSON.stringify(overflow)).toEqual({ document: false, offenders: [] });
  }).toPass({ timeout: 5000 });
}
