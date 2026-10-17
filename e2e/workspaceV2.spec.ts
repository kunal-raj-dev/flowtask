import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'node:path';

async function seed(page: Page, count = 8, theme = 'light') {
  page.on('pageerror', error => console.log('WORKSPACE PAGE ERROR:',error.message));
  page.on('requestfailed', request => console.log('WORKSPACE LOAD ERROR:',new URL(request.url()).pathname,request.failure()?.errorText));
  await page.addInitScript(({ count, theme }) => {
    localStorage.setItem('flowtask_theme',theme);
    localStorage.setItem('flowtask_onboarding_completed','true');
    const now = new Date(), date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const titles = ['Build the dashboard editing flow','Practice tree traversal patterns','Review the workspace accessibility','Write release notes','Read one chapter','Prepare the next sprint','Refine project outcomes','Plan tomorrow with room to breathe'];
    const tasks = Array.from({length:count},(_,i)=>({id:`workspace-${i}`,title:titles[i]||`Backlog task ${i+1}`,status:'todo',priority:i<3?'p1':'p3',projectId:i%2?'personal':'work',subtasks:[],createdAt:Date.now()+i,plannedDate:date,estimatedMinutes:25+(i%3)*10,...(i<3?{topThreeDate:date,isPinnedToday:true,nextAction:['Start with the resize controls','Solve the first recursive example','Walk through the keyboard flow'][i]}:{}),...(i===3?{scheduledStart:'10:30'}:{})}));
    localStorage.setItem('flowtask_tasks_v1',JSON.stringify(tasks));
  },{count,theme});
  await page.goto('/?view=today');
  await page.getByRole('heading',{name:'Today.',exact:true}).waitFor();
}
async function workspace(page:Page) {
  return page.evaluate(async()=>{
    const db = await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('flowtask_storage_v2');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    return new Promise<any>((resolve,reject)=>{const request=db.transaction('workspaces').objectStore('workspaces').get('local');request.onsuccess=()=>{resolve(request.result);db.close();};request.onerror=()=>{reject(request.error);db.close();};});
  });
}
async function noSeriousA11y(page:Page) {
  const result = await new AxeBuilder({page}).analyze();
  expect(result.violations.filter(v=>v.impact==='critical'||v.impact==='serious').map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,reason:n.failureSummary}))}))).toEqual([]);
}

test('populated desktop desk supports capture, shared task actions, agenda and accessible hierarchy',async({page})=>{
  await page.setViewportSize({width:1440,height:1000}); await seed(page);
  const priorities=page.getByRole('region',{name:'Top 3 Priorities',exact:true});
  await expect(priorities.getByRole('button',{name:'Build the dashboard editing flow',exact:true})).toBeVisible();
  await expect(page.getByRole('region',{name:'Day Agenda',exact:true}).getByRole('button',{name:/Write release notes/})).toBeVisible();
  const input=page.getByRole('textbox',{name:'Add a task to this list',exact:true}); await input.fill('A fresh captured task p2 ~15m'); await input.press('Enter');
  await expect(page.getByRole('button',{name:'A fresh captured task',exact:true})).toBeVisible();
  await noSeriousA11y(page);
  await page.screenshot({path:path.resolve('screenshots/workspace-final-desktop.png'),fullPage:true});
  await page.getByRole('region',{name:"Today's Tasks",exact:true}).getByRole('checkbox',{name:'Mark as complete',exact:true}).first().click();
  await expect.poll(async()=> (await workspace(page)).tasks.filter((t:any)=>t.status==='done').length).toBe(1);
});

