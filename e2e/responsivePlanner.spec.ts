import { openWorkspaceCustomization } from './helpers/workspaceActions';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seedPlanner, readPlanner, assertViewport, plannerErrors } from './helpers/plannerWorkspace';
import { THEME_IDS } from '../src/utils/themeRegistry';
import path from 'node:path';

test.use({ timezoneId: 'Asia/Kolkata' });
test.afterEach(({ page }) => expect(plannerErrors(page)).toEqual([]));

for (const width of [320, 360, 390, 768, 1024, 1280, 1440]) {
  test(`workspace views and overlays fit ${width}px`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 900 });
    await seedPlanner(page, { image: 'ws-morning-library' });
    await expect(page.locator('[data-today-background] img')).toBeVisible();
    if (width < 1024) expect(await page.locator('.mobile-view-title').evaluate(el => el.clientWidth >= el.scrollWidth)).toBe(true);
    await assertViewport(page);
    if (width < 1280) {
      await page.getByRole('button', { name: 'Timeline', exact: true }).click();
      const rail = page.getByRole('dialog', { name: 'Today timeline', exact: true });
      await expect(rail).toBeVisible(); await assertViewport(page);
      await rail.getByRole('button', { name: 'Auto-Slot Day', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Plan your schedule' })).toBeVisible();
      await page.getByRole('button', { name: 'Preview schedule', exact: true }).click();
      await assertViewport(page);
      await page.getByRole('dialog', { name: 'Plan your schedule' }).getByRole('button', { name: 'Cancel', exact: true }).click();
      await rail.getByRole('button', { name: 'Close dialog', exact: true }).click();
    } else await expect(page.getByRole('complementary', { name: 'Today schedule' })).toBeVisible();
    await page.getByRole('button', { name: 'Open Copilot Omnibar', exact: true }).click();
    const copilot = page.getByRole('dialog', { name: 'FlowTask Copilot' });
    await copilot.getByRole('button', { name: 'Break into steps', exact: true }).click();
    await copilot.getByRole('textbox', { name: 'Copilot task title' }).fill('Prepare my presentation');
    await copilot.getByRole('button', { name: 'Suggest steps' }).click();
    await assertViewport(page);
    if (width === 390) {
      const audit = await new AxeBuilder({ page }).include('.copilot-dialog').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(audit.violations.filter(v => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);
      await page.screenshot({ path: path.resolve('screenshots/planner-copilot-mobile.png') });
    }
    await copilot.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await page.screenshot({ path: path.resolve(`screenshots/planner-today-${width}.png`) });
    for (const view of ['inbox', 'timeline', 'upcoming', 'projects', 'kanban', 'matrix', 'study', 'review', 'insights', 'logbook', 'all', 'someday']) {
      await page.goto(`/app?view=${view}`);
      await expect(page.locator(`[data-workspace-view="${view}"]`)).toBeVisible();
      await assertViewport(page);
    }
    await page.getByRole('button', { name: 'Preferences and Settings', exact: true }).last().click();
    await expect(page.getByRole('dialog').first()).toBeVisible(); await assertViewport(page);
    await page.goto('/'); await expect(page.getByRole('heading', { level: 1 })).toBeVisible(); await assertViewport(page);
  });
}

