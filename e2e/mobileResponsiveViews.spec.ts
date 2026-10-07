import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Mobile Responsive Views Deep Audit', () => {
  const screenshotsDir = path.join(process.cwd(), 'screenshots', 'mobile_audit');

  test.beforeAll(async () => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  const MOBILE_VIEWPORTS = [
    { name: 'android_360', width: 360, height: 740 },
    { name: 'iphone_se_375', width: 375, height: 667 },
    { name: 'iphone_14_390', width: 390, height: 844 },
    { name: 'pixel_412', width: 412, height: 915 },
  ];

  // Common setup helper
  const setupPage = async (page: any, width: number, height: number) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');

    await page.evaluate(() => {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toISOString();
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Quarterly Executive Review & Product Strategy',
          description: 'Synthesize sprint velocity, churn signals, and competitive benchmarks for board meeting.',
          priority: 'p1',
          status: 'todo',
          projectId: 'inbox',
          plannedDate: today,
          dueDate: today,
          estimatedMinutes: 60,
          createdAt: now,
          subtasks: [
            { id: 'st-1', title: 'Collect metric charts from telemetry', completed: true },
            { id: 'st-2', title: 'Synthesize top 3 risks', completed: false },
          ],
          tags: ['strategy', 'exec', 'q3'],
          isPinnedToday: true,
        },
        {
          id: 'task-2',
          title: 'Fix IndexedDB race conditions in offline sync worker',
          description: 'Ensure optimistic transactions rollback cleanly.',
          priority: 'p2',
          status: 'in_progress',
          projectId: 'inbox',
          plannedDate: today,
          scheduledStart: '11:00',
          estimatedMinutes: 45,
          createdAt: now,
          subtasks: [],
          tags: ['backend', 'bug'],
        },
        {
          id: 'task-3',
          title: 'Mobile touch ergonomics and responsive layout audit',
          description: 'Calibrate buttons, drawers, and modal sheets to 44px+ tap bounds.',
          priority: 'p1',
          status: 'todo',
          projectId: 'inbox',
          plannedDate: today,
          scheduledStart: '14:30',
          estimatedMinutes: 90,
          createdAt: now,
          subtasks: [],
          tags: ['mobile', 'design'],
        },
        {
          id: 'task-4',
          title: 'Verify diurnal aurora contrast ratio compliance with WCAG AAA',
          description: 'Audit light and dark diurnal presets.',
          priority: 'p3',
          status: 'done',
          projectId: 'inbox',
          plannedDate: today,
          completedAt: now,
          createdAt: now,
          subtasks: [],
          tags: ['a11y'],
        },
        {
          id: 'task-5',
          title: 'Backlog item for next sprint release candidate',
          description: 'Review release checklist.',
          priority: 'p4',
          status: 'todo',
          projectId: 'inbox',
          createdAt: now,
          subtasks: [],
          tags: ['release'],
        },
      ];
      localStorage.setItem('flowtask_tasks', JSON.stringify(mockTasks));
      localStorage.setItem('flowtask_onboarding_dismissed', 'true');
      localStorage.setItem('flowtask_onboarding_completed', 'true');
      localStorage.setItem('flowtask_sidebar_perspectives_collapsed', 'false');
      localStorage.setItem('flowtask_sidebar_more_collapsed', 'false');
      window.location.reload();
    });

    await page.waitForSelector('main#main-content', { state: 'visible' });
    await page.waitForTimeout(300);
  };

  for (const vp of MOBILE_VIEWPORTS) {
    test(`Audit Today View & Task Drawer on ${vp.name}`, async ({ page }) => {
      await setupPage(page, vp.width, vp.height);

      // Verify Today View
      await page.screenshot({ path: path.join(screenshotsDir, `${vp.name}_01_today.png`) });

      // Click task card to open TaskDrawer
      const card = page.locator('text=Quarterly Executive Review').first();
      await card.click();
      await page.waitForSelector('div[role="dialog"][aria-label="Task Details"]', { state: 'visible' });
      await page.waitForTimeout(400);

      await page.screenshot({ path: path.join(screenshotsDir, `${vp.name}_02_task_drawer.png`) });

      // Scroll inside TaskDrawer to inspect bottom properties
      const drawerBody = page.locator('div[role="dialog"][aria-label="Task Details"] .overflow-y-auto');
      await drawerBody.evaluate((el: HTMLElement) => { el.scrollTop = el.scrollHeight; });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(screenshotsDir, `${vp.name}_02b_task_drawer_scrolled.png`) });

      // Close TaskDrawer
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    });

    test(`Audit Quick Add Modal on ${vp.name}`, async ({ page }) => {
      await setupPage(page, vp.width, vp.height);

      // Open Quick Add Modal
      const addBtn = page.getByRole('button', { name: /Quick Add Task/i });
      await addBtn.click();
      await page.waitForSelector('#quick-add-modal-title-input, input[placeholder*="needs to be done"]', { state: 'visible' });
      await page.waitForTimeout(300);

      await page.screenshot({ path: path.join(screenshotsDir, `${vp.name}_03_quick_add_modal.png`) });

      // Click "+ Set properties" or "+ Session" to see expanded composer on mobile
      const propsToggle = page.locator('button, span').filter({ hasText: /properties/i }).first();
      if (await propsToggle.isVisible()) {
        await propsToggle.click();
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(screenshotsDir, `${vp.name}_03b_quick_add_properties_expanded.png`) });
      }

      await page.keyboard.press('Escape');
    });

    test(`Audit Priority Matrix (Eisenhower) on ${vp.name}`, async ({ page }) => {
      await setupPage(page, vp.width, vp.height);

      // Open mobile drawer
      await page.getByRole('button', { name: /More views and projects/i }).click();
      await page.waitForSelector('aside', { state: 'visible' });

      // Click Priority Matrix
      await page.locator('button').filter({ hasText: 'Priority Matrix' }).first().click();
      // Wait for Matrix view to mount (not skeleton)
      await page.waitForSelector('h2:has-text("Priority Matrix")', { state: 'visible', timeout: 15000 });
      await page.waitForTimeout(400);

      await page.screenshot({ path: path.join(screenshotsDir, `${vp.name}_04_matrix_do_first.png`) });

      // Switch to Schedule quadrant
      await page.locator('button').filter({ hasText: /Schedule/i }).first().click();
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(screenshotsDir, `${vp.name}_04b_matrix_schedule.png`) });
    });

    test(`Audit Kanban Board on ${vp.name}`, async ({ page }) => {
      await setupPage(page, vp.width, vp.height);

      await page.getByRole('button', { name: /More views and projects/i }).click();
      await page.waitForSelector('aside', { state: 'visible' });

      await page.locator('button').filter({ hasText: 'Kanban Board' }).first().click();
      await page.waitForSelector('h2:has-text("Kanban Board")', { state: 'visible', timeout: 15000 });
      await page.waitForTimeout(400);

      await page.screenshot({ path: path.join(screenshotsDir, `${vp.name}_05_kanban_todo.png`) });

      // Switch to In Progress
      await page.locator('button').filter({ hasText: /In Progress/i }).first().click();
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(screenshotsDir, `${vp.name}_05b_kanban_in_progress.png`) });
    });

    test(`Audit Timeline View on ${vp.name}`, async ({ page }) => {
      await setupPage(page, vp.width, vp.height);

      await page.getByRole('button', { name: /More views and projects/i }).click();
      await page.waitForSelector('aside', { state: 'visible' });

      await page.locator('button').filter({ hasText: 'Timeline' }).first().click();
      // Wait for timeline canvas or hours
      await page.waitForSelector('text=Hourly Timeline, text=Capacity, text=Timeline', { state: 'visible', timeout: 15000 });
      await page.waitForTimeout(400);

      await page.screenshot({ path: path.join(screenshotsDir, `${vp.name}_06_timeline.png`) });
    });

    test(`Audit Settings Drawer & Modals on ${vp.name}`, async ({ page }) => {
      await setupPage(page, vp.width, vp.height);

      // Open Settings Drawer
      const settingsBtn = page.getByRole('button', { name: /Preferences/i }).first();
      await settingsBtn.click();
      await page.waitForSelector('h2:has-text("Preferences & Settings"), div:has-text("Preferences & Settings")', { state: 'visible', timeout: 10000 });
      await page.waitForTimeout(300);

      await page.screenshot({ path: path.join(screenshotsDir, `${vp.name}_07_settings_capacity.png`) });

      // Tab: Aesthetics & Audio
      await page.locator('button').filter({ hasText: /Aesthetics/i }).first().click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(screenshotsDir, `${vp.name}_07b_settings_aesthetics.png`) });

      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Open Pomodoro Modal
      const timerBtn = page.getByRole('button', { name: /Launch Focus Mode/i }).or(page.getByRole('button', { name: /Focus/i })).first();
      await timerBtn.click();
      await page.waitForSelector('div[role="dialog"]', { state: 'visible' });
      await page.waitForTimeout(300);

      await page.screenshot({ path: path.join(screenshotsDir, `${vp.name}_08_pomodoro_modal.png`) });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // Open Command Palette
      const searchBtn = page.getByRole('button', { name: /Search/i }).first();
      await searchBtn.click();
      await page.waitForSelector('input[placeholder*="Type a command"], input[placeholder*="Search"]', { state: 'visible' });
      await page.waitForTimeout(300);

      await page.screenshot({ path: path.join(screenshotsDir, `${vp.name}_09_command_palette.png`) });
      await page.keyboard.press('Escape');
    });
  }
});
