import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { chromium, expect } from '@playwright/test';

// Explicitly opt in: this runner creates and deletes only its own disposable users.
// It cannot target production, and it never records traces, tokens or passwords.
const project = 'flowtask-kunal-staging';
const linked = JSON.parse(fs.readFileSync('.vercel/project.json', 'utf8'));
assert.equal(linked.projectName, 'flowtask-staging');
if (fs.existsSync('.env.staging.local')) process.loadEnvFile('.env.staging.local');
assert.equal(process.env.VITE_FIREBASE_PROJECT_ID, project, 'Only the isolated staging Firebase project is allowed.');
const url = new URL(process.env.FLOWTASK_STAGING_URL || '');
assert.equal(url.protocol, 'https:');
assert.match(url.hostname, /^flowtask-staging-[a-z0-9]+-[a-z0-9-]+\.vercel\.app$/);
const apiKey = process.env.VITE_FIREBASE_API_KEY;
assert(apiKey);
const vercelToken = process.env.VERCEL_TOKEN || JSON.parse(fs.readFileSync(path.join(process.env.APPDATA, 'com.vercel.cli/Data/auth.json'), 'utf8')).token;
async function vercel(endpoint, options = {}) {
  const response = await fetch(`https://api.vercel.com${endpoint}${endpoint.includes('?') ? '&' : '?'}teamId=${linked.orgId}`, { ...options, headers: { Authorization: `Bearer ${vercelToken}`, 'Content-Type': 'application/json' } });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const detail = String(error.error?.message || error.error?.code || '').replaceAll(vercelToken, '[redacted]').replace(/[a-f0-9]{32,}/gi, '[redacted]');
    throw new Error(`Staging management request failed (${response.status}): ${detail}`);
  }
  return response.json();
}
const deployment = await vercel(`/v13/deployments/${url.hostname}`);
assert.equal(deployment.projectId, linked.projectId);
assert.equal(deployment.name, 'flowtask-staging');
assert.notEqual(deployment.target, 'production', 'Cloud verification requires a Preview, not the bootstrap deployment.');
assert.equal(deployment.readyState, 'READY');
const hosted = await vercel(`/v9/projects/${linked.projectId}`);
assert.equal(hosted.ssoProtection?.deploymentType, 'all_except_custom_domains');
assert.equal(hosted.nodeVersion, '22.x');
const publicResponse = await fetch(url, { redirect: 'manual' });
assert([401, 302, 307].includes(publicResponse.status), 'The candidate must remain protected from unauthenticated visitors.');
const existingAccess = Object.entries(hosted.protectionBypass || {}).find(([, metadata]) => metadata.note === 'Temporary FlowTask cloud acceptance runner');
const bypass = existingAccess?.[0] || randomBytes(16).toString('hex');
if (!existingAccess) {
  const accessConfiguration = await vercel(`/v1/projects/${linked.projectId}/protection-bypass`, { method: 'PATCH', body: JSON.stringify({ generate: { secret: bypass, note: 'Temporary FlowTask cloud acceptance runner' } }) });
  assert(Object.hasOwn(accessConfiguration.protectionBypass || {}, bypass), 'The automation access secret was not configured.');
}

