import {test,expect} from '@playwright/test';
test('production PWA restores tasks, timer and the selected starter media while offline',async({page,context,browserName})=>{
  test.skip(!process.env.FLOWTASK_E2E_URL,'Run against npm run preview so the service worker is enabled.');
  test.fixme(browserName==='webkit' && process.platform==='win32','WebKit offline emulation rejects service-worker navigation: https://github.com/microsoft/playwright/issues/42775. Verify physical Safari separately.');
  await page.addInitScript(()=>{localStorage.setItem('flowtask_onboarding_completed','true');
    const OriginalAudio=window.Audio;const tracked:HTMLAudioElement[]=[];(window as any).__testMedia=tracked;
    window.Audio=function(src?:string){const audio=new OriginalAudio(src);tracked.push(audio);return audio;} as typeof Audio;
  });await page.goto('/app');await page.locator('main#main-content').waitFor();
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload();await page.locator('main#main-content').waitFor();
  await page.getByRole('button',{name:'Focus',exact:true}).click();let s=page.getByRole('dialog',{name:'Focus Studio',exact:true});await s.waitFor();
  await s.getByRole('button',{name:'Session',exact:true}).click();await s.getByRole('button',{name:'Download starter pack',exact:true}).click();await expect(s.getByText('Your starter pack is available offline.')).toBeVisible({timeout:45000});
  await s.getByRole('button',{name:'Close customization panel'}).click();await s.getByRole('button',{name:'Room',exact:true}).click();await s.getByRole('button',{name:'Use Misty Pines background',exact:true}).click();await s.getByRole('button',{name:'Close customization panel'}).click();await s.getByRole('button',{name:'Sound',exact:true}).click();await s.getByRole('button',{name:'Gentle rain',exact:true}).click();await s.getByRole('button',{name:'Close customization panel'}).click();await s.getByRole('button',{name:'Start focus',exact:true}).click();
  await expect(s.getByRole('button',{name:'Pause',exact:true})).toBeVisible();await page.waitForTimeout(1200);await context.setOffline(true);await page.reload();await page.locator('main#main-content').waitFor();await page.getByRole('button',{name:'Focus',exact:true}).click();s=page.getByRole('dialog',{name:'Focus Studio',exact:true});await s.waitFor();
  await expect(s.getByRole('button',{name:'Pause',exact:true})).toBeVisible();expect(await s.locator('.studio-backdrop img').evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
  await s.getByRole('button',{name:'Pause',exact:true}).click();await s.getByRole('button',{name:'Resume',exact:true}).click();await expect(s.getByRole('button',{name:'Pause',exact:true})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>(window as any).__testMedia.some((audio:HTMLAudioElement)=>!audio.paused && audio.readyState>=2 && audio.currentTime>0)),{timeout:10000}).toBe(true);
});
