import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import path from 'node:path';

// Official Firestore emulator artifact, pinned with Firebase's published SHA-256.
const version = '1.19.8';
const digest = '9d43599ed6151199e8d604dc87fac51218e49e5f3a48519b1ae560bbe5e3382d';
const directory = path.resolve('node_modules/.cache/flowtask-emulators');
const jar = path.join(directory, `cloud-firestore-emulator-v${version}.jar`);
await mkdir(directory, { recursive: true });
const valid = bytes => createHash('sha256').update(bytes).digest('hex') === digest;
let cached;
try { cached = await readFile(jar); } catch { /* first run */ }
if (!cached || !valid(cached)) {
  console.log(`Downloading official Firestore emulator ${version}…`);
  const response = await fetch(`https://storage.googleapis.com/firebase-preview-drop/emulator/cloud-firestore-emulator-v${version}.jar`, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`Emulator download failed (${response.status}).`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!valid(bytes)) throw new Error('Emulator checksum failed. Refusing to execute the download.');
  await writeFile(`${jar}.download`, bytes);
  await rename(`${jar}.download`, jar);
}
await new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.once('error', () => reject(new Error('Port 8088 is already in use. Stop that emulator before running isolated rules tests.')));
  probe.listen(8088, '127.0.0.1', () => probe.close(resolve));
});
const emulator = spawn(process.env.JAVA_BIN || 'java', ['-Duser.language=en', '-jar', jar, '--host', '127.0.0.1', '--port', '8088', '--project_id', 'demo-flowtask'], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
let startupError;
emulator.on('error', error => { startupError = error; });
const cleanup = () => { if (emulator.exitCode === null) emulator.kill(); };
process.once('SIGINT', cleanup); process.once('SIGTERM', cleanup); process.once('exit', cleanup);
let logs = '';
emulator.stdout.on('data', bytes => { logs = (logs + bytes.toString()).slice(-6000); });
emulator.stderr.on('data', bytes => { logs = (logs + bytes.toString()).slice(-6000); });
try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (startupError) throw startupError;
    if (emulator.exitCode !== null) throw new Error(`Emulator exited before readiness. ${logs}`);
    ready = await new Promise(resolve => {
      const socket = net.connect(8088, '127.0.0.1');
      socket.once('connect', () => { socket.destroy(); resolve(true); });
      socket.once('error', () => { socket.destroy(); resolve(false); });
    });
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error(`Emulator did not become ready. ${logs}`);
  const tests = spawn(process.execPath, ['--test', 'scripts/firestore-rules.test.mjs'], { stdio: 'inherit', windowsHide: true, env: { ...process.env, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8088', GCLOUD_PROJECT: 'demo-flowtask' } });
  const [code] = await once(tests, 'exit');
  process.exitCode = code || 0;
} finally { cleanup(); }
