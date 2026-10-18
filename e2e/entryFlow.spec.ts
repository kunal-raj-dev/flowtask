import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function workspaceSnapshot(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve,reject) => { const r=indexedDB.open('flowtask_storage_v2'); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); });
    return new Promise<any>((resolve,reject) => {
      const r=db.transaction('workspaces').objectStore('workspaces').get('local');
      r.onsuccess=()=> { const w=r.result; db.close(); resolve({ tasks:w.tasks.map((t:any)=>({id:t.id,title:t.title,projectId:t.projectId})), dashboards:w.dashboards, theme:w.preferences.appearance?.theme, sessionId:w.preferences.focusSession?.id }); };
      r.onerror=()=> { db.close(); reject(r.error); };
    });
  });
}
async function finishSetup(page: Page, title: string) {
  const setup = page.getByRole('dialog', {name:'Welcome Setup Ritual',exact:true});
  await setup.getByRole('button',{name:'Developer',exact:true}).click();
  await setup.getByRole('button',{name:'Set Up My Daily Capacity',exact:true}).click();
  await setup.getByRole('button',{name:'Continue to Top 3 Focus',exact:true}).click();
  await setup.getByPlaceholder('Most important deliverable or deep focus task...').fill(title);
  await setup.getByRole('button',{name:/Continue|Review|Lock/i}).last().click();
  await setup.getByRole('button',{name:'Enter Flow State & Launch Today',exact:true}).click();
}
test('root landing continues to real setup, creates a task and starts Focus Studio', async ({page}) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:/Plan your day/})).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('flowtask_onboarding_completed'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('flowtask_tasks_v1'))).toBeNull();
  await page.getByRole('link',{name:'Continue to workspace',exact:true}).click();
  await expect(page).toHaveURL(/\/app$/);
  await finishSetup(page, 'My first real focus task');
  const studio = page.getByRole('dialog',{name:'Focus Studio',exact:true});
  await expect(studio.getByRole('heading',{name:'My first real focus task',exact:true})).toBeVisible();
  await studio.getByRole('button',{name:'Start focus',exact:true}).click();
  await expect(studio.getByRole('button',{name:'Pause',exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});
test('returning through landing preserves tasks, theme, desk and active session', async ({page}) => {
  await page.goto('/'); await page.getByRole('link',{name:'Continue to workspace',exact:true}).click();
  await finishSetup(page, 'Continue my existing work');
  let studio = page.getByRole('dialog',{name:'Focus Studio',exact:true});
  await studio.getByRole('button',{name:'Start focus',exact:true}).click();
  await studio.getByRole('button',{name:'Back to planner',exact:true}).click();
  await expect(studio).not.toBeVisible();
  await page.keyboard.press('Control+,'); await page.getByRole('button',{name:'Appearance',exact:true}).click();
  await page.getByRole('button',{name:'Apply Northern Aurora theme',exact:true}).click();
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await workspaceSnapshot(page)).theme).toBe('aurora');
  const before = await workspaceSnapshot(page);
  const titleBefore = await page.getByRole('heading',{name:'Today.',exact:true}).textContent();
  await page.goto('/'); await expect(page.getByRole('heading',{name:/Plan your day/})).toBeVisible();
  await page.getByRole('link',{name:'Continue to workspace',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Welcome Setup Ritual',exact:true})).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-theme','aurora');
  await expect(page.getByRole('heading',{name:'Today.',exact:true})).toHaveText(titleBefore!);
  await expect(page.getByRole('button',{name:'Pause Focus Session',exact:true})).toBeVisible();
  const after = await workspaceSnapshot(page);
  expect(after.tasks).toEqual(before.tasks);
  expect(after.dashboards).toEqual(before.dashboards);
  expect(after.sessionId).toBe(before.sessionId);
  await page.getByRole('button',{name:'Focus',exact:true}).click();
  studio = page.getByRole('dialog',{name:'Focus Studio',exact:true});
  await expect(studio.getByRole('heading',{name:'Continue my existing work',exact:true})).toBeVisible();
  await expect(studio.getByRole('button',{name:'Pause',exact:true})).toBeVisible();
});
test('legacy views and Quick Add shortcuts bypass marketing and consume capture once', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('flowtask_onboarding_completed','true'));
  await page.goto('/?view=inbox'); await page.locator('main#main-content').waitFor();
  await expect(page.getByRole('heading',{name:'Inbox',exact:true})).toBeVisible();
  await page.goto('/?view=inbox&action=quickadd');
  await expect(page.getByRole('dialog',{name:/Quick Capture/})).toBeVisible();
  await expect(page).toHaveURL(/\/app\?view=inbox$/);
  await page.keyboard.press('Escape'); await page.reload();
  await page.locator('main#main-content').waitFor();
  await expect(page.getByRole('dialog',{name:/Quick Capture/})).toHaveCount(0);
  await page.goto('/app/?view=today'); await page.locator('main#main-content').waitFor();
});
test('Quick Add waits for onboarding and the automatically opened Focus Studio to close', async ({page}) => {
  await page.goto('/app?action=quickadd');
  await expect(page.getByRole('dialog',{name:'Welcome Setup Ritual',exact:true})).toBeVisible();
  await expect(page.getByRole('dialog',{name:/Quick Capture/})).toHaveCount(0);
  await finishSetup(page, 'Set up before capturing');
  const studio = page.getByRole('dialog',{name:'Focus Studio',exact:true});
  await expect(studio).toBeVisible();
  await expect(page.getByRole('dialog',{name:/Quick Capture/})).toHaveCount(0);
  await studio.getByRole('button',{name:'Back to planner',exact:true}).click();
  await expect(page.getByRole('dialog',{name:/Quick Capture/})).toBeVisible();
  await expect(page).toHaveURL(/\/app$/);
});
test('landing alias, refresh and Back retain the marketing-to-workspace boundary', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('flowtask_onboarding_completed','true'));
  await page.goto('/welcome'); await page.getByRole('link',{name:'Continue to workspace',exact:true}).click();
  await page.locator('main#main-content').waitFor(); await page.reload(); await page.locator('main#main-content').waitFor();
  await page.goBack(); await expect(page.getByRole('heading',{name:/Plan your day/})).toBeVisible();
  await page.goto('/index.html'); await expect(page.getByRole('heading',{name:/Plan your day/})).toBeVisible();
});
for (const width of [390,768,1440]) test(`landing and Continue are accessible at ${width}px`, async ({page}) => {
  await page.setViewportSize({width,height:1000}); await page.goto('/');
  await expect(page.getByRole('link',{name:'Continue to workspace',exact:true})).toBeVisible();
  const scan = await new AxeBuilder({page}).analyze();
  expect(scan.violations.filter(v => ['serious','critical'].includes(v.impact || ''))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:`screenshots/entry-landing-${width}.png`});
});
test('installed landing and the saved workspace remain usable offline', async ({page,context,browserName}) => {
  test.skip(process.env.FLOWTASK_PRODUCTION !== 'true','Requires production service worker');
  test.fixme(browserName === 'webkit' && process.platform === 'win32','Windows WebKit offline service-worker navigation needs physical Safari verification.');
  await page.addInitScript(() => localStorage.setItem('flowtask_onboarding_completed','true'));
  await page.goto('/app'); await page.locator('main#main-content').waitFor();
  const input = page.getByRole('textbox',{name:'Add a task to this list'});
  await input.fill('My offline entry task'); await input.press('Enter');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true); await page.goto('/');
  await expect(page.getByRole('heading',{name:/Plan your day/})).toBeVisible();
  await page.getByRole('link',{name:'Continue to workspace',exact:true}).click();
  await page.locator('main#main-content').waitFor();
  await expect(page.getByRole('button',{name:'My offline entry task',exact:true})).toBeVisible();
  await context.setOffline(false);
});

