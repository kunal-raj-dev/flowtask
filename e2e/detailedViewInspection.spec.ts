import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Detailed Multi-Device View & Interaction Inspection', () => {
  const auditDir = path.join(process.cwd(), 'screenshots', 'detailed');

  test.beforeAll(async () => {
    if (!fs.existsSync(auditDir)) {
      fs.mkdirSync(auditDir, { recursive: true });
    }
  });

  const DEVICES = [
    { name: 'iphone14', width: 390, height: 844, isMobile: true },
    { name: 'android360', width: 360, height: 740, isMobile: true },
    { name: 'iphonese375', width: 375, height: 667, isMobile: true },
    { name: 'tablet768', width: 768, height: 1024, isMobile: false },
    { name: 'desktop1280', width: 1280, height: 800, isMobile: false },
  ];

  for (const dev of DEVICES) {
    test(`Comprehensive audit on ${dev.name} (${dev.width}x${dev.height})`, async ({ page }) => {
      await page.setViewportSize({ width: dev.width, height: dev.height });
      await page.goto('/');

      // Seed mock tasks & projects and close onboarding if open
      await page.evaluate(() => {
        const today = new Date().toISOString().split('T')[0];
        const now = new Date().toISOString();
        const mockTasks = [
          {
            id: 'task-1',
            title: 'Prepare executive quarterly roadmap review',
            description: 'Synthesize sprint velocity, customer churn signals, and competitive benchmarks.',
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
              { id: 'st-3', title: 'Publish deck to stakeholder channel', completed: false },
            ],
            tags: ['strategy', 'exec', 'q3'],
            isPinnedToday: true,
          },
          {
            id: 'task-2',
            title: 'Resolve race conditions in offline IndexedDB sync worker',
            description: 'Ensure optimistic transactions rollback reliably without corrupting cache.',
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
            title: 'Design mobile ergonomic controls and touch targets',
            description: 'Calibrate buttons, drawers, and modal sheets to 44px+ tap bounds.',
            priority: 'p1',
            status: 'todo',
            projectId: 'inbox',
            plannedDate: today,
            scheduledStart: '14:30',
            estimatedMinutes: 90,
            createdAt: now,
            subtasks: [],
            tags: ['mobile', 'design', 'ux'],
          },
          {
            id: 'task-4',
            title: 'Verify diurnal aurora contrast ratio compliance with WCAG AAA',
            description: 'Audit light and dark diurnal presets across circadian periods.',
            priority: 'p3',
            status: 'done',
            projectId: 'inbox',
            plannedDate: today,
            completedAt: now,
            createdAt: now,
            subtasks: [],
            tags: ['a11y', 'design-tokens'],
          },
          {
            id: 'task-5',
            title: 'Refactor priority scoring multi-factor heuristic engine',
            description: 'Balance deadline urgency, estimated effort, and blockers.',
            priority: 'p4',
            status: 'todo',
            projectId: 'inbox',
            createdAt: now,
            subtasks: [],
            tags: ['engine'],
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
      await page.waitForTimeout(400);

      const snap = async (name: string) => {
        await page.screenshot({ path: path.join(auditDir, `${dev.name}_${name}.png`) });
      };

      // Helper to navigate via sidebar / mobile drawer
      const navigateTo = async (label: string) => {
        if (dev.isMobile) {
          // Open mobile drawer
          const moreBtn = page.getByRole('button', { name: /More views and projects/i });
          if (await moreBtn.isVisible()) {
            await moreBtn.click();
            await page.waitForTimeout(300);
          } else {
            const menuBtn = page.getByRole('button', { name: /Open navigation menu/i });
            if (await menuBtn.isVisible()) {
              await menuBtn.click();
              await page.waitForTimeout(300);
            }
          }

          // Expand Perspectives if needed
          const persBtn = page.locator('button').filter({ hasText: /^PERSPECTIVES/i });
          if (await persBtn.isVisible()) {
            // Check if collapsed
            const targetItem = page.locator('button').filter({ hasText: new RegExp(label, 'i') });
            if (!(await targetItem.isVisible())) {
              await persBtn.click();
              await page.waitForTimeout(200);
            }
          }

          // Click target
          const btn = page.locator('button').filter({ hasText: new RegExp(label, 'i') }).first();
          if (await btn.isVisible()) {
            await btn.click();
            await page.waitForTimeout(400);
          }
        } else {
          // Desktop sidebar
          const persBtn = page.locator('button').filter({ hasText: /^PERSPECTIVES/i });
          const targetItem = page.locator('button').filter({ hasText: new RegExp(label, 'i') }).first();
          if (!(await targetItem.isVisible()) && (await persBtn.isVisible())) {
            await persBtn.click();
            await page.waitForTimeout(200);
          }
          if (await targetItem.isVisible()) {
            await targetItem.click();
            await page.waitForTimeout(400);
          }
        }
      };

      // 1. Today View
      await snap('01_today_view');

      // 2. Click a Task Card to open TaskDrawer
      const taskCard = page.locator('text=Prepare executive quarterly').first();
      if (await taskCard.isVisible()) {
        await taskCard.click();
        await page.waitForTimeout(400);
        await snap('02_task_drawer');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }

      // 3. Quick Capture Composer
      if (dev.isMobile) {
        await page.getByRole('button', { name: /Quick Add Task/i }).click();
      } else {
        await page.getByRole('button', { name: /New Task/i }).click();
      }
      await page.waitForTimeout(300);
      await snap('03_quick_add_modal');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      // 4. Matrix (Eisenhower) View
      await navigateTo('Priority Matrix');
      await snap('04_eisenhower_matrix');

      // Test mobile quadrant switcher if mobile
      if (dev.isMobile) {
        const scheduleQuad = page.locator('button').filter({ hasText: /Schedule/i }).first();
        if (await scheduleQuad.isVisible()) {
          await scheduleQuad.click();
          await page.waitForTimeout(200);
          await snap('04b_matrix_schedule_quadrant');
        }
      }

      // 5. Kanban View
      await navigateTo('Kanban Board');
      await snap('05_kanban_board');

      if (dev.isMobile) {
        const inProgCol = page.locator('button').filter({ hasText: /In Progress/i }).first();
        if (await inProgCol.isVisible()) {
          await inProgCol.click();
          await page.waitForTimeout(200);
          await snap('05b_kanban_in_progress');
        }
      }

      // 6. Timeline View
      await navigateTo('Timeline');
      await snap('06_timeline_view');

      // 7. Projects View
      await navigateTo('Projects');
      await snap('07_projects_view');

      // 8. Review & Insights View
      await navigateTo('Review');
      await snap('08_review_view');

      // Switch to Insights tab inside Review if visible
      const insightsTab = page.locator('button').filter({ hasText: /Insights/i }).first();
      if (await insightsTab.isVisible()) {
        await insightsTab.click();
        await page.waitForTimeout(300);
        await snap('08b_insights_tab');
      }

      // 9. Modals Inspection:
      // A. Pomodoro Modal
      const timerBtn = page.getByRole('button', { name: /Launch Focus Mode/i }).or(page.getByRole('button', { name: /Focus/i })).first();
      if (await timerBtn.isVisible()) {
        await timerBtn.click();
        await page.waitForTimeout(300);
        await snap('09_pomodoro_modal');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }

      // B. Settings Drawer (Tabs 1-5)
      const settingsBtn = page.getByRole('button', { name: /Preferences/i }).first();
      if (await settingsBtn.isVisible()) {
        await settingsBtn.click();
        await page.waitForTimeout(400);
        await snap('10a_settings_tab_capacity');

        // Tab 2: Aesthetics & Audio
        const aesTab = page.locator('button').filter({ hasText: /Aesthetics/i }).first();
        if (await aesTab.isVisible()) {
          await aesTab.click();
          await page.waitForTimeout(300);
          await snap('10b_settings_tab_aesthetics');
        }

        // Tab 3: Cloud Sync / Calendar
        const syncTab = page.locator('button').filter({ hasText: /Calendar/i }).or(page.locator('button').filter({ hasText: /Sync/i })).first();
        if (await syncTab.isVisible()) {
          await syncTab.click();
          await page.waitForTimeout(300);
          await snap('10c_settings_tab_sync');
        }

        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }

      // C. Command Palette
      const searchBtn = page.getByRole('button', { name: /Search/i }).first();
      if (await searchBtn.isVisible()) {
        await searchBtn.click();
        await page.waitForTimeout(300);
        await snap('11_command_palette');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    });
  }
});
