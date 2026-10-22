import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDiagnosticsHandler } from '../api/diagnostics.mjs';
import worker from '../workers/calendar-proxy.js';
import { deploymentOrigin } from '../server/deployment-origin.mjs';

test('preview APIs use only the exact platform-provided origin', async () => {
  const env = { VERCEL_ENV: 'preview', VERCEL_URL: 'flowtask-staging-example.vercel.app', APP_ORIGIN: 'https://production.test' };
  assert.equal(deploymentOrigin(env), 'https://flowtask-staging-example.vercel.app');
  const res = response();
  await createDiagnosticsHandler({ origin: deploymentOrigin(env), enabled: true, limit: async () => true })({ method: 'POST', headers: { origin: 'https://other-preview.vercel.app' }, body }, res);
  assert.equal(res.code, 403);
});
test('invalid preview configuration fails closed and production retains its configured origin', () => {
  assert.equal(deploymentOrigin({ VERCEL_ENV: 'production', VERCEL_URL: 'ignored.vercel.app', APP_ORIGIN: 'https://flowtask.test' }), 'https://flowtask.test');
  for (const value of ['evil.test', 'https://flow.vercel.app', 'flow.vercel.app/path', 'flow.vercel.app@evil.test', '']) {
    assert.equal(deploymentOrigin({ VERCEL_ENV: 'preview', VERCEL_URL: value, APP_ORIGIN: 'https://flowtask.test' }), null);
  }
  assert.equal(deploymentOrigin({ APP_ORIGIN: 'https://flowtask.test/path' }), null);
});

const response = () => ({ code: 0, body: null, headers: {}, setHeader(key,value) { this.headers[key]=value; }, status(code) { this.code=code; return this; }, json(body) { this.body=body; return this; } });
const body = { metric: 'INP', value: 120, build: 'dpl_G8YajPLuhYBZ4X4yiJrCZyQm21oR', view: 'today', device: 'mobile' };
test('monitoring accepts only consent-safe numeric envelopes and never logs request identity', async () => {
  const logs=[]; const handler=createDiagnosticsHandler({ origin:'https://flow.test',enabled:true,limit:async()=>true,log:entry=>logs.push(entry) });
  const res=response(); await handler({method:'POST',headers:{origin:'https://flow.test','x-forwarded-for':'192.0.2.1'},body},res);
  assert.equal(res.code,202); assert.equal(logs.length,1); assert(!JSON.stringify(logs).includes('192.0.2.1'));
  for(const extra of [{taskTitle:'private'}, {url:'https://calendar.google.com/private'}, {stack:'sensitive'}, {userId:'account'}]) {
    const rejected=response(); await handler({method:'POST',headers:{origin:'https://flow.test'},body:{...body,...extra}},rejected); assert.equal(rejected.code,400);
  }
  assert.equal(logs.length,1);
});
test('monitoring rejects wrong origins, invalid numbers, disabled service and quota exhaustion', async () => {
  for (const [options,request,code] of [
    [{enabled:false},{headers:{origin:'https://flow.test'},body},503],
    [{enabled:true},{headers:{origin:'https://evil.test'},body},403],
    [{enabled:true},{headers:{origin:'https://flow.test'},body:{...body,value:Infinity}},400],
    [{enabled:true,limit:async()=>false},{headers:{origin:'https://flow.test'},body},429],
  ]) { const res=response(); await createDiagnosticsHandler({origin:'https://flow.test',limit:async()=>true,...options})({method:'POST',...request},res); assert.equal(res.code,code); }
});
test('extension has no wildcard content-script broadcast and requires explicit exact-origin permission', () => {
  const manifest=JSON.parse(readFileSync('extension/manifest.json','utf8'));
  assert.equal(manifest.content_scripts,undefined);
  const source=readFileSync('extension/popup.js','utf8');
  assert(!source.includes("includes('vercel.app')"));
  assert(source.includes('chrome.permissions.request'));
  assert(source.includes('new URL(tab.url).origin !== state.flowtask_origin'));
  assert(!readFileSync('extension/content.js','utf8').includes("postMessage(message, '*')"));
});
test('calendar proxy fails closed without its production rate limiter and returns 429 when limited', async () => {
  const request=()=>new Request('https://proxy.test',{method:'POST',headers:{Origin:'https://flow.test'},body:JSON.stringify({url:'https://calendar.google.com/feed'})});
  assert.equal((await worker.fetch(request(),{ALLOWED_ORIGINS:'https://flow.test'})).status,503);
  assert.equal((await worker.fetch(request(),{ALLOWED_ORIGINS:'https://flow.test',CALENDAR_RATE_LIMITER:{limit:async()=>({success:false})}})).status,429);
});
test('production CSP excludes eval and inline scripts while preserving required auth endpoints', () => {
  const config=JSON.parse(readFileSync('vercel.json','utf8'));
  const csp=config.headers.flatMap(rule=>rule.headers).find(header=>header.key==='Content-Security-Policy').value;
  const scripts=csp.split(';').find(part=>part.trim().startsWith('script-src'));
  assert(!scripts.includes('unsafe-eval')); assert(!scripts.includes('unsafe-inline')); assert(scripts.includes('firebaseapp.com'));
});
