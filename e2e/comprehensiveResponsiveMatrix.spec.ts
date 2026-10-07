import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Exhaustive Multi-Device Responsive Audit', () => {
  const outDir = path.join(process.cwd(), 'screenshots', 'responsive_matrix');

  test.beforeAll(async () => {
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
  });

  const VIEWPORTS = [
    { name: 'android_360', width: 360, height: 740 },
    { name: 'iphone_se_375', width: 375, height: 667 },
    { name: 'iphone_14_390', width: 390, height: 844 },
    { name: 'pixel_412', width: 412, height: 915 },
    { name: 'tablet_768', width: 768, height: 1024 },
    { name: 'desktop_1280', width: 1280, height: 800 },
  ];

  const seedWorkspace = async (page: any) => {
    await page.evaluate(async () => {
      // Clear IndexedDB so fallback to localStorage flowtask_ws_local is immediate
      if (typeof indexedDB !== 'undefined') {
        indexedDB.deleteDatabase('flowtask_storage_v2');
      }
      const now = new Date().toISOString();
      // Use local date YYYY-MM-DD
      const localDate = new Date();
      const y = localDate.getFullYear();
      const m = String(localDate.getMonth() + 1).padStart(2, '0');
      const d = String(localDate.getDate()).padStart(2, '0');
      const todayStr = `${y}-${m}-${d}`;

      const tasks = [
        {
          id: 'task-1',
          title: 'Prepare quarterly product roadmap presentation',
          description: 'Synthesize user feedback and velocity metrics for the board review.',
          priority: 'p1',
          status: 'todo',
          projectId: 'inbox',
          plannedDate: todayStr,
          dueDate: todayStr,
          estimatedMinutes: 60,
          isPinnedToday: true,
          scheduledStart: '09:00',
          createdAt: now,
          subtasks: [
            { id: 'st-1', title: 'Audit churn telemetry', completed: true },
            { id: 'st-2', title: 'Review sprint commitments', completed: false },
          ],
          tags: ['strategy', 'exec'],
        },
        {
          id: 'task-2',
          title: 'Investigate offline IndexedDB sync race condition',
          description: 'Ensure optimistic state transactions rollback cleanly on conflicts.',
          priority: 'p2',
          status: 'in_progress',
          projectId: 'inbox',
          plannedDate: todayStr,
          scheduledStart: '11:00',
          estimatedMinutes: 45,
          createdAt: now,
          subtasks: [],
          tags: ['bug', 'backend'],
        },
        {
          id: 'task-3',
          title: 'Optimize mobile responsiveness and touch ergonomics',
          description: 'Ensure 44px tap targets, fix overflowing headers, modals and drawers.',
          priority: 'p1',
          status: 'todo',
          projectId: 'inbox',
          plannedDate: todayStr,
          scheduledStart: '14:00',
          estimatedMinutes: 90,
          createdAt: now,
          subtasks: [],
          tags: ['mobile', 'ux'],
        },
        {
          id: 'task-4',
          title: 'Audit accessibility focus rings and color contrast',
          description: 'Pass WCAG 2.2 AA standards across all diurnal color schemes.',
          priority: 'p3',
          status: 'done',
          projectId: 'inbox',
          plannedDate: todayStr,
          completedAt: now,
          createdAt: now,
          subtasks: [],
          tags: ['a11y'],
        },
        {
          id: 'task-5',
          title: 'Future backlog: Serverless edge streaming endpoints',
          description: 'Evaluate Cloudflare workers vs Supabase edge functions.',
          priority: 'p4',
          status: 'todo',
          projectId: 'inbox',
          createdAt: now,
          subtasks: [],
          tags: ['infra'],
        },
      ];

      const projects = [
        { id: 'inbox', name: 'Inbox', color: '#6366f1', icon: 'Inbox' },
        { id: 'work', name: 'Work', color: '#3b82f6', icon: 'Briefcase' },
        { id: 'personal', name: 'Personal', color: '#10b981', icon: 'User' },
      ];

      const record = {
        schemaVersion: 3,
        workspaceId: 'local',
        tasks,
        projects,
        customViews: [],
        preferences: {},
        pending: [],
        undo: [],
        updatedAt: Date.now(),
      };

      localStorage.setItem('flowtask_ws_local', JSON.stringify(record));
      localStorage.setItem('flowtask_onboarding_dismissed', 'true');
      localStorage.setItem('flowtask_onboarding_completed', 'true');
      localStorage.setItem('flowtask_sidebar_perspectives_collapsed', 'false');
      localStorage.setItem('flowtask_sidebar_more_collapsed', 'false');
    });
  };

  for (const vp of VIEWPORTS) {
    test(`Audit ${vp.name} (${vp.width}x${vp.height}) across all views & overlays`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await seedWorkspace(page);
      await page.goto('/?view=today');
      await page.waitForSelector('main#main-content', { state: 'visible' });
      await page.waitForTimeout(500);

      const checkLayoutOverflow = async (screenLabel: string) => {
        return await page.evaluate((label) => {
          const docEl = document.documentElement;
          const body = document.body;
          const winW = window.innerWidth;
          const scrollW = Math.max(docEl.scrollWidth, body.scrollWidth);
          const hasOverflow = scrollW > winW + 1;

          const offenders: { tag: string; cls: string; right: number; width: number }[] = [];
          document.querySelectorAll('*').forEach((el) => {
            const rect = (el as HTMLElement).getBoundingClientRect();
            if (rect.right > winW + 2 && rect.width > 0 && rect.height > 0) {
              offenders.push({
                tag: el.tagName,
                cls: typeof el.className === 'string' ? el.className.slice(0, 60) : '',
                right: Math.round(rect.right),
                width: Math.round(rect.width),
              });
            }
          });
          return { label, winW, scrollW, hasOverflow, count: offenders.length, topOffenders: offenders.slice(0, 5) };
        }, screenLabel);
      };

      // Ensure a task exists for Today
      const composerInput = page.locator('input[placeholder*="What needs to be done"]').first();
      if (await composerInput.isVisible()) {
        await composerInput.fill('Executive Strategy Roadmap #work p1');
        await composerInput.press('Enter');
        await page.waitForTimeout(500);
      }

      // 1. TODAY VIEW
      const todayOverflow = await checkLayoutOverflow('today');
      if (todayOverflow.hasOverflow) {
        console.warn(`[OVERFLOW] ${vp.name} today:`, todayOverflow);
      }
      await page.screenshot({ path: path.join(outDir, `${vp.name}_01_today.png`) });

      // 2. TASK DRAWER (Detail slide-over)
      const taskCard = page.locator('text=Executive Strategy Roadmap').first();
      if (await taskCard.isVisible()) {
        await taskCard.click();
        await page.waitForSelector('div[role="dialog"]', { state: 'visible' });
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(outDir, `${vp.name}_02_task_drawer.png`) });

        // Scroll inside TaskDrawer to inspect bottom properties
        const drawerBody = page.locator('div[role="dialog"] .overflow-y-auto').first();
        if (await drawerBody.isVisible()) {
          await drawerBody.evaluate((el: HTMLElement) => { el.scrollTop = el.scrollHeight; });
          await page.waitForTimeout(300);
          await page.screenshot({ path: path.join(outDir, `${vp.name}_02b_task_drawer_bottom.png`) });
        }
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }

      // 3. QUICK ADD MODAL
      const addTrigger = vp.width < 768
        ? page.getByRole('button', { name: /Quick Add Task/i })
        : page.getByRole('button', { name: /New Task/i });
      if (await addTrigger.isVisible()) {
        await addTrigger.click();
        await page.waitForSelector('#quick-add-modal-title-input, input[placeholder*="What needs to be done"]', { state: 'visible' });
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(outDir, `${vp.name}_03_quick_add.png`) });

        // Expand properties
        const dialog = page.locator('div[role="dialog"]');
        const propsToggle = dialog.locator('button, span').filter({ hasText: /properties/i }).first();
        if (await propsToggle.isVisible()) {
          await propsToggle.click();
          await page.waitForTimeout(300);
          await page.screenshot({ path: path.join(outDir, `${vp.name}_03b_quick_add_props.png`) });
        }
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }

      // 4. PRIORITY MATRIX (EISENHOWER)
      await page.goto('/?view=matrix');
      await page.locator('main#main-content').locator('h2, [role="heading"]').filter({ hasText: /Priority Matrix/i }).waitFor({ state: 'visible', timeout: 10000 });
      await page.waitForTimeout(400);
      await checkLayoutOverflow('matrix');
      await page.screenshot({ path: path.join(outDir, `${vp.name}_04_matrix.png`) });

      // 5. KANBAN BOARD
      await page.goto('/?view=kanban');
      await page.locator('main#main-content').locator('h2, [role="heading"]').filter({ hasText: /Kanban Board/i }).waitFor({ state: 'visible', timeout: 10000 });
      await page.waitForTimeout(400);
      await checkLayoutOverflow('kanban');
      await page.screenshot({ path: path.join(outDir, `${vp.name}_05_kanban.png`) });

      // 6. TIMELINE VIEW
      await page.goto('/?view=timeline');
      await page.locator('main#main-content').getByText(/Day Timeline|Time-blocking/i).first().waitFor({ state: 'visible', timeout: 10000 });
      await page.waitForTimeout(400);
      await checkLayoutOverflow('timeline');
      await page.screenshot({ path: path.join(outDir, `${vp.name}_06_timeline.png`) });

      // 7. PROJECTS VIEW
      await page.goto('/?view=projects');
      await page.locator('main#main-content').getByText(/Manage work streams/i).first().waitFor({ state: 'visible', timeout: 10000 });
      await page.waitForTimeout(400);
      await checkLayoutOverflow('projects');
      await page.screenshot({ path: path.join(outDir, `${vp.name}_07_projects.png`) });

      // 8. REVIEW & INSIGHTS VIEW
      await page.goto('/?view=review');
      await page.locator('[role="tab"], button').filter({ hasText: /Logbook/i }).first().waitFor({ state: 'visible', timeout: 10000 });
      await page.waitForTimeout(400);
      await checkLayoutOverflow('review_logbook');
      await page.screenshot({ path: path.join(outDir, `${vp.name}_08_review_logbook.png`) });

      const insightsTab = page.locator('[role="tab"], button').filter({ hasText: /^Insights/i }).first();
      if (await insightsTab.isVisible()) {
        await insightsTab.click();
        await page.waitForTimeout(400);
        await checkLayoutOverflow('review_insights');
        await page.screenshot({ path: path.join(outDir, `${vp.name}_08b_review_insights.png`) });
      }

      // 9. SETTINGS DRAWER
      const settingsBtn = page.getByRole('button', { name: /Preferences/i }).first();
      if (await settingsBtn.isVisible()) {
        await settingsBtn.click();
        await page.waitForSelector('div:has-text("Preferences & Settings")', { state: 'visible' });
        await page.waitForTimeout(400);
        await checkLayoutOverflow('settings_drawer');
        await page.screenshot({ path: path.join(outDir, `${vp.name}_09_settings_tab1.png`) });

        // Tab 2 Aesthetics
        const tab2 = page.locator('button').filter({ hasText: /Aesthetics/i }).first();
        if (await tab2.isVisible()) {
          await tab2.click();
          await page.waitForTimeout(300);
          await page.screenshot({ path: path.join(outDir, `${vp.name}_09b_settings_tab2.png`) });
        }
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }

      // 10. AESTHETICS MODAL
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const aes = btns.find((b) => b.title?.includes('Aesthetics') || b.textContent?.includes('Aesthetics'));
        if (aes) aes.click();
      });
      await page.waitForTimeout(400);
      const aesDialog = page.getByRole('dialog', { name: /Aesthetics/i });
      if (await aesDialog.isVisible()) {
        await checkLayoutOverflow('aesthetics_modal');
        await page.screenshot({ path: path.join(outDir, `${vp.name}_10_aesthetics_modal.png`) });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    });
  }
});