const checks = [];
const fixtures = [];
const contexts = [];
const browserWarnings = [];
const attestationResponses = [];
let browser;
const output = 'test-results-staging-cloud';
fs.mkdirSync(output, { recursive: true });
const check = (name, evidence = {}) => { checks.push({ name, ...evidence }); console.log(`PASS ${name}`); };
async function identity(method, body) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${method}?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert(response.ok, `Disposable staging authentication failed (${response.status}).`);
  return response.json();
}
async function createAccount(label) {
  const password = randomBytes(24).toString('base64url');
  const email = `flowtask-acceptance-${label}-${randomBytes(8).toString('hex')}@example.invalid`;
  const result = await identity('signUp', { email, password, returnSecureToken: true });
  assert.equal(JSON.parse(Buffer.from(result.idToken.split('.')[1], 'base64url')).aud, project);
  const fixture = { ...result, password, email };
  fixtures.push(fixture);
  fs.writeFileSync(`${output}/fixture-ledger.json`, JSON.stringify({ project, users: fixtures.map(item => item.localId) }));
  return fixture;
}
async function device() {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } });
  context.setDefaultTimeout(15000);
  context.setDefaultNavigationTimeout(30000);
  contexts.push(context);
  // Scope the automation header to this deployment only. Global extraHTTPHeaders
  // would also send it to Firebase/Google; cookie-only access is not portable.
  await context.route(`${url.origin}/**`, route => route.continue({ headers: { ...route.request().headers(), 'x-vercel-protection-bypass': bypass } }));
  let access;
  for (const delay of [0, 1000, 3000, 6000, 12000]) {
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    access = await context.request.get(`${url.origin}/app`, { maxRedirects: 0, headers: { 'x-vercel-protection-bypass': bypass } });
    if (access.status() === 200) break;
  }
  assert.equal(access.status(), 200, 'Protected Preview access could not be established.');
  const cookieSetup = await context.request.get(`${url.origin}/app`, { maxRedirects: 0, headers: { 'x-vercel-protection-bypass': bypass, 'x-vercel-set-bypass-cookie': 'true' } });
  const cookies = await context.cookies(url.origin);
  fs.writeFileSync(`${output}/protection-session.json`, JSON.stringify({ status: cookieSetup.status(), setCookie: Boolean(cookieSetup.headers()['set-cookie']), cookies: cookies.map(item => ({ name: item.name, domain: item.domain, path: item.path, secure: item.secure })) }, null, 2));
  const health = await context.request.get(`${url.origin}/api/health`, { maxRedirects: 0, headers: { 'x-vercel-protection-bypass': bypass } });
  if (health.status() !== 200) fs.writeFileSync(`${output}/health-failure.txt`, `HTTP ${health.status()}\n${(await health.text()).slice(0, 1000)}`);
  await context.addInitScript(({ origin }) => {
    if (location.origin !== origin) return;
    localStorage.setItem('flowtask_onboarding_completed', 'true');
    localStorage.setItem('flowtask_backup_last_reminder', String(Date.now()));
  }, { origin: url.origin });
  const page = await context.newPage();
  const errors = [];
  const navigationResponses = [];
  const protectionRedirects = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    const content = message.text();
    if (['warning', 'error'].includes(message.type())) browserWarnings.push(content.replaceAll(apiKey, '[public-key]').slice(0, 1800));
    // Chromium may block an asset redirect at the CSP layer before Playwright
    // emits its redirect response. Accept only a reported Vercel SSO destination
    // whose embedded original URL belongs to this exact protected Preview.
    if (message.type() === 'error' && content.includes('Content Security Policy')) {
      const blocked = content.match(/https:\/\/vercel\.com\/sso-api\?[^\s'"]+/)?.[0];
      if (blocked) {
        const destination = new URL(blocked);
        const source = destination.searchParams.get('url');
        if (source && URL.canParse(source)) {
          const original = new URL(source);
          if (original.origin === url.origin) protectionRedirects.push({ path: original.pathname, kind: 'csp-blocked-sso' });
        }
      }
    }
  });
  page.on('response', response => {
    const address = new URL(response.url());
    if (response.request().isNavigationRequest()) navigationResponses.push({ host: address.hostname, path: address.pathname, status: response.status() });
    const redirect = response.headers().location;
    if (address.origin === url.origin && [302, 307].includes(response.status()) && redirect) {
      const destination = new URL(redirect, address);
      if (destination.origin === 'https://vercel.com' && destination.pathname === '/sso-api') protectionRedirects.push({ path: address.pathname, status: response.status() });
    }
    if (['firebaseappcheck.googleapis.com', 'content-firebaseappcheck.googleapis.com'].includes(address.hostname) && address.pathname.endsWith(':exchangeRecaptchaEnterpriseToken')) attestationResponses.push(response.status());
  });
  let navigation;
  // A new automation secret can be accepted by the API request's edge before
  // the browser's page/assets edges recognize it. Retry only observed Vercel
  // SSO redirects; ordinary application startup failures still fail the run.
  try {
    const delays = [0, 2000, 5000, 10000, 20000, 30000];
    for (const [attempt, delay] of delays.entries()) {
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      const redirectsBefore = protectionRedirects.length;
      navigation = await page.goto(`${url.origin}/app`, { waitUntil: 'domcontentloaded' });
      const destination = new URL(page.url());
      const atVercelLogin = destination.hostname === 'vercel.com' && ['/login', '/sso-api'].includes(destination.pathname);
      if (!atVercelLogin) {
        try {
          const input = page.getByRole('textbox', { name: 'Add a task to this list' });
          await expect.poll(async () => protectionRedirects.length > redirectsBefore || await input.isVisible(), { timeout: 30000 }).toBe(true);
          if (protectionRedirects.length === redirectsBefore) break;
        } catch (error) {
          if (protectionRedirects.length === redirectsBefore || attempt === delays.length - 1) throw error;
        }
      }
      assert(attempt < delays.length - 1, 'Temporary staging access did not reach the browser edge within the bounded startup window.');
      console.log('Waiting for temporary staging access to reach the browser page/assets.');
    }
  }
  catch (error) {
    await page.screenshot({ path: `${output}/startup-failure.png` });
    fs.writeFileSync(`${output}/startup-failure.json`, JSON.stringify({ status: navigation?.status(), path: new URL(page.url()).pathname, navigationResponses, protectionRedirects, errors, visibleText: (await page.locator('body').innerText()).slice(0, 6000) }, null, 2));
    throw error;
  }
  return { context, page };
}
async function authenticate(page, fixture) {
  // Seed the official SDK's persisted session with a genuine staging ID/refresh
  // token. This bypasses no backend validation and adds no test login to the app.
  const account = {
    uid: fixture.localId, email: fixture.email, emailVerified: false, isAnonymous: false,
    providerData: [{ providerId: 'password', uid: fixture.email, displayName: null, email: fixture.email, phoneNumber: null, photoURL: null }],
    stsTokenManager: { refreshToken: fixture.refreshToken, accessToken: fixture.idToken, expirationTime: Date.now() + Number(fixture.expiresIn) * 1000 },
    createdAt: String(Date.now()), lastLoginAt: String(Date.now()), apiKey, appName: '[DEFAULT]',
  };
  await page.evaluate(async ({ account, apiKey }) => {
    const key = `firebase:authUser:${apiKey}:[DEFAULT]`;
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('firebaseLocalStorageDb', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('firebaseLocalStorage', { keyPath: 'fbase_key' });
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction('firebaseLocalStorage', 'readwrite');
      tx.objectStore('firebaseLocalStorage').put({ fbase_key: key, value: account });
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    });
    db.close(); localStorage.setItem(key, JSON.stringify(account));
    localStorage.setItem('flowtask_cloud_connected', 'true');
  }, { account, apiKey });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: new RegExp(`User Account: ${fixture.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) })).toBeVisible({ timeout: 30000 });
}
async function read(page, id) {
  return page.evaluate(async workspaceId => {
    const db = await new Promise((resolve, reject) => { const request = indexedDB.open('flowtask_storage_v2'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    return new Promise((resolve, reject) => {
      const request = db.transaction('workspaces').objectStore('workspaces').get(workspaceId);
      request.onsuccess = () => { db.close(); resolve(request.result || null); }; request.onerror = () => { db.close(); reject(request.error); };
    });
  }, id);
}
async function settled(page, fixture) {
  await expect.poll(async () => (await read(page, fixture.localId))?.pending.length, { timeout: 45000 }).toBe(0);
  await expect(page.locator('.product-status-text')).toHaveText('Synced', { timeout: 45000 });
}
async function capture(page, title) {
  const input = page.getByRole('textbox', { name: 'Add a task to this list' });
  await input.fill(title); await input.press('Enter');
  await expect(page.getByRole('button', { name: title, exact: true })).toBeVisible();
}
async function renameTask(page, before, after) {
  await page.getByRole('button', { name: before, exact: true }).click();
  const title = page.getByRole('textbox', { name: 'Task title', exact: true });
  await title.fill(after); await title.press('Enter');
  await page.getByRole('button', { name: 'Close task details', exact: true }).click();
  await expect(page.getByRole('button', { name: after, exact: true })).toBeVisible();
}
async function remoteTasks(fixture) {
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/users/${fixture.localId}/tasks`, { headers: { Authorization: `Bearer ${fixture.idToken}` } });
  assert(response.ok, `Staging account read failed (${response.status}).`);
  return (await response.json()).documents || [];
}

