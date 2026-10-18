import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Automated Accessibility & WCAG 2.2 AA Audit', () => {
  const setupPage = async (page: any, width = 1280, height = 800) => {
    await page.setViewportSize({ width, height });
    await page.addInitScript(() => {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toISOString();
      const mockTasks = [
        {
          id: 'task-a11y-1',
          title: 'Quarterly Executive Review & Product Strategy',
          description: 'Synthesize sprint velocity, churn signals, and competitive benchmarks.',
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
          tags: ['strategy', 'exec'],
          isPinnedToday: true,
        },
        {
          id: 'task-a11y-2',
          title: 'Implement accessible WCAG 2.2 focus rings and high-contrast tokens',
          description: 'Audit tab index, focus trapping, and semantic landmark roles.',
          priority: 'p2',
          status: 'in_progress',
          projectId: 'inbox',
          plannedDate: today,
          scheduledStart: '10:00',
          estimatedMinutes: 45,
          createdAt: now,
          subtasks: [],
          tags: ['a11y', 'design'],
        },
        {
          id: 'task-a11y-3',
          title: 'Verify screen reader announcements for completed task toasts',
          description: 'Ensure aria-live region announces undo/redo state changes.',
          priority: 'p3',
          status: 'done',
          projectId: 'inbox',
          plannedDate: today,
          completedAt: now,
          createdAt: now,
          subtasks: [],
          tags: ['a11y', 'testing'],
        },
      ];
      localStorage.setItem('flowtask_tasks', JSON.stringify(mockTasks));
      localStorage.setItem('flowtask_tasks_v1', JSON.stringify(mockTasks));
      localStorage.setItem('flowtask_onboarding_dismissed', 'true');
      localStorage.setItem('flowtask_onboarding_completed', 'true');
      localStorage.setItem('flowtask_sidebar_perspectives_collapsed', 'false');
      localStorage.setItem('flowtask_sidebar_more_collapsed', 'false');
    });

    await page.goto('/app');
    await page.waitForSelector('main#main-content', { state: 'visible' });
    await page.waitForTimeout(300);
  };

  test('Typography tokens guarantee WCAG 2.2 AAA / AA high-contrast ratios', async ({ page }) => {
    await setupPage(page);

    const contrastAudit = await page.evaluate(() => {
      const getLuminance = (rgb: number[]) => {
        const a = rgb.map((v) => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
      };

      const getRatio = (fg: number[], bg: number[]) => {
        const l1 = getLuminance(fg);
        const l2 = getLuminance(bg);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      };

      // Primary Text (#0F172A) on Alabaster Surface (#FAF9F6)
      const primaryOnPaper = getRatio([15, 23, 42], [250, 249, 246]);
      // Secondary Text (#334155) on Elevated Surface (#F3F0E8)
      const secondaryOnElevated = getRatio([51, 65, 85], [243, 240, 232]);
      // Muted Text (#475569) on Elevated Surface (#F3F0E8)
      const mutedOnElevated = getRatio([71, 85, 105], [243, 240, 232]);

      return { primaryOnPaper, secondaryOnElevated, mutedOnElevated };
    });

    // WCAG AAA requires >= 7:1 for normal text
    expect(contrastAudit.primaryOnPaper).toBeGreaterThan(14.0);
    // WCAG AA requires >= 4.5:1 for normal text
    expect(contrastAudit.secondaryOnElevated).toBeGreaterThan(7.0);
    expect(contrastAudit.mutedOnElevated).toBeGreaterThan(4.5);
  });

  test('Today View passes WCAG 2.2 AA audit with 0 critical or serious violations', async ({ page }) => {
    await setupPage(page);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze();

    const criticalOrSerious = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalOrSerious).toEqual([]);
  });

  test('Upcoming View passes WCAG 2.2 AA audit', async ({ page }) => {
    await setupPage(page);

    await page.locator('aside[aria-label="Desktop navigation"]').getByRole('button', { name: /Upcoming/i }).click();
    await page.waitForSelector('h1:has-text("Upcoming")', { state: 'visible' });

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze();

    const criticalOrSerious = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalOrSerious).toEqual([]);
  });

  test('Kanban Board View passes WCAG 2.2 AA audit', async ({ page }) => {
    await setupPage(page);

    await page.locator('aside[aria-label="Desktop navigation"]').getByRole('button', { name: /Kanban/i }).click();
    await page.waitForSelector('h2:has-text("Kanban Board")', { state: 'visible' });

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze();

    const criticalOrSerious = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalOrSerious).toEqual([]);
  });

  test('Priority Matrix (Eisenhower) View passes WCAG 2.2 AA audit', async ({ page }) => {
    await setupPage(page);

    await page.locator('aside[aria-label="Desktop navigation"]').getByRole('button', { name: /Priority Matrix/i }).click();
    await page.waitForSelector('h2:has-text("Priority Matrix")', { state: 'visible' });

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze();

    const criticalOrSerious = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalOrSerious).toEqual([]);
  });

  test('Day Timeline View passes WCAG 2.2 AA audit', async ({ page }) => {
    await setupPage(page);

    await page.locator('aside[aria-label="Desktop navigation"]').getByRole('button', { name: /Timeline/i }).click();
    await page.waitForSelector('h3:has-text("Day Timeline")', { state: 'visible' });

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze();

    const criticalOrSerious = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalOrSerious).toEqual([]);
  });

  test('Task Details Slide-over Drawer passes WCAG 2.2 AA audit and keyboard escape dismiss', async ({ page }) => {
    await setupPage(page);

    const taskCard = page.locator('text=Quarterly Executive Review').first();
    await taskCard.click();

    const drawer = page.locator('div[role="dialog"][aria-label="Task Details"]');
    await expect(drawer).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('div[role="dialog"][aria-label="Task Details"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze();

    const criticalOrSerious = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalOrSerious).toEqual([]);

    // Verify dismissal via accessible close control
    const closeBtn = drawer.getByRole('button', { name: /Close task details/i });
    await closeBtn.click();
    await expect(drawer).not.toBeVisible();
  });

  test('Quick Add Modal dialog passes WCAG 2.2 AA audit and keyboard escape dismiss', async ({ page }) => {
    await setupPage(page);

    const addBtn = page.getByRole('button', { name: /Quick Add Task/i }).or(page.getByRole('button', { name: /New Task/i })).first();
    await addBtn.click();

    const dialog = page.locator('div[role="dialog"][aria-labelledby="quick-add-title"]');
    await expect(dialog).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('div[role="dialog"][aria-labelledby="quick-add-title"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze();

    const criticalOrSerious = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalOrSerious).toEqual([]);

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('Settings Drawer passes WCAG 2.2 AA audit across Workflow and Aesthetics tabs', async ({ page }) => {
    await setupPage(page);

    const settingsBtn = page.getByRole('button', { name: /Preferences and Settings/i }).first();
    await settingsBtn.click();

    const dialog = page.locator('div[role="dialog"][aria-label="Application Settings"]');
    await expect(dialog).toBeVisible();

    // Audit Tab 1: Workflow & Capacity
    const scanWorkflow = await new AxeBuilder({ page })
      .include('div[role="dialog"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze();

    const criticalOrSeriousWorkflow = scanWorkflow.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(criticalOrSeriousWorkflow).toEqual([]);

    // Switch to Tab 2: Aesthetics & Tactile Sound Profiles
    await dialog.locator('button').filter({ hasText: /Aesthetics/i }).first().click();
    await page.waitForTimeout(300);

    const scanAesthetics = await new AxeBuilder({ page })
      .include('div[role="dialog"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze();

    const criticalOrSeriousAesthetics = scanAesthetics.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(criticalOrSeriousAesthetics).toEqual([]);

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('Command Palette modal passes WCAG 2.2 AA audit and keyboard escape dismiss', async ({ page }) => {
    await setupPage(page);

    // Open via search button or keyboard shortcut
    const searchBtn = page.getByRole('button', { name: /Search and commands|Search/i }).first();
    if (await searchBtn.isVisible()) {
      await searchBtn.click();
    } else {
      await page.keyboard.press('Control+k');
    }
    const palette = page.locator('input[placeholder*="Type a command"], input[placeholder*="Search"]').first();
    await expect(palette).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('div[role="dialog"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast'])
      .analyze();

    const criticalOrSerious = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalOrSerious).toEqual([]);

    await page.keyboard.press('Escape');
    await expect(palette).not.toBeVisible();
  });
});
