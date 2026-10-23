import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'node:path';

async function seed(page:Page){
  await page.addInitScript(()=>{
    localStorage.setItem('flowtask_onboarding_completed','true');
    const d=new Date(); const today=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    localStorage.setItem('flowtask_tasks_v1',JSON.stringify([{id:'flow-test',title:'Explain binary search',nextAction:'Write the loop invariant',status:'todo',priority:'p1',projectId:'inbox',subtasks:[],createdAt:Date.now(),plannedDate:today,topThreeDate:today,isPinnedToday:true,estimatedMinutes:50}]));
  }); await page.goto('/app'); await page.locator('main#main-content').waitFor();
}
async function open(page:Page){const studioEntry=page.getByRole('button',{name:/^Focus Studio/}).first(); const launcher=page.getByRole('button',{name:'Launch Focus Mode',exact:true}); if(await studioEntry.isVisible()) await studioEntry.click(); else await launcher.click();await page.getByRole('dialog',{name:'Focus Studio',exact:true}).waitFor();}
test('task-linked session survives minimize, pause and reload without duplicate history',async({page})=>{
  await seed(page);await open(page);const studio=page.getByRole('dialog',{name:'Focus Studio',exact:true});
  await expect(studio.getByRole('heading',{name:'Explain binary search'})).toBeVisible();await expect(studio.getByText('Next step · Write the loop invariant')).toBeVisible();
  await studio.getByRole('button',{name:'Start focus',exact:true}).click();await expect(studio.getByRole('button',{name:'Pause',exact:true})).toBeVisible();
  await studio.getByRole('button',{name:'Back to planner'}).click();await page.getByRole('button',{name:'Pause Focus Session',exact:true}).click();
  await page.reload();await page.locator('main#main-content').waitFor();await open(page);await expect(studio.getByRole('button',{name:'Resume',exact:true})).toBeVisible();
  await studio.getByRole('button',{name:'Resume',exact:true}).click();await page.waitForTimeout(1100);await studio.getByRole('button',{name:'Finish session',exact:true}).click();
  await expect(studio.getByRole('heading',{name:'That was time well spent.'})).toBeVisible();
  await expect.poll(async()=>page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('flowtask_storage_v2');r.onsuccess=()=>resolve(r.result);});return new Promise(resolve=>{const r=db.transaction('workspaces').objectStore('workspaces').get('local');r.onsuccess=()=>{db.close();resolve(r.result?.preferences.focusLogs?.length || 0);};});})).toBe(1);
  const result=await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('flowtask_storage_v2');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});return await new Promise<any>(resolve=>{const r=db.transaction('workspaces').objectStore('workspaces').get('local');r.onsuccess=()=>resolve(r.result);});});
  expect(result.preferences.focusLogs).toHaveLength(1);expect(result.preferences.focusLogs[0].phase).toBe('focus');expect(result.tasks[0].timeSpentMinutes).toBeGreaterThan(0);
});
test('backgrounds, four-layer limit, recipes and accessible desktop Studio',async({page})=>{
  await seed(page);await open(page);const s=page.getByRole('dialog',{name:'Focus Studio',exact:true});
  await s.getByRole('button',{name:'Room',exact:true}).click();await expect(s.getByRole('button',{name:/^Use .+ background$/})).toHaveCount(57);
  await s.getByRole('button',{name:'Use Rainy Desk background',exact:true}).click();await s.getByRole('button',{name:'Close customization panel'}).click();
  await s.getByRole('button',{name:'Sound',exact:true}).click();for(const name of ['Brown noise','Gentle rain','Distant thunder','Forest air']) await s.getByRole('button',{name,exact:true}).click();
  await s.getByRole('button',{name:'Morning birds',exact:true}).click();await expect(s.getByText(/up to four ambient layers/)).toBeVisible();await s.getByRole('button',{name:'Dismiss message',exact:true}).click();
  await s.getByRole('button',{name:'Close customization panel'}).click();
  const scan=await new AxeBuilder({page}).include('.focus-studio').withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();expect(scan.violations.filter(v=>['critical','serious'].includes(v.impact||''))).toEqual([]);
  await page.screenshot({path:path.join('screenshots','flowtask-v2-studio.png'),fullPage:true});
});
test('mobile Studio keeps controls accessible and captures a thought as a task',async({page})=>{
  await page.setViewportSize({width:390,height:844});await seed(page);await open(page);const s=page.getByRole('dialog',{name:'Focus Studio',exact:true});
  await s.getByRole('button',{name:'Notes',exact:true}).click();await s.getByRole('textbox',{name:'Focus scratchpad'}).fill('Review the off-by-one example');
  await s.getByRole('button',{name:'Capture selection as a task'}).click();await expect(s.getByText('Thought captured in your Inbox.')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await s.getByRole('button',{name:'Close customization panel'}).click();await page.screenshot({path:path.join('screenshots','flowtask-v2-mobile.png'),fullPage:true});
});
test('welcome page and every new theme can be reached',async({page})=>{
  await page.goto('/welcome');await expect(page.getByRole('heading',{name:/Plan your day/})).toBeVisible();
  await page.screenshot({path:path.join('screenshots','flowtask-v2-welcome.png'),fullPage:true});
  const scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();expect(scan.violations.filter(v=>['critical','serious'].includes(v.impact||''))).toEqual([]);
  await seed(page);await page.keyboard.press('Control+,');await page.getByRole('button',{name:'Appearance',exact:true}).click();
  await page.getByRole('button',{name:'All',exact:true}).click();
  for(const [name,id] of [['Lavender Dusk','lavender'],['Rosewater','rosewater'],['Desert Sand','desert'],['AMOLED Black','amoled']]){await page.getByRole('button',{name:new RegExp(name)}).click();await expect(page.locator('html')).toHaveAttribute('data-theme',id);}
});
test('break completion after sleep logs exactly once and never adds task work',async({page})=>{
  await seed(page);await open(page);const s=page.getByRole('dialog',{name:'Focus Studio',exact:true});
  await s.getByRole('button',{name:'Short break',exact:true}).click();await s.getByRole('button',{name:'Session',exact:true}).click();await s.getByRole('spinbutton',{name:'Short break minutes',exact:true}).fill('1');await s.getByRole('button',{name:'Close customization panel'}).click();
  await page.clock.install();await s.getByRole('button',{name:'Start break',exact:true}).click();await page.clock.fastForward(65000);
  await expect(s.getByRole('heading',{name:'That was time well spent.'})).toBeVisible();await page.clock.fastForward(5000);
  await expect.poll(async()=>page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('flowtask_storage_v2');r.onsuccess=()=>resolve(r.result);});return new Promise(resolve=>{const r=db.transaction('workspaces').objectStore('workspaces').get('local');r.onsuccess=()=>{db.close();resolve(r.result?.preferences.focusLogs?.length || 0);};});})).toBe(1);
  const result=await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('flowtask_storage_v2');r.onsuccess=()=>resolve(r.result);});return await new Promise<any>(resolve=>{const r=db.transaction('workspaces').objectStore('workspaces').get('local');r.onsuccess=()=>resolve(r.result);});});
  expect(result.preferences.focusLogs).toHaveLength(1);expect(result.preferences.focusLogs[0]).toMatchObject({seconds:60,phase:'short_break',outcome:'completed'});expect(result.tasks[0].timeSpentMinutes||0).toBe(0);
});
test('a second tab waits for the workspace owner and cannot duplicate playback',async({page,context})=>{
  await seed(page);await open(page);await page.getByRole('button',{name:'Start focus',exact:true}).click();
  const second=await context.newPage();await second.goto('/app');await expect(second.getByText('Read-only preview', { exact: false })).toBeVisible();await page.close();await second.getByRole('button',{name:'Use this tab',exact:true}).click();
  await expect(second.locator('main#main-content')).toBeVisible();await expect(second.getByRole('button',{name:'Pause Focus Session',exact:true})).toBeVisible();
});
test('a saved recipe can be edited and started from the lobby in two actions',async({page})=>{
  await seed(page);await open(page);const s=page.getByRole('dialog',{name:'Focus Studio',exact:true});
  await s.getByRole('button',{name:'Your recipes',exact:true}).click();await s.getByRole('textbox',{name:'Recipe name',exact:true}).fill('Sunday session');await s.getByRole('button',{name:'Save current setup',exact:true}).click();
  await s.getByRole('button',{name:'Close customization panel'}).click();await s.getByRole('button',{name:'Session',exact:true}).click();await s.getByRole('spinbutton',{name:'Focus minutes',exact:true}).fill('50');await s.getByRole('button',{name:'Close customization panel'}).click();
  await s.getByRole('button',{name:'Your recipes',exact:true}).click();await s.getByRole('button',{name:'Update selected recipe',exact:true}).click();await s.getByRole('button',{name:'Back to planner'}).click();
  await expect(s).not.toBeVisible();
  await open(page);await s.getByRole('button',{name:/^Sunday session /}).click();await s.getByRole('button',{name:'Start focus',exact:true}).click();
  await expect(s.getByRole('button',{name:'Pause',exact:true})).toBeVisible();await expect(s.locator('.studio-session-label')).toContainText('50 minutes');await expect(s.getByRole('heading',{name:'Explain binary search'})).toBeVisible();
});