try {
  browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome', headless: true });
  const first = await device();
  const health = await first.context.request.get(`${url.origin}/api/health`, { maxRedirects: 0, headers: { 'x-vercel-protection-bypass': bypass } });
  assert.equal(health.status(), 200);
  assert.equal((await health.json()).build, deployment.id);
  const pageResponse = await first.context.request.get(url.origin, { maxRedirects: 0, headers: { 'x-vercel-protection-bypass': bypass } });
  const csp = pageResponse.headers()['content-security-policy'];
  const scripts = csp?.match(/script-src ([^;]+)/)?.[1];
  assert(scripts && !scripts.includes('unsafe-inline') && !scripts.includes('unsafe-eval'));
  check('protected Preview, deployed identity, server configuration and tightened CSP');
  const a = await createAccount('a'), b = await createAccount('b');

  await capture(first.page, 'Device-only draft');
  console.log('Checking explicit device import with a genuine staging account.');
  await authenticate(first.page, a);
  assert.equal((await remoteTasks(a)).length, 0, 'The new staging account must be readable before import.');
  const prompt = first.page.getByRole('dialog', { name: 'Bring your device tasks into this account?' });
  await expect(prompt).toBeVisible({ timeout: 45000 });
  await expect(prompt.getByText(a.email, { exact: true })).toBeVisible();
  await prompt.getByRole('button', { name: 'Keep separate', exact: true }).click();
  await settled(first.page, a);
  assert.equal((await remoteTasks(a)).length, 0);
  assert.equal((await read(first.page, 'local')).tasks.length, 1);
  check('device import is explicit, correctly addressed, and declining preserves local data');

  await capture(first.page, 'Shared cloud task');
  await settled(first.page, a);
  await expect.poll(async () => (await remoteTasks(a)).length).toBe(1);
  const second = await device();
  await authenticate(second.page, a);
  await settled(second.page, a);
  await expect(second.page.getByRole('button', { name: 'Shared cloud task', exact: true })).toBeVisible({ timeout: 30000 });
  check('a second independent device hydrates the real account workspace');

  await first.context.setOffline(true);
  await capture(first.page, 'Offline queued task');
  await expect.poll(async () => (await read(first.page, a.localId)).pending.length).toBeGreaterThan(0);
  await capture(second.page, 'Other device task'); await settled(second.page, a);
  await first.context.setOffline(false);
  await settled(first.page, a);
  await expect.poll(async () => (await remoteTasks(a)).length, { timeout: 45000 }).toBe(3);
  await first.page.reload({ waitUntil: 'domcontentloaded' }); await settled(first.page, a);
  assert.equal((await remoteTasks(a)).filter(doc => doc.fields.title.stringValue === 'Offline queued task').length, 1);
  await expect(second.page.getByRole('button', { name: 'Offline queued task', exact: true })).toBeVisible({ timeout: 30000 });
  check('offline delivery survives reconnect/reload exactly once alongside unrelated device edits');

  await first.context.setOffline(true);
  await renameTask(first.page, 'Shared cloud task', 'Device conflict version');
  await expect.poll(async () => (await read(first.page, a.localId)).pending.length).toBeGreaterThan(0);
  await renameTask(second.page, 'Shared cloud task', 'Account conflict version'); await settled(second.page, a);
  await first.context.setOffline(false);
  await expect(first.page.getByRole('button', { name: 'Review changes', exact: true })).toBeVisible({ timeout: 45000 });
  await first.page.getByRole('button', { name: 'Review changes', exact: true }).click();
  const review = first.page.getByRole('dialog', { name: 'Review device and account changes' });
  await expect(review).toContainText('Device conflict version'); await expect(review).toContainText('Account conflict version');
  await review.getByRole('button', { name: 'Use account changes', exact: true }).click();
  await settled(first.page, a);
  await expect(first.page.getByRole('button', { name: 'Account conflict version', exact: true })).toBeVisible();
  const preserved = await first.page.evaluate(id => JSON.parse(localStorage.getItem(`flowtask_conflict_backup_${id}`) || 'null'), a.localId);
  assert(preserved.local.tasks.some(task => task.title === 'Device conflict version'));
  assert(preserved.remote.tasks.some(task => task.title === 'Account conflict version'));
  assert.equal((await remoteTasks(a)).length, 3);
  await renameTask(first.page, 'Account conflict version', 'Shared cloud task'); await settled(first.page, a);
  check('same-record conflict review preserves both versions before an explicit account choice');

  await authenticate(first.page, b);
  await expect(prompt).toBeVisible({ timeout: 45000 });
  await expect(prompt.getByText(b.email, { exact: true })).toBeVisible();
  await prompt.getByRole('button', { name: 'Keep separate', exact: true }).click();
  await settled(first.page, b);
  assert.equal((await remoteTasks(b)).length, 0);
  await expect(first.page.getByRole('button', { name: 'Shared cloud task', exact: true })).toHaveCount(0);
  await capture(first.page, 'Account B private task'); await settled(first.page, b);
  assert.equal((await remoteTasks(a)).length, 3);
  await authenticate(first.page, a); await settled(first.page, a);
  await expect(prompt).toHaveCount(0);
  await expect(first.page.getByRole('button', { name: 'Account B private task', exact: true })).toHaveCount(0);
  check('local/A/B switching and repeated login preserve account boundaries and import choice');

  await first.page.getByRole('button', { name: /User Account:/ }).click();
  await first.page.getByRole('button', { name: 'Import device workspace', exact: true }).click();
  await expect(prompt).toBeVisible();
  await prompt.getByRole('button', { name: 'Import device tasks', exact: true }).click();
  await settled(first.page, a);
  await expect.poll(async () => (await remoteTasks(a)).length).toBe(4);
  await first.page.getByRole('button', { name: /User Account:/ }).click();
  await first.page.getByRole('button', { name: 'Import device workspace', exact: true }).click();
  await prompt.getByRole('button', { name: 'Import device tasks', exact: true }).click();
  await settled(first.page, a);
  assert.equal((await remoteTasks(a)).length, 4);
  check('approved device import is repeatable without duplicate records');

  const denied = await fetch(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/users/${a.localId}/tasks`, { headers: { Authorization: `Bearer ${b.idToken}` } });
  assert.equal(denied.status, 403);
  check('deployed rules reject cross-account reads');

  await first.page.getByRole('button', { name: /^Focus Studio/ }).first().click();
  const studio = first.page.getByRole('dialog', { name: 'Focus Studio', exact: true });
  await studio.getByRole('button', { name: 'Start focus', exact: true }).click();
  await studio.getByRole('button', { name: 'Back to planner', exact: true }).click();
  await first.page.getByRole('button', { name: 'Pause Focus Session', exact: true }).click();
  await first.page.reload({ waitUntil: 'domcontentloaded' });
  await first.page.getByRole('button', { name: /^Focus Studio/ }).first().click();
  await studio.getByRole('button', { name: 'Resume', exact: true }).click();
  await new Promise(resolve => setTimeout(resolve, 1200));
  await studio.getByRole('button', { name: 'Finish session', exact: true }).click();
  await expect(studio.getByRole('heading', { name: 'That was time well spent.' })).toBeVisible();
  await settled(first.page, a);
  await expect.poll(async () => (await read(second.page, a.localId)).preferences.focusLogs?.length, { timeout: 30000 }).toBe(1);
  await studio.getByRole('button', { name: 'Back to planner', exact: true }).click();
  await first.page.reload({ waitUntil: 'domcontentloaded' }); await settled(first.page, a);
  assert.equal((await read(first.page, a.localId)).preferences.focusLogs.length, 1);
  check('focus survives minimize/pause/reload and sends one completion log to the other device');

  await first.page.screenshot({ path: `${output}/cloud-today-desktop.png` });
  await first.page.setViewportSize({ width: 390, height: 844 });
  await expect(first.page.getByRole('textbox', { name: 'Add a task to this list' })).toBeVisible();
  await first.page.screenshot({ path: `${output}/cloud-today-mobile.png` });
  assert(attestationResponses.includes(200), 'A real App Check token exchange must succeed before this candidate passes cloud acceptance.');
  check('real App Check token exchange succeeds with hosted CSP and enforcement disabled');
} catch (error) {
  checks.push({ name: 'cloud acceptance', failed: true, reason: error.message });
  console.error(error.message);
  fs.writeFileSync(`${output}/browser-warnings.json`, JSON.stringify(browserWarnings, null, 2));
  for (const [index, context] of contexts.entries()) {
    const page = context.pages()[0];
    if (!page || new URL(page.url()).origin !== url.origin) continue;
    await page.screenshot({ path: `${output}/failure-device-${index}.png` }).catch(() => {});
    fs.writeFileSync(`${output}/failure-device-${index}.json`, JSON.stringify({ visibleText: (await page.locator('body').innerText()).slice(0, 10000), accounts: await Promise.all(fixtures.map(async item => ({ id: item.localId, record: await read(page, item.localId) }))) }, null, 2));
  }
} finally {
  for (const context of contexts) await context.setOffline(false).catch(() => {});
  const cleanupContext = contexts[0];
  for (const fixture of fixtures) {
    try {
      const refreshed = await identity('signInWithPassword', { email: fixture.email, password: fixture.password, returnSecureToken: true });
      const response = await cleanupContext.request.post(`${url.origin}/api/account/delete`, { maxRedirects: 0, headers: { 'x-vercel-protection-bypass': bypass, Origin: url.origin, Authorization: `Bearer ${refreshed.idToken}` }, data: { confirmation: 'DELETE' } });
      if (response.status() !== 200) console.error(`Deletion response: ${(await response.text()).slice(0, 800)}`);
      assert.equal(response.status(), 200, 'Disposable account deletion failed.');
      const lookup = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: refreshed.idToken }) });
      assert.equal(lookup.status, 400, 'Deleted staging user remains accessible.');
      const deniedWrite = await fetch(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/users/${fixture.localId}/tasks/deleted-token-probe`, { method: 'PATCH', headers: { Authorization: `Bearer ${refreshed.idToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { title: { stringValue: 'Must remain denied' } } }) });
      assert.equal(deniedWrite.status, 403, 'The pre-deletion ID token must not recreate account data.');
      check('disposable account deletion removes authentication and locks old tokens');
    } catch (error) {
      checks.push({ name: 'disposable account cleanup', failed: true });
      console.error(error.message);
    }
  }
  for (const context of contexts) await context.close().catch(() => {});
  await browser?.close();
  // Keep the managed secret for a failed-run retry, avoiding edge propagation
  // races caused by rotating protection configuration on every diagnostic run.
  if (!checks.some(item => item.failed)) {
    const protection = await vercel(`/v9/projects/${linked.projectId}`);
    for (const [secret, metadata] of Object.entries(protection.protectionBypass || {})) {
      if (metadata.note === 'Temporary FlowTask cloud acceptance runner') await vercel(`/v1/projects/${linked.projectId}/protection-bypass`, { method: 'PATCH', body: JSON.stringify({ revoke: { secret, regenerate: false } }) });
    }
  }
  fs.writeFileSync(`${output}/summary.json`, JSON.stringify({ project, url: url.origin, deployment: deployment.id, checks, appCheckExchangeStatuses: attestationResponses, exclusions: ['Real Google provider interaction', 'physical devices', 'App Check enforcement', 'field Web Vitals', 'screen readers', 'monitored beta'], recordedCredentials: false }, null, 2));
  if (!checks.some(item => item.failed)) {
    const verified = `${output}/verified/${deployment.id}`;
    fs.mkdirSync(verified, { recursive: true });
    for (const filename of ['summary.json', 'cloud-today-desktop.png', 'cloud-today-mobile.png']) fs.copyFileSync(`${output}/${filename}`, `${verified}/${filename}`);
  }
  assert(!checks.some(item => item.failed), 'Cloud acceptance failed; inspect the sanitized summary and cleanup checks.');
}
