import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';

// A reproducible local lab, kept separate from consent-based field Web Vitals.
// Event Timing here measures a short scripted capture journey, not field INP.
assert.equal(Number(process.versions.node.split('.')[0]), 22, 'Use Node 22 for release measurements.');
const origin = 'http://127.0.0.1:5192';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '5192', '--strictPort'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
for (const stream of [server.stdout, server.stderr]) stream.on('data', chunk => { output = (output + chunk.toString()).slice(-4000); });
let browser;
const samples = [];
const p75 = values => [...values].sort((a, b) => a - b)[Math.ceil(values.length * .75) - 1];
try {
  let ready = false;
  for (let i = 0; i < 150; i++) {
    if (server.exitCode !== null) throw new Error(`Preview failed to start: ${output}`);
    try { if ((await fetch(origin, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch { /* booting */ }
    await delay(100);
  }
  assert(ready, 'Performance preview did not become ready.');
  browser = await chromium.launch(process.env.CI ? {} : { channel: 'chrome' });
  for (const device of ['desktop', 'mobile']) {
    for (const route of ['/', '/app']) {
      for (let run = 1; run <= 3; run++) {
        const context = await browser.newContext({ viewport: device === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: device === 'mobile', hasTouch: device === 'mobile', serviceWorkers: 'block' });
        try {
          await context.addInitScript(() => {
            localStorage.setItem('flowtask_onboarding_completed', 'true');
            const metrics = window.__flowtaskLab = { lcp: 0, cls: 0, interaction: 0, slowestEvent: null };
            const keys = [];
            document.addEventListener('keydown', event => keys.push({ at: performance.now(), kind: event.key === 'Enter' ? 'submit' : 'typing', target: event.target?.tagName }));
            new PerformanceObserver(list => { for (const entry of list.getEntries()) metrics.lcp = entry.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
            new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) metrics.cls += entry.value; }).observe({ type: 'layout-shift', buffered: true });
            new PerformanceObserver(list => { for (const entry of list.getEntries()) if (entry.interactionId && entry.duration > metrics.interaction) {
              metrics.interaction = entry.duration;
              const key = keys.find(key => Math.abs(key.at - entry.processingStart) < 5);
              metrics.slowestEvent = { type: entry.name, phase: key?.kind, target: key?.target, sinceNavigationMs: entry.startTime, inputDelayMs: entry.processingStart - entry.startTime, handlerMs: entry.processingEnd - entry.processingStart };
            } }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
          });
          const page = await context.newPage();
          const cdp = await context.newCDPSession(page);
          await cdp.send('Network.enable');
          await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: 1_600_000, uploadThroughput: 750_000 });
          await cdp.send('Emulation.setCPUThrottlingRate', { rate: device === 'mobile' ? 4 : 1 });
          await page.goto(origin + route);
          await page.getByRole('heading', { name: route === '/' ? /Plan your day/ : 'Today.', exact: route !== '/' }).waitFor();
          await page.evaluate(() => document.fonts.ready);
          await delay(1000);
          if (route === '/app') {
            const capture = page.getByRole('textbox', { name: 'Add a task to this list' });
            await capture.click();
            await capture.pressSequentially('Performance verification task', { delay: 20 });
            const profileCapture = process.env.FLOWTASK_PROFILE_CAPTURE === 'true' && device === 'desktop' && run === 1;
            if (profileCapture) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.start'); }
            await capture.press('Enter');
            await page.getByRole('button', { name: 'Performance verification task', exact: true }).waitFor();
            await delay(250);
            if (profileCapture) {
              const { profile } = await cdp.send('Profiler.stop');
              await mkdir('test-results-lab-performance', { recursive: true });
              await writeFile('test-results-lab-performance/capture.cpuprofile', JSON.stringify(profile));
            }
          }
          const metrics = await page.evaluate(() => window.__flowtaskLab);
          samples.push({ device, route, run, ...metrics });
        } finally { await context.close(); }
      }
    }
  }
  const summary = ['desktop', 'mobile'].flatMap(device => ['/', '/app'].map(route => {
    const matching = samples.filter(sample => sample.device === device && sample.route === route);
    return { device, route, lcpP75Ms: p75(matching.map(s => s.lcp)), clsP75: p75(matching.map(s => s.cls)), captureInteractionP75Ms: route === '/app' ? p75(matching.map(s => s.interaction)) : null };
  }));
  const report = { measuredAt: new Date().toISOString(), conditions: 'Three cold-profile Chromium runs per route/device; service workers blocked; local preview; 40ms latency, 1.6MB/s download, 750KB/s upload; mobile CPU 4x slowdown. Scripted capture Event Timing is a lab guard, not field INP. No authentication or cloud latency included.', summary, samples };
  await mkdir('test-results-lab-performance', { recursive: true });
  await writeFile('test-results-lab-performance/report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  for (const sample of summary) {
    assert(sample.lcpP75Ms > 0 && sample.lcpP75Ms <= 2500, `${sample.device} ${sample.route}: LCP lab budget exceeded.`);
    assert(sample.clsP75 <= .1, `${sample.device} ${sample.route}: CLS lab budget exceeded.`);
    assert(sample.captureInteractionP75Ms === null || sample.captureInteractionP75Ms <= 200, `${sample.device}: capture interaction lab budget exceeded.`);
  }
} finally {
  await browser?.close();
  server.kill();
}