test('Today background selection spans both views, survives reload and can be removed', async ({ page }) => {
  await seedPlanner(page);
  await openWorkspaceCustomization(page);
  await page.getByRole('button', { name: 'Choose a background', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Choose a workspace image' });
  await picker.getByRole('textbox', { name: 'Search workspace images' }).fill('Morning Library');
  await picker.getByRole('button', { name: 'Select Morning Library', exact: true }).click();
  await picker.getByRole('button', { name: 'Use image', exact: true }).click();
  const image = page.locator('[data-today-background] img');
  await expect(image).toHaveAttribute('src', /ws-morning-library/);
  await expect.poll(async () => (await readPlanner(page)).dashboards[0].coverImage).toBe('ws-morning-library');
  const bounds = await page.locator('[data-today-background]').boundingBox();
  expect(bounds!.height).toBeGreaterThan(500);
  await page.getByRole('button', { name: 'Switch dashboard', exact: true }).click();
  await expect(page.getByText('Modular Dashboard Canvas', { exact: true })).toBeVisible();
  await expect(image).toBeVisible();
  await page.reload(); await expect(image).toBeVisible();
  await openWorkspaceCustomization(page);
  await page.getByRole('button', { name: 'Change background', exact: true }).click();
  await page.getByRole('button', { name: 'Remove background', exact: true }).click();
  await expect(image).toHaveCount(0);
});

test('missing or failed images fall back to the theme and leave tasks usable', async ({ page }) => {
  await page.route('**/ws-morning-library-960.webp', route => route.abort());
  await seedPlanner(page, { image: 'ws-morning-library' });
  await expect(page.getByText('Your saved background is unavailable on this device.', { exact: true })).toBeVisible();
  await expect(page.locator('[data-today-background]')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Add a task to this list' })).toBeEnabled();
  await page.getByRole('button', { name: 'Choose replacement', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Choose a workspace image' })).toBeVisible();
});

test('bright, dark and busy wallpapers stay readable in light and dark themes', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedPlanner(page);
  for (const [id, title] of [['ws-nature-tateyama-snow', 'Tateyama Snow Route'], ['ws-illustration-starry-night', 'Starry Night'], ['ws-morning-library', 'Morning Library']]) {
    await openWorkspaceCustomization(page);
    await page.getByRole('button', { name: /^(Choose a background|Change background)$/ }).click();
    const picker = page.getByRole('dialog', { name: 'Choose a workspace image' });
    await picker.getByRole('textbox', { name: 'Search workspace images' }).fill(title);
    await picker.getByRole('button', { name: `Select ${title}`, exact: true }).click();
    await picker.getByRole('button', { name: 'Use image', exact: true }).click();
    await expect(page.locator('[data-today-background] img')).toHaveAttribute('src', new RegExp(id));
    for (const theme of ['light', 'dark'] as const) {
      await page.evaluate(async theme => { const { applyTheme } = await import('/src/utils/themeRegistry.ts'); applyTheme(theme); }, theme);
      await page.screenshot({ path: path.resolve(`screenshots/planner-${id}-${theme}.png`) });
      const audit = await new AxeBuilder({ page }).include('.today-surface').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(audit.violations.filter(v => v.impact === 'critical' || v.impact === 'serious').map(v => v.id), `${id}/${theme}`).toEqual([]);
    }
  }
});

test('short landscape and resized focus modes keep controls reachable', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 }); await seedPlanner(page, { image: 'ws-morning-library' });
  await page.getByRole('button', { name: 'Open Copilot Omnibar' }).click();
  const copilot = page.getByRole('dialog', { name: 'FlowTask Copilot' });
  await copilot.getByRole('button', { name: 'Start focus', exact: true }).click();
  await copilot.getByRole('combobox', { name: 'Focus task' }).selectOption('two');
  await copilot.getByRole('button', { name: 'Start focus session' }).click();
  const focus = page.getByRole('dialog', { name: 'Unified Focus Engine' });
  await expect(focus).toBeVisible();
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    for (const mode of ['Zen', 'Studio', 'Sprint']) {
      await focus.getByRole('tab', { name: mode, exact: true }).click();
      await assertViewport(page);
      await expect(focus.getByRole('button', { name: 'Close Focus Engine' })).toBeVisible();
    }
  }
  await focus.getByRole('button', { name: 'Close Focus Engine' }).click();
  await assertViewport(page);
});

