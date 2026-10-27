import { expect, test } from '@playwright/test';
import { seedPlanner, readPlanner, assertViewport } from './helpers/plannerWorkspace';

test.use({ timezoneId: 'Asia/Kolkata' });

test('Today capture parses priority and duration, then supports task details and completion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedPlanner(page);
  const input = page.getByRole('textbox', { name: 'Add a task to this list' });
  await input.fill('Read one chapter p2 ~45m'); await input.press('Enter');
  const row = page.locator('.desk-task-row').filter({ has: page.getByRole('button', { name: 'Read one chapter', exact: true }) });
  await expect(row).toBeVisible();
  await expect.poll(async () => (await readPlanner(page)).tasks.find((t: any) => t.title === 'Read one chapter')?.estimatedMinutes).toBe(45);
  expect((await readPlanner(page)).tasks.find((t: any) => t.title === 'Read one chapter').priority).toBe('p2');
  await row.getByRole('button', { name: 'Read one chapter', exact: true }).click();
  await expect(page.getByRole('dialog', { name: /Task details/i })).toBeVisible(); await assertViewport(page);
  await page.getByRole('button', { name: 'Close task details', exact: true }).click();
  await row.getByRole('checkbox', { name: 'Mark as complete' }).click();
  await expect.poll(async () => (await readPlanner(page)).tasks.find((t: any) => t.title === 'Read one chapter')?.status).toBe('done');
});

test('narrow Today timeline opens as a keyboard-accessible dialog and restores focus', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 }); await seedPlanner(page);
  const trigger = page.getByRole('button', { name: 'Timeline', exact: true });
  await trigger.click(); await expect(page.getByRole('dialog', { name: 'Today timeline', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Today timeline', exact: true })).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.getByRole('textbox', { name: 'Add a task to this list' })).toBeVisible();
});

test('wide Today rail collapses without hiding the main task capture', async ({ page }) => {
  // The rail needs 1500px of workspace after the navigation sidebar.
  await page.setViewportSize({ width: 1920, height: 900 }); await seedPlanner(page);
  await page.getByRole('button', { name: 'Collapse timeline rail', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Today schedule' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Expand 24h timeline rail', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Today schedule' })).toBeVisible(); await assertViewport(page);
});

test('first task introduction and its actions stay reachable on a short phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => localStorage.removeItem('flowtask_onboarding_completed'));
  await seedPlanner(page, { empty: true });
  // Explicitly revisit setup through its real workspace preference rather than an obsolete localStorage fixture.
  await page.evaluate(async () => {
    const { useTaskStore } = await import('/src/store/useTaskStore.ts');
    useTaskStore.getState().updateSettings({ onboardingCompleted: false });
    localStorage.removeItem('flowtask_onboarding_completed');
  });
  await expect.poll(async () => (await readPlanner(page)).preferences.settings.onboardingCompleted).toBe(false);
  await page.reload();
  const intro = page.getByRole('region', { name: 'Start with one task', exact: true });
  await expect(intro).toBeVisible();
  await intro.getByRole('textbox', { name: 'Your first task' }).fill('A small first step');
  await intro.getByRole('button', { name: 'Add task', exact: true }).click();
  await expect(intro.getByRole('button', { name: 'Start 25-minute focus', exact: true })).toBeVisible();
  await assertViewport(page);
});
