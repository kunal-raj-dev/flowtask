import { expect, test, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seedPlanner } from './helpers/plannerWorkspace';
import { STUDIO_THEME_IDS } from '../src/utils/studioAppearance';
import { THEMES } from '../src/utils/themeRegistry';

async function openStudio(page: Page) {
  await page.locator('main#main-content').waitFor({ state:'visible' });
  const desktopEntry = page.getByRole('button', { name: /^Focus Studio/ }).first();
  if (await desktopEntry.isVisible()) await desktopEntry.click();
  else await page.getByRole('button', { name: 'Launch Focus Mode', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Focus Studio', exact: true })).toBeVisible();
}

async function assertSessionFits(studio: Locator) {
  const layout = await studio.evaluate(root => {
    const stage = root.querySelector<HTMLElement>('.studio-stage')!;
    const bounds = stage.getBoundingClientRect();
    const controls = [...root.querySelectorAll<HTMLElement>('.studio-playback button')].map(el => el.getBoundingClientRect());
    const clock = root.querySelector('.studio-clock > span')!.getBoundingClientRect();
    return {
      scrolls: stage.scrollHeight > stage.clientHeight + 1,
      outside: [...controls,clock].some(r => r.top < bounds.top - 1 || r.bottom > bounds.bottom + 1 || r.left < bounds.left - 1 || r.right > bounds.right + 1),
      overlapping: controls.some((a,i) => controls.slice(i+1).some(b => Math.min(a.right,b.right) > Math.max(a.left,b.left)+1 && Math.min(a.bottom,b.bottom) > Math.max(a.top,b.top)+1)),
    };
  });
  expect(layout).toEqual({ scrolls: false, outside: false, overlapping: false });
}

test('multi-hour clocks stay fully readable on a small phone', async ({ page }) => {
  await page.setViewportSize({ width:360,height:640 });
  await seedPlanner(page);
  await openStudio(page);
  const studio = page.getByRole('dialog', { name:'Focus Studio', exact:true });
  await studio.getByRole('button', { name:'Session',exact:true }).click();
  await studio.getByRole('spinbutton', { name:'Focus minutes',exact:true }).fill('180');
  await studio.getByRole('button', { name:'Close customization panel' }).click();
  await expect(studio.getByRole('timer')).toContainText('03:00:00');
  await assertSessionFits(studio);
  await studio.getByRole('button', { name:'Start focus',exact:true }).click();
  await assertSessionFits(studio);
});

for (const [width,height] of [[1920,1080],[1536,864],[1366,768],[1280,720],[1024,768],[390,844],[360,640],[844,390]]) {
  test(`Studio fills ${width}x${height} with primary controls fully in view`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await seedPlanner(page);
    await openStudio(page);
    const studio = page.getByRole('dialog', { name: 'Focus Studio', exact: true });
    await assertSessionFits(studio);
    await page.screenshot({ path: `screenshots/studio-lobby-${width}-${height}.png` });
    await studio.getByRole('button', { name: 'Start focus', exact: true }).click();
    await expect(studio.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    await assertSessionFits(studio);
    await page.screenshot({ path: `screenshots/studio-session-${width}-${height}.png` });
  });
}

test('all Studio themes have readable surfaces and persist independently of the planner', async ({ page }) => {
  test.setTimeout(120000);
  await seedPlanner(page);
  await openStudio(page);
  const studio = page.getByRole('dialog', { name: 'Focus Studio', exact: true });
  await studio.getByRole('button', { name: 'Style', exact: true }).click();
  for (const id of STUDIO_THEME_IDS) {
    await studio.getByRole('button', { name: `Use ${THEMES[id].label} Studio theme`, exact: true }).click();
    await expect(studio).toHaveAttribute('data-studio-theme', id);
    const scan = await new AxeBuilder({ page }).include('.focus-studio').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    expect(scan.violations.filter(v => ['serious','critical'].includes(v.impact || '')).map(v => ({ id:v.id, nodes:v.nodes.map(n=>n.target) })), id).toEqual([]);
  }
  await studio.getByRole('button', { name: 'Use Espresso Studio theme', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await openStudio(page);
  await expect(studio).toHaveAttribute('data-studio-theme', 'espresso');
});

test('floating timer shares the current scene, supports independent palettes and keyboard controls', async ({ page, context }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'documentPictureInPicture', { configurable: true, value: {
      requestWindow: async ({ width,height }: { width:number; height:number }) => {
        const popup = window.open('about:blank', 'focus-appearance-test', `width=${width},height=${height}`);
        if (!popup) throw new Error('Unable to open test floating window');
        return popup;
      },
    } });
  });
  await seedPlanner(page);
  await openStudio(page);
  const studio = page.getByRole('dialog', { name: 'Focus Studio', exact: true });
  await studio.getByRole('button', { name: 'Room', exact: true }).click();
  await studio.getByRole('button', { name: 'Use Kyoto Rain background', exact: true }).click();
  await studio.getByRole('button', { name: 'Close customization panel' }).click();
  await studio.getByRole('button', { name: 'Start focus', exact: true }).click();
  const popupPromise = context.waitForEvent('page');
  await studio.getByRole('button', { name: 'Open floating timer' }).click();
  const popup = await popupPromise;
  await popup.setViewportSize({ width:360,height:280 });
  await expect(popup.locator('.pip-container')).toHaveAttribute('data-pip-background', 'kyoto-rain');
  await expect(popup.locator('.pip-scene')).toBeVisible();
  await expect.poll(() => popup.locator('.pip-scene').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await studio.getByRole('button', { name: 'Style', exact: true }).click();
  await studio.getByRole('button', { name: 'Use Porcelain Studio theme', exact: true }).click();
  await expect(popup.locator('.pip-container')).toHaveAttribute('data-pip-theme', 'porcelain');
  await popup.getByRole('button', { name: 'Floating timer appearance', exact: true }).click();
  await popup.getByRole('button', { name: 'Use Espresso floating theme', exact: true }).click();
  await popup.screenshot({ path:'screenshots/studio-floating-appearance.png' });
  await expect(popup.locator('.pip-container')).toHaveAttribute('data-pip-theme', 'espresso');
  await expect(studio).toHaveAttribute('data-studio-theme', 'porcelain');
  await popup.getByLabel('Studio background', { exact:true }).uncheck();
  await expect(popup.locator('.pip-scene')).toHaveCount(0);
  await popup.getByLabel('Studio background', { exact:true }).check();
  await popup.getByRole('button', { name: 'Match Studio', exact:true }).click();
  await popup.keyboard.press('Escape');
  await expect(popup.getByRole('region', { name:'Floating timer appearance options' })).toHaveCount(0);
  await popup.locator('body').click({ position:{x:180,y:110} });
  await popup.keyboard.press('Space');
  await expect(popup.getByRole('button', { name:'Resume focus timer' })).toBeVisible();
  await popup.keyboard.press('Space');
  await expect(popup.getByRole('button', { name:'Pause focus timer' })).toBeVisible();
  await studio.getByRole('button', { name: 'Close customization panel' }).click();
  await studio.getByRole('button', { name: 'Room', exact:true }).click();
  await studio.getByRole('button', { name: 'Use Dolomite Dawn background', exact:true }).click();
  await expect(popup.locator('.pip-container')).toHaveAttribute('data-pip-background', 'dolomite-dawn');
  await popup.screenshot({ path:'screenshots/studio-floating-timer.png' });
});
