import { openWorkspaceCustomization } from './helpers/workspaceActions';
import { expect, test } from '@playwright/test';
import { seedPlanner, assertViewport, plannerErrors, readPlanner } from './helpers/plannerWorkspace';

test.use({ timezoneId: 'Asia/Kolkata' });
test.afterEach(({ page }) => expect(plannerErrors(page)).toEqual([]));

for (const width of [320, 390, 1440]) {
  test(`every workspace section opens and fits at ${width}px`, async ({ page }) => {
    test.setTimeout(240000);
    await page.setViewportSize({ width, height: 900 });
    await seedPlanner(page);
    for (const view of ['today', 'inbox', 'timeline', 'projects', 'project:work', 'notes', 'areas', 'goals', 'routines', 'upcoming', 'study', 'review', 'insights', 'logbook', 'all', 'someday', 'kanban', 'matrix', 'archive', 'trash', 'dashboard']) {
      await page.goto(`/app?view=${encodeURIComponent(view)}`);
      const surface = page.locator(`[data-workspace-view="${view}"]`);
      await expect(surface).toBeVisible();
      await expect(surface.getByRole('heading').first()).toBeVisible();
      if (view === 'dashboard') await expect(surface.locator('[data-dashboard-grid]')).toBeVisible();
      await expect(page.locator('main')).not.toContainText('could not display');
      await assertViewport(page);
    }
    await page.screenshot({ path: `screenshots/ux-sections-${width}.png` });
  });
}

test('default background removal persists and a new image can be applied from plain mode', async ({ page }) => {
  await seedPlanner(page);
  await expect(page.locator('[data-workspace-background]')).toBeVisible();
  await openWorkspaceCustomization(page);
  await page.getByRole('button', { name: 'Remove background', exact: true }).click();
  await expect(page.locator('[data-workspace-background]')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Today.', exact: true })).toBeVisible();
  await expect(page.locator('[data-workspace-background]')).toHaveCount(0);
  await openWorkspaceCustomization(page);
  await page.getByRole('button', { name: 'Background', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Choose a workspace image' });
  await expect(picker.getByText(/saved personal image is not available/)).toHaveCount(0);
  await picker.getByRole('textbox', { name: 'Search workspace images' }).fill('Morning Library');
  await picker.getByRole('button', { name: 'Select Morning Library', exact: true }).click();
  await picker.getByRole('button', { name: 'Use image', exact: true }).click();
  await expect(page.locator('[data-workspace-background] img')).toHaveAttribute('src', /ws-morning-library/);
});

test('goal links, target date, life area and status can be edited and cleared after reload', async ({ page }) => {
  await seedPlanner(page);
  await page.goto('/app?view=goals');
  await page.getByRole('button', { name: 'New Goal', exact: true }).click();
  await page.getByRole('textbox', { name: 'Goal title', exact: true }).fill('Ship a useful planner');
  await page.getByLabel('Target date', { exact: true }).fill('2026-12-15');
  await page.getByRole('checkbox', { name: 'Work', exact: true }).check();
  await page.getByRole('button', { name: 'Save Goal', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ship a useful planner' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit Goal', exact: true }).click();
  await expect(page.getByLabel('Target date', { exact: true })).toHaveValue('2026-12-15');
  await page.getByLabel('Target date', { exact: true }).fill('');
  await page.getByRole('checkbox', { name: 'Work', exact: true }).uncheck();
  await page.getByRole('combobox', { name: 'Goal status', exact: true }).selectOption('paused');
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await page.reload();
  await expect(page.getByText('Paused', { exact: true })).toBeVisible();
  const goal = (await readPlanner(page)).goals[0];
  expect(goal.projectIds).toEqual([]);
  expect(goal.targetDate).toBeUndefined();
});

test('routine editor works on a small phone, supports Escape and saves real steps', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await seedPlanner(page);
  await page.goto('/app?view=routines');
  await page.getByRole('button', { name: 'New Routine', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create Routine', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Routine Title', { exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'New Routine', exact: true }).click();
  await dialog.getByLabel('Routine Title', { exact: true }).fill('Prepare to focus');
  await dialog.getByLabel('Step 1 title', { exact: true }).fill('Open my task list');
  await dialog.getByRole('button', { name: 'Add Step', exact: true }).click();
  await dialog.getByLabel('Step 2 title', { exact: true }).fill('Pick one task');
  await assertViewport(page);
  await dialog.getByRole('button', { name: 'Save Routine', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Prepare to focus', exact: true })).toBeVisible();
});

for (const width of [320, 1440]) test(`all settings panels and nested background controls work at ${width}px`, async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width, height: 900 });
  await seedPlanner(page);
  if (width < 1024) await page.getByRole('button', { name: 'Open navigation menu', exact: true }).click();
  await page.getByRole('button', { name: 'Preferences and Settings', exact: true }).last().click();
  for (const name of ['Workspace', 'Appearance', 'Focus', 'Sound', 'Workflow', 'Shortcuts', 'Calendar', 'Data', 'Account', 'About']) {
    await page.getByRole('dialog').getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('button', { name: 'Close settings', exact: true })).toBeVisible();
    await assertViewport(page);
  }
  await page.getByRole('dialog').getByRole('button', { name: 'Appearance', exact: true }).click();
  await page.getByRole('button', { name: 'Change background', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Choose a workspace image' });
  await expect(picker).toBeVisible();
  await picker.getByRole('button', { name: 'Remove background', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Appearance settings' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choose background', exact: true })).toBeVisible();
  await page.screenshot({ path: `screenshots/ux-appearance-${width}.png` });
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  await expect(page.locator('[data-workspace-background]')).toHaveCount(0);
});

test('mobile capture keeps keyboard focus inside the dialog and cancels without creating a task', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await seedPlanner(page);
  await expect(page.getByRole('button', { name: 'Open Copilot Omnibar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open navigation menu', exact: true }).click();
  await page.getByRole('button', { name: 'Preferences and Settings', exact: true }).last().click();
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('Alt+Space');
  const dialog = page.getByRole('dialog', { name: 'Quick capture', exact: true });
  const input = dialog.getByRole('textbox', { name: 'Quick capture task', exact: true });
  const before = (await readPlanner(page)).tasks.length;
  await input.fill('A disposable capture draft');
  await assertViewport(page);
  await input.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Capture', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Close (Esc)', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(input).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect((await readPlanner(page)).tasks.length).toBe(before);
});
