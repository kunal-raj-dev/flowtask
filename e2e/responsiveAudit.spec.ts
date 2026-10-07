import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const VIEWPORTS = [
  { name: 'mobile_360', width: 360, height: 740, isMobile: true },
  { name: 'mobile_iphone_se_375', width: 375, height: 667, isMobile: true },
  { name: 'mobile_iphone14_390', width: 390, height: 844, isMobile: true },
  { name: 'mobile_pixel_412', width: 412, height: 915, isMobile: true },
  { name: 'tablet_ipad_768', width: 768, height: 1024, isMobile: false },
  { name: 'tablet_landscape_1024', width: 1024, height: 768, isMobile: false },
  { name: 'desktop_1280', width: 1280, height: 800, isMobile: false },
];

const VIEWS = [
  'today',
  'inbox',
  'upcoming',
  'projects',
  'timeline',
  'matrix',
  'kanban',
  'insights',
  'logbook',
  'trash',
];

test.describe('Responsive Deep Inspection & Diagnostics', () => {
  const screenshotsDir = path.join(process.cwd(), 'screenshots', 'audit');

  test.beforeAll(async () => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  for (const vp of VIEWPORTS) {
    test(`Inspect all views and detect layout overflow on ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');

      // Wait for app to be ready
      await page.waitForSelector('main#main-content', { state: 'visible' });

      // Seed mock tasks if empty for rich visual inspection
      await page.evaluate(() => {
        const stored = localStorage.getItem('flowtask_tasks');
        const tasks = stored ? JSON.parse(stored) : [];
        if (tasks.length < 5) {
          const now = new Date().toISOString();
          const today = new Date().toISOString().split('T')[0];
          const mockTasks = [
            {
              id: 'test-task-1',
              title: 'Quarterly Product Strategy Review with Stakeholders',
              description: 'Synthesize user feedback and prepare quarterly roadmap slides with metrics.',
              priority: 'p1',
              status: 'todo',
              projectId: 'inbox',
              plannedDate: today,
              dueDate: today,
              estimatedMinutes: 60,
              createdAt: now,
              subtasks: [
                { id: 'sub-1', title: 'Review Q2 engagement stats', completed: true },
                { id: 'sub-2', title: 'Draft OKR alignment matrix', completed: false },
              ],
              tags: ['strategy', 'roadmap', 'high-impact'],
            },
            {
              id: 'test-task-2',
              title: 'Fix edge-case race conditions in offline sync worker',
              description: 'Ensure optimistic updates rollback cleanly on conflict.',
              priority: 'p2',
              status: 'in_progress',
              projectId: 'inbox',
              plannedDate: today,
              estimatedMinutes: 45,
              scheduledStart: '10:00',
              createdAt: now,
              subtasks: [],
              tags: ['bug', 'sync', 'backend'],
            },
            {
              id: 'test-task-3',
              title: 'Design responsive ergonomics for smartphones',
              description: 'Inspect buttons, modals, and navigation across mobile ratios.',
              priority: 'p1',
              status: 'todo',
              projectId: 'inbox',
              plannedDate: today,
              estimatedMinutes: 90,
              scheduledStart: '14:00',
              createdAt: now,
              subtasks: [],
              tags: ['ux', 'mobile', 'frontend'],
            },
            {
              id: 'test-task-4',
              title: 'Audit accessibility touch targets and focus rings',
              description: 'Ensure WCAG 2.2 touch target compliance.',
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
              id: 'test-task-5',
              title: 'Long title: Conduct comprehensive performance benchmarking and load test on serverless edge functions with latency distribution analysis',
              description: 'Benchmark latency at 95th and 99th percentiles.',
              priority: 'p4',
              status: 'todo',
              projectId: 'inbox',
              createdAt: now,
              subtasks: [],
              tags: ['perf', 'benchmarks', 'infra'],
            },
          ];
          localStorage.setItem('flowtask_tasks', JSON.stringify(mockTasks));
          window.location.reload();
        }
      });

      await page.waitForSelector('main#main-content', { state: 'visible' });

      // Check horizontal overflow on initial Today view
      const checkOverflow = async (viewName: string) => {
        const overflow = await page.evaluate(() => {
          const docEl = document.documentElement;
          const body = document.body;
          const winWidth = window.innerWidth;
          const docScrollWidth = Math.max(docEl.scrollWidth, body.scrollWidth);
          const hasHorizontalOverflow = docScrollWidth > winWidth + 1; // 1px threshold for subpixel

          // Find specific offending elements that extend beyond viewport
          const overflowingElements: { tag: string; id: string; className: string; right: number; width: number }[] = [];
          const allElements = document.querySelectorAll('*');
          for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i] as HTMLElement;
            const rect = el.getBoundingClientRect();
            if (rect.right > winWidth + 2 && rect.width > 0 && rect.height > 0) {
              overflowingElements.push({
                tag: el.tagName,
                id: el.id,
                className: (el.className && typeof el.className === 'string') ? el.className.slice(0, 80) : '',
                right: Math.round(rect.right),
                width: Math.round(rect.width),
              });
              if (overflowingElements.length >= 10) break;
            }
          }

          return {
            winWidth,
            docScrollWidth,
            hasHorizontalOverflow,
            overflowingElements,
          };
        });

        if (overflow.hasHorizontalOverflow) {
          console.warn(`[OVERFLOW DETECTED] View "${viewName}" on ${vp.name}: window=${overflow.winWidth}px, docScrollWidth=${overflow.docScrollWidth}px, elements:`, overflow.overflowingElements);
        }
        return overflow;
      };

      // 1. Audit Today View
      await checkOverflow('today');
      await page.screenshot({ path: path.join(screenshotsDir, `${vp.name}_today.png`), fullPage: false });

      // 2. Audit Mobile Bottom Nav / Sidebar Navigation
      if (vp.isMobile) {
        const bottomNav = page.locator('nav[aria-label="Mobile navigation"]');
        await expect(bottomNav).toBeVisible();

        // Check Quick Add Modal from Mobile Bottom Nav '+'
        const quickAddBtn = page.getByRole('button', { name: /Quick Add Task/i });
        await quickAddBtn.click();
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(screenshotsDir, `${vp.name}_quick_add_modal.png`) });
        await checkOverflow('quick_add_modal');
        // Close modal
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);

        // Open Mobile Menu (Sidebar Drawer)
        const moreBtn = page.getByRole('button', { name: /More views and projects/i });
        await moreBtn.click();
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(screenshotsDir, `${vp.name}_mobile_menu_drawer.png`) });
        await checkOverflow('mobile_menu_drawer');
        // Close drawer by clicking backdrop
        await page.locator('div.fixed.inset-0.z-40').click({ position: { x: vp.width - 20, y: 100 } });
        await page.waitForTimeout(300);
      }

      // 3. Test Navigation across Views
      for (const view of VIEWS) {
        // Navigate by evaluating taskContext or clicking sidebar/menu
        await page.evaluate((targetView) => {
          // Trigger view change via window event or direct navigation if available
          const sidebarBtn = document.querySelector(`[data-view-id="${targetView}"]`) as HTMLElement;
          if (sidebarBtn) {
            sidebarBtn.click();
          } else {
            // Find button by text or data attribute
            const buttons = Array.from(document.querySelectorAll('button'));
            const match = buttons.find(b => b.textContent?.toLowerCase().includes(targetView));
            if (match) match.click();
          }
        }, view);

        await page.waitForTimeout(250);
        await checkOverflow(view);
        if (['matrix', 'kanban', 'timeline', 'projects', 'insights'].includes(view)) {
          await page.screenshot({ path: path.join(screenshotsDir, `${vp.name}_view_${view}.png`) });
        }
      }

      // 4. Test Task Drawer (Slide-over Details)
      // Switch back to Today view and click first task card
      await page.evaluate(() => {
        const todayBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Today'));
        if (todayBtn) todayBtn.click();
      });
      await page.waitForTimeout(300);

      const firstTaskCard = page.locator('[data-task-card="true"], [role="article"], .task-card-item, h3, span').filter({ hasText: 'Quarterly Product Strategy' }).first();
      if (await firstTaskCard.isVisible()) {
        await firstTaskCard.click();
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(screenshotsDir, `${vp.name}_task_drawer.png`) });
        await checkOverflow('task_drawer');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      }

      // 5. Test Settings Drawer
      const settingsBtn = page.getByRole('button', { name: /Preferences/i }).first();
      if (await settingsBtn.isVisible()) {
        await settingsBtn.click();
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(screenshotsDir, `${vp.name}_settings_drawer.png`) });
        await checkOverflow('settings_drawer');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      }

      // 6. Test Aesthetics Modal
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const aestheticsBtn = buttons.find(b => b.title?.includes('Aesthetics') || b.textContent?.includes('Aesthetics'));
        if (aestheticsBtn) aestheticsBtn.click();
      });
      await page.waitForTimeout(300);
      const aestheticsDialog = page.getByRole('dialog', { name: /Aesthetics/i });
      if (await aestheticsDialog.isVisible()) {
        await page.screenshot({ path: path.join(screenshotsDir, `${vp.name}_aesthetics_modal.png`) });
        await checkOverflow('aesthetics_modal');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      }
    });
  }
});
