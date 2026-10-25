import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Public vendor UI references for visual analysis. Images remain in a temporary
// folder; the research links to their official source pages instead of republishing.
const out = path.join(tmpdir(), 'flowtask-public-ui-references-2026-10-25');
await mkdir(out, { recursive: true });
const refs = [
  ['sunsama', 'https://pub-f7ae218077e542729e28e6f8f45a9a40.r2.dev/images/689dccdcc5a4dd323c07127c_Main%20container.svg'],
  ['akiflow', 'https://framerusercontent.com/images/eE3zfnbwzc9vnhCbcsfkdWQG4v8.png?height=1144&width=2384'],
  ['noteplan', 'https://images.prismic.io/noteplan-landing-cms/ZhAAgBrFxhpPBVcN_hero_web.png?auto=format%2Ccompress'],
  ['structured', 'https://structured.app/_next/image?q=75&url=%2Fassets%2Fphone-mockup.webp&w=3840'],
];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
for (const [name, url] of refs) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.screenshot({ path: path.join(out, `${name}.png`) });
    results.push({ name, url, screenshot: path.join(out, `${name}.png`) });
  } catch (error) { results.push({ name, url, error: String(error) }); }
  await page.close();
}
await browser.close();
await writeFile(path.join(out, 'sources.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