test('Copilot persists a real editable breakdown, schedules through preview, undoes and starts task-linked focus', async ({ page }) => {
  await seedPlanner(page);
  await page.getByRole('button', { name: 'Open Copilot Omnibar', exact: true }).click();
  const copilot = page.getByRole('dialog', { name: 'FlowTask Copilot' });
  await copilot.getByRole('textbox', { name: 'Copilot command' }).fill('decompose Fix login bug');
  await copilot.getByRole('button', { name: 'Use command' }).click();
  await copilot.getByRole('textbox', { name: 'Step 1 title' }).fill('Reproduce with an expired token');
  await copilot.getByRole('button', { name: 'Preview task', exact: true }).click();
  await copilot.getByRole('button', { name: 'Add task with subtasks', exact: true }).dblclick();
  await expect.poll(async () => (await readPlanner(page)).tasks.filter((t: any) => t.title === 'Fix login bug').length).toBe(1);
  let saved = (await readPlanner(page)).tasks.find((t: any) => t.title === 'Fix login bug');
  expect(saved.subtasks).toHaveLength(4); expect(saved.subtasks[0].title).toBe('Reproduce with an expired token'); expect(saved.nextAction).toContain('2-Min Starter');
  await copilot.getByRole('button', { name: 'Plan / schedule day', exact: true }).click();
  const planner = page.getByRole('dialog', { name: 'Plan your schedule' });
  await planner.getByRole('button', { name: 'Preview schedule' }).click();
  expect((await readPlanner(page)).tasks.find((t: any) => t.id === 'two').scheduledStart).toBeUndefined();
  await planner.getByRole('button', { name: 'Apply schedule' }).click();
  await expect.poll(async () => (await readPlanner(page)).tasks.find((t: any) => t.id === 'two').scheduledStart).toBeTruthy();
  await copilot.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.getByRole('button', { name: /Undo.*Ctrl/ }).click();
  await expect.poll(async () => (await readPlanner(page)).tasks.find((t: any) => t.id === 'two').scheduledStart).toBeUndefined();
  expect((await readPlanner(page)).tasks.find((t: any) => t.id === 'scheduled').scheduledStart).toBe('10:00');
  await page.getByRole('button', { name: 'Open Copilot Omnibar', exact: true }).click();
  await copilot.getByRole('button', { name: 'Start focus', exact: true }).click();
  await copilot.getByRole('combobox', { name: 'Focus task' }).selectOption('two');
  await copilot.getByRole('button', { name: 'Start focus session', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Unified Focus Engine' })).toBeVisible();
  await expect.poll(async () => (await readPlanner(page)).preferences.focusSession?.taskId).toBe('two');
  await page.reload(); saved = (await readPlanner(page)).tasks.find((t: any) => t.title === 'Fix login bug');
  expect(saved.subtasks).toHaveLength(4);
});

test('Plan uses the same editable preview and offers no auto-slot action for an empty past day', async ({ page }) => {
  await seedPlanner(page);
  await page.goto('/app?view=timeline');
  await page.getByRole('button', { name: 'Auto-Slot Day', exact: true }).click();
  const planner = page.getByRole('dialog', { name: 'Plan your schedule' });
  await planner.getByRole('spinbutton', { name: /Minutes for Fix background focus timer/ }).fill('45');
  await planner.getByRole('button', { name: 'Preview schedule' }).click();
  expect((await readPlanner(page)).tasks.find((t: any) => t.id === 'two').scheduledStart).toBeUndefined();
  await planner.getByRole('button', { name: 'Apply schedule' }).click();
  await expect.poll(async () => (await readPlanner(page)).tasks.find((t: any) => t.id === 'two').estimatedMinutes).toBe(45);
  expect((await readPlanner(page)).tasks.find((t: any) => t.id === 'blocked').scheduledStart).toBeUndefined();
  await page.getByRole('textbox', { name: 'Planning date' }).fill('2026-10-19');
  await expect(page.getByRole('button', { name: 'Auto-Slot Day', exact: true })).toHaveCount(0);
});

test('all themes retain full-background geometry with and without an image', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seedPlanner(page, { image: 'ws-morning-library' });
  for (const theme of THEME_IDS) {
    await page.evaluate(async theme => { const { applyTheme } = await import('/src/utils/themeRegistry.ts'); applyTheme(theme); }, theme);
    await expect(page.locator('[data-today-background] img')).toBeVisible();
    await assertViewport(page);
    if (['light', 'dark', 'forest', 'solar'].includes(theme)) await page.screenshot({ path: path.resolve(`screenshots/planner-theme-${theme}.png`) });
    const audit = await new AxeBuilder({ page }).include('.today-surface').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(audit.violations.filter(v => v.impact === 'critical' || v.impact === 'serious').map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), theme).toEqual([]);
  }
  await openWorkspaceCustomization(page); await page.getByRole('button', { name: 'Change background', exact: true }).click(); await page.getByRole('button', { name: 'Remove background', exact: true }).click();
  for (const theme of THEME_IDS) {
    await page.evaluate(async theme => { const { applyTheme } = await import('/src/utils/themeRegistry.ts'); applyTheme(theme); }, theme);
    await expect(page.locator('[data-today-background]')).toHaveCount(0); await assertViewport(page);
  }
});
