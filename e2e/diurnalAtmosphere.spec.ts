import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { THEMES, THEME_IDS } from '../src/utils/themeRegistry';

async function open(page: Page) {
  await page.addInitScript(() => localStorage.setItem('flowtask_onboarding_completed', 'true'));
  await page.goto('/app');
  await page.locator('main#main-content').waitFor();
  await page.keyboard.press('Control+,');
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  await page.getByRole('button', { name: 'All', exact: true }).click();
}
async function colors(page: Page) {
  return page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return Object.fromEntries(['--bg-main','--bg-surface-l1','--bg-surface-l2','--bg-surface-l3','--bg-surface-l4','--text-primary','--text-secondary','--text-muted','--color-brand','--border-strong','--text-on-brand'].map(key => [key,style.getPropertyValue(key).trim()]));
  });
}
test('all bundled themes change rendered workspace, controls and preview consistently', async ({ page }) => {
  test.setTimeout(180000);
  await open(page);
  for (const id of THEME_IDS) {
    const button = page.getByRole('button', { name: `Apply ${THEMES[id].label} theme`, exact: true });
    await button.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', id);
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    const actual = await colors(page);
    for (const [key,value] of Object.entries(actual)) expect(value, `${id}: ${key}`).toBe(THEMES[id].tokens[key]);
    await expect.poll(() => page.locator('.flowtask-workspace').evaluate(el => getComputedStyle(el).backgroundColor)).toBe(`rgb(${[1,3,5].map(i => parseInt(actual['--bg-main'].slice(i,i+2),16)).join(', ')})`);
    const rendered = await page.evaluate(id => {
      const css = (element: Element | null, property: 'backgroundColor' | 'color') => element ? getComputedStyle(element)[property] : null;
      return {
        canvas: css(document.querySelector('.flowtask-workspace'),'backgroundColor'),
        sidebar: css(document.querySelector('aside[aria-label="Desktop navigation"]'),'backgroundColor'),
        input: css(document.querySelector('.appearance-panel select'),'backgroundColor'),
        preview: css(document.querySelector(`[data-theme-card="${id}"] .theme-preview`),'backgroundColor'),
        previewCard: css(document.querySelector(`[data-theme-card="${id}"] .theme-preview-row`),'backgroundColor'),
        selected: css(document.querySelector(`[data-theme-card="${id}"] .theme-preview-row.selected`),'backgroundColor'),
        foreground: css(document.querySelector(`[data-theme-card="${id}"] .theme-preview-bottom b`),'color'),
      };
    }, id);
    const rgb = (hex: string) => `rgb(${[1,3,5].map(i => parseInt(hex.slice(i,i+2),16)).join(', ')})`;
    expect(rendered.canvas).toBe(rgb(actual['--bg-main']));
    expect(rendered.sidebar).toBe(rgb(actual['--bg-surface-l1']));
    expect(rendered.input).toBe(rgb(actual['--bg-surface-l2']));
    expect(rendered.preview).toBe(rendered.canvas);
    expect(rendered.previewCard).toBe(rgb(actual['--bg-surface-l2']));
    expect(rendered.selected).toBe(rgb(actual['--bg-surface-l4']));
    expect(rendered.foreground).toBe(rgb(actual['--text-on-brand']));
    const scan = await new AxeBuilder({page}).include('[role="dialog"]').analyze();
    expect(scan.violations.filter(v => ['serious','critical'].includes(v.impact || '')), `${id}: ${JSON.stringify(scan.violations)}`).toEqual([]);
  }
});
test('theme undo, custom accent reset, optional glow, high contrast and offline reload persist', async ({ page, context }) => {
  await open(page);
  await page.getByRole('button', { name: 'Apply Forest Matcha theme', exact: true }).click();
  await page.getByLabel('Accent color', { exact: true }).fill('#ff00ff');
  const custom = (await colors(page))['--color-brand'];
  await page.getByRole('button', { name: 'Apply Northern Aurora theme', exact: true }).click();
  expect((await colors(page))['--color-brand']).toBe(THEMES.aurora.tokens['--color-brand']);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'matcha');
  expect((await colors(page))['--color-brand']).toBe(custom);
  await page.getByRole('button', { name: 'Apply Oceanic Abyss theme', exact: true }).click();
  await page.getByLabel('Atmosphere color').selectOption('aurora');
  await page.getByRole('slider', { name: 'Glow intensity' }).fill('0.8');
  await expect(page.locator('html')).toHaveAttribute('data-theme','abyss');
  await expect.poll(() => page.locator('.workspace-aurora').evaluate(el => getComputedStyle(el).opacity)).toBe('0.8');
  await page.getByRole('slider', { name: 'Glow intensity' }).fill('0');
  await expect.poll(() => page.locator('.workspace-aurora').evaluate(el => getComputedStyle(el).opacity)).toBe('0');
  await page.getByRole('slider', { name: 'Glow intensity' }).fill('0.8');
  await page.getByLabel('Increase contrast', {exact:true}).check();
  await expect.poll(() => page.locator('.workspace-aurora').evaluate(el => getComputedStyle(el).opacity)).toBe('0');
  await page.getByLabel('Increase contrast', {exact:true}).uncheck();
  await page.keyboard.press('Escape');
  await page.reload(); await page.locator('main#main-content').waitFor();
  await expect(page.locator('html')).toHaveAttribute('data-theme','abyss');
  // A production service worker must be controlling the page before offline reload.
  if (process.env.FLOWTASK_PRODUCTION === 'true') {
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true); await page.reload(); await page.locator('main#main-content').waitFor();
    await expect(page.locator('html')).toHaveAttribute('data-theme','abyss');
    await context.setOffline(false);
  }
});
test('schedule changes the full palette at a local boundary, manual theme cancels it, system follows device', async ({ page }) => {
  await page.clock.install({ time: new Date(2026,9,17,16,0,0) });
  await open(page);
  await page.getByLabel('Appearance behavior').selectOption('schedule');
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.clock.setSystemTime(new Date(2026,9,17,16,59,59));
  await page.clock.runFor(2100);
  await expect(page.locator('html')).toHaveAttribute('data-theme','desert');
  await page.getByLabel('Dusk theme', {exact:true}).selectOption('mocha');
  await expect(page.locator('html')).toHaveAttribute('data-theme','mocha');
  await page.getByRole('button', { name: 'Apply Northern Aurora theme', exact:true }).click();
  await expect(page.getByLabel('Appearance behavior')).toHaveValue('manual');
  await page.clock.setSystemTime(new Date(2026,9,18,2));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('html')).toHaveAttribute('data-theme','aurora');
  await page.getByLabel('Appearance behavior').selectOption('system');
  await page.emulateMedia({colorScheme:'light'}); await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await page.emulateMedia({colorScheme:'dark'}); await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
});
for (const width of [390,768,1440]) test(`appearance library is accessible at ${width}px with no overflow`, async ({ page }) => {
  await page.setViewportSize({width, height: 1000}); await open(page);
  await page.getByRole('button',{name:'Apply Northern Aurora theme',exact:true}).click();
  const scan = await new AxeBuilder({page}).analyze();
  expect(scan.violations.filter(v => ['serious','critical'].includes(v.impact || ''))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const drawer = page.locator('[data-settings-content]');
  expect(await drawer.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await page.getByRole('button', { name: 'Featured', exact: true }).click();
  await page.getByRole('heading', { name: 'Theme library', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({path:`screenshots/themes-after-settings-${width}.png`});
  await page.keyboard.press('Escape');
  await page.screenshot({path:`screenshots/themes-after-workspace-${width}.png`});
});

test('changing appearance preserves an active task-linked Studio session and media setup', async ({page}) => {
  await page.addInitScript(() => {
    localStorage.setItem('flowtask_onboarding_completed','true');
    const d = new Date(); const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    localStorage.setItem('flowtask_tasks_v1',JSON.stringify([{id:'appearance-focus-task',title:'Keep the same session',nextAction:'Check appearance safely',status:'todo',priority:'p1',projectId:'inbox',subtasks:[],createdAt:Date.now(),plannedDate:today,topThreeDate:today,isPinnedToday:true,estimatedMinutes:25}]));
  });
  await page.goto('/app'); await page.locator('main#main-content').waitFor();
  await page.getByRole('button',{name:/^Focus Studio/}).first().click();
  const studio = page.getByRole('dialog',{name:'Focus Studio',exact:true});
  await studio.getByRole('button',{name:'Room',exact:true}).click();
  await studio.getByRole('button',{name:'Use Misty Pines background',exact:true}).click();
  await studio.getByRole('button',{name:'Close customization panel',exact:true}).click();
  const scene = await studio.locator('.studio-backdrop img').getAttribute('src');
  await studio.getByRole('button',{name:'Start focus',exact:true}).click();
  await studio.getByRole('button',{name:'Back to planner',exact:true}).click();
  await expect(studio).not.toBeVisible();
  await page.keyboard.press('Control+,'); await page.getByRole('button',{name:'Appearance',exact:true}).click();
  await page.getByRole('button',{name:'Apply Northern Aurora theme',exact:true}).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'Pause Focus Session',exact:true})).toBeVisible();
  await page.getByRole('button',{name:/^Focus Studio/}).first().click();
  await expect(studio.getByRole('heading',{name:'Keep the same session',exact:true})).toBeVisible();
  await expect(studio.getByRole('button',{name:'Pause',exact:true})).toBeVisible();
  await expect(studio.locator('.studio-backdrop img')).toHaveAttribute('src', scene!);
});
test('workspace views keep readable surfaces and no overflow across representative themes', async ({page}) => {
  await open(page);
  for (const id of ['solar','mocha','aurora'] as const) {
    await page.getByRole('button',{name:`Apply ${THEMES[id].label} theme`,exact:true}).click();
    await page.keyboard.press('Escape');
    for (const view of ['all','timeline','projects','today']) {
      await page.goto(`/?view=${view}`); await page.locator('main#main-content').waitFor();
      await expect(page.locator('html')).toHaveAttribute('data-theme',id);
      const scan = await new AxeBuilder({page}).analyze();
      expect(scan.violations.filter(v => ['serious','critical'].includes(v.impact || '')),`${id} ${view}: ${JSON.stringify(scan.violations)}`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.keyboard.press('Control+,'); await page.getByRole('button',{name:'Appearance',exact:true}).click();
  }
});

test('the appearance picker opens on its first visit offline after app installation', async ({page,context}) => {
  test.skip(process.env.FLOWTASK_PRODUCTION !== 'true', 'Requires a production service worker');
  await page.addInitScript(() => localStorage.setItem('flowtask_onboarding_completed','true'));
  await page.goto('/app'); await page.locator('main#main-content').waitFor();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true); await page.reload(); await page.locator('main#main-content').waitFor();
  await page.keyboard.press('Control+,'); await page.getByRole('button',{name:'Appearance',exact:true}).click();
  await page.getByRole('button',{name:'All',exact:true}).click();
  await expect(page.locator('[data-theme-card]')).toHaveCount(THEME_IDS.length);
  await page.getByRole('button',{name:'Apply Catppuccin Mocha theme',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','mocha');
  await context.setOffline(false);
});

test('workspace ownership handoff retains appearance and keyboard theme selection works', async ({page,context}) => {
  await open(page);
  const theme = page.getByRole('button',{name:'Apply Catppuccin Mocha theme',exact:true});
  await theme.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme','mocha');
  const second = await context.newPage(); await second.goto('/app');
  await expect(second.getByText('Read-only preview', { exact: false })).toBeVisible();
  await page.close();
  await second.getByRole('button',{name:'Use this tab',exact:true}).click();
  await expect(second.locator('main#main-content')).toBeVisible();
  await expect(second.locator('html')).toHaveAttribute('data-theme','mocha');
  await second.keyboard.press('Control+,'); await second.getByRole('button',{name:'Appearance',exact:true}).click();
  await second.getByRole('button',{name:'Apply Solar Dawn theme',exact:true}).click();
  await second.reload(); await second.locator('main#main-content').waitFor();
  await expect(second.locator('html')).toHaveAttribute('data-theme','solar');
});
