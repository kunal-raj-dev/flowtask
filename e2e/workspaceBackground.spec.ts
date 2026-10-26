import { openWorkspaceCustomization } from './helpers/workspaceActions';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seedPlanner, assertViewport, plannerErrors } from './helpers/plannerWorkspace';

test.use({ timezoneId: 'Asia/Kolkata' });
test.afterEach(({ page }) => expect(plannerErrors(page)).toEqual([]));

for (const width of [390, 1440]) {
  for (const theme of ['light', 'dark']) {
    test(`shared scene covers workspace views at ${width}px in ${theme}`, async ({ page }) => {
      test.setTimeout(120000);
      await page.setViewportSize({ width, height: 900 });
      await seedPlanner(page, { image: 'ws-morning-library', theme, empty: width === 390 });
      for (const view of ['today', 'inbox', 'timeline', 'projects', 'project:work', 'upcoming', 'study', 'review', 'insights', 'logbook', 'all', 'someday', 'kanban', 'matrix', 'trash', 'archive']) {
        await page.goto(`/app?view=${view}`);
        await expect(page.locator(`[data-workspace-view="${view}"]`)).toBeVisible();
        const image = page.locator('[data-workspace-background] img');
        await expect(image).toBeVisible();
        await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
        await expect(image).toHaveCSS('object-position', '52% 52%');
        await expect(page.locator('[data-workspace-background]')).toHaveCount(1);
        const bounds = await image.boundingBox();
        expect(bounds!.height).toBeGreaterThan(500);
        await assertViewport(page);
        if (['inbox', 'timeline'].includes(view)) {
          const audit = await new AxeBuilder({ page }).include('.workspace-surface').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
          expect(audit.violations.filter(v => v.impact === 'critical' || v.impact === 'serious').map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
          await page.screenshot({ path: `screenshots/workspace-${view}-${theme}-${width}.png` });
        }
        if (view === 'timeline') {
          const scroller = page.locator('.desk-view-host');
          await scroller.evaluate(el => { el.scrollTop = 600; });
          expect(await scroller.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
          expect(await image.boundingBox()).toEqual(bounds);
        }
      }
    });
  }
}

test('navigation preserves the image element and background changes apply throughout the workspace', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedPlanner(page, { image: 'ws-morning-library' });
  const image = page.locator('[data-workspace-background] img');
  await expect(image).toBeVisible();
  const original = await image.elementHandle();
  const navigation = page.getByRole('complementary', { name: 'Desktop navigation' });
  for (const label of ['Inbox', 'Plan', 'Today']) {
    await navigation.getByRole('button', { name: new RegExp(`^${label}(?:\\s*\\d+)?$`) }).click();
    await expect(page.locator(`[data-workspace-view="${label === 'Plan' ? 'timeline' : label.toLowerCase()}"]`)).toBeVisible();
    expect(await image.evaluate((el, previous) => el === previous, original)).toBe(true);
  }
  await openWorkspaceCustomization(page);
  await page.getByRole('button', { name: 'Background', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Choose a workspace image' });
  await picker.getByRole('textbox', { name: 'Search workspace images' }).fill('Archival Reading Room');
  await picker.getByRole('button', { name: 'Select Archival Reading Room', exact: true }).click();
  await picker.getByRole('button', { name: 'Use image', exact: true }).click();
  await expect(image).toHaveAttribute('src', /ws-archival-reading-room/);
  await navigation.getByRole('button', { name: 'Inbox', exact: true }).click();
  await expect(image).toHaveAttribute('src', /ws-archival-reading-room/);
  await navigation.getByRole('button', { name: /^Today/ }).click();
  await openWorkspaceCustomization(page);
  await page.getByRole('button', { name: 'Background', exact: true }).click();
  await page.getByRole('button', { name: 'Remove background', exact: true }).click();
  await expect(image).toHaveCount(0);
  await navigation.getByRole('button', { name: 'Inbox', exact: true }).click();
  await expect(page.locator('.workspace-surface')).not.toHaveAttribute('data-has-workspace-background');
  await page.reload();
  await expect(page.locator('[data-workspace-view="inbox"]')).toBeVisible();
  await expect(image).toHaveCount(0);
});

test('missing images can be replaced from Inbox and cover visibility applies globally', async ({ page }) => {
  await page.route('**/ws-morning-library-960.webp', route => route.abort());
  await seedPlanner(page, { image: 'ws-morning-library' });
  await page.goto('/app?view=inbox');
  await expect(page.getByText('Your saved background is unavailable on this device.', { exact: true })).toBeVisible();
  await expect(page.locator('[data-workspace-background]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Choose replacement', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Choose a workspace image' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.evaluate(async () => {
    const { useTaskStore } = await import('/src/store/useTaskStore.ts');
    useTaskStore.getState().setWorkspacePreference('workspace', { showCovers: false });
  });
  await expect(page.getByText('Your saved background is unavailable on this device.', { exact: true })).toHaveCount(0);
  await page.goto('/app?view=timeline');
  await expect(page.locator('[data-workspace-view="timeline"]')).toBeVisible();
  await expect(page.locator('[data-workspace-background]')).toHaveCount(0);
  await page.unroute('**/ws-morning-library-960.webp');
  await page.evaluate(async () => {
    const { useTaskStore } = await import('/src/store/useTaskStore.ts');
    useTaskStore.getState().setWorkspacePreference('workspace', { showCovers: true });
  });
  await expect(page.locator('[data-workspace-background] img')).toBeVisible();
  await page.evaluate(async () => {
    const { useTaskStore } = await import('/src/store/useTaskStore.ts');
    const state = useTaskStore.getState();
    state.setWorkspacePreference('appearance', { ...state.preferences.appearance as object, highContrast: true });
  });
  await expect(page.locator('[data-workspace-background]')).toBeHidden();
  await expect(page.locator('.workspace-timeline-canvas')).toBeVisible();
});