test('root capture and snapshot links remain workspace URLs after consumption and refresh', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('flowtask_onboarding_completed','true'));
  await page.goto('/?action=quickadd');
  await expect(page.getByRole('dialog',{name:'Quick Capture',exact:true})).toBeVisible();
  await expect(page).toHaveURL(/\/app$/); await page.keyboard.press('Escape');
  await page.reload(); await page.locator('main#main-content').waitFor();
  const snapshot = Buffer.from(JSON.stringify({v:1,title:'Legacy shared work',exportedAt:Date.now(),tasks:[{title:'A task from a legacy snapshot',priority:'p2'}]})).toString('base64');
  await page.goto('/#snapshot=' + snapshot);
  await expect(page.getByRole('heading',{name:'Shared Task Snapshot: "Legacy shared work"',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Import 1 Tasks',exact:true}).click();
  await expect(page).toHaveURL(/\/app$/); await page.reload(); await page.locator('main#main-content').waitFor();
  await page.goto('/app?view=all');
  await expect(page.getByRole('button',{name:'A task from a legacy snapshot',exact:true})).toBeVisible();
});

test('Continue honors the saved start view, explicit deep links win, and dashboard launches Today', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('flowtask_onboarding_completed','true'));
  await page.goto('/app'); await page.locator('main#main-content').waitFor();
  await page.keyboard.press('Control+,');
  await page.getByRole('button',{name:'Workspace',exact:true}).click();
  await page.getByRole('combobox',{name:'Default Start View',exact:true}).selectOption('inbox');
  await page.getByRole('button',{name:'Launch Configured Workspace',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Inbox',exact:true})).toBeVisible();
  await page.goto('/'); await page.getByRole('link',{name:'Continue to workspace',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Inbox',exact:true})).toBeVisible();
  await page.goto('/app?view=timeline');
  await expect(page.locator('[data-workspace-view="timeline"]')).toBeVisible();
  await page.keyboard.press('Control+,');
  await page.getByRole('button',{name:'Workspace',exact:true}).click();
  await page.getByRole('combobox',{name:'Default Start View',exact:true}).selectOption('dashboard');
  await page.getByRole('button',{name:'Launch Configured Workspace',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Today.',exact:true})).toBeVisible();
});
