import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const out = path.join(tmpdir(), 'flowtask-ecosystem-ui-2026-10-25');
await mkdir(out, {recursive:true});
const browser = await chromium.launch({channel:'chrome',headless:true});
const refs = [
  ['sunsama','https://www.sunsama.com/'],
  ['akiflow','https://akiflow.com/'],
  ['tiimo','https://www.tiimoapp.com/'],
  ['goblin','https://goblin.tools/Todo'],
  ['things','https://culturedcode.com/things/features/'],
  ['toby','https://www.gettoby.com/'],
  ['mynoise','https://mynoise.net/NoiseMachines/whiteNoiseGenerator.php'],
  ['capacities','https://capacities.io/'],
];
const results = await Promise.all(refs.map(async ([name,url])=> {
 const page=await browser.newPage({viewport:{width:1440,height:1200},reducedMotion:'reduce'});
 try {
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForTimeout(2500);
  const finalUrl=page.url();
  const title=await page.title();
  const images=await page.locator('img').evaluateAll(imgs=>imgs.map(i=>({alt:i.alt,src:i.currentSrc,width:i.naturalWidth,height:i.naturalHeight})).filter(i=>i.width>=700).slice(0,8));
  // Inspect the vendor's published product image when the consent overlay covers it.
  const asset = name === 'tiimo' ? images.find(i=>i.alt.startsWith('Tiimo app interface')) : undefined;
  if (asset) await page.goto(asset.src,{waitUntil:'load',timeout:30000});
  const screenshot=path.join(out,`${name}.png`);
  await page.screenshot({path:screenshot,timeout:15000});
  return {name,url,finalUrl,screenshot,title,images,...(asset?{inspectedAsset:asset.src}:{}),note:name==='mynoise'?'Initial capture may still show audio loading; playback not evaluated.':undefined};
 }catch(error){return {name,url,error:String(error)};}finally{await page.close();}
}));
await browser.close();
await writeFile(new URL('./evidence/public-inspection.json',import.meta.url),JSON.stringify({capturedAt:new Date().toISOString(),method:'Public unauthenticated vendor pages; no app account; screenshots temporary, not republished.',results},null,2));
console.log(JSON.stringify(results.map(({images: _images,...r})=>r)));