test('layout editing isolates task actions, supports accessible moves, undo and save after mobile preview',async({page})=>{
  await page.setViewportSize({width:1440,height:1000}); await seed(page);
  await page.getByRole('button',{name:'Edit workspace',exact:true}).click();
  await expect(page.locator('.widget-body').first()).toHaveAttribute('inert','');
  const before=(await workspace(page)).dashboards[0];
  await page.getByRole('button',{name:'Move Top 3 Priorities later',exact:true}).click();
  await expect(page.getByRole('button',{name:'Undo layout change',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Undo layout change',exact:true}).click();
  await page.getByRole('button',{name:'Remove Continue Study',exact:true}).click();
  await expect(page.locator('[data-widget-type="studyContinuation"]')).toHaveCount(0);
  await page.getByRole('button',{name:'Mobile preview',exact:true}).click();
  await expect.poll(async()=> (await page.locator('[data-dashboard-grid]').boundingBox())!.width).toBeLessThanOrEqual(420);
  await page.getByRole('button',{name:'Save Layout',exact:true}).click();
  await expect.poll(async()=> (await page.locator('[data-dashboard-grid]').boundingBox())!.width).toBeGreaterThan(800);
  await expect.poll(async()=> (await workspace(page)).dashboards[0].widgets.length).toBe(before.widgets.length-1);
  await expect.poll(async()=> (await workspace(page)).tasks.filter((t:any)=>t.status==='done').length).toBe(0);
  await page.reload(); await page.getByRole('heading',{name:'Today.',exact:true}).waitFor();
  await expect(page.locator('[data-widget-type="studyContinuation"]')).toHaveCount(0);
});

test('unfinished layout recovers after navigation without changing the saved dashboard',async({page})=>{
  await seed(page); const count=(await workspace(page)).dashboards[0].widgets.length;
  await page.getByRole('button',{name:'Edit workspace',exact:true}).click();
  await page.getByRole('button',{name:'Remove Continue Study',exact:true}).click();
  await page.getByRole('button',{name:'Inbox',exact:true}).click();
  await page.getByRole('heading',{name:'Inbox',exact:true}).waitFor();
  await page.getByRole('button',{name:/^Today \d/}).click();
  await page.getByRole('button',{name:'Resume Editing',exact:true}).click();
  await expect(page.locator('[data-widget-type="studyContinuation"]')).toHaveCount(0);
  expect((await workspace(page)).dashboards[0].widgets).toHaveLength(count);
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.locator('[data-widget-type="studyContinuation"]')).toHaveCount(1);
});

test('dashboard selection survives reload and deletion has an undo',async({page})=>{
  await seed(page); await page.getByRole('button',{name:'Switch dashboard',exact:true}).click();
  await page.getByRole('dialog',{name:'Your desks',exact:true}).locator('.desk-manager-select').filter({hasText:'Study Desk'}).click();
  await expect(page.getByRole('button',{name:'Switch dashboard',exact:true})).toContainText('Study Desk');
  await page.reload(); await page.getByRole('heading',{name:'Today.',exact:true}).waitFor();
  await expect(page.getByRole('button',{name:'Switch dashboard',exact:true})).toContainText('Study Desk');
  await page.getByRole('button',{name:'Switch dashboard',exact:true}).click();
  await page.getByRole('button',{name:'Delete Study Desk',exact:true}).click();
  await page.getByRole('button',{name:'Undo removal',exact:true}).click();
  await expect.poll(async()=> (await workspace(page)).dashboards.some((d:any)=>d.name==='Study Desk')).toBe(true);
});

test('quick notes flush on immediate navigation and stay shared with the notes panel',async({page})=>{
  await seed(page); const note=page.getByRole('textbox',{name:'Workspace scratchpad',exact:true});
  await note.fill('Keep the resize handle accessible.\nReturn to this after lunch.');
  await page.getByRole('button',{name:'Inbox',exact:true}).click();
  await expect.poll(async()=> (await workspace(page)).preferences.scratchpad).toBe('Keep the resize handle accessible.\nReturn to this after lunch.');
  await page.getByRole('button',{name:'Sticky Scratchpad',exact:true}).click();
  await expect(page.locator('textarea').first()).toHaveValue('Keep the resize handle accessible.\nReturn to this after lunch.');
});

test('task-linked focus still runs after the workspace refresh',async({page})=>{
  await seed(page); await page.getByRole('region',{name:'Top 3 Priorities',exact:true}).getByRole('button',{name:'Focus on Build the dashboard editing flow',exact:true}).click();
  const studio=page.getByRole('dialog',{name:'Focus Studio',exact:true});
  await expect(studio.getByRole('heading',{name:'Build the dashboard editing flow',exact:true})).toBeVisible();
  await studio.getByRole('button',{name:'Start focus',exact:true}).click();
  await studio.getByRole('button',{name:'Back to planner',exact:true}).click();
  await expect(page.getByRole('button',{name:'Pause Focus Session',exact:true})).toBeVisible();
});

for(const width of [360,390,768]) test(`workspace at ${width}px remains readable and supports layout controls`,async({page})=>{
  await page.setViewportSize({width,height:900}); await seed(page);
  await expect(page.getByRole('heading',{name:'Today.',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Edit workspace',exact:true}).click();
  await page.getByRole('button',{name:'Move Top 3 Priorities later',exact:true}).click();
  await page.getByRole('button',{name:'Undo layout change',exact:true}).click();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await noSeriousA11y(page);
  if(width===390) await page.screenshot({path:path.resolve('screenshots/workspace-final-mobile.png'),fullPage:true});
});

test('Study deep link survives refresh',async({page})=>{
  await seed(page); await page.goto('/?view=study'); await expect(page.getByRole('heading',{name:/Study/i}).first()).toBeVisible();
  await page.reload(); await expect(page.getByRole('heading',{name:/Study/i}).first()).toBeVisible(); expect(new URL(page.url()).searchParams.get('view')).toBe('study');
});

test('workspace settings pin a project and view display options survive navigation',async({page})=>{
  await seed(page); await page.getByRole('button',{name:'Preferences and Settings',exact:true}).first().click();
  await page.getByRole('button',{name:'Workspace',exact:true}).click();
  await page.getByRole('checkbox',{name:'Work',exact:true}).check();
  await page.getByRole('button',{name:'Close settings',exact:true}).click();
  await expect(page.getByText('Pinned',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Work 4',exact:true}).last().click();
  await page.getByRole('button',{name:'Display',exact:true}).click();
  await page.getByRole('combobox',{name:'Group by',exact:true}).selectOption('priority');
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  await expect(page.getByRole('heading',{name:/P1/}).first()).toBeVisible();
  await page.reload(); await expect(page.getByRole('heading',{name:/P1/}).first()).toBeVisible();
});

test('dashboard cover, validated export and import use portable built-in assets',async({page})=>{
  await seed(page); await page.getByRole('button',{name:'Switch dashboard',exact:true}).click();
  const cover = page.getByRole('combobox',{name:'Cover for Daily Desk',exact:true});
  await expect(cover.locator('option')).not.toHaveCount(1); await cover.selectOption('misty-pines');
  const downloadEvent=page.waitForEvent('download'); await page.getByRole('button',{name:'Export layout',exact:true}).click();
  const download=await downloadEvent; expect(download.suggestedFilename()).toMatch(/\.json$/);
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  await expect(page.locator('.desk-dashboard-cover')).toBeVisible();
  const dashboard=(await workspace(page)).dashboards[0];
  await page.getByRole('button',{name:'Switch dashboard',exact:true}).click();
  await page.getByRole('button',{name:'Import layout',exact:true}).click();
  await page.getByLabel('Import dashboard file',{exact:true}).setInputFiles({name:'desk.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'flowtask-dashboard',version:1,dashboard:{...dashboard,name:'Imported desk'}}))});
  await expect(page.getByRole('button',{name:'Switch dashboard',exact:true})).toContainText('Imported desk');
  expect((await workspace(page)).tasks).toHaveLength(8);
});

test('large workspace keeps task rendering bounded and keyboard navigation reaches virtual rows',async({page})=>{
  await page.setViewportSize({width:1440,height:1000}); await seed(page,1000);
  await expect(page.locator('[data-task-id]')).not.toHaveCount(1000);
  expect(await page.locator('[data-task-id]').count()).toBeLessThan(70);
  await page.getByRole('heading',{name:'Today.',exact:true}).click();
  for(let i=0;i<45;i++) await page.keyboard.press('j');
  await expect(page.locator('[data-keyboard-focused="true"]')).toBeVisible();
  await page.getByRole('button',{name:'Edit workspace',exact:true}).click();
  for(const name of ['Projects','Recent Activity','Weekly Workload','Resources','Quiet Scene & Clock']) {
    await page.getByRole('button',{name:'Add Widget',exact:true}).click();
    const card=page.getByRole('dialog',{name:'Add Widget to Workspace',exact:true}).locator('article').filter({has:page.getByRole('heading',{name,exact:true})});
    await card.getByRole('button',{name:'Add',exact:true}).click();
  }
  await page.getByRole('button',{name:'Save Layout',exact:true}).click();
  await expect(page.locator('[data-widget-id]')).toHaveCount(12);
  expect(await page.locator('[data-task-id]').count()).toBeLessThan(80);
});

test('main sections retain an accessible workspace hierarchy',async({page})=>{
  await page.setViewportSize({width:1440,height:1000}); await seed(page);
  for(const view of ['inbox','projects','timeline','study','review']) {
    await page.goto('/?view='+view); await page.locator('[data-workspace-view="'+view+'"]').waitFor(); await noSeriousA11y(page);
  }
});

for(const theme of ['light','dark','tokyo','nord','matcha','sepia','crimson','cobalt','lavender','rosewater','desert','amoled']) test(`readable workspace in ${theme} theme`,async({page})=>{
  await page.setViewportSize({width:1440,height:1000}); await seed(page,8,theme);
  await expect(page.locator('html')).toHaveAttribute('data-theme',theme); await noSeriousA11y(page);
  if(theme==='dark') await page.screenshot({path:path.resolve('screenshots/workspace-final-dark.png')});
});
